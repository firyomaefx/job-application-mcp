// Renderer: talks to the local HTTP bridge via fetch. No direct DB access.

const els = {
  dot: document.getElementById("dot"),
  statusText: document.getElementById("status-text"),
  refresh: document.getElementById("refresh"),
  restart: document.getElementById("restart"),
  openData: document.getElementById("open-data"),
  profile: document.getElementById("profile"),
  appsBody: document.getElementById("apps-body"),
  appCount: document.getElementById("app-count"),
  error: document.getElementById("error"),
  bridgeUrl: document.getElementById("bridge-url"),
  cvSelect: document.getElementById("cv-select"),
  exportPdf: document.getElementById("export-pdf"),
  reminders: document.getElementById("reminders"),
  reminderCount: document.getElementById("reminder-count"),
  updateBanner: document.getElementById("update-banner"),
  updateVersion: document.getElementById("update-version"),
  updateInstall: document.getElementById("update-install"),
  updateDismiss: document.getElementById("update-dismiss"),
  // Setup & Status card (v0.4.0 one-click)
  autoConfigure: document.getElementById("auto-configure"),
  autoConfigureMsg: document.getElementById("auto-configure-msg"),
  bridgeToggle: document.getElementById("bridge-toggle"),
  ckBridgeDot: document.getElementById("ck-bridge-dot"),
  ckBridgeText: document.getElementById("ck-bridge-text"),
  ckAiDot: document.getElementById("ck-ai-dot"),
  ckAiText: document.getElementById("ck-ai-text"),
  ckAiChips: document.getElementById("ck-ai-chips"),
  ckProfileDot: document.getElementById("ck-profile-dot"),
  ckProfileText: document.getElementById("ck-profile-text"),
  setupProfile: document.getElementById("setup-profile"),
  ckCvDot: document.getElementById("ck-cv-dot"),
  ckCvText: document.getElementById("ck-cv-text"),
  setupCv: document.getElementById("setup-cv"),
  aiSettingsForm: document.getElementById("ai-settings-form"),
  aiProvSelect: document.getElementById("ai-prov-select"),
  aiModel: document.getElementById("ai-model"),
  aiBaseUrl: document.getElementById("ai-base-url"),
  aiApiKey: document.getElementById("ai-api-key"),
  aiClearKey: document.getElementById("ai-clear-key"),
};

let baseUrl = "http://127.0.0.1:8787";
let bridgeToken = ""; // loopback bearer (from bridgeInfo); "" = no auth

function setError(msg) {
  els.error.textContent = msg || "";
  els.error.hidden = !msg;
}

window.jobMcp.onStatus(({ status, message, url }) => {
  if (url) { baseUrl = url; els.bridgeUrl.textContent = url; }
  els.dot.className = "dot " + (status === "running" ? "on" : status === "crashed" ? "bad" : "");
  els.statusText.textContent = message || status;
});

/** JSON headers + optional bearer for the loopback bridge. */
function bridgeHeaders(extra) {
  const h = { "Content-Type": "application/json", ...(extra || {}) };
  if (bridgeToken) h["Authorization"] = `Bearer ${bridgeToken}`;
  return h;
}

async function call(name, args) {
  const res = await fetch(`${baseUrl}/call`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ name, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Generic bridge endpoint helper for /detect and /settings. */
async function api(path, method = "GET", body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: bridgeHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function refresh() {
  setError("");
  try {
    const [profileRes, appsRes, cvsRes, dueRes, detectRes, settingsRes] = await Promise.all([
      call("get_profile", {}),
      call("list_applications", {}),
      call("list_cvs", {}),
      call("due_reminders", {}),
      api("/detect").catch(() => null),
      api("/settings").catch(() => null),
    ]);
    renderProfile(profileRes.data);
    renderApps(appsRes.data);
    renderCvSelect(cvsRes.data);
    renderReminders(dueRes.data);
    if (detectRes?.data) renderChecklist(detectRes.data);
    if (settingsRes?.data) renderSettingsForm(settingsRes.data);
  } catch (e) {
    setError(`Could not reach bridge: ${e.message}. Click "Restart bridge" or run "npm run serve:http".`);
    clearEl(els.profile, "span", "—", "muted");
    const tr = document.createElement("tr");
    tr.append(td("—", 5, "muted"));
    els.appsBody.replaceChildren(tr);
    els.cvSelect.replaceChildren();
    els.reminders.replaceChildren(clearElLi("No reminders (bridge offline).", "muted"));
    setChecklistOffline();
  }
}

function renderReminders(due) {
  els.reminders.replaceChildren();
  els.reminderCount.textContent = due && due.length ? `(${due.length} due)` : "";
  if (!due || !due.length) {
    els.reminders.append(clearElLi("No reminders due.", "muted"));
    return;
  }
  for (const r of due) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = r.title;
    const meta = document.createElement("span");
    meta.className = "muted";
    meta.textContent = ` — due ${shortDate(r.due_at)} (${r.kind})`;
    li.append(title, meta);
    els.reminders.append(li);
  }
}

function clearElLi(text, cls) {
  const li = document.createElement("li");
  if (cls) li.className = cls;
  li.textContent = text;
  return li;
}

// ── Setup & Status card (v0.4.0 one-click) ───────────────────
const PROVIDER_LABELS = { mock: "Mock (offline)", ollama: "Ollama (local)", openai: "OpenAI", anthropic: "Anthropic" };

function setDot(el, ok) {
  el.className = "dot " + (ok ? "on" : "bad");
}

/** Render the four-row checklist from a /detect SystemReport. */
function renderChecklist(r) {
  // Bridge
  const bridgeUp = r.bridge && r.bridge.status === "running";
  setDot(els.ckBridgeDot, bridgeUp);
  els.ckBridgeText.textContent = bridgeUp ? `Bridge running :${r.bridge.port}` : "Bridge stopped";

  // AI
  const ai = r.ai || {};
  const aiOk = ai.effective_provider === "ollama"
    ? ai.ollama_reachable
    : (ai.effective_provider === "openai" || ai.effective_provider === "anthropic"
        ? ai.key_present
        : true); // mock is always "ok"
  setDot(els.ckAiDot, aiOk);
  const provLabel = PROVIDER_LABELS[ai.effective_provider] || ai.effective_provider || "mock";
  let aiText = `AI: ${provLabel}`;
  if (ai.effective_provider === "ollama") aiText += ai.ollama_reachable ? " · up" : " · not running";
  if (ai.key_present) aiText += ` · key ${ai.key_masked}`;
  els.ckAiText.textContent = aiText;
  // Highlight the active chip
  for (const chip of els.ckAiChips.querySelectorAll("button.chip")) {
    const prov = chip.getAttribute("data-prov");
    const isActive =
      (prov === "mock" && ai.effective_provider === "mock") ||
      (prov === "ollama" && ai.effective_provider === "ollama") ||
      (prov === "key" && (ai.effective_provider === "openai" || ai.effective_provider === "anthropic"));
    chip.classList.toggle("active", isActive);
  }

  // Profile
  setDot(els.ckProfileDot, r.data && r.data.profile_present);
  els.ckProfileText.textContent = r.data && r.data.profile_present ? "Profile set" : "No profile yet";
  els.setupProfile.hidden = !!(r.data && r.data.profile_present);

  // CV
  const cvCount = (r.data && r.data.cv_count) || 0;
  setDot(els.ckCvDot, cvCount > 0);
  els.ckCvText.textContent = cvCount > 0 ? `${cvCount} CV(s)` : "No CV yet";
  els.setupCv.hidden = cvCount > 0;
}

/** Fill the AI settings form from a /settings response (key masked, never raw). */
function renderSettingsForm(s) {
  els.aiProvSelect.value = s.ai_provider || "";
  els.aiModel.value = s.ai_model || "";
  els.aiBaseUrl.value = s.ai_base_url || "";
  // Never pre-fill the raw key. Show a masked placeholder when one is set.
  els.aiApiKey.value = "";
  els.aiApiKey.placeholder = s.ai_api_key_present
    ? `${s.ai_api_key} · leave blank to keep`
    : "Enter API key";
}

function setChecklistOffline() {
  setDot(els.ckBridgeDot, false);
  els.ckBridgeText.textContent = "Bridge offline";
  setDot(els.ckAiDot, false);
  els.ckAiText.textContent = "AI: unknown (bridge offline)";
  setDot(els.ckProfileDot, false);
  els.ckProfileText.textContent = "Profile: unknown";
  setDot(els.ckCvDot, false);
  els.ckCvText.textContent = "CV: unknown";
}

/** The headline one-click: detect → pick best AI → apply → ensure bridge up. */
async function autoConfigure() {
  els.autoConfigure.disabled = true;
  els.autoConfigureMsg.textContent = "Detecting…";
  setError("");
  try {
    let report = (await api("/detect")).data;
    // Pick the best available AI: Ollama if reachable > keep key if present > mock.
    let chosen = report.ai.configured_provider;
    if (report.ai.ollama_reachable) chosen = "ollama";
    else if (!chosen && report.ai.key_present) chosen = report.ai.effective_provider; // keep an env key
    else if (!chosen) chosen = "mock";
    if (chosen !== report.ai.configured_provider) {
      await api("/settings", "POST", { ai_provider: chosen });
    }
    // Ensure the bridge is up (it normally is, since the dashboard starts it).
    if (report.bridge.status !== "running") {
      await window.jobMcp.bridgeStart();
    }
    // Re-detect to reflect the new state.
    report = (await api("/detect")).data;
    renderChecklist(report);
    const missing = [];
    if (!report.data.profile_present) missing.push("a profile");
    if (!report.data.cv_count) missing.push("a CV");
    els.autoConfigureMsg.textContent = missing.length
      ? `Ready on ${PROVIDER_LABELS[report.ai.effective_provider] || report.ai.effective_provider}. Add ${missing.join(" & ")}.`
      : `Ready: ${PROVIDER_LABELS[report.ai.effective_provider] || report.ai.effective_provider} · ${report.data.cv_count} CV(s)`;
    refresh();
  } catch (e) {
    setError(`Auto-configure failed: ${e.message}`);
    els.autoConfigureMsg.textContent = "";
  } finally {
    els.autoConfigure.disabled = false;
  }
}

/** Save the AI settings form. The key is sent only if the field is non-empty. */
async function saveSettingsForm(e) {
  e.preventDefault();
  setError("");
  const patch = {
    ai_provider: els.aiProvSelect.value,
    ai_model: els.aiModel.value,
    ai_base_url: els.aiBaseUrl.value,
  };
  if (els.aiApiKey.value) patch.ai_api_key = els.aiApiKey.value;
  try {
    await api("/settings", "POST", patch);
    els.aiApiKey.value = "";
    await refresh();
    setError("AI settings saved.");
  } catch (err) {
    setError(`Save failed: ${err.message}`);
  }
}

/** Fully clear the stored API key (delete the row → env fallback returns). */
async function clearKey() {
  setError("");
  try {
    await api("/settings", "POST", { ai_api_key: null });
    await refresh();
    setError("API key cleared.");
  } catch (err) {
    setError(`Clear failed: ${err.message}`);
  }
}

/** One-click AI provider chip → POST and refresh. */
async function chipToProvider(prov) {
  setError("");
  // "My key" with no key set: open the AI settings form + focus the key field.
  if (prov === "key") {
    const r = (await api("/detect").catch(() => null))?.data;
    if (!r || !r.ai.key_present) {
      document.getElementById("ai-settings").open = true;
      els.aiProvSelect.value = "openai";
      els.aiApiKey.focus();
      return;
    }
    prov = r.ai.effective_provider === "anthropic" ? "anthropic" : "openai";
  }
  try {
    await api("/settings", "POST", { ai_provider: prov });
    await refresh();
  } catch (err) {
    setError(`Switch failed: ${err.message}`);
  }
}

function renderCvSelect(cvs) {
  els.cvSelect.replaceChildren();
  if (!cvs || !cvs.length) {
    const opt = document.createElement("option");
    opt.textContent = "No CVs yet — use parse_cv.";
    opt.value = "";
    els.cvSelect.append(opt);
    els.exportPdf.disabled = true;
    return;
  }
  els.exportPdf.disabled = false;
  for (const c of cvs) {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = `#${c.id} — ${c.label}`;
    els.cvSelect.append(opt);
  }
}

async function exportCvPdf() {
  setError("");
  const cvId = Number(els.cvSelect.value);
  if (!cvId) { setError("Select a CV first."); return; }
  try {
    const res = await call("export_cv_markdown", { cv_id: cvId, include_cover_letter: false });
    const markdown = res?.data?.markdown;
    if (!markdown) { setError("No markdown returned from export_cv_markdown."); return; }
    const out = await window.jobMcp.exportPdf({ markdown });
    if (out && out.ok) setError(`Exported PDF: ${out.path}`);
    else if (out && out.canceled) setError("");
    else setError("PDF export failed.");
  } catch (e) {
    setError(`Export failed: ${e.message}`);
  }
}

/** Build a single <dd> row: <dt>label</dt><dd>value</dd>. */
function dlRow(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value == null || value === "" ? "—" : String(value);
  return [dt, dd];
}

function renderProfile(p) {
  if (!p) { clearEl(els.profile, "span", "No profile.", "muted"); return; }
  const dl = document.createElement("dl");
  dl.append(
    ...dlRow("Name", p.full_name || "—"),
    ...dlRow("Headline", p.headline || "—"),
    ...dlRow("Email", p.email || "—"),
    ...dlRow("Location", p.location || "—"),
    ...dlRow("Experience", p.experience_years == null ? "—" : `${p.experience_years} yrs`),
  );
  // Skills row with chips (textContent — never innerHTML).
  const dt = document.createElement("dt"); dt.textContent = "Skills";
  const dd = document.createElement("dd");
  const skillsWrap = document.createElement("div"); skillsWrap.className = "skills";
  const skills = Array.isArray(p.skills) ? p.skills : [];
  if (skills.length) {
    for (const s of skills) {
      const chip = document.createElement("span"); chip.className = "skill";
      chip.textContent = String(s);
      skillsWrap.append(chip);
    }
  } else {
    const m = document.createElement("span"); m.className = "muted"; m.textContent = "none";
    skillsWrap.append(m);
  }
  dd.append(skillsWrap);
  dl.append(dt, dd);
  els.profile.replaceChildren(dl);
}

function renderApps(apps) {
  els.appCount.textContent = apps.length ? `(${apps.length})` : "";
  els.appsBody.replaceChildren();
  if (!apps.length) {
    const tr = document.createElement("tr");
    tr.append(td("No applications yet. Use the MCP tools to create one.", 5, "muted"));
    els.appsBody.append(tr);
    return;
  }
  for (const a of apps) {
    const tr = document.createElement("tr");
    const badge = document.createElement("span");
    // status is a known enum locally, but treat it as untrusted text + sanitize the class
    badge.className = "badge " + sanitizeStatusClass(a.status);
    badge.textContent = a.status ?? "";
    tr.append(
      td(a.id),
      td(`job #${a.job_id}`),
      wrapTd(badge),
      td(a.match_score == null ? "—" : `${a.match_score}/100`),
      td(shortDate(a.updated_at), null, "muted"),
    );
    els.appsBody.append(tr);
  }
}

/** A <td> with optional colspan + class; value set via textContent. */
function td(value, colspan, cls) {
  const c = document.createElement("td");
  if (colspan) c.colSpan = colspan;
  if (cls) c.className = cls;
  c.textContent = value == null ? "" : String(value);
  return c;
}
function wrapTd(node) {
  const c = document.createElement("td");
  c.append(node);
  return c;
}
/** Replace an element's children with a single text node element of the given tag/class. */
function clearEl(parent, tag, text, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.textContent = text;
  parent.replaceChildren(el);
}
/** Only allow a-z0-9 and - in a class suffix derived from data. */
function sanitizeStatusClass(s) {
  return String(s ?? "").replace(/[^a-z0-9-]/gi, "");
}
function shortDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

els.refresh.addEventListener("click", refresh);
els.restart.addEventListener("click", async () => { await window.jobMcp.bridgeRestart(); setTimeout(refresh, 800); });
els.openData.addEventListener("click", () => window.jobMcp.openDataDir());
els.exportPdf.addEventListener("click", exportCvPdf);

// Setup card events
els.autoConfigure.addEventListener("click", autoConfigure);
els.bridgeToggle.addEventListener("click", async () => { await window.jobMcp.bridgeRestart(); setTimeout(refresh, 800); });
els.setupProfile.addEventListener("click", () => document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" }));
els.setupCv.addEventListener("click", () => document.getElementById("cv-select")?.scrollIntoView({ behavior: "smooth", block: "center" }));
els.aiSettingsForm.addEventListener("submit", saveSettingsForm);
els.aiClearKey.addEventListener("click", clearKey);
for (const chip of els.ckAiChips.querySelectorAll("button.chip")) {
  chip.addEventListener("click", () => chipToProvider(chip.getAttribute("data-prov")));
}

// initial info + first refresh
(async () => {
  const info = await window.jobMcp.bridgeInfo();
  if (info?.url) { baseUrl = info.url; els.bridgeUrl.textContent = info.url; }
  if (info?.token) bridgeToken = info.token;
  refresh();
})();

// ── Auto-update prompt (Phase 4) ─────────────────────────────
// Nothing installs without the user clicking "Install & restart". The main
// process only emits update:available after the version-compare helper
// confirms the remote is strictly newer.
window.jobMcp.onUpdateAvailable(({ version }) => {
  els.updateVersion.textContent = version || "newer build";
  els.updateBanner.hidden = false;
});
els.updateInstall.addEventListener("click", async () => {
  els.updateInstall.disabled = true;
  els.updateInstall.textContent = "Installing…";
  try {
    const r = await window.jobMcp.installUpdate();
    if (!r?.ok) {
      setError(`Update not available: ${r?.reason || "auto-updater unavailable"}.`);
      els.updateInstall.disabled = false;
      els.updateInstall.textContent = "Install & restart";
    }
  } catch (e) {
    setError(`Update failed: ${e.message}`);
    els.updateInstall.disabled = false;
    els.updateInstall.textContent = "Install & restart";
  }
});
els.updateDismiss.addEventListener("click", () => { els.updateBanner.hidden = true; });

// ── Jump-list deep link (Phase 4) ─────────────────────────────
// `--open-inbox` from a jump-list task scrolls to the reminders section.
const intent = window.jobMcp.launchIntent?.();
if (intent === "open-inbox") {
  document.getElementById("reminders")?.scrollIntoView({ behavior: "smooth", block: "start" });
}