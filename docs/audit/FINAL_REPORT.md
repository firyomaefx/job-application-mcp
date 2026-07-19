# Final Report — Job Application MCP Production-Readiness Audit (Cycle 2)

**Audit:** PMP process groups + O-A-D-I-E-R loop engineering
**Window:** continuous to 07:00 Asia/Kuala_Lumpur, 2026-07-20
**Branch:** `audit/mvp-hardening` (dedicated audit branch; not merged)
**Base:** `main` at v0.1.2 (released)
**Authorization boundary:** no publish/deploy, no push to `main`, no tag cut
without explicit user authorization. Honoured — Cycle 2 is staged and
verified, **not shipped**.

---

## 1. Release Decision

**✅ GO (to merge) — pending explicit authorization to ship.**

All MVP release gates pass on the audit branch: no Critical, no High, no
unauthorized submission, free workflow intact, Pro entitlement seam
preserved, Claude cost controls in place, sensitive data protected,
standalone installer builds, backup/restore works, 72/72 core tests pass,
docs accurate. The work is ready to merge and cut a fresh `v0.1.3` tag when
authorized. **No tag was cut and nothing was pushed to `main` or published.**

(No Critical issue remains → audit rule 9 satisfied; release is not blocked.)

---

## 2. Work Completed

Closed 8 new findings (N1–N8) + the deferred M7, each with tests:

- **N1 — Prompt-injection hardening (High):** centralised AI prompts in
  `src/ai/prompt.ts`. SYSTEM declares job/CV content untrusted and forbids
  following instructions inside it or revealing API keys/system-prompt/PII.
  `untrusted()` strips injected `</untrusted>` tags and wraps content. Both
  real providers import the shared prompts.
- **N2 — AI usage + cost measurement (Medium):** `src/ai/usage.ts`
  (`estimateUsage`, `PRICE_TABLE`, `costFor`, `recordUsage`, `monthlySpend`);
  `AiResult` carries `usage` + `cost_usd`; `ai_usage` table (schema v3).
- **N3 — Spend cap + retry + rate limit (Medium):** `monthlyLimit` (env
  `JOB_MCP_AI_MONTHLY_LIMIT_USD`, default 20, 0=unlimited), `canSpend`,
  `maxRetries` (env, default 3), `enforceRateLimit` (env min interval).
- **N4 — Graceful fallback (Medium):** `src/ai/guard.ts` `runAiOp` retries
  with backoff, debits **only on a successful real-AI result** (Pro hosted),
  and degrades to the heuristic MockProvider (no debit) on exhaustion or when
  the cap is hit. A paid-AI failure never blocks the free workflow.
- **N5 — Approval-gated submission recording (High):** `src/submission/approval.ts`
  + `request_approval`/`confirm_submission` tools. Full gate: valid app id,
  approved CV, not already submitted, no duplicate for the same job, no
  unresolved sensitive field, explicit approval, `randomBytes(24)` single-use
  10-min token, constant-time `safeEqual`. **Nothing is submitted to a
  browser** — the tool only records a user-performed submission.
- **N6 — Local backup/restore (Medium):** `src/store/backup.ts` +
  `backup_data`/`list_backups`/`restore_data`. Restore writes a safety
  snapshot first; never deletes user data without one.
- **N7 — Entitlement-activity log + lifecycle (Medium):** `src/licence/events.ts`
  records activate/renew/expire/downgrade/clear into `entitlement_events`
  (schema v3). Local data + credit ledger preserved across upgrade/downgrade/expiry.
- **N8 — Form-field classification (Medium):** `src/forms/fields.ts` (pure:
  `SENSITIVE_PATTERN`, `isSensitiveField`, `guessFieldKey`, `classifyField`).
  Used by `autofill_form`; extension `SENSITIVE` regex aligned;
  `request_approval` accepts the autofill mapping directly.
