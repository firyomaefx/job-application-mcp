# Test Results — Job Application MCP (v0.1.2)

**Run date:** 2026-07-20
**Commit:** `24ca939` (tag `v0.1.2`)

## 1. Local verification (Evaluate phase)

### typecheck
```
$ npm run typecheck
> tsc --noEmit
(exit 0, no errors)
```

### build
```
$ npm run build
> tsc
(exit 0, dist/ produced)
```

### unit tests
```
$ npm test
> node --test --import tsx tests/*.test.ts
... 40 tests … 40 pass, 0 fail
pass: 40, fail: 0, cancelled: 0
```
Breakdown: scoring + store + credits + entitlement + payments(8) +
audit-fixes(12) = 40.

### stdio smoke (fresh data dir)
```
$ JOB_MCP_DATA_DIR=./data-fresh-verify node dist/src/index.js
tools/list ok, count= 23
status -> Plan: Free · credits: 0
```
A second run on a fresh dir confirmed `credits: 0` (an earlier `credits: 5`
was stale state in a leftover `data-smoke` dir, **not** an auto-grant bug —
verified by wiping and re-running).

## 2. CI verification

Workflow `ci.yml`, matrix Node 22/24 × ubuntu/windows: green (the Node ≥ 22
fix from v0.1.1 resolved the `node:sqlite` unavailability on Node 20).

## 3. Release verification (the C1 target)

Tag `v0.1.2` pushed → `release.yml` run `29697683404`:

```
status: completed
conclusion: success
jobs:
  - Core + extension zip        : success
  - Desktop installer (ubuntu)  : success   ← AppImage built
  - Desktop installer (windows) : success   ← NSIS exe built
  - Desktop installer (macos)   : success   ← DMG built
  - Publish GitHub Release      : success
```

Published release (not a draft): https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.1.2

Assets (8):
| Asset | Size |
|-------|------|
| job-application-mcp-core-dist.zip | 186 KB |
| job-application-mcp-extension.zip | 10 KB |
| Job.Application.MCP.Setup.0.1.2.exe (NSIS) | 81.6 MB |
| Job.Application.MCP-0.1.2.AppImage | 108 MB |
| Job.Application.MCP-0.1.2-arm64.dmg | 98.4 MB |
| latest.yml / latest-mac.yml / latest-linux.yml | auto-update manifests |

> Contrast: the `v0.1.0` and `v0.1.1` release runs **failed** (electron-builder
> null-provider crash + invalid CLI flags). v0.1.2 is the first green release.

## 4. Audit-fix test evidence mapping

| Finding | Test(s) that prove the fix | Result |
|---------|----------------------------|--------|
| C1 | `release.yml` run 29697683404, 3 desktop jobs green | ✅ |
| H1 | `audit-fixes.test.ts`: MAC round-trip, tamper→Free, legacy→Free | ✅ |
| H2 | `audit-fixes.test.ts`: own-key real AI no debit; no-key→mock | ✅ |
| H3 | README/CLAUDE review (23 tools, config, layout) | ✅ |
| H4 | `audit-fixes.test.ts`: allow/block origins + import side-effect gone | ✅ |
| M1 | `audit-fixes.test.ts`: accept inside / reject outside | ✅ |
| M2 | `audit-fixes.test.ts`: spend-to-zero no double-grant + topup dedup | ✅ |
| M6/L10 | docs review (layout, "40 unit tests") | ✅ |
| L1 | folded into H4 (`safeEqual`) | ✅ |
| L5 | `application.ts` isSensitive no longer duplicates salary | ✅ |
| L7 | smoke now asserts `status` + count, not count alone | 🔧 partial |

## 5. Regression check

No existing test regressed. The only test-environment issue encountered
(EADDRINUSE on 127.0.0.1:8787) was caused by the http.ts import side-effect
itself and was fixed by the `isMain` guard (part of H4) — i.e. the fix
resolved the failure rather than introducing it.

## 6. Conclusion

All release-gating acceptance criteria in TEST_PLAN.md §4 are met:
typecheck clean, build clean, 40/40 tests pass, smoke confirms 23 tools +
fresh-state status, CI green, and the release run is green with a published
release and all 8 assets. **C1 is verified fixed in CI.**

---

## 7. Cycle 2 — production-readiness hardening (2026-07-20, branch `audit/mvp-hardening`)

A second `/goal` audit pass (PMP + O-A-D-I-E-R) closed the remaining
production-readiness gaps without cutting a new release (no publish/deploy
without explicit authorization; no push to `main`).

### typecheck / build / tests
```
$ npm run typecheck     # tsc --noEmit        → exit 0, no errors
$ npm run build         # tsc                 → exit 0, dist/ produced
$ npm test              # node --test tsx
... 72 tests … 72 pass, 0 fail
pass: 72, fail: 0, cancelled: 0, duration_ms ~535
```
Suite grew from 40 → **72** (+32 new tests across 6 new files).

### New test files and coverage

| File | Tests | Proves |
|------|-------|--------|
| `tests/ai-cost.test.ts` | 11 | N1 prompt-injection (SYSTEM untrusted, `<untrusted>` wrapper, injected closing tag stripped, no escape), N2 usage+cost (mock usage>0 cost 0, costFor openai>0), N3 spend cap / maxRetries env / monthlyLimit default 20, N4 fallback (failing provider → heuristic, no debit, 3 attempts; cap-exhausted → provider not called) |
| `tests/approval.test.ts` | 8 | N5 token issue, no-CV block, duplicate block, single-use, expiry, sensitive-field block, bogus-token (constant-time), already-submitted |
| `tests/forms.test.ts` | 4 | N8 guessFieldKey, isSensitiveField, classifyField review logic, SENSITIVE_PATTERN/SKIP_FIELD_TYPES |
| `tests/licence-lifecycle.test.ts` | 6 | N7 activate/downgrade/expire events, expiry past grace → Free, within grace → Pro, data preserved after downgrade, credits preserved after downgrade |
| `tests/backup.test.ts` | 2 | N6 backup writes file + lists; restore rolls back to snapshot + safety backup |
| `tests/workflow.test.ts` | 1 | Phase 5 end-to-end: import → score → draft → autofill preview → request_approval (blocks on sensitive) → resolve → confirm_submission → recorded application |

`tests/audit-fixes.test.ts` H2 updated for the new `resolveProvider` →
`{provider, usedAi, proHosted}` shape (debit moved into `runAiOp`).

### Standalone desktop bridge smoke (M7 fix)
```
$ npm run bundle:bridge    # esbuild dist/src/http.js → desktop/bridge-bundle.mjs (12.5 MB, self-contained)
$ JOB_MCP_DATA_DIR=./data-test-standalone JOB_MCP_HTTP_PORT=8799 node desktop/bridge-bundle.mjs
job-application-mcp HTTP bridge listening on http://127.0.0.1:8799
$ curl /health        → {"ok":true,"data":{"tools":[…28 tools…]}}
$ curl /call get_profile → ok, profile returned
$ curl /call parse_cv (txt) → ok, CV stored + skills detected
```
`desktop/main.js` forks the bundle via `ELECTRON_RUN_AS_NODE=1` +
`process.execPath` (Electron's own Node) — **no system Node.js required** at
runtime. `node --check desktop/main.js` passes.

### Cycle 2 finding → test evidence mapping

| Finding | Test(s) | Result |
|---------|---------|--------|
| N1 prompt injection | `ai-cost.test.ts` (3 cases) | ✅ |
| N2 usage + cost | `ai-cost.test.ts` (3 cases) | ✅ |
| N3 spend cap / retry / rate | `ai-cost.test.ts` (3 cases) | ✅ |
| N4 graceful fallback (no debit) | `ai-cost.test.ts` (2 cases) | ✅ |
| N5 approval-gated submission | `approval.test.ts` (8) + `workflow.test.ts` | ✅ |
| N6 backup/restore | `backup.test.ts` (2) | ✅ |
| N7 entitlement events + lifecycle | `licence-lifecycle.test.ts` (6) | ✅ |
| N8 form-field classification | `forms.test.ts` (4) | ✅ |
| M7 standalone desktop | bridge bundle smoke (health/call/parse_cv) | ✅ |