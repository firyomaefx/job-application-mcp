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
  result: document.getElementById("result"),
  resultJson: document.getElementById("result-json"),
  error: document.getElementById("error"),
  status: document.getElementById("status"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  optionsLink: document.getElementById("options-link"),
};

let capturedFields = [];

// ── settings ────────────────────────────────────────────────
async function getSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  return s;
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
  } catch (e) {
    els.statusDot.className = "dot dot-off";
    els.statusText.textContent = "Bridge: offline — start `npm run serve:http`";
  }
}

// ── capture (injected into the page) ────────────────────────
// This function is serialized by chrome.scripting, so it must not reference
// any outer-scope variables. It returns a plain array of field metadata.
function captureFieldsInPage() {
  const SENSITIVE = /salary|compensation|authorized|visa|sponsor|gender|race|ethnic|disability|consent|agree|ssn|national/i;
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
  const { bridgeUrl, token } = await getSettings();
  const body = {
    name: "autofill_form",
    arguments: {
      application_id: appId,
      form_fields: capturedFields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
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
  } catch (e) {
    showError(`Bridge call failed: ${e.message}`);
  }
}

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

// ── wire up ─────────────────────────────────────────────────
els.capture.addEventListener("click", captureFields);
els.send.addEventListener("click", sendToBridge);
els.copy.addEventListener("click", copyJson);
els.optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

checkBridge();