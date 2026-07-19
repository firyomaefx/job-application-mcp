# CONTEXT — Job Application MCP (Reflect phase)

> Written only during the Reflect phase per audit rule 7. Contains **no
> secrets, tokens, API keys, or PII** (rule 8). A continuity brief for anyone
> (human or agent) picking up this project after the v0.1.2 audit.

## 1. Where the project stands

- **Repo:** `firyomaefx/job-application-mcp`, branch `main`.
- **Current release:** `v0.1.2` (commit `24ca9d9`), published as a GitHub
  Release with 8 assets (core zip, extension zip, Windows NSIS exe, Linux
  AppImage, macOS DMG, 3 auto-update manifests).
  URL: https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.1.2
- **Release strategy (decided by product owner):** non-destructive re-release.
  Cut **fresh** version tags. **Never** force-push or rewrite existing remote
  tags. v0.1.0/v0.1.1 release runs were red; v0.1.2 is the first green one.
- **Audit:** complete. 11 deliverables in `audit/`. Final decision: **GO**
  (see `audit/RELEASE_READINESS.md`).

## 2. What the system is

Local-first, open-source (AGPL-3.0-or-later) job-application assistant built
on the Model Context Protocol. TypeScript/Node ESM, Node ≥ 22, `node:sqlite`
(built-in, no native deps). Free community core in this repo; paid Pro/cloud
services are **deferred seams** — not built yet.

- stdio MCP server (23 tools) + local HTTP bridge (127.0.0.1) sharing the
  same tools.
- CV parse (PDF/DOCX/TXT), heuristic keyword + 0–100 match scoring,
  tailor/cover-letter/draft-answer (own AI key or heuristic mock),
  application CRUD + analytics, autofill **preview** (never submits).
- Licence/entitlement + credit ledger + offline grace (seams), payment
  webhook seam (server-side only, not live), Supabase sync seam (local no-op).
- Chrome MV3 extension (form capture → preview), Electron desktop wrapper
  (developer preview).

## 3. What the audit changed (v0.1.2)

Fixed (with tests/CI): C1 desktop build, H1 entitlement MAC, H2 free-user
own-key AI, H4 bridge CORS/auth/import-guard, M1 parse_cv path scoping, M2
grantMonthly idempotency, H3/M6/L10 docs, L1 constant-time, L5 dup-salary,
L7 smoke. Versions bumped to 0.1.2 across `package.json`, `desktop/package.json`,
`extension/manifest.json`, `src/server.ts`. 12 new tests in
`tests/audit-fixes.test.ts` (suite now 40).

Accepted/deferred (with rationale): M3 ungated admin credit tools, M4
server-side paid enforcement, M7 desktop standalone non-functional, L2/L3/L4
desktop+extension hardening, L6 pdf-parse, L8 tryDebit race, L9 release token.

## 4. Hard constraints that must persist

- **Free** core: no paid subscription needed, local storage, own Claude key,
  basic prep, never upload PII, never require cloud.
- **Paid** features must be **server-side**, never just local flags: hosted
  Claude, cloud sync, premium adapter updates, team dashboard, usage
  analytics, licence entitlement, managed backups.
- **MVP excludes:** CAPTCHA bypass, unrestricted auto-submission, unlimited
  Claude, full LinkedIn/Indeed automation, automatic legal declarations.
- **Submission never without approval.** Bridge loopback-only. No payment
  secrets/AI keys in desktop. No CV text/PII in logs.

## 5. The Pro-launch checklist (do NOT sell Pro before these)

1. Hosted licence server issuing **server-signed** entitlements (H1 true fix).
2. Server-side enforcement of device limits + AI-credit limits (M4).
3. Move the seven server-side-only features off local flags (M4).
4. Re-evaluate ungated admin credit tools before credits gate real value (M3).

## 6. How to verify a change didn't regress

```bash
npm run typecheck   # 0 errors
npm run build       # 0 errors
npm test            # 40/40 pass
JOB_MCP_DATA_DIR=./data-smoke node dist/src/index.js   # tools/list=23, status OK
```
For a release: tag `v0.x.y` (fresh, no force), push, then
`gh run watch <id> --exit-status` and require all 5 `release.yml` jobs green.

## 7. Conventions worth remembering

- Free path = zero network. Never gate a free-core feature behind a paid call.
- Keep Pro code out of this repo beyond seams; design handlers so Pro can
  slot in later.
- Tests: Node's built-in runner via tsx, prefer pure functions in `src/lib/`.
- Electron-builder 25 **needs** a `build.publish` provider even with
  `--publish never`, and uses `--<platform> <target>` flags (not bare
  `--AppImage` etc.).
- Node ≥ 22 is required (`node:sqlite`). CI matrix is 22/24.

## 8. Non-obvious gotchas discovered

- A parent-directory pnpm store can mask a CI-only typecheck failure
  (`pdf-parse` untyped on clean install → TS7016). Fixed with `@types/pdf-parse`.
- `src/http.ts` used to start its listener on import → EADDRINUSE in tests.
  The `isMain` guard (part of H4) fixed it. Keep that guard.
- `grantMonthly` idempotency must key on a ledger row, not on `balance > 0`,
  or spend-to-zero double-grants (M2).
- Stale `data-smoke` dirs can show leftover credits; always verify on a
  truly fresh `JOB_MCP_DATA_DIR`.

## 9. Audit artefacts

`audit/AUDIT_CHARTER.md` · `audit/AUDIT_PLAN.md` ·
`audit/REQUIREMENTS_TRACEABILITY.md` · `audit/RISK_REGISTER.md` ·
`audit/SECURITY_AUDIT.md` · `audit/FREE_PAID_FEATURE_MATRIX.md` ·
`audit/TEST_PLAN.md` · `audit/TEST_RESULTS.md` ·
`audit/MVP_ACCEPTANCE.md` · `audit/RELEASE_READINESS.md` · this file.