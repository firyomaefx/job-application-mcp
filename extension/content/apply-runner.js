// DOM autofill + optional submit for the opt-in auto-apply module.
// Injected by the popup when JOB_MCP_AUTO_APPLY is enabled on the bridge.
// Must not reference outer scope variables (serialized by chrome.scripting).

function jobMcpApplyInPage(payload) {
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
    return {
      ok: false,
      paused: true,
      reason: "CAPTCHA, login, or verification detected — complete manually, then resume.",
      filled: 0,
    };
  }

  const mapping = payload.mapping || [];
  let filled = 0;
  const missed = [];
  for (const row of mapping) {
    if (!row.value || row.requires_user_review) continue;
    const el = findControl(row.field);
    if (el && setValue(el, row.value)) filled += 1;
    else missed.push(row.field);
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

  return { ok: true, filled, missed, submitted };
}

// Exposed for popup executeScript after this file is injected.
if (typeof globalThis !== "undefined") {
  globalThis.jobMcpApplyInPage = jobMcpApplyInPage;
}