# Requirements Traceability — Job Application MCP

Maps each governing requirement (Free / Paid / MVP / security) to the code
that implements it, the test that proves it, and the audit finding that
touched it. **RT** = requirement ID; **Impl** = implementation location;
**Test** = evidence; **Finding** = audit ID (see RISK_REGISTER.md).

## 1. Free-version requirements

| RT | Requirement | Impl | Test | Finding |
|----|-------------|------|------|---------|
| F1 | Works without paid subscription | `src/features.ts` (default plan = Free); all 23 tools run with no entitlement | `tests/audit-fixes.test.ts` (no-key → mock works); stdio smoke `status → Plan: Free · credits: 0` | — |
| F2 | Stores data locally | `src/store/db.ts` (`node:sqlite`, `JOB_MCP_DATA_DIR`); no outbound calls in free core | `tests/store*.test.ts`; grep: no `fetch` in `src/store` or `src/tools` free paths | — |
| F3 | Allow own Claude API key | `src/ai/openai.ts`, `src/ai/anthropic.ts`; `src/tools/matching.ts` `resolveProvider` uses real provider when `AI_API_KEY` set | `tests/audit-fixes.test.ts` H2 (own-key → real AI, no debit) | **H2** (was gated behind Pro; fixed) |
| F4 | Basic application preparation | `tailor_cv`, `cover_letter`, `draft_answer`, `autofill_form` (preview only) | `tests/scoring.test.ts`; `tests/audit-fixes.test.ts` H2 | — |
| F5 | Never secretly upload personal data | No network call in free core; bridge loopback-only; CV text never logged | grep audit (Observe) | **H4** (CORS), **M1** (file scoping) hardened |
| F6 | Never require cloud for core | Free path has zero cloud deps; `src/sync/supabase.ts` is a local no-op until Pro | grep + smoke | **M4** (documented seam) |

## 2. Paid-version requirements (seams; service not yet built)

| RT | Requirement | Impl (current seam) | Test | Finding |
|----|-------------|---------------------|------|---------|
| P1 | Validate subscription via licence server | `src/licence/index.ts` entitlement + MAC (defense-in-depth); server validation **deferred** | `tests/audit-fixes.test.ts` H1 (tamper/legacy → Free) | **H1** (local MAC added; server-side is the real fix), **M4** |
| P2 | Unlock only approved paid services | `src/features.ts` gating | unit-gated paths | **M4** (must be server-side at launch) |
| P3 | Enforce device limits | entitlement schema field; not enforced locally (server-side) | — | **M4** (deferred) |
| P4 | Enforce AI-credit limits | `src/licence/credits.ts` ledger `tryDebit` | `tests/credits.test.ts`; `tests/audit-fixes.test.ts` M2 | **M2** (idempotency fixed) |
| P5 | Offline grace periods | `src/licence/index.ts` `entitlementWithGrace` (14-day) | `tests/entitlement.test.ts` | — |
| P6 | Downgrade safely on expiry | Free path always available; expiry → FREE plan | `tests/entitlement.test.ts` grace | **H1** (tamper → Free) |
| P7 | Preserve local data after expiry | Data in `JOB_MCP_DATA_DIR`; entitlement never deletes data | schema has no data-delete on expiry | — |

> **Mandatory server-side list** (Hosted Claude, Cloud sync, Premium adapter
> updates, Team dashboard, Usage analytics, Licence entitlement, Managed
> backups) is **not yet implemented** — they are deferred seams. M4 records
> the obligation that these must be server-enforced before any Pro launch.

## 3. MVP exclusion gates

| RT | Excluded capability | Impl status | Test/evidence | Finding |
|----|---------------------|-------------|---------------|---------|
| X1 | CAPTCHA bypass | Not present; no CAPTCHA code anywhere | grep audit (Observe): zero hits | — |
| X2 | Unrestricted automatic submission | `autofill_form` returns **preview only**, never submits; no submit call | tool descriptions + `src/tools/application.ts` | — |
| X3 | Unlimited Claude usage | Free own-key use is the user's own quota; Pro path debits via `tryDebit` | `tests/audit-fixes.test.ts` H2 (no debit on own-key) | **H2** |
| X4 | Full LinkedIn automation | Not present; CLAUDE.md forbids; analysis-and-manual only | grep: no LinkedIn automation | — |
| X5 | Full Indeed automation | Not present; same as X4 | grep: no Indeed automation | — |
| X6 | Automatic legal declarations | Not present; no declaration/affirm code | grep audit | — |

## 4. Security / privacy requirements

| RT | Requirement | Impl | Test | Finding |
|----|-------------|------|------|---------|
| S1 | Submission only with approval | `autofill_form` preview; tool descriptions | manual + grep | — |
| S2 | HTTP bridge loopback-only | `src/http.ts` binds `127.0.0.1` | `tests/audit-fixes.test.ts` H4 | **H4** |
| S3 | No payment secrets / AI keys in desktop | desktop spawns bridge via env; keys read server-side at call time | grep desktop/ | — |
| S4 | No CV text / PII in logs | logging avoids CV payloads | grep `console.*cv` audit | — |
| S5 | Bridge auth + CORS | `allowedOrigin` allow-list + constant-time bearer | `tests/audit-fixes.test.ts` H4 | **H4**, **L1** |
| S6 | parse_cv path scoping | `src/cv/parser.ts` `assertAllowed` | `tests/audit-fixes.test.ts` M1 | **M1** |
| S7 | Entitlement integrity | MAC-signed local entitlement | `tests/audit-fixes.test.ts` H1 | **H1** |

## 5. Traceability summary

- All 6 Free requirements: **met** (F3 fixed in this audit).
- Paid requirements: **seams only**; real enforcement deferred (M4) —
  acceptable because no paid value is currently sold or gated.
- All 6 MVP exclusions: **honoured** (none present).
- All 7 security requirements: **met after fixes** (H1, H4, M1, L1).