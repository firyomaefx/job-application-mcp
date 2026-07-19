# Job Application MCP — Guide for Claude Code

## Project

Local-first, open-source job application assistant built on the
Model Context Protocol. Free community core; paid Pro/cloud services
are out of scope for this repo (see `BUSINESS_PROPOSAL.md`).

Language: **TypeScript/Node (ESM, Node ≥ 20)**. Local DB: **`node:sqlite`**
(`DatabaseSync`, built into Node — no native deps). MCP transport: **stdio**.

## Layout

- `src/index.ts` — MCP server entrypoint (stdio), wires tools into the SDK.
- `src/http.ts` — local HTTP bridge entrypoint (127.0.0.1). Same tools as stdio,
  for non-stdio clients (Chrome extension, desktop app). Part of the free core.
- `src/server.ts` — server factory + tool registry.
- `src/tools/` — one file per MCP tool. Each exports a `tool` definition
  (name, description, input schema) and a `handler` function.
- `src/store/` — SQLite layer (`db.ts` opens/migrates; `profile.ts`,
  `applications.ts` are CRUD).
- `src/cv/parser.ts` — parse PDF/DOCX/TXT into plain text.
- `src/lib/` — pure helpers (scoring, types). No I/O here.
- `cli/cli.ts` — human CLI: `job-mcp serve | serve:http | --help`.
- `extension/` — Chrome MV3 extension that captures form fields and sends them
  to the HTTP bridge for preview. Never submits.
- `desktop/` — Electron wrapper that spawns the bridge and shows a dashboard.
  Separate package with its own `package.json`.

## Conventions

- Free core must stay genuinely useful and fully local. **Never** add a
  network call that gates a free-core feature behind a paid service.
- Keep paid/Pro code out of this repo; design tool handlers so a Pro
  upgrade could slot in later (e.g. `tailorCv` returns local suggestions
  now, could call an AI service later).
- Privacy: CVs and applications live under `JOB_MCP_DATA_DIR` (default
  `./data`), gitignored. Never log full CV text or PII at info level.
- Submission is **user-approved only** — `autofill_form` returns a
  preview; it never submits. Reflect this in tool descriptions.
- Do not automate LinkedIn/Indeed submission (ToS). Those platforms are
  analysis-and-manual-completion only.

## Commands

- `npm run build` — compile to `dist/`
- `npm test` — run `node --test` suite via tsx
- `npm run typecheck` — `tsc --noEmit`
- `node dist/src/index.js` — start the stdio MCP server
- `npm run serve:http` — start the local HTTP bridge (127.0.0.1:8787)
- `cd extension && node build-icons.js` — regenerate extension icons
- `cd desktop && npm start` — launch the Electron desktop app

## Testing

Add tests under `tests/*.test.ts` using Node's built-in test runner.
Prefer testing pure functions in `src/lib/` directly.