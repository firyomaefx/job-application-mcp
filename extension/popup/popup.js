// Popup logic: capture form fields on the active tab, then ask the local
// Job Application MCP HTTP bridge to preview an autofill mapping.
//
// This extension never submits anything. It only reads field metadata from
// the page and sends it to YOUR local bridge for a preview.

const DEFAULTS = { bridgeUrl: "http://127.0.0.1:8787", token: "" };

const els = {
  capture: document.getElementById("capture"),
  send: document.getElementById("send"),
  copy: document.getElementById("copy"),
  fieldsSection: document.getElementById("fields-section"),
  fieldsList: document.getElementById("fields"),
  count: document.getElementById("count"),
  appId: document.getElementById("application-id"),
  queueId: document.getElementById("queue-id"),
  queueIdRow: document.getElementById("queue-id-row"),
  result: document.getElementById("result"),
  resultJson: document.getElementById("result-json"),
  error: document.getElementById("error"),
  status: document.getElementById("status"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  optionsLink: document.getElementById("options-link"),
  importBtn: document.getElementById("import"),
  jobSection: document.getElementById("job-section"),
  jobTitle: document.getElementById("job-title"),
  jobMeta: document.getElementById("job-meta"),
  jobDesc: document.getElementById("job-desc"),
  analyzeBtn: document.getElementById("analyze"),
  autoApplyBtn: document.getElementById("auto-apply"),
  enqueueBtn: document.getElementById("enqueue"),
  tagline: document.getElementById("tagline"),
  footerHint: document.getElementById("footer-hint"),
};

let capturedFields = [];
let detectedJob = null;
let autoApplyEnabled = false;
let lastExecutePayload = null;

// ── settings ────────────────────────────────────────────────
// L4 fix: the bridge token is a LOCAL secret (it grants /call on the user's
// bridge). Store it in chrome.storage.local, NOT sync (which is synced to the
// user's Chrome account). bridgeUrl is non-secret and stays in sync. On first
// load after upgrade we migrate any token still present in sync to local, then
// clear it from sync.
async function getSettings() {
  const sync = await chrome.storage.sync.get({ bridgeUrl: DEFAULTS.bridgeUrl, token: "" });
  const local = await chrome.storage.local.get({ token: "" });
  let token = local.token || "";
  // one-time migration: move a token stranded in sync into local
  if (!token && sync.token) {
    token = sync.token;
    await chrome.storage.local.set({ token });
    await chrome.storage.sync.remove("token");
  }
  return { bridgeUrl: sync.bridgeUrl, token };
}

// ── errors ──────────────────────────────────────────────────
function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = false;
}
function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

// ── bridge health ───────────────────────────────────────────
async function bridgeCall(name, args) {
  const { bridgeUrl, token } = await getSettings();
  const res = await fetch(`${bridgeUrl}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || data.summary || `HTTP ${res.status}`);
  return data;
}

async function checkBridge() {
  els.status.hidden = false;
  const { bridgeUrl, token } = await getSettings();
  try {
    const res = await fetch(`${bridgeUrl}/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    els.statusDot.className = "dot dot-on";
    els.statusText.textContent = `Bridge: up (${data?.data?.tools?.length ?? "?"} tools)`;
    try {
      const defs = await bridgeCall("get_apply_defaults", {});
      autoApplyEnabled = Boolean(defs?.data?.auto_apply_enabled);
    } catch {
      autoApplyEnabled = false;
    }
    els.autoApplyBtn.hidden = !autoApplyEnabled;
    els.enqueueBtn.hidden = !autoApplyEnabled;
    els.queueIdRow.hidden = !autoApplyEnabled;
    if (autoApplyEnabled) {
      els.tagline.textContent = "Auto-apply mode ON — ATS sites only · you set JOB_MCP_AUTO_APPLY=1";
      els.footerHint.textContent =
        "Auto-apply fills and may click Submit when mapping is approved. LinkedIn/Indeed apply blocked.";
    }
  } catch (e) {
    els.statusDot.className = "dot dot-off";
    els.statusText.textContent = "Bridge: offline — start `npm run serve:http`";
    autoApplyEnabled = false;
    els.autoApplyBtn.hidden = true;
    els.enqueueBtn.hidden = true;
  }
}

