#!/usr/bin/env node
/**
 * Optional JobSpy sidecar (MIT): search job boards locally via Python jobspy.
 * Outputs JSON rows for the desktop Campaign UI or MCP analyze_job / enqueue_apply.
 *
 * Prerequisites:
 *   pip install python-jobspy pandas
 *
 * Usage:
 *   node scripts/jobspy-import.mjs '{"search_term":"engineer","location":"Kuala Lumpur","results_wanted":10,"site_name":["indeed","jobstreet"]}'
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const raw = process.argv[2];
  if (!raw) {
    return {
      search_term: "software engineer",
      location: "",
      results_wanted: 15,
      site_name: ["indeed", "linkedin", "glassdoor", "zip_recruiter"],
      country_indeed: "",
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error("First argument must be JSON config.");
    process.exit(2);
  }
}

const cfg = parseArgs();

const py = `
import json, sys
try:
    from jobspy import scrape_jobs
except ImportError:
    print(json.dumps({"ok": false, "error": "python-jobspy not installed (pip install python-jobspy pandas)"}))
    sys.exit(1)

cfg = json.loads(sys.argv[1])
sites = cfg.get("site_name") or ["indeed", "linkedin"]
kwargs = dict(
    site_name=sites,
    search_term=cfg.get("search_term", ""),
    location=cfg.get("location") or None,
    results_wanted=int(cfg.get("results_wanted") or 15),
    hours_old=int(cfg.get("hours_old") or 72),
)
if cfg.get("country_indeed"):
    kwargs["country_indeed"] = cfg["country_indeed"]

df = scrape_jobs(**kwargs)
rows = []
for _, row in df.iterrows():
    url = row.get("job_url") or row.get("url") or ""
    if not url or not str(url).startswith("http"):
        continue
    desc = row.get("description") or row.get("job_description") or ""
    if not desc or len(str(desc)) < 20:
        desc = f"{row.get('title','Role')} at {row.get('company','Company')}\\n\\nApply URL: {url}"
    rows.append({
        "title": str(row.get("title") or "Untitled"),
        "company": (str(row.get("company")) if row.get("company") is not None else None),
        "url": str(url),
        "description": str(desc)[:12000],
        "location": str(row.get("location") or "")[:200],
    })
print(json.dumps({"ok": true, "count": len(rows), "jobs": rows}))
`;

const run = spawnSync(
  process.env.JOBSPY_PYTHON || "python3",
  ["-c", py, JSON.stringify(cfg)],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

if (run.error) {
  console.log(JSON.stringify({ ok: false, error: String(run.error.message || run.error) }));
  process.exit(1);
}

const out = (run.stdout || "").trim();
const err = (run.stderr || "").trim();
if (run.status !== 0 && !out) {
  console.log(
    JSON.stringify({
      ok: false,
      error: err || `python exited ${run.status}`,
      hint: "Install: pip install python-jobspy pandas",
    }),
  );
  process.exit(run.status || 1);
}

try {
  const data = JSON.parse(out);
  console.log(JSON.stringify(data));
  process.exit(data.ok === false ? 1 : 0);
} catch {
  console.log(JSON.stringify({ ok: false, error: "invalid JSON from python", raw: out.slice(0, 500) }));
  process.exit(1);
}