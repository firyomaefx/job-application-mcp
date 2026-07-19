<div align="center">

# Job Application MCP

**A local-first, open-source job application assistant built on the
[Model Context Protocol](https://modelcontextprotocol.io).**

Analyse jobs · Match against your CV · Tailor documents · Preview forms · Track applications —
**all on your machine, nothing uploaded, submission stays in your hands.**

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

</div>

---

## Table of contents

- [Why](#why)
- [What it does (free core)](#what-it-does-free-core)
- [What it deliberately does NOT do](#what-it-deliberately-does-not-do)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Connect an MCP client](#connect-an-mcp-client)
- [Tools reference](#tools-reference)
- [A full example flow](#a-full-example-flow)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Companion apps](#companion-apps)
- [Develop](#develop)
- [How matching works](#how-matching-works)
- [Privacy & data](#privacy--data)
- [Roadmap / Pro upgrade](#roadmap--pro-upgrade)
- [Limitations](#limitations)
- [License](#license)
- [Contributing](#contributing)

---

## Why

Job hunting is repetitive: read a posting, check it against your CV, tweak a cover
letter, fill the same fields on yet another form, and remember where you applied.

**Job Application MCP** turns that into a set of tools any MCP-compatible AI client
(Claude Desktop, Claude Code, others) can drive for you — **while keeping you in
control**:

- Your CV and applications never leave your machine in the free core.
- The assistant prepares and previews; **you** review and submit.
- It's open source under AGPL-3.0, so you can audit exactly what it does.

> ℹ️ This repository is the **free community core** described in
> [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md). Paid AI/cloud/business services
> are intentionally out of scope here.

---

## What it does (free core)

| Capability | Description |
| --- | --- |
| 🧩 **Local MCP server** | A stdio server you connect from any MCP client. |
| 👤 **Candidate profile** | One local profile: skills, headline, contact, summary. |
| 📄 **CV parsing** | Parse **PDF / DOCX / TXT** locally — no upload, no network. |
| 🔍 **Job analysis** | Paste a job description; get extracted key skills + a short summary. |
| 🎯 **Match scoring** | Heuristic **0–100** score with matched / missing skills. |
| ✂️ **Tailoring suggestions** | Structural advice on which skills to surface or add. |
| ✍️ **Answer drafting** | A template starter for screening questions (you rewrite it). |
| 📝 **Form autofill preview** | Maps your profile onto form fields — **preview only, never submits**. |
| 📊 **Application tracking** | Local SQLite store with a status pipeline (draft → submitted → offer…). |

## What it deliberately does NOT do

- ❌ **No automated submission.** You submit manually on the employer's site.
- ❌ **No automation of LinkedIn or Indeed** — their Terms of Service prohibit it. Paste the description and complete those by hand.
- ❌ **No CAPTCHA solving, 2FA bypass, or login recovery** — it pauses for manual action.
- ❌ **No AI rewriting, cloud sync, or premium adapters** — those are future Pro/cloud services.

These aren't missing features; they're the design.

---

## How it works

```text
┌─────────────────┐      stdio (JSON-RPC)      ┌──────────────────────┐
│  MCP client     │  ◀────────────────────────▶│  job-application-mcp │
│  (Claude, etc.) │                             │  (this server)       │
└─────────────────┘                             └──────────┬───────────┘
                                                           │ reads / writes
                                                           ▼
                                                ┌──────────────────────┐
                                                │  local SQLite DB     │
                                                │  + parsed CV text    │
                                                │  (JOB_MCP_DATA_DIR)  │
                                                └──────────────────────┘
```

You (or an AI client) call **tools**. Each tool does a small, auditable thing and
returns structured JSON. Tools that touch external sites do not exist; everything
operates on data you provide and store locally.

---

## Quick start

### Requirements

- **Node.js ≥ 22** (uses the built-in `node:sqlite` — no native compilation needed)
- npm

### Install & build

```bash
git clone https://github.com/<your-user>/job-application-mcp.git
cd job-application-mcp
npm install
npm run build      # -> dist/
```

### Verify it works

```bash
npm test           # 8 unit tests (scoring + store)
node dist/cli/cli.js --help
```

---

## Connect an MCP client

Build the project, then add the server to your MCP client's config.

### Claude Desktop / Claude Code

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

> ⚠️ Use an **absolute** path — MCP clients launch the server from their own
> working directory, not yours.

### Run directly (no client)

```bash
node dist/cli/cli.js serve      # equivalent to: node dist/src/index.js
```

The server speaks JSON-RPC over stdio. See
[A full example flow](#a-full-example-flow) for raw request examples.

---

## Tools reference

All 13 tools are local and synchronous-ish (CV parsing is async). Arguments are
validated with zod; the MCP client receives a JSON Schema for each.

### Profile

| Tool | Args | Returns |
| --- | --- | --- |
| `get_profile` | — | The local candidate profile (auto-created on first call). |
| `update_profile` | `full_name?, email?, phone?, location?, headline?, summary?, skills?, experience_years?` | Updated profile. `skills` replaces the list. |

### CVs

| Tool | Args | Returns |
| --- | --- | --- |
| `parse_cv` | `file_path?` **or** `text`, `label?` | Parsed CV stored locally; detected skills + a short preview. |
| `list_cvs` | — | All stored CVs. |

`parse_cv` supports `.pdf` (pdf-parse), `.docx` (mammoth), and plain text. If you
pass `text`, it's stored as-is.

### Jobs

| Tool | Args | Returns |
| --- | --- | --- |
| `analyze_job` | `description` (≥20 chars), `title?, company?, url?, store?=true` | Extracted keywords + summary; stored as a job (unless `store: false`). |
| `get_job` | `job_id` | A stored job with its keywords. |

### Matching & prep

| Tool | Args | Returns |
| --- | --- | --- |
| `match_cv` | `job_id`, `cv_id`, `save?=false` | 0–100 score, matched/missing/extra skills; optionally creates a draft application. |
| `tailor_cv` | `job_id`, `cv_id` | Suggestions: skills to surface, profile skills to add, genuine gaps. |
| `draft_answer` | `question`, `cv_id?, profile_summary?` | A **template starter** with talking points — not a finished answer. |

### Applications & forms

| Tool | Args | Returns |
| --- | --- | --- |
| `save_application` | `job_id`, `cv_id?, match_score?, tailored_cv_text?, cover_letter?, answers?, notes?` | A **draft** application record. Does not submit. |
| `list_applications` | `status?` | Application records (optionally filtered by status). |
| `update_application_status` | `application_id`, `status`, `notes?` | Updates status; sets `submitted_at` when status is `submitted`. |
| `autofill_form` | `application_id`, `form_fields?` | A **preview** mapping of profile data onto form fields. Nothing is submitted. |

**Status pipeline:** `draft → ready → submitted → interview → offer → rejected → closed`.

---

## A full example flow

Here's a complete session using the stdio JSON-RPC interface directly. (An MCP
client like Claude does this for you in natural language.)

```bash
node dist/src/index.js
```

Send these lines (one JSON-RPC object per line):

```jsonc
// 1. handshake
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}

// 2. set up your profile
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"update_profile","arguments":{"full_name":"Ada Lovelace","headline":"Backend Engineer","skills":["python","sql","aws","docker"]}}}

// 3. analyse + store a job (paste the description text)
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"analyze_job","arguments":{"title":"Backend Engineer","company":"Acme Co","description":"We need a backend engineer with Python, SQL, and AWS to build data pipelines. PostgreSQL and Docker are a plus."}}}

// 4. parse a CV (file path or pasted text)
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"parse_cv","arguments":{"label":"main-cv","text":"Ada Lovelace — Backend Engineer. Python, SQL, AWS, PostgreSQL. Built ETL pipelines..."}}}

// 5. score the CV against the job (save=true creates a draft application)
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"match_cv","arguments":{"job_id":1,"cv_id":1,"save":true}}}

// 6. preview autofill for a form (no submission)
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"autofill_form","arguments":{"application_id":1,"form_fields":[{"name":"name","label":"Full name"},{"name":"email","label":"Email"},{"name":"salary","label":"Salary expectation"}]}}}

// 7. after you submit on the employer's site, mark it submitted
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"update_application_status","arguments":{"application_id":1,"status":"submitted"}}}
```

Step 6 returns a mapping where the `salary` field is flagged
`requires_user_review: true` — sensitive fields always need your eyes.

---

## Configuration

All config is via environment variables. **The free core needs none of them.**

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOB_MCP_DATA_DIR` | `./data` | Where the SQLite DB and parsed data live. |

The following are **placeholders for future Pro/cloud services** (not used by the
free core — see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `JOB_MCP_LICENCE_SERVER` | Pro licence activation endpoint. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Cloud sync & auth (Pro). |
| `AI_PROVIDER` / `AI_API_KEY` | AI tailoring & answer drafting (Pro). |

---

## Project layout

```text
job-application-mcp/
├── src/
│   ├── index.ts           # stdio MCP server entrypoint
│   ├── http.ts            # local HTTP bridge entrypoint (127.0.0.1)
│   ├── server.ts          # server factory + tool registry
│   ├── tools/             # one file per MCP tool
│   │   ├── types.ts       # ToolDef / AnyTool / result helpers
│   │   ├── profile.ts     # get/update_profile
│   │   ├── cv.ts          # parse_cv, list_cvs
│   │   ├── job.ts         # analyze_job, get_job
│   │   ├── matching.ts    # match_cv, tailor_cv, draft_answer
│   │   └── application.ts # save/list/update_application, autofill_form
│   ├── store/             # SQLite layer (node:sqlite)
│   │   ├── db.ts          # open / migrate / close / reset
│   │   ├── profile.ts     # profile CRUD
│   │   └── applications.ts# cv / job / application CRUD
│   ├── cv/parser.ts       # PDF / DOCX / TXT parsing
│   └── lib/
│       ├── types.ts       # domain types
│       └── scoring.ts     # keyword extraction + match scoring (pure)
├── cli/cli.ts             # human CLI: job-mcp serve | serve:http | --help
├── extension/             # Chrome MV3 extension (form capture → preview)
├── desktop/               # Electron wrapper UI (launches the bridge)
├── .github/workflows/ci.yml  # build + typecheck + test + stdio smoke
├── tests/                 # node:test suite
├── BUSINESS_PROPOSAL.md   # open-core + paid-service model
├── CLAUDE.md              # guide for Claude Code working in this repo
└── LICENSE                # AGPL-3.0-or-later
```

---

## Companion apps

The free core is the stdio MCP server above. Two optional companions live in this
repo and talk to a **local HTTP bridge** (same tools, loopback only):

### HTTP bridge

```bash
npm run serve:http      # 127.0.0.1:8787 by default
```

Endpoints: `GET /health`, `POST /call` with `{"name","arguments"}`. Optional
bearer auth via `JOB_MCP_HTTP_TOKEN`. Source: [`src/http.ts`](./src/http.ts).

### Chrome extension — `extension/`

Captures form fields on a career page and asks the bridge to **preview** an
autofill mapping. Never submits. Load it unpacked from `extension/`. See
[`extension/README.md`](./extension/README.md).

### Desktop app — `desktop/`

An Electron wrapper that launches the bridge and shows a dashboard (status,
profile, applications). Run with `cd desktop && npm install && npm start`. See
[`desktop/README.md`](./desktop/README.md).

> Both companions are **read/preview only** and reach only `127.0.0.1`. They
> inherit the project's no-submission, no-LinkedIn/Indeed-automation rules.

---

## Develop

```bash
npm run build       # tsc -> dist/
npm run typecheck   # tsc --noEmit
npm test            # node --test (scoring + store)
npm run dev         # tsc --watch
```

### Adding a tool

1. Create `src/tools/<name>.ts` exporting a `ToolDef<z.ZodObject<…>>`.
2. Register it in `src/tools/index.ts` (add to the `tools` array).
3. Add a test in `tests/` if it has pure logic worth covering.

Tools receive parsed, typed input and return a `ToolResult` (`{ summary, data?, notes? }`).
The server handles JSON Schema generation, validation, and error wrapping for you.

---

## How matching works

Matching is a **pure, heuristic** function in [`src/lib/scoring.ts`](./src/lib/scoring.ts) — no AI, no network.

1. **Extract keywords** from the job description: tokenize, drop stopwords and
   filler verbs, weight tech hints and frequent terms.
2. **Score**: for each job keyword, check the candidate's curated profile skills
   **plus** skills detected in the CV text. Stem-ish matches count (e.g.
   `react` ≈ `reactjs`).
3. **Result**: `score` (0–100), `matched`, `missing`, `extra`, and `notes`
   (e.g. "Below 50% — consider tailoring or skipping").

Formula: `score = matched/total × 100` plus a small, capped breadth bonus for
extra skills (only when there are job keywords). It's intentionally simple and
auditable — a baseline you can replace with the Pro AI scorer later.

---

## Privacy & data

- **Local-first.** CVs, profile, and applications live in `JOB_MCP_DATA_DIR`
  (default `./data`), which is gitignored. The free core makes **no network calls**.
- **No PII in logs.** CV text and personal fields aren't logged at info level.
- **Sensitive fields are flagged.** `autofill_form` marks salary, authorization,
  gender, disability, and consent fields as `requires_user_review: true`.
- **You can wipe everything** by deleting the data directory.

---

## Roadmap / Pro upgrade

The free core is the foundation. [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md)
describes the open-core model. Likely next steps:

- **Free core:** `match_cv` + `tailor_cv` integration test through the MCP layer; richer keyword extraction (skill taxonomy).
- **Distribution:** Windows installer via GitHub Releases; Chrome Web Store extension for form-field capture.
- **Pro (separate hosted services):** AI CV tailoring & cover letters, encrypted cloud backup, multi-device sync, maintained site adapters, application analytics.
- **Business:** multi-candidate accounts, team dashboards, white-label.

Tool handlers are written so a Pro upgrade can slot in without changing the public
tool surface — e.g. `tailor_cv` returns heuristic suggestions today and could call
an AI service tomorrow.

---

## Limitations

- **Keyword extraction is heuristic** and will miss or mis-rank some skills. Confirm
  against the source posting before relying on a match score.
- **No browser automation.** Form fields must be supplied to `autofill_form`
  (manually or, later, via the extension). The tool previews; it doesn't fill.
- **LinkedIn / Indeed:** analysis-only, paste the description, submit manually.
- **Alpha status:** APIs and stored schemas may change before 1.0.

---

## License

Copyright © 2026 Job Application MCP contributors.

This program is free software: you can redistribute it and/or modify it under the
terms of the **GNU Affero General Public License** as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
See [`LICENSE`](./LICENSE).

A separate **commercial licence** is available for embedding without AGPL
obligations — see [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md) §8.

---

## Contributing

Issues and PRs welcome. By contributing you agree your contributions will be
licensed under the same AGPL-3.0-or-later terms.

Please keep the free core **fully local and free** — no feature in this repo may
gate a free-core capability behind a paid/network service. See
[`CLAUDE.md`](./CLAUDE.md) for the conventions used in this codebase.