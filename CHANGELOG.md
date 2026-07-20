# Changelog

All notable changes to Job Application MCP are documented here.
This project follows [Semantic Versioning](https://semver.org/). While at 0.x,
breaking changes may bump the minor version.

## [Unreleased]

## [0.2.2] — 2026-07-20

### Job inbox/ranking + follow-up reminders (Windows roadmap Phase 3)

- **Job inbox.** Imported jobs now carry an inbox status (`new` / `triaged` /
  `applied` / `archived`). New tools: `list_job_inbox`, `triage_job`, and
  `rank_jobs`, which ranks your inbox by best application match score plus a
  30-day recency bonus so the freshest well-matched jobs surface first
  (pure, tested `src/lib/inbox.ts`). Archived jobs are excluded by default.
- **Reminders.** New `add_reminder`, `list_reminders`, `due_reminders`,
  `complete_reminder`, `delete_reminder` tools (schema v5 `reminders` table).
  The desktop app surfaces due/overdue reminders on launch. Local-only.
- Schema v5 (additive: jobs `inbox_status` + `reminders` table; no data loss).
- Tool count 32 → 39; test suite 90 → 96.

## [0.2.1] — 2026-07-20

### CV versioning + export + application editing (Windows roadmap Phase 2)

- **CV versioning (schema v4, additive).** Revising a CV now creates a new
  version instead of overwriting: `update_cv` inserts a new row linked via
  `parent_cv_id`, makes it the sole active version of its chain, and preserves
  every prior version's text. `list_cv_versions` shows the full chain;
  `list_cvs` returns active versions only by default (`include_history=true`
  for all). No data is ever deleted.
- **Application editing.** New `update_application` tool edits an existing
  application's tailored CV text, cover letter, screening answers, notes,
  cv_id, or match_score (status unchanged; nothing is submitted).
- **Export.** New `export_cv_markdown` tool renders a CV (optionally with a
  cover letter tailored to a job) to Markdown via a pure, tested exporter.
  The desktop app adds an **Export to PDF** button that renders Markdown to a
  hidden sandboxed window and prints to PDF (Electron `printToPDF`, no new
  npm dependency; Markdown text is escaped before conversion).
- Tool count 28 → 32; test suite 85 → 90.

## [0.2.0] — 2026-07-20

### Local AI + browser job import + desktop hardening (Windows roadmap Phase 1)

- **Local AI via Ollama (fully offline, no key, no cost).** Set
  `AI_PROVIDER=ollama` (no `AI_API_KEY` needed). Reuses the OpenAI-compatible
  transport against `http://localhost:11434/v1` (default model `llama3.1`,
  overridable via `AI_MODEL`/`AI_BASE_URL`). Ollama calls cost $0 and never take
  the Pro-hosted credit path. `--ai <provider>` CLI convenience flag for
  `serve`/`serve:http`. The shared `<untrusted>` prompt framing still applies.
- **Extension: detect + one-click job import.** A content script now runs on
  common job-board URLs, extracts the posting (JSON-LD `JobPosting` preferred,
  `<title>`/body fallback) via a pure, tested extractor, and the popup offers
  "Import this job" → "Analyze & save job", which POSTs to the existing
  `analyze_job` tool on your local bridge. Nothing leaves the machine except to
  your own `127.0.0.1` bridge. Background relay stores the detected job +
  sets a badge, and re-detects on SPA navigations.
- **Security: extension token storage (L4).** The bridge bearer token moved
  from `chrome.storage.sync` to `chrome.storage.local` (one-time migration) so a
  local secret is not synced to your Chrome account.
- **Security: desktop hardening (L2/L3).** Electron renderer now runs in the
  sandbox; all `innerHTML` usage in the renderer replaced with safe DOM
  construction (no XSS surface; status-derived class suffixes sanitized).
- Test suite 72 → 85 (13 new: Ollama provider behaviour + job extractor).

## [0.1.3] — 2026-07-20

### Production-readiness hardening (Cycle 2 audit)

- **Standalone desktop app**: the Windows installer (NSIS), Linux AppImage, and
  macOS DMG no longer require Node.js on the user's PATH. The HTTP bridge is
  esbuild-bundled into a single self-contained file and forked from Electron's
  own bundled Node runtime (`ELECTRON_RUN_AS_NODE`). The release workflow runs
  `bundle:bridge` before packaging.
- **Prompt-injection hardening**: AI prompts now treat job/CV content as
  untrusted. A shared system prompt forbids following instructions inside
  untrusted content or revealing API keys/system prompt/PII, and untrusted
  content is wrapped in `<untrusted>` delimiters (injected closing tags are
  stripped) so a malicious job description cannot escape the wrapper.
- **Claude cost controls**: AI calls now measure token usage and cost, enforce a
  monthly spend cap (`JOB_MCP_AI_MONTHLY_LIMIT_USD`, default $20, 0=unlimited),
  retry with backoff, and rate-limit. A failed or capped real-AI call falls
  back to the local heuristic draft — no debit, workflow continues. Credits are
  debited only on a successful Pro hosted result.
- **Approval-gated submission recording**: a submission can now only be
  *recorded* (never performed) after a full validation gate and a short-lived
  (10 min) single-use approval token. New tools `request_approval` and
  `confirm_submission`. Nothing is ever submitted to a browser.
- **Local backup/restore**: new `backup_data`, `list_backups`, and `restore_data`
  tools. Restore writes a safety snapshot first.
- **Entitlement-activity log**: activate/renew/expire/downgrade events are
  recorded; local data and the credit ledger are preserved across
  upgrade/downgrade/expiry.
- **Form-field classification**: sensitive-field detection and key guessing are
  now a pure, tested module shared by the autofill tool and the extension.
- **Schema v3** (additive): `approval_tokens`, `entitlement_events`, `ai_usage`.
- Tool count 23 → 28; test suite 40 → 72 (all green).

## [0.1.2] — 2026-07-20

### Security / compliance (audit fixes)
- **Bridge CORS hardening**: the HTTP bridge no longer sends
  `Access-Control-Allow-Origin: *`. Only `chrome-extension://` and loopback
  (`127.0.0.1` / `localhost`) origins are reflected; arbitrary web origins get
  no ACAO header and are blocked by the browser. Bearer-token check now uses a
  constant-time compare. The listener is also guarded so importing `http.ts`
  (e.g. in tests) no longer starts a server.
- **Free users can use their own AI key**: `tailor_cv`, `cover_letter`, and
  `draft_answer` now use a real AI provider whenever `AI_API_KEY` is set — on
  the Free **or** Pro plan — instead of gating AI behind the Pro entitlement.
  Using your own key is never debited; only the Pro hosted path debits a credit.
- **`parse_cv` path allow-list**: `file_path` must be inside the data dir
  (`+ cvs/`) or a folder listed in `JOB_MCP_CV_DIRS`. Paths outside the
  allow-list are rejected, so an MCP client cannot read arbitrary files.
- **Entitlement integrity**: the local `entitlement.json` is now MAC-signed with
  a per-install secret; editing it by hand falls back to Free. (Defense-in-depth
  only — real Pro enforcement stays server-side, deferred until the hosted
  service launches.)
- **`grantMonthly` idempotency**: re-granting after spending the balance to zero
  no longer double-grants in the same calendar month.

### Fixed (release)
- Desktop installers now build: electron-builder 25 was crashing on
  `--publish never` because no publish provider was configured. Added a
  `publish` block to `desktop/package.json` and used valid `--<platform>
  <target>` CLI flags.
- Release body no longer hardcodes a GitHub username; desktop installer is
  labelled a developer preview (requires Node.js on PATH; does not bundle the
  bridge).

### Docs
- README tools reference now documents all **23** tools (was 13), including
  `cover_letter`, `application_analytics`, `status`, `credits`/`topup_credits`/
  `grant_monthly_credits`, and the four `admin_*` tools.
- README/CLAUDE project layout updated to include `src/ai/`, `src/licence/`,
  `src/payments/`, `src/sync/`, `src/features.ts`, and `src/lib/crypto.ts` /
  `entitlement.ts`.
- Configuration docs cover `JOB_MCP_CV_DIRS`, `JOB_MCP_HTTP_PORT`/`_TOKEN`, and
  the own-AI-key env vars.

### Tests
- Added `tests/audit-fixes.test.ts` (12 tests) covering the entitlement MAC,
  free-user own-key AI, bridge CORS allow-list, `parse_cv` path scoping, and
  `grantMonthly` spend-out idempotency. Suite is now 40 tests (was 29).

## [0.1.1] — 2026-07-20

### Added
- Stage 2 Pro seams: AI provider abstraction (`src/ai/`), licence/entitlement
  module (`src/licence/`), credit ledger, feature gating (`src/features.ts`),
  application analytics tool, Supabase sync seam (`src/sync/`). Free-core
  paths keep working without any configuration.
- Stage 3 wire-ready: static marketing site (`website/`), credit top-up module,
  payment-webhook seam (env-gated, not live).
- Stage 4 wire-ready: multi-candidate/business DB schema + admin tools.
- Release workflow: GitHub Actions `release.yml` builds the core + Chrome
  extension zip and per-OS desktop installers (AppImage / NSIS / DMG) on tag.

### Fixed
- `@types/pdf-parse` added so `tsc` typecheck passes on a clean install (local
  resolution was masked by a parent pnpm store).
- Require Node ≥ 22 (the `node:sqlite` DB needs it); CI matrix now 22/24.
- Use valid electron-builder 25 CLI flags (`--linux/--win/--mac <target>`) so
  desktop installers actually build instead of printing help and exiting.

## [0.1.0] — 2026-07-20

### Added
- Free community core: TypeScript/Node stdio MCP server with 13 tools
  (`get/update_profile`, `parse_cv`, `list_cvs`, `analyze_job`, `get_job`,
  `match_cv`, `tailor_cv`, `draft_answer`, `save/list/update_application`,
  `autofill_form`). Local SQLite via `node:sqlite` (no native deps).
- CV parsing: PDF (pdf-parse), DOCX (mammoth), TXT — all local.
- Heuristic keyword extraction + 0–100 match scoring (pure, tested).
- Local HTTP bridge (`src/http.ts`, 127.0.0.1 only) reusing the same tools.
- Chrome MV3 extension (`extension/`): form-field capture → autofill preview.
  Never submits; sensitive fields flagged.
- Electron desktop app (`desktop/`): launches the bridge, dashboard UI.
- CLI: `job-mcp serve | serve:http | --help`.
- CI: build + typecheck + test on Node 20/22 (Ubuntu + Windows) + stdio smoke.
- Docs: README, CLAUDE.md, BUSINESS_PROPOSAL.md, CONTRIBUTING, CODE_OF_CONDUCT,
  SECURITY, issue/PR templates.

### Security
- No outbound network calls in the free core. Loopback-only HTTP bridge.
- Optional bearer auth on the bridge via `JOB_MCP_HTTP_TOKEN`.

[Unreleased]: https://github.com/firyomaefx/job-application-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.1.0