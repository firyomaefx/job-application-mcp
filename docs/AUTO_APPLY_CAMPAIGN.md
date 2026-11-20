# Auto-apply campaign (desktop)

One local workflow: **résumé → job target → Start**. No MCP tool names required.

## Requirements

- Built bridge: `npm run build && npm run bundle:bridge` (repo root).
- Desktop: `cd desktop && npm install && npm start`.
- Opt-in auto-apply on the bridge (the desktop app sets this automatically).
- For unattended file upload + queue processing:
  `cd desktop && npm install playwright && npm run playwright:install`
  (Chromium browsers are **not** bundled in the installer — run once per machine.)

## Steps

1. **Import CV** — Campaign card → **Choose résumé** (copied under `data/cvs/`, then `parse_cv`).
2. **Job target**
   - **URLs:** one apply link per line (Greenhouse, Lever, company careers, etc.).
   - **Search:** title + location + boards → optional JobSpy import ([DISCOVERY.md](./DISCOVERY.md)).
   - **Caps:** min match score, max applies/day.
   - **Screening answers:** work authorization, salary, notice period → `set_apply_defaults`.
3. **Start campaign** — saves defaults, calls `start_campaign`, enqueues and prepares the queue, then starts the Playwright worker when items are ready.
4. The worker opens a persistent browser profile, fills forms, uploads CV, pauses on CAPTCHA/login (desktop notification), and records submission when safe.

## What stays blocked

- LinkedIn / Indeed / Glassdoor **apply** URLs ([platform guard](../src/apply/platform.ts)).
- CAPTCHA solving — you complete the step, then resume the queue.
- Multi-step Workday/assessments may pause for manual “Next”.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `JOB_MCP_AUTO_APPLY=1` | Bridge (desktop sets) | Enables auto-apply tools |
| `JOB_MCP_ALL_TOOLS=1` | Bridge (desktop sets) | Full tool list |
| `JOB_MCP_DATA_DIR` | Bridge + worker | SQLite + CV store |
| `JOB_MCP_BROWSER_PROFILE` | Worker | Playwright user data dir (cookies, uploads) |

## Extension fallback

If Playwright is not installed, use the Chrome extension popup **Auto-apply** on each ready
queue item after `start_campaign`.