// ── capture (injected into the page) ────────────────────────
// This function is serialized by chrome.scripting, so it must not reference
// any outer-scope variables. It returns a plain array of field metadata.
function captureFieldsInPage() {
  const SENSITIVE = /salary|compensation|authorized|authorised|visa|sponsor|gender|race|ethnic|disability|consent|agree|ssn|national|criminal/i;
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
    if (!name && !el.placeholder) continue; // skip anonymous, label-less fields
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue; // skip invisible
    out.push({
      name,
      label: labelFor(el),
      type,
      value: el.value ?? "",
      sensitive: SENSITIVE.test(name) || SENSITIVE.test(labelFor(el)),
    });
  }
  return out;
}

async function captureFields() {
  clearError();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showError("No active tab.");
    return;
  }
  if (/^(chrome|edge|about):/i.test(tab.url ?? "")) {
    showError("Can't capture on browser-internal pages. Open a career site.");
    return;
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureFieldsInPage,
    });
    capturedFields = results?.[0]?.result ?? [];
    renderFields();
  } catch (e) {
    showError(`Capture failed: ${e.message}`);
  }
}

function renderFields() {
  els.fieldsList.innerHTML = "";
  els.count.textContent = String(capturedFields.length);
  if (capturedFields.length === 0) {
    els.fieldsSection.hidden = true;
    showError("No form fields found on this page.");
    return;
  }
  els.fieldsSection.hidden = false;
  for (const f of capturedFields) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.innerHTML = `<span class="fname"></span><br/><span class="flabel"></span>`;
    left.querySelector(".fname").textContent = f.name || "(no name)";
    left.querySelector(".flabel").textContent = f.label || f.type;
    const right = document.createElement("span");
    if (f.sensitive) {
      right.className = "sensitive";
      right.textContent = "sensitive";
    }
    li.append(left, right);
    els.fieldsList.append(li);
  }
}

// ── send to bridge ──────────────────────────────────────────
async function sendToBridge() {
  clearError();
  const appId = Number(els.appId.value);
  if (!appId || appId < 1) {
    showError("Enter a valid Application ID first (from match_cv/save_application).");
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    const tool = autoApplyEnabled ? "execute_autofill" : "autofill_form";
    const args = {
      application_id: appId,
      form_fields: capturedFields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
    };
    if (autoApplyEnabled) {
      args.url = url;
      args.issue_approval_token = true;
    }
    const data = await bridgeCall(tool, args);
    lastExecutePayload = autoApplyEnabled ? data?.data : null;
    els.result.hidden = false;
    els.resultJson.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    showError(`Bridge call failed: ${e.message}`);
  }
}

async function runAutoApplyInTab() {
  clearError();
  if (!autoApplyEnabled) {
    showError("Enable JOB_MCP_AUTO_APPLY=1 on the bridge first.");
    return;
  }
  if (!lastExecutePayload?.can_auto_submit) {
    showError("Run preview/execute_autofill first — mapping must be approved with no blocked fields.");
    return;
  }
  const appId = Number(els.appId.value);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showError("No active tab.");
    return;
  }
  try {
    const payload = {
      mapping: lastExecutePayload.mapping,
      adapter: lastExecutePayload.adapter,
      submit: true,
    };
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/apply-runner.js"],
    });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (p) => {
        if (typeof globalThis.jobMcpApplyInPage === "function") {
          return globalThis.jobMcpApplyInPage(p);
        }
        return { ok: false, error: "apply runner not loaded on page" };
      },
      args: [payload],
    });
    const outcome = res?.result;
    if (outcome?.paused) {
      showError(outcome.reason);
      return;
    }
    if (outcome?.submitted && lastExecutePayload.approval?.approval_token) {
      await bridgeCall("confirm_submission", {
        application_id: appId,
        approval_token: lastExecutePayload.approval.approval_token,
        confirmation: "auto-apply via extension",
      });
      const queueId = Number(els.queueId?.value);
      if (queueId > 0) {
        await bridgeCall("report_apply_step", { queue_id: queueId, step: "submitted" });
      }
    }
    els.result.hidden = false;
    els.resultJson.textContent = JSON.stringify(outcome, null, 2);
  } catch (e) {
    showError(`Auto-apply failed: ${e.message}`);
  }
}

