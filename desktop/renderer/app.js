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
};

let baseUrl = "http://127.0.0.1:8787";

function setError(msg) {
  els.error.textContent = msg || "";
  els.error.hidden = !msg;
}

window.jobMcp.onStatus(({ status, message, url }) => {
  if (url) { baseUrl = url; els.bridgeUrl.textContent = url; }
  els.dot.className = "dot " + (status === "running" ? "on" : status === "crashed" ? "bad" : "");
  els.statusText.textContent = message || status;
});

async function call(name, args) {
  const res = await fetch(`${baseUrl}/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function refresh() {
  setError("");
  try {
    const [profileRes, appsRes, cvsRes, dueRes] = await Promise.all([
      call("get_profile", {}),
      call("list_applications", {}),
      call("list_cvs", {}),
      call("due_reminders", {}),
    ]);
    renderProfile(profileRes.data);
    renderApps(appsRes.data);
    renderCvSelect(cvsRes.data);
    renderReminders(dueRes.data);
  } catch (e) {
    setError(`Could not reach bridge: ${e.message}. Click "Restart bridge" or run "npm run serve:http".`);
    clearEl(els.profile, "span", "—", "muted");
    const tr = document.createElement("tr");
    tr.append(td("—", 5, "muted"));
    els.appsBody.replaceChildren(tr);
    els.cvSelect.replaceChildren();
    els.reminders.replaceChildren(clearElLi("No reminders (bridge offline).", "muted"));
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

// initial info + first refresh
(async () => {
  const info = await window.jobMcp.bridgeInfo();
  if (info?.url) { baseUrl = info.url; els.bridgeUrl.textContent = info.url; }
  refresh();
})();