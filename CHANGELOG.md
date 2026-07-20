# Changelog

All notable changes to Job Application MCP are documented here.
This project follows [Semantic Versioning](https://semver.org/). While at 0.x,
breaking changes may bump the minor version.

## [Unreleased]

## [0.4.0] — 2026-07-21

### One-click setup & auto-detect

The app now configures itself with a single click instead of requiring
hand-edited environment variables.

- **“Auto-configure & start” button.** A new **Setup & Status** card at the top
  of the desktop dashboard probes the local environment (is Ollama running? is
  an AI key set? is the bridge up? is there a profile / CV?) and applies the
  best available AI option — Ollama (offline, free) > your key > the built-in
  Mock heuristic — then shows a green checklist for **Bridge · AI · Profile · CV**.
- **One-click settings changes.** Chips switch AI provider live (Mock / Ollama /
  My key) with **no restart** — the bridge applies settings to its own process
  env and the next tool call picks them up. A collapsible **AI settings** form
  sets model, base URL, and API key.
- **Persisted settings (SQLite `meta` kv).** AI provider/model/base-URL/key are
  now stored locally and survive restarts. Precedence: a persisted value
  overrides the environment; an empty persisted value falls back to env — so
  env-only users (v0.3.0 and earlier) are unaffected.
- **New bridge endpoints** (`src/http.ts`, bearer-gated like `/call` when a
  token is set): `GET /detect` (a single `SystemReport`: bridge + AI
  reachability + profile/CV presence + plan), `GET /settings` (current settings,
  **API key masked**), `POST /settings` (validate + persist + apply live). The
  raw API key is never returned by any read path. `handle` is now exported
  (additive, mirrors `allowedOrigin`) so tests can drive the bridge in-process.
- **`system_check` MCP tool.** Returns the same `SystemReport` as `/detect` so
  MCP clients (Claude Desktop / Code / Cursor) can verify the environment and
  tell the user what to fix. Tool count 40 → 41.
- **Detection module** (`src/lib/detect.ts` + `detect-probe.ts`): a pure async
  `probeOllama` (loopback only, keyless, ~1.5s timeout, never throws) +
  `buildSystemReport` shared by the endpoint and the tool.
- **Quickstart replaces the long guide.** `docs/QUICKSTART.pdf` (1 page) focuses
  on install → click “Auto-configure & start” → done. The old 13-page
  `USAGE_GUIDE.*` was removed (the README already lists tools).

### Security & compatibility notes
- **AI key relaxation (documented):** previously env-only, the API key may now
  be stored in the local SQLite `meta` table. It is **masked on every read**
  (`/settings`, `system_check`, the UI), never written to logs
  (`applyPersistedSettingsToEnv` returns only key *names*), and never sent
  off-machine — the only new network touch is the loopback Ollama probe, which
  is keyless. The desktop renderer receives the loopback bearer token via
  `bridge:info` so it can authorize `/detect` & `/settings` when the bridge is
  token-gated; this is acceptable on a single-user local/sandboxed app (the
  renderer already calls `/call`, so the threat model is unchanged).
- **Backward compatible:** empty settings store → bridge behaves identically to
  v0.3.0. No new egress beyond the loopback Ollama probe. Submission gating
  unchanged (still approval-gated, manual, no CAPTCHA bypass).
- Test suite 101 → 134 (33 new: settings pure/store, detect, http endpoints,
  system_check). All schema changes additive (reused `meta`); no user-data
  deletion.

## [0.3.0] — 2026-07-20

### Windows distribution + auto-update + fit-and-finish (Windows roadmap Phase 4)

- **Distribution targets.** The Electron builder now emits both a per-user
  **NSIS** installer and an **MSIX** package for Windows (`desktop/package.json`
  `win.target`). MSIX identity configured (`JobApplicationMCP.Desktop`); NSIS is
  non-one-click, per-user, with a configurable install directory. A reference
  **winget manifest** lives at `packaging/winget/JobApplicationMCP.yaml` (submit
  to `microsoft/winget-pkgs` manually — not automated by CI).
- **Auto-update (electron-updater).** `desktop/main.js` now wires
  `electron-updater` (guarded, packaged-only; never crashes the app if absent).
  On a packaged build it checks the GitHub Releases feed, downloads, and prompts
  via an in-app banner. **Nothing installs without the user clicking
  "Install & restart"** (`update:install` IPC). The update-decision is a pure,
  tested helper (`desktop/version-util.js` `parseVer`/`isUpdateAvailable`) so a
  malformed remote feed never prompts, downgrades, or loops. Update checks
  contact `github.com` (public feed) — documented as opt-out.
- **Windows fit-and-finish.** Stable `AppUserModelId` for taskbar grouping,
  jump lists (`setUserTasks`: "Open Inbox", "New CV"), system light/dark theme
  via `nativeTheme`, an acrylic backdrop on Win11, and an optional tray with a
  context menu. Jump-list flags deep-link to the relevant section.
- **PowerShell module.** `packaging/powershell/JobMcp.psd1` + `.psm1` wrap the
  `job-mcp` CLI for Windows power users: `Start-JobMcpBridge`, `Stop-JobMcpBridge`,
  `Get-JobMcpStatus`, `Import-Job`, `Get-JobInbox`. Talks to the loopback bridge
  only — no direct network egress.
- **Security.** Auto-update install requires explicit user consent; tray is
  optional. No CV text/PII is sent to the update feed (only the app version +
  GitHub release metadata).
- ⚠️ **Code-signing certificate gap (documented, not shipped-as-signed).** The
  MSIX/NSIS installers are **unsigned** until a paid external code-signing
  certificate is obtained. SmartScreen will warn on first install, and MSIX
  requires developer unlock without a trusted cert. See
  `packaging/README.md`. We do not claim the build is signed anywhere in the UI
  or docs.
- Tool count unchanged (39); test suite 96 → 101 (5 new: version-compare helper).

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