async function enqueueCurrentPage() {
  clearError();
  if (!autoApplyEnabled) {
    showError("Enable JOB_MCP_AUTO_APPLY=1 on the bridge first.");
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  if (!url || !/^https:/.test(url)) {
    showError("Open an HTTPS career/apply page first.");
    return;
  }
  const args = { url };
  if (detectedJob && lastAnalyzeJobId) args.job_id = lastAnalyzeJobId;
  try {
    const data = await bridgeCall("enqueue_apply", args);
    const qid = data?.data?.id;
    if (qid) els.queueId.value = String(qid);
    els.result.hidden = false;
    els.resultJson.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    showError(`Enqueue failed: ${e.message}`);
  }
}

let lastAnalyzeJobId = null;

async function copyJson() {
  clearError();
  try {
    await navigator.clipboard.writeText(JSON.stringify(capturedFields, null, 2));
    els.copy.textContent = "Copied!";
    setTimeout(() => (els.copy.textContent = "Copy JSON"), 1200);
  } catch {
    showError("Clipboard write failed.");
  }
}

// ── import this job ─────────────────────────────────────────
// On-demand detection is more reliable than the auto content script (covers
// SPA navigations and pages outside the static matches). We inject extract.js
// then a tiny function that reads the page and calls the shared parseJobPosting.
function detectJobInPage() {
  const jsonLd = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
    .map((s) => s.textContent || "")
    .join("\n");
  return self.parseJobPosting({
    jsonLdText: jsonLd,
    title: document.title || "",
    bodyText: (document.body && document.body.innerText) || "",
    url: location.href,
  });
}

async function importJob() {
  clearError();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showError("No active tab.");
    return;
  }
  if (/^(chrome|edge|about):/i.test(tab.url ?? "")) {
    showError("Can't detect a job on a browser-internal page. Open a career site.");
    return;
  }
  try {
    // inject the pure extractor, then the page reader
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/extract.js"] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectJobInPage,
    });
    const job = res?.result;
    if (!job) {
      showError("No job posting detected on this page. Open a job listing and try again.");
      els.jobSection.hidden = true;
      return;
    }
    detectedJob = job;
    renderJob();
  } catch (e) {
    showError(`Detect failed: ${e.message}`);
  }
}

function renderJob() {
  if (!detectedJob) {
    els.jobSection.hidden = true;
    return;
  }
  els.jobTitle.textContent = detectedJob.title || "(untitled job)";
  const meta = [
    detectedJob.company,
    detectedJob.location,
    detectedJob.source === "jsonld" ? "structured" : "fallback",
  ]
    .filter(Boolean)
    .join(" · ");
  els.jobMeta.textContent = meta;
  const desc = (detectedJob.description || "").slice(0, 280);
  els.jobDesc.textContent = desc + (detectedJob.description.length > 280 ? "…" : "");
  els.jobSection.hidden = false;
}

async function analyzeJob() {
  clearError();
  if (!detectedJob) {
    showError("Detect a job first.");
    return;
  }
  const { bridgeUrl, token } = await getSettings();
  const body = {
    name: "analyze_job",
    arguments: {
      description: detectedJob.description,
      title: detectedJob.title,
    },
  };
  try {
    const res = await fetch(`${bridgeUrl}/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    els.result.hidden = false;
    els.resultJson.textContent = JSON.stringify(data, null, 2);
    lastAnalyzeJobId = data?.data?.job_id ?? data?.data?.id ?? null;
  } catch (e) {
    showError(`Bridge call failed: ${e.message}`);
  }
}

// ── wire up ─────────────────────────────────────────────────
els.capture.addEventListener("click", captureFields);
els.send.addEventListener("click", sendToBridge);
els.autoApplyBtn.addEventListener("click", runAutoApplyInTab);
els.enqueueBtn.addEventListener("click", enqueueCurrentPage);
els.copy.addEventListener("click", copyJson);
els.importBtn.addEventListener("click", importJob);
els.analyzeBtn.addEventListener("click", analyzeJob);
els.optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// If the auto content script already detected a job on this tab, pre-fill it.
chrome.storage.session.get(["lastJob", "lastJobUrl"]).then((s) => {
  if (s && s.lastJob) {
    detectedJob = s.lastJob;
    renderJob();
  }
});

checkBridge();