- **M7 — Standalone desktop app (Medium → Fixed):** `npm run bundle:bridge`
  esbuild-bundles the HTTP bridge into a single self-contained
  `desktop/bridge-bundle.mjs`; `main.js` forks it from Electron's own Node
  via `ELECTRON_RUN_AS_NODE=1` + `process.execPath` — **no system Node.js
  required**. electron-builder ships it as an `extraResource`; `release.yml`
  runs `bundle:bridge` before packaging. (This is the "update to standalone
  apps" instruction.)

---

## 3. Tests Added / Passed / Failed

- **Added:** 32 new tests across 6 new files
  (`ai-cost.test.ts` 11, `approval.test.ts` 8, `forms.test.ts` 4,
  `licence-lifecycle.test.ts` 6, `backup.test.ts` 2, `workflow.test.ts` 1) +
  `audit-fixes.test.ts` H2 updated.
- **Passed:** **72/72**.
- **Failed:** 0.
- No real job submission occurs in any test (all submission paths are
  recording-only; no browser/DOM submission). No paid AI calls (deterministic
  MockProvider + a fake FailingProvider).

```
$ npm test
... 72 tests … pass 72, fail 0, cancelled 0, duration_ms ~535
```

---

## 4. Build Status

```
$ npm run typecheck   # tsc --noEmit        → exit 0, no errors
$ npm run build       # tsc                 → exit 0, dist/ produced
$ npm run bundle:bridge                    → desktop/bridge-bundle.mjs (12.5 MB)
$ node --check desktop/main.js             → OK
```
Standalone bridge smoke: starts, `/health` lists 28 tools, `get_profile` and
`parse_cv` (txt) work end-to-end through the bundle with no system Node.

CI (`ci.yml`, Node 22/24 × ubuntu/windows) was green for v0.1.2 and is
unchanged in its gate logic; `release.yml` desktop job now runs
`bundle:bridge` before packaging (not yet exercised in CI — no tag cut).

---

## 5. Findings (this cycle)

### Critical
None open. (C1 from Cycle 1 remains fixed.)

### High
- **N1** prompt injection → ✅ Fixed (tested).
- **N5** unguarded submission → ✅ Fixed (tested).

### Medium
- **N2** no usage/cost → ✅ Fixed.
- **N3** no spend cap/retry/rate → ✅ Fixed.
- **N4** no fallback on AI failure → ✅ Fixed.
- **N6** no backup/restore → ✅ Fixed.
- **N7** no entitlement log → ✅ Fixed.
- **N8** form logic untestable → ✅ Fixed.
- **M7** desktop non-standalone → ✅ Fixed (Cycle 2).

### Low (unchanged from Cycle 1, deferred)
L2 (Electron sandbox), L3 (renderer innerHTML), L4 (extension token in
`chrome.storage.sync`), L6 (`pdf-parse` unmaintained), L8 (`tryDebit` race),
L9 (release token perms).

---

## 6. Status by dimension

| Dimension | Status |
|-----------|--------|
| **Free** | ✅ PASS — all 6 Free "Must" met; own-key AI now with spend cap + graceful fallback. |
| **Paid / Pro** | ⚠️ DEFERRED — seams only; no paid value sold/gated; M4 server-side obligations unchanged. |
| **Claude** | ✅ PASS — usage/cost measured, monthly cap (default $20), retry/rate limit, graceful fallback; debit only on successful Pro result. |
| **Licence** | ✅ PASS (free-core) / ⚠️ DEFERRED (Pro) — MAC-signed local entitlement (H1) + lifecycle log (N7); server-signed entitlements still M4. |
| **Browser (extension)** | ✅ PASS with deferred L4 — MV3, activeTab, localhost host_permissions, preview-only; token storage → `chrome.storage.local` pending. |
| **Security** | ✅ PASS (free-core) — N1 prompt injection closed; H4/M1/L1 from Cycle 1 hold; M4 is the Pro-launch obligation. |
| **Backup** | ✅ PASS — local backup/restore (N6) with safety snapshot on restore. |
| **Submission approval** | ✅ PASS — N5 full gate + single-use short-lived token; never submits to a browser. |
| **Desktop** | ✅ PASS (standalone, M7 fixed) — bundled bridge, no system Node; L2/L3 hardening still deferred. |

---

## 7. Changes Made

- New modules: `src/ai/prompt.ts`, `src/ai/usage.ts`, `src/ai/guard.ts`,
  `src/submission/approval.ts`, `src/tools/submission.ts`,
  `src/forms/fields.ts`, `src/licence/events.ts`, `src/store/backup.ts`,
  `src/tools/backup.ts`.
- Edited: `src/store/db.ts` (schema v3), `src/ai/provider.ts`,
  `src/ai/mock.ts`, `src/ai/openai.ts`, `src/ai/anthropic.ts`,
  `src/tools/matching.ts` (debit moved into `runAiOp`), `src/tools/application.ts`
  (uses `classifyField`), `src/licence/index.ts` (records events),
  `src/tools/index.ts` (28 tools), `extension/popup/popup.js` (regex aligned).
- Desktop standalone: `desktop/main.js` (fork via `ELECTRON_RUN_AS_NODE`),
  `desktop/package.json` (extraResource), `desktop/README.md`,
  root `package.json` (`bundle:bridge` script + `esbuild` devDep),
  `.github/workflows/release.yml` (run `bundle:bridge`), `.gitignore`
  (ignore generated bundle), `CLAUDE.md`.
- Docs/audit: AUDIT_FINDINGS.md + Cycle-2 sections in TEST_RESULTS,
  RISK_REGISTER, SECURITY_AUDIT, FREE_PAID_FEATURE_MATRIX, MVP_ACCEPTANCE,
  RELEASE_READINESS, REQUIREMENTS_TRACEABILITY, CONTEXT; this final report.

---

## 8. Files Changed (summary)

Source (new): 9 files. Source (edited): 11 files. Tests (new): 6 files;
tests (edited): 1. Desktop/config/CI: 7 files. Docs/audit: 10 files.
Generated (gitignored): `desktop/bridge-bundle.mjs`.

---

## 9. Known Limitations

- Paid/Pro is a seam, not a product — server-side enforcement (M4) and
  server-signed entitlements (H1 true fix) are required before any Pro launch.
- Desktop: Electron `sandbox` (L2) and safe DOM construction (L3) not yet
  enabled; the renderer is dev-preview.
- Extension bridge token still in `chrome.storage.sync` (L4).
- `pdf-parse` is unmaintained (L6); the bundled bridge inlines pdf-parse/mammoth
  — txt/docx verified through the bundle, real-PDF-through-packaged-app not
  exercised in this cycle.
- `tryDebit` is not atomic (L8) — single-user local SQLite, low practical risk.
- No full http-bridge black-box (spawn+fetch) test yet (M5 partial); CORS/auth
  logic is unit-tested via `allowedOrigin`/`authorized`.

---

## 10. Blocked Items

- **Merge + release:** blocked on explicit user authorization (per directive:
  "Do not publish or deploy without explicit user authorization"). Branch is
  ready; no push to `main`, no tag cut.
- Nothing is blocked on technical grounds — all gates pass.

---

## 11. Required Actions

| # | Action | Owner | State |
|---|--------|-------|-------|
| A1 | Authorize merge of `audit/mvp-hardening` → `main` | user | ⏳ |
| A2 | Bump versions to 0.1.3 (`package.json`, `desktop/package.json`, `extension/manifest.json`, `src/server.ts`) | release | at release time |
| A3 | Cut a fresh `v0.1.3` tag (no force-push, no tag rewrite) | release | after A1 |
| A4 | `gh run watch <id> --exit-status`; require all 5 release.yml jobs green (now incl. `bundle:bridge`) | release | after A3 |
| A5 | Before any Pro launch: server-signed entitlements + server-side enforcement of the seven server-side-only features (M4) + re-evaluate ungated admin credit tools (M3) | future | tracked |

---

## 12. Recommended Next Iteration

1. **Merge + ship v0.1.3** (after authorization) — the hardening is staged
   and verified.
2. **Desktop hardening pass:** enable Electron `sandbox`, replace `innerHTML`
   with safe DOM construction (L3), and exercise a real PDF through the
   packaged standalone app (verify pdf-parse in the bundle).
3. **Extension release:** move the bridge token to `chrome.storage.local` (L4).
4. **Pro-launch track (M4):** build the hosted licence server (server-signed
   entitlements — H1 true fix), enforce device + AI-credit limits server-side,
   and move hosted Claude / cloud sync / adapter updates / team dashboard /
   analytics / managed backups off local flags. **Do not sell Pro before this.**
5. **Test depth:** add a black-box http-bridge integration test
   (spawn `bridge-bundle.mjs` + fetch `/health` + `/call`) to lock the
   standalone packaging path in CI.

---

**Bottom line:** the system is production-ready as a free-core MVP. Cycle 2
closes every High and Medium finding actionable in this repo, makes the
desktop app genuinely standalone, and adds the Claude cost controls,
prompt-injection defence, approval-gated submission, backup/restore, and
entitlement-audit trail the directive required — all verified by 72 passing
tests. It is staged on `audit/mvp-hardening`, ready to ship on authorization.