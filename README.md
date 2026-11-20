<div align="center">

# Job Application MCP

**A local-first, open-source job assistant on the
[Model Context Protocol](https://modelcontextprotocol.io).**

📋 **Paste your CV · Paste a job · Get a score card** — on your machine, nothing uploaded, **you** still hit Submit.

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

</div>

---

## Table of contents

- [🚀 Start here in 2 minutes](#-start-here-in-2-minutes)
- [📖 New to MCP?](#-new-to-mcp)
- [⚡ Quick start](#-quick-start)
- [💬 Connect your AI app](#-connect-your-ai-app)
- [📋 Everyday use](#-everyday-use)
- [🛑 What we will NOT do](#-what-we-will-not-do)
- [🎯 Sample score card](#-sample-score-card)
- [🔧 Power users](#-power-users)
- [🔒 Privacy and data](#-privacy-and-data)
- [⚙️ Configuration](#configuration)
- [🛠️ For developers](#for-developers)
- [📜 License](#-license)
- [🤝 Contributing](#-contributing)

---

## 🚀 Start here in 2 minutes

Job hunting is repetitive. This project helps you answer one question fast: **does my CV look like a fit for this posting?**

You don’t need to be a developer 🙂. Most people only need **four short steps**:

1. **Install once** — follow [Quick start](#-quick-start) (Node 22 + `npm install` + `npm run build`).
2. **Paste your CV** — in chat: tool `save_my_cv`, or in terminal: `job-mcp cv cv.txt`.
3. **Paste the job description** — in chat: tool `check_this_job`, or in terminal: `job-mcp job job.txt`.
4. **Read the card** — use the text exactly as returned. The server does not invent job titles, employers, dates, or skills.

> ✅ **Lazy mode:** A connected chat app sees **only 2 tools** by default (`save_my_cv` and `check_this_job`), not 41. That saves tokens and stops the AI from guessing which step to run.

Want tracking, cover letters, and the rest? See [Power users](#-power-users) and set `JOB_MCP_ALL_TOOLS=1`.

---

## 📖 New to MCP?

| Term | Plain English |
| --- | --- |
| **MCP** | A plug-in protocol so apps like Claude Desktop or Cursor can call small programs on your computer (“tools”). |
| **This repo** | A local helper that scores your CV against a job posting. It is **not** a job board and it does **not** apply for you. |
| **Tool** | One action the server can run. The default pair is “save CV” and “check job”. |
| **Your data** | Stays in a folder on your PC (default `./data`). The free two-paste path does not call the cloud. |

```text
┌─────────────────┐                         ┌──────────────────────┐
│  Claude/Cursor  │  ◀──── local chat ────▶  │  job-application-mcp │
│  (optional)     │                         │  (this server)       │
└─────────────────┘                         └──────────┬───────────┘
                                                     │ saves on disk
                                                     ▼
                                          ┌──────────────────────┐
                                          │  ./data  (SQLite)    │
                                          └──────────────────────┘
```

> ℹ️ Paid cloud/Pro services described in [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md) are **out of scope** for this repo’s free core.

---

## ⚡ Quick start

### Requirements

- **Node.js ≥ 22** (built-in SQLite — no extra database install)
- **npm**

### Install and build

```bash
git clone https://github.com/firyomaefx/job-application-mcp.git
cd job-application-mcp
npm install
npm run build      # writes dist/
```

### Check it runs

```bash
node dist/cli/cli.js --help
# should list: cv, job, serve, serve:http, …
```

Optional: `npm test` runs the full test suite (for contributors).

---

## 💬 Connect your AI app

Build the project, then tell your MCP client how to start the server.

### Claude Desktop / Claude Code / Cursor

```jsonc
{
  "mcpServers": {
    "job-application-mcp": {
      "command": "node",
      "args": ["/ABSOLUTE/path/to/job-application-mcp/dist/src/index.js"]
    }
  }
}
```

> ⚠️ Use a real **absolute** path. MCP clients start the server from *their* working directory, not yours.

Restart the client. You should see **two tools**: `save_my_cv` and `check_this_job`.

### No chat app? Use the terminal only

```bash
node dist/cli/cli.js cv my-cv.txt
node dist/cli/cli.js job posting.txt
```

Same logic, zero AI tokens ✨

---

## 📋 Everyday use

### In chat (Claude, Cursor, …)

Say what you mean in plain language; the assistant should call the tool and show you the result **unchanged**:

1. *“Save this as my CV:”* + paste résumé text → `save_my_cv`
2. *“Check this job:”* + paste posting → `check_this_job`

**Example replies you might send:**

> Here’s my CV: Ada Lovelace. Backend engineer. Python, SQL, PostgreSQL, ETL pipelines…

> Here’s the job: We need Python, SQL, and AWS. Docker is a plus.

The tool text is the product — don’t let the model “improve” skills or add employers.

### In the terminal

Put text in two files, then:

```bash
job-mcp cv cv.txt
job-mcp job job.txt
```

(`job-mcp` works after `npm run build` from the project root, or install the package globally.)

### If you check a job before saving a CV

You get exactly:

```text
No CV saved. Paste your CV first.
```

Nothing is stored. Paste the CV first, then try again.

### More than matching?

Set environment variable `JOB_MCP_ALL_TOOLS=1` before starting the server or HTTP bridge to unlock [all tools](#all-tools-reference) (tracking, tailoring, autofill preview, etc.). The [desktop app](#desktop-app--desktop) sets this for its bundled bridge automatically.

---

## 🛑 What we will NOT do

These limits are **on purpose** — not bugs:

- ❌ **No auto-submit by default.** You click Apply unless you opt in (below).
- ❌ **No LinkedIn / Indeed auto-apply.** Import/analyze only; ATS career sites for automation.
- ❌ **No CAPTCHA / 2FA hacking.** You handle security steps.
- ❌ **No fake facts on the default path.** The two-paste card only names skills found in *your* CV text.

---

## 🎯 Sample score card

After CV + job, a successful `check_this_job` looks like this (your numbers and skills will differ):

```text
Role: Untitled role
Score: 67/100
In both: python, sql
Only in the job: aws, docker
Matched skills you can name: python, sql.
These are the only skills this card supports.
Do not add employers.
Do not add dates.
Do not add numbers.
```

- **Role** stays `Untitled role` on the default path (the first line of a posting is **not** treated as a title).
- **Score** is a local keyword match (0–100), not an AI opinion.

If you skipped the CV step, you only see: `No CV saved. Paste your CV first.`

---

## 🔧 Power users

### What else exists (when `JOB_MCP_ALL_TOOLS=1`)

| Capability | What it’s for |
| --- | --- |
| 🧩 **Full MCP tool set** | Profile, CV files, job inbox, applications, reminders, backups, … |
| 📄 **CV parsing** | PDF / DOCX / TXT from allowed folders |
| ✍️ **Drafts** | Cover letter & answers (heuristic, or your own AI key) |
| 📝 **Autofill preview** | Map profile fields — **preview only** (default) |
| 🤖 **Auto-apply (opt-in)** | `JOB_MCP_AUTO_APPLY=1` + extension — fill/submit on ATS with caps |
| 📊 **Tracking** | Local application status pipeline |

### Companion apps

#### HTTP bridge

```bash
npm run serve:http      # 127.0.0.1:8787 by default
```

- `GET /health` — list tools exposed on this bridge
- `POST /call` — `{"name","arguments"}`

Use `JOB_MCP_ALL_TOOLS=1` for the Chrome extension. See [`src/http.ts`](./src/http.ts).

#### Chrome extension — `extension/`

Captures form fields and asks the bridge for an **autofill preview**. Never submits. See [`extension/README.md`](./extension/README.md).

#### Desktop app — `desktop/`

Electron UI + bundled bridge (`JOB_MCP_ALL_TOOLS=1`). See [`desktop/README.md`](./desktop/README.md).

> Both companions talk only to `127.0.0.1`. With **`JOB_MCP_AUTO_APPLY=1`** on the bridge, the extension may fill and submit on allowed ATS pages after approval.

### Auto-apply (opt-in)

1. Start the bridge with `JOB_MCP_AUTO_APPLY=1` (and `JOB_MCP_ALL_TOOLS=1` for the extension).
2. Call `set_apply_defaults` for salary, work authorization, and daily caps.
3. `enqueue_apply` → `prepare_application` → open the apply URL → capture fields → **execute_autofill** → **Auto-apply** in the extension.
4. LinkedIn/Indeed apply URLs are **rejected**; CAPTCHA/login pauses for you.

### How matching works (default card)

The two-paste score uses a **local, heuristic** scorer in [`src/lib/scoring.ts`](./src/lib/scoring.ts) — no AI, no network:

1. Pull likely **skills/keywords** from CV and job text.
2. Compare them (simple stem matching, e.g. `react` ≈ `reactjs`).
3. Output score, matched, and missing lists.

Treat the score as a **hint**. Always read the original posting.

### Windows alpha installer

GitHub **prereleases** ship a standalone x64 Windows installer (bundled bridge; no separate Node required).

- Version **0.4.2** is **unsigned alpha** — SmartScreen may warn.
- Verify the file with `SHA256SUMS.txt` on the same release before installing.
- Not a production or paid hosted product.

### Roadmap / Pro

[`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md) describes the open-core model and optional hosted Pro services (AI tailoring, sync, business accounts). The free core stays fully local.

### Limitations

- Keyword extraction can miss or mis-rank skills.
- No browser automation; forms are preview-only.
- **Alpha:** APIs and schemas may change before 1.0.

### <a id="status"></a> Status

**Alpha** — fine for self-hosted trial on your own machine; not a finished product release.

---

<a id="all-tools-reference"></a>

### All tools reference

Skip this section unless you set **`JOB_MCP_ALL_TOOLS=1`**. Arguments are validated with zod; the MCP client gets JSON Schema for each tool. **Credits/Pro** and **admin** tools are wire-ready seams for a future hosted service; they run locally today without a subscription.

#### Profile

| Tool | Args | Returns |
| --- | --- | --- |
| `get_profile` | — | Local candidate profile (auto-created on first call). |
| `update_profile` | `full_name?, email?, phone?, location?, headline?, summary?, skills?, experience_years?` | Updated profile. `skills` replaces the list. |

#### CVs

| Tool | Args | Returns |
| --- | --- | --- |
| `parse_cv` | `file_path?` **or** `text`, `label?` | Parsed CV stored locally; detected skills + short preview. |
| `list_cvs` | — | All stored CVs. |

`parse_cv` supports `.pdf`, `.docx`, and plain text. `file_path` must stay inside the data dir or `JOB_MCP_CV_DIRS` allow-list.

#### Jobs

| Tool | Args | Returns |
| --- | --- | --- |
| `analyze_job` | `description` (≥20 chars), `title?, company?, url?, store?=true` | Keywords + summary; stores job by default. |
| `get_job` | `job_id` | Stored job with keywords. |

#### Matching and prep

| Tool | Args | Returns |
| --- | --- | --- |
| `match_cv` | `job_id`, `cv_id`, `save?=false` | 0–100 score; optional draft application. |
| `tailor_cv` | `job_id`, `cv_id` | Tailored draft (AI with your key, else heuristic). |
| `cover_letter` | `job_id`, `cv_id` | Cover-letter draft. |
| `draft_answer` | `question`, `cv_id?, job_id?` | Screening-answer draft. Review before sending. |

> **Your own AI key:** set `AI_PROVIDER` + `AI_API_KEY` for real drafts on `tailor_cv`, `cover_letter`, and `draft_answer`. Without a key, outputs stay heuristic and local.

#### Applications and forms

| Tool | Args | Returns |
| --- | --- | --- |
| `save_application` | `job_id`, `cv_id?, match_score?, …` | Draft application record. Does not submit. |
| `list_applications` | `status?` | Application list. |
| `update_application_status` | `application_id`, `status`, `notes?` | Updates status pipeline. |
| `autofill_form` | `application_id`, `form_fields?` | **Preview** mapping only. |

**Status pipeline:** `draft → ready → submitted → interview → offer → rejected → closed`.

#### Analytics, credits, admin

| Tool | Purpose |
| --- | --- |
| `application_analytics`, `status` | Counts and server snapshot |
| `credits`, `topup_credits`, `grant_monthly_credits` | Credit ledger (Pro seam) |
| `admin_*` | Business-tier account tools (seam) |

(Default path tools `save_my_cv` and `check_this_job` are always available even when the full list is hidden.)

---

## 🔒 Privacy and data

- **Local-first.** CVs and applications live in `JOB_MCP_DATA_DIR` (default `./data`), gitignored on the repo side — your machine only.
- **Two-paste path:** scoring runs locally; no CV upload to this project’s servers.
- **Your AI keys** are not stored in SQLite. Desktop UI keys are session-only unless you set env vars.
- **Logs:** CV text and PII are not logged at info level.
- **Sensitive form fields** (salary, work authorization, etc.) are flagged for human review when using `autofill_form`.
- **Nuclear option:** delete the `data` folder to wipe local state.

Optional outbound calls only if **you** configure them (OpenAI, Anthropic, Ollama, licence server, update feed).

---

<a id="configuration"></a>

## ⚙️ Configuration

**The two-paste path needs no env vars.** Everything below is optional.

### Everyday / paths

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOB_MCP_DATA_DIR` | `./data` | SQLite DB and parsed files |
| `JOB_MCP_ALL_TOOLS` | unset | `1` = expose all 41 tools (else only `save_my_cv` + `check_this_job`) |

### HTTP bridge / companions

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOB_MCP_HTTP_PORT` | `8787` | Loopback bridge port |
| `JOB_MCP_HTTP_TOKEN` | — | Optional bearer token for `/call` |
| `JOB_MCP_CV_DIRS` | — | Extra folders for `parse_cv` reads |

### AI and Pro (power tools only)

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` / `AI_API_KEY` | Your OpenAI/Anthropic (or compatible) key for drafts |
| `AI_MODEL` / `AI_BASE_URL` | Model and endpoint overrides (Ollama-friendly) |
| `JOB_MCP_LICENCE_SERVER` | Pro licence activation (hosted) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Future cloud sync (Pro) |

See [`.env.example`](./.env.example) for placeholders.

---

<a id="for-developers"></a>

## 🛠️ For developers

### Commands

```bash
npm run build       # tsc -> dist/
npm run typecheck   # tsc --noEmit
npm test            # node:test suite
npm run serve:http  # local bridge
npm run dev         # tsc --watch
```

Daily effectiveness gate (synthetic, no user data): [`docs/EFFECTIVENESS.md`](./docs/EFFECTIVENESS.md).

### Project layout

```text
job-application-mcp/
├── src/
│   ├── index.ts, http.ts, server.ts
│   ├── simple.ts          # saveMyCv / checkThisJob (default path)
│   ├── tools/             # MCP tool definitions (+ simple.ts)
│   ├── store/             # SQLite
│   ├── lib/scoring.ts     # keyword match (default card)
│   └── ai/                # optional providers
├── cli/cli.ts             # job-mcp cv | job | serve …
├── desktop/, extension/   # companions
└── tests/
```

### Adding a tool

1. Add `src/tools/<name>.ts` with a `ToolDef`.
2. Register in `src/tools/index.ts`.
3. Add tests under `tests/` when logic is non-trivial.

Conventions: [`CLAUDE.md`](./CLAUDE.md).

---

## 📜 License

Copyright © 2026 Job Application MCP contributors.

Free software under the **GNU Affero General Public License v3.0-or-later**. See [`LICENSE`](./LICENSE).

Commercial licensing without AGPL obligations: [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md).

---

## 🤝 Contributing

Issues and pull requests welcome. Contributions are licensed under the same AGPL-3.0-or-later terms.

Please keep the **free core fully local** — no gating basic usefulness behind a paid network service.