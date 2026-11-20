# Job discovery (optional JobSpy sidecar)

The free core does **not** bundle Python. For multi-board search (Indeed, JobStreet, SEEK,
LinkedIn *listings*, etc.) use the optional [JobSpy](https://github.com/speedyapply/JobSpy)
sidecar — data stays on your machine.

## Install (once)

```bash
pip install python-jobspy pandas
```

Use `JOBSPY_PYTHON=python` on Windows if `python3` is not on PATH.

## CLI

From the repo root:

```bash
# Malaysia example (JobStreet + Indeed listings)
node scripts/jobspy-import.mjs '{"search_term":"data engineer","location":"Kuala Lumpur","results_wanted":20,"site_name":["indeed","jobstreet"],"country_indeed":"malaysia"}'
```

Output: JSON `{ ok, count, jobs: [{ title, company, url, description, location }] }`.

Only **employer ATS apply URLs** should be enqueued for auto-apply. Skip LinkedIn/Indeed
*apply* flows — import those postings for analysis and open the employer ATS link instead.

## Desktop Campaign

1. Open the desktop app → **Auto-apply campaign**.
2. Use **Search boards** (calls this script via the main process) or paste apply URLs.
3. **Start campaign** → `start_campaign` on the bridge, then the Playwright worker.

## Agent / MCP

For Cursor-only workflows you can pipe JobSpy JSON into `analyze_job` (with `url` + `description`)
then `enqueue_apply` with the returned `job_id`. The desktop path is the supported “upload + Go” UX.

## Rate limits and ToS

Search is **user-initiated**, local, and should be rate-limited. Board terms may restrict
scraping — use at your own risk; this project does not operate a hosted scraper.