#!/usr/bin/env node
/**
 * Playwright campaign worker — processes ready apply_queue items via the local HTTP bridge.
 * Spawned from Electron main (utilityProcess). Requires: npm install playwright (in desktop/).
 */

import fs from "node:fs";
import path from "node:path";

const BRIDGE_URL = (process.env.JOB_MCP_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const TOKEN = process.env.JOB_MCP_HTTP_TOKEN || "";
const DATA_DIR = process.env.JOB_MCP_DATA_DIR || "";
const PROFILE_DIR =
  process.env.JOB_MCP_BROWSER_PROFILE ||
  (DATA_DIR ? path.join(DATA_DIR, "playwright-profile") : path.join(process.cwd(), "data", "playwright-profile"));
const HEADLESS = process.env.JOB_MCP_PLAYWRIGHT_HEADLESS !== "0";

function log(msg) {
  const line = `[campaign-worker] ${msg}`;
  console.log(line);
  process.stdout.write("");
}

async function bridgeCall(name, args = {}) {
  const res = await fetch(`${BRIDGE_URL}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ name, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `${name} failed (${res.status})`);
  return data;
}

function captureFieldsInPage() {
  const SENSITIVE =
    /salary|compensation|authorized|authorised|visa|sponsor|gender|race|ethnic|disability|consent|agree|ssn|national|criminal/i;
  const SKIP_TYPES = new Set(["hidden", "password", "submit", "button", "image", "file", "reset"]);

  function labelFor(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
    }
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
    const wrap = el.closest("label");
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    return "";
  }

  const sel = "input, textarea, select";
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const type = (el.type || el.tagName.toLowerCase()).toLowerCase();
    if (SKIP_TYPES.has(type)) continue;
    const name = el.name || el.id || "";
    if (!name && !el.placeholder) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    out.push({
      name,
      label: labelFor(el),
      type,
    });
  }
  return out;
}

function applyMappingInPage(payload) {
  const SKIP_TYPES = new Set(["hidden", "password", "submit", "button", "image", "reset"]);
  const PAUSE_PATTERN =
    /captcha|recaptcha|hcaptcha|two.?factor|2fa|verify you are human|sign in to continue/i;

  function findControl(name) {
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
    return (
      document.querySelector(`[name="${esc}"]`) ||
      document.querySelector(`#${esc}`) ||
      document.querySelector(`[id="${esc}"]`)
    );
  }

  function setValue(el, value) {
    if (!el || value == null) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (tag === "textarea" || tag === "input") {
      const type = (el.type || "text").toLowerCase();
      if (SKIP_TYPES.has(type) || type === "file") return false;
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  const bodyText = (document.body && document.body.innerText) || "";
  if (PAUSE_PATTERN.test(bodyText)) {
    return { ok: false, paused: true, reason: "CAPTCHA, login, or verification detected" };
  }

  const mapping = payload.mapping || [];
  let filled = 0;
  for (const row of mapping) {
    if (!row.value || row.requires_user_review) continue;
    const el = findControl(row.field);
    if (el && setValue(el, row.value)) filled += 1;
  }

  let submitted = false;
  if (payload.submit && payload.adapter && payload.adapter.submit_selectors) {
    for (const sel of payload.adapter.submit_selectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) {
        btn.click();
        submitted = true;
        break;
      }
    }
  }
  return { ok: true, filled, submitted };
}

async function clickApplyLink(page, adapter) {
  if (!adapter?.apply_link_selectors?.length) return;
  const clicked = await page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el instanceof HTMLElement) {
        el.click();
        return true;
      }
    }
    return false;
  }, adapter.apply_link_selectors);
  if (clicked) await page.waitForTimeout(1200);
}

async function uploadCvOnPage(page, adapter, cvPath) {
  const selectors = adapter?.file_input_selectors?.length
    ? adapter.file_input_selectors
    : ['input[type="file"]'];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if ((await loc.count()) > 0) {
        await loc.setInputFiles(cvPath);
        return true;
      }
    } catch {
      /* try next selector */
    }
  }
  return false;
}

async function clickNextStep(page, adapter) {
  if (!adapter?.next_selectors?.length) return false;
  return page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el instanceof HTMLElement && !el.disabled) {
        const tag = el.tagName.toLowerCase();
        const type = (el.getAttribute("type") || "").toLowerCase();
        if (type === "submit") continue;
        el.click();
        return true;
      }
    }
    return false;
  }, adapter.next_selectors);
}

async function cvFileForApplication(applicationId) {
  const apps = await bridgeCall("list_applications", {});
  const app = (apps.data || []).find((a) => a.id === applicationId);
  if (!app || app.cv_id == null) return null;
  const cvs = await bridgeCall("list_cvs", {});
  const cv = (cvs.data || []).find((c) => c.id === app.cv_id);
  if (!cv || !cv.source_path) return null;
  const p = cv.source_path;
  return fs.existsSync(p) ? p : null;
}

async function processQueueItem(queueId, context) {
  const run = await bridgeCall("run_auto_apply", { queue_id: queueId });
  const { application_id, url, adapter } = run.data || {};
  if (!url || !application_id) throw new Error(run.summary || "run_auto_apply missing data");

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await clickApplyLink(page, adapter);

    const form_fields = await page.evaluate(captureFieldsInPage);
    const exec = await bridgeCall("execute_autofill", {
      application_id,
      queue_id: queueId,
      url,
      form_fields,
      issue_approval_token: true,
    });

    const mapping = exec.data?.mapping || [];
    const fillResult = await page.evaluate(applyMappingInPage, {
      mapping: mapping.map((m) => ({
        field: m.field,
        value: m.value,
        requires_user_review: m.requires_user_review,
      })),
      submit: false,
      adapter,
    });

    if (fillResult.paused) {
      await bridgeCall("pause_for_human", { queue_id: queueId, reason: fillResult.reason });
      log(`Paused #${queueId}: ${fillResult.reason}`);
      return;
    }

    const cvPath = await cvFileForApplication(application_id);
    if (cvPath) {
      const ok = await uploadCvOnPage(page, adapter, cvPath);
      if (ok) log(`Uploaded CV for queue #${queueId}`);
    }

    for (let step = 0; step < 3; step += 1) {
      const advanced = await clickNextStep(page, adapter);
      if (!advanced) break;
      await page.waitForTimeout(1500);
      const moreFields = await page.evaluate(captureFieldsInPage);
      if (!moreFields.length) continue;
      const more = await bridgeCall("execute_autofill", {
        application_id,
        queue_id: queueId,
        url: page.url(),
        form_fields: moreFields,
        issue_approval_token: false,
      });
      await page.evaluate(applyMappingInPage, {
        mapping: (more.data?.mapping || []).map((m) => ({
          field: m.field,
          value: m.value,
          requires_user_review: m.requires_user_review,
        })),
        submit: false,
        adapter,
      });
    }

    await bridgeCall("report_apply_step", { queue_id: queueId, step: "filled" });

    if (exec.data?.can_auto_submit && exec.data?.approval?.approval_token) {
      await bridgeCall("confirm_apply_attempt", {
        application_id,
        form_fields: mapping.map((m) => ({
          name: m.field,
          label: m.label,
          mapped_to: m.mapped_to,
          value: m.value,
          requires_user_review: m.requires_user_review,
        })),
      });

      const submitResult = await page.evaluate(applyMappingInPage, {
        mapping: [],
        submit: true,
        adapter,
      });

      if (submitResult.submitted) {
        await bridgeCall("confirm_submission", {
          application_id,
          approval_token: exec.data.approval.approval_token,
          confirmation: "playwright-worker",
        });
        await bridgeCall("report_apply_step", { queue_id: queueId, step: "submitted" });
        log(`Submitted queue #${queueId}`);
      } else {
        await bridgeCall("pause_for_human", {
          queue_id: queueId,
          reason: "Submit button not found — complete manually",
        });
      }
    } else {
      await bridgeCall("pause_for_human", {
        queue_id: queueId,
        reason: exec.data?.blocked_fields?.length
          ? "Unresolved fields — review in browser"
          : "Auto-submit not approved — review then submit manually",
      });
    }
  } catch (e) {
    await bridgeCall("report_apply_step", {
      queue_id: queueId,
      step: "failed",
      detail: String(e.message || e),
    }).catch(() => {});
    log(`Failed #${queueId}: ${e.message || e}`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    log("Playwright not installed. In desktop/: npm install playwright && npx playwright install chromium");
    process.exit(1);
  }

  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const defaults = await bridgeCall("get_apply_defaults", {});
  if (!defaults.data?.auto_apply_enabled) {
    log("JOB_MCP_AUTO_APPLY=1 is required on the bridge.");
    process.exit(1);
  }

  const context = await playwright.chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
  });

  try {
    let idleRounds = 0;
    while (idleRounds < 3) {
      const list = await bridgeCall("list_apply_queue", { status: "ready" });
      const items = list.data || [];
      if (!items.length) {
        idleRounds += 1;
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      idleRounds = 0;
      for (const item of items) {
        log(`Processing queue #${item.id} …`);
        await processQueueItem(item.id, context);
      }
    }
    log("No more ready queue items.");
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((e) => {
  log(String(e.message || e));
  process.exit(1);
});