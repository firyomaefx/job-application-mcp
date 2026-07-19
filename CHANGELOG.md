# Changelog

All notable changes to Job Application MCP are documented here.
This project follows [Semantic Versioning](https://semver.org/). While at 0.x,
breaking changes may bump the minor version.

## [Unreleased]

### Added
- Stage 2 Pro seams: AI provider abstraction (`src/ai/`), licence/entitlement
  module (`src/licence/`), credit ledger, feature gating (`src/features.ts`),
  application analytics tool, Supabase sync seam (`src/sync/`). Free-core
  paths keep working without any configuration.
- Stage 3 wire-ready: static marketing site (`website/`), credit top-up module,
  payment-webhook seam (env-gated, not live).
- Stage 4 wire-ready: multi-candidate/business DB schema + admin tools.

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