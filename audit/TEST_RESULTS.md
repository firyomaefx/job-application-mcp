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