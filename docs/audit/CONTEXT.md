# CONTEXT — Job Application MCP (Reflect phase)

> Written only during the Reflect phase per audit rule 7. Contains **no
> secrets, tokens, API keys, or PII** (rule 8). A continuity brief for anyone
> (human or agent) picking up this project after the v0.1.2 audit and the
> Cycle-2 hardening pass.

## 1. Where the project stands

- **Repo:** `firyomaefx/job-application-mcp`. `main` = v0.1.2 (released).
  Cycle-2 hardening is on branch **`audit/mvp-hardening`** (unreleased;
  awaiting authorization to merge + cut a fresh tag).
- **Current release (on main):** `v0.1.2` (commit `24ca9d9`), published as a
  GitHub Release with 8 assets. v0.1.0/v0.1.1 release runs were red; v0.1.2 is
  the first green one.
  URL: https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.1.2
- **Release strategy (decided by product owner):** non-destructive re-release.
  Cut **fresh** version tags. **Never** force-push or rewrite existing remote
  tags.
- **Audit:** Cycle 1 (v0.1.2) = GO, shipped. Cycle 2 (hardening) = ready to
  merge, **not shipped** (no publish/deploy without explicit authorization).
  Deliverables in `docs/audit/`. See `docs/audit/RELEASE_READINESS.md` §6.

## 2. What the system is

Local-first, open-source (AGPL-3.0-or-later) job-application assistant built
on the Model Context Protocol. TypeScript/Node ESM, Node ≥ 22, `node:sqlite`
(built-in, no native deps). Free community core in this repo; paid Pro/cloud
services are **deferred seams** — not built yet.

- stdio MCP server (**28 tools** after Cycle 2) + local HTTP bridge
  (127.0.0.1) sharing the same tools.
- CV parse (PDF/DOCX/TXT), heuristic keyword + 0–100 match scoring,
  tailor/cover-letter/draft-answer (own AI key or heuristic mock) with
  **prompt-injection hardening + cost controls** (Cycle 2),
  application CRUD + analytics, autofill **preview** (never submits) +
  **approval-gated submission recording** (Cycle 2: single-use 10-min token).
- Licence/entitlement + credit ledger + offline grace (seams) +
  **entitlement-activity log** (Cycle 2); payment webhook seam (server-side
  only, not live); Supabase sync seam (local no-op); **local backup/restore**
  (Cycle 2).
- Chrome MV3 extension (form capture → preview), Electron desktop wrapper —
  **standalone as of Cycle 2** (bundled bridge, no system Node).

## 3. What the audits changed

### Cycle 1 (v0.1.2, shipped)
Fixed (with tests/CI): C1 desktop build, H1 entitlement MAC, H2 free-user
own-key AI, H4 bridge CORS/auth/import-guard, M1 parse_cv path scoping, M2
grantMonthly idempotency, H3/M6/L10 docs, L1 constant-time, L5 dup-salary,
L7 smoke. Suite 40.

### Cycle 2 (hardening, branch `audit/mvp-hardening`, unreleased)
Closed 8 new findings + M7, all with tests (suite 40 → **72**):
- **N1** prompt injection → `src/ai/prompt.ts` (shared SYSTEM + `untrusted()`).
- **N2–N4** Claude cost controls → `src/ai/usage.ts` + `src/ai/guard.ts`
  (usage/cost, spend cap, retry/rate, graceful fallback; debit only on
  success). `ai_usage` table (schema v3).
- **N5** approval-gated submission → `src/submission/approval.ts` +
  `src/tools/submission.ts` (`request_approval`/`confirm_submission`;
  `approval_tokens` table, schema v3).
- **N6** backup/restore → `src/store/backup.ts` + `src/tools/backup.ts`
  (`backup_data`/`list_backups`/`restore_data`).
- **N7** entitlement events → `src/licence/events.ts`
  (`entitlement_events` table, schema v3); data preserved across up/down/expiry.
- **N8** form classification → `src/forms/fields.ts` (pure; used by
  `autofill_form`; extension aligned).
- **M7** standalone desktop → `npm run bundle:bridge` (esbuild) →
  `desktop/bridge-bundle.mjs`; `main.js` forks via `ELECTRON_RUN_AS_NODE` +
  `process.execPath`; electron-builder `extraResource`; release.yml runs
  `bundle:bridge` before packaging.

Schema v3 (additive): `approval_tokens`, `entitlement_events`, `ai_usage`.
Tool count 23 → 28. `esbuild` added as an explicit devDependency.

Still accepted/deferred (unchanged): M3 ungated admin credit tools, M4
server-side paid enforcement, L2/L3 desktop sandbox+DOM, L4 extension token
storage, L6 pdf-parse, L8 tryDebit race, L9 release token.

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
npm test            # 72/72 pass (Cycle 2)
npm run bundle:bridge   # builds desktop/bridge-bundle.mjs (needed for desktop)
JOB_MCP_DATA_DIR=./data-smoke node dist/src/index.js   # tools/list=28, status OK
```
For a release: bump versions, tag `v0.x.y` (fresh, no force), push, then
`gh run watch <id> --exit-status` and require all 5 `release.yml` jobs green
(the desktop job now runs `bundle:bridge` before packaging).

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

`docs/audit/AUDIT_CHARTER.md` · `docs/audit/AUDIT_PLAN.md` ·
`docs/audit/AUDIT_FINDINGS.md` ·
`docs/audit/REQUIREMENTS_TRACEABILITY.md` · `docs/audit/RISK_REGISTER.md` ·
`docs/audit/SECURITY_AUDIT.md` · `docs/audit/FREE_PAID_FEATURE_MATRIX.md` ·
`docs/audit/TEST_PLAN.md` · `docs/audit/TEST_RESULTS.md` ·
`docs/audit/MVP_ACCEPTANCE.md` · `docs/audit/RELEASE_READINESS.md` · this file.