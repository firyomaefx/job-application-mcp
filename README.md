# Job Application MCP

> Local-first, open-source job application assistant built on the
> [Model Context Protocol](https://modelcontextprotocol.io).

The free **community core**: analyse job vacancies, match them against your CV,
prepare tailored documents, preview application forms, and track your
applications — all running locally on your machine, with **user-approved
submission only**. Nothing leaves your device.

Licensed under **AGPL-3.0-or-later**. See [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md)
for the open-core + paid-service model.

## Status

Early scaffold of the free core. Not production-ready. No cloud, no AI, no
browser automation — by design.

## What the free core does

- **Local MCP server** (stdio) you can connect from any MCP client.
- **Candidate profile** — one local profile (skills, headline, contact).
- **CV parsing** — PDF / DOCX / TXT, parsed locally (no upload).
- **Job analysis** — paste a job description; extracts key skills + summary.
- **Match scoring** — heuristic 0–100 score with matched / missing skills.
- **Tailoring suggestions** — structural advice on what to surface / add.
- **Answer drafting** — template starter for screening questions (review required).
- **Form autofill preview** — maps profile data onto form fields. **Preview only — never submits.**
- **Application tracking** — local SQLite store, status pipeline.

## What it deliberately does NOT do

- No automated submission. You submit manually on the employer's site.
- **No automation of LinkedIn or Indeed** (their terms prohibit it). Paste the
  job description text and complete those applications by hand.
- No CAPTCHA solving, 2FA bypass, or login recovery — it pauses for manual action.
- No AI rewriting, cloud sync, or premium adapters (those are future Pro/cloud services).

## Requirements

- Node.js ≥ 20
- A C++ toolchain for `better-sqlite3` (prebuilt binaries cover most platforms)

## Install

```bash
git clone <repo> job-application-mcp
cd job-application-mcp
npm install
npm run build
```

## Run as an MCP server

Build, then point any MCP client at the server. For Claude Desktop / Claude Code:

```jsonc
{
  "mcpServers": {
    "job-application-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/job-application-mcp/dist/src/index.js"]
    }
  }
}
```

Or via the CLI: `node dist/cli/cli.js serve` (equivalent to `node dist/src/index.js`)

Data is stored under `JOB_MCP_DATA_DIR` (default `./data`), which is gitignored.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_profile` / `update_profile` | Read / update the local candidate profile |
| `parse_cv` | Parse a CV file or pasted text; store locally |
| `list_cvs` | List stored CVs |
| `analyze_job` | Analyze + store a pasted job description |
| `get_job` | Fetch a stored job |
| `match_cv` | Score a CV against a job |
| `tailor_cv` | Basic CV-tailoring suggestions |
| `draft_answer` | Template starter for a screening question |
| `save_application` | Create / update a draft application |
| `list_applications` | List applications, optionally by status |
| `update_application_status` | Move an application through the pipeline |
| `autofill_form` | Preview form-field mapping (no submission) |

## Develop

```bash
npm run build       # tsc -> dist/
npm test            # node --test (scoring + store)
npm run typecheck   # tsc --noEmit
```

## Project layout

```
src/
  index.ts         stdio MCP server entrypoint
  server.ts        server factory + tool registry
  tools/           one file per MCP tool
  store/           SQLite layer (better-sqlite3)
  cv/parser.ts     PDF/DOCX/TXT parsing
  lib/             pure helpers (scoring, types)
cli/cli.ts         human CLI
tests/             node:test suite
```

## License

Copyright (C) 2026 Job Application MCP contributors.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. See [`LICENSE`](./LICENSE).

A separate commercial licence is available for embedding without AGPL
obligations — see `BUSINESS_PROPOSAL.md`.