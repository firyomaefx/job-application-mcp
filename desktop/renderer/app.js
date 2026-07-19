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
    const [profileRes, appsRes] = await Promise.all([
      call("get_profile", {}),
      call("list_applications", {}),
    ]);
    renderProfile(profileRes.data);
    renderApps(appsRes.data);
  } catch (e) {
    setError(`Could not reach bridge: ${e.message}. Click "Restart bridge" or run "npm run serve:http".`);
    els.profile.innerHTML = '<span class="muted">—</span>';
    els.appsBody.innerHTML = '<tr><td colspan="5" class="muted">—</td></tr>';
  }
}

function renderProfile(p) {
  if (!p) { els.profile.innerHTML = '<span class="muted">No profile.</span>'; return; }
  const skills = (p.skills || []).map((s) => `<span class="skill"></span>`).join("");
  els.profile.innerHTML = `
    <dl>
      <dt>Name</dt><dd></dd>
      <dt>Headline</dt><dd>${escapeHtml(p.headline || "—")}</dd>
      <dt>Email</dt><dd>${escapeHtml(p.email || "—")}</dd>
      <dt>Location</dt><dd>${escapeHtml(p.location || "—")}</dd>
      <dt>Experience</dt><dd>${p.experience_years ?? "—"} yrs</dd>
      <dt>Skills</dt><dd><div class="skills">${skills || '<span class="muted">none</span>'}</div></dd>
    </dl>`;
  // set text via DOM to avoid HTML injection in skill chips
  const nameDd = els.profile.querySelector("dl dd");
  nameDd.textContent = p.full_name || "—";
  els.profile.querySelectorAll(".skill").forEach((chip, i) => (chip.textContent = p.skills[i]));
}

function renderApps(apps) {
  els.appCount.textContent = apps.length ? `(${apps.length})` : "";
  if (!apps.length) {
    els.appsBody.innerHTML = '<tr><td colspan="5" class="muted">No applications yet. Use the MCP tools to create one.</td></tr>';
    return;
  }
  els.appsBody.innerHTML = apps
    .map(
      (a) => `<tr>
        <td>${a.id}</td>
        <td>job #${a.job_id}</td>
        <td><span class="badge ${a.status}">${a.status}</span></td>
        <td>${a.match_score ?? "—"}${a.match_score != null ? "/100" : ""}</td>
        <td class="muted">${shortDate(a.updated_at)}</td>
      </tr>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function shortDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

els.refresh.addEventListener("click", refresh);
els.restart.addEventListener("click", async () => { await window.jobMcp.bridgeRestart(); setTimeout(refresh, 800); });
els.openData.addEventListener("click", () => window.jobMcp.openDataDir());

// initial info + first refresh
(async () => {
  const info = await window.jobMcp.bridgeInfo();
  if (info?.url) { baseUrl = info.url; els.bridgeUrl.textContent = info.url; }
  refresh();
})();