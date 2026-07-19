# Test Plan — Job Application MCP

## 1. Test strategy

| Level | Scope | Runner | Where |
|-------|-------|--------|-------|
| Unit (pure) | `src/lib/*` (scoring, crypto, entitlement limits, types) | `node --test` via tsx | `tests/*.test.ts` |
| Unit (handler) | tool handlers + licence/credit/parser logic | `node --test` via tsx | `tests/*.test.ts` incl. `audit-fixes.test.ts` |
| Build/typecheck | whole repo | `tsc --noEmit`, `tsc` | CI + local |
| Stdio smoke | built server end-to-end | manual JSON-RPC over stdio | CI + local |
| CI matrix | Node 22/24 × ubuntu/windows | GitHub Actions | `.github/workflows/ci.yml` |
| Release | tag → build core+extension+desktop → publish | GitHub Actions | `.github/workflows/release.yml` |

## 2. Test inventory (40 tests)

| File | Tests | Covers |
|------|-------|--------|
| `tests/scoring.test.ts` | keyword extraction + 0–100 match scoring | `src/lib/scoring.ts` |
| `tests/store*.test.ts` | profile + applications CRUD | `src/store/*` |
| `tests/credits.test.ts` | `grantMonthly`, `applyTopup`, `tryDebit` | `src/licence/credits.ts` |
| `tests/entitlement.test.ts` | plan limits, offline grace | `src/lib/entitlement.ts`, `src/licence/index.ts` |
| `tests/payments.test.ts` (8) | webhook HMAC + events; referral code/resolve | `src/payments/webhook.ts`, `src/licence/referral.ts` |
| `tests/audit-fixes.test.ts` (12) | H1 MAC (round-trip/tamper/legacy), H2 own-key/no-key, H4 origin allow/block, M1 parse inside/outside, M2 spend-to-zero/topup-dedup | audit fixes |

## 3. Audit-fix test cases (`tests/audit-fixes.test.ts`)

| Case | Asserts | Finding |
|------|---------|---------|
| H1 MAC round-trip | stored entitlement verifies and reads back | H1 |
| H1 tamper → Free | editing `entitlement.json` falls back to Free | H1 |
| H1 legacy → Free | unsigned legacy file rejected → Free | H1 |
| H2 own-key real AI, no debit | `AI_API_KEY` set + no entitlement → real provider, `tryDebit` not called | H2 |
| H2 no-key → mock | no `AI_API_KEY` → mock heuristic provider | H2 |
| H4 allow extension origin | `allowedOrigin` returns chrome-extension origin | H4 |
| H4 allow loopback origin | `allowedOrigin` returns 127.0.0.1 / localhost | H4 |
| H4 block arbitrary origin | `allowedOrigin` returns null for `https://evil.com` | H4 |
| M1 accept inside data dir | `parseCvFile` accepts `<dataDir>/cvs/x.txt` | M1 |
| M1 reject outside | `parseCvFile` rejects `/etc/passwd`-style path | M1 |
| M2 spend-to-zero no double-grant | grant → spend all → re-grant same month = no extra | M2 |
| M2 topup dedup | duplicate topup code rejected | M2 |

All tests use an isolated `JOB_MCP_DATA_DIR` (`./data-test-audit-fixes`) so
they never touch real user data.

## 4. Acceptance criteria

- `npm run typecheck` → 0 errors.
- `npm run build` → 0 errors, `dist/` produced.
- `npm test` → 40/40 pass, 0 fail.
- stdio smoke: `tools/list` count = 23; `status` → `Plan: Free · credits: 0`
  on a fresh data dir.
- CI: green on Node 22 + 24, ubuntu + windows.
- Release: `release.yml` all 5 jobs green; GitHub Release published (not
  draft) with core zip + extension zip + 3 desktop installers + update
  manifests.

## 5. What is intentionally NOT tested yet (deferred)

- Full http-bridge end-to-end (spawn `dist/src/http.js` + fetch) — the
  CORS/auth logic is unit-tested via `allowedOrigin`/`authorized`; a
  black-box fetch test is a future workstream (M5 residual).
- Electron desktop runtime (launch + bridge spawn) — manual; dev-preview (M7).
- Chrome extension against live career sites — out of scope (MVP excludes
  automation); manual load + preview only.
- Hosted Pro paths — code does not exist yet (M4).