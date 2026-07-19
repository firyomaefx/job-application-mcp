# Audit Plan — Job Application MCP

**Audit dates:** 2026-07-19 → 2026-07-20
**Framework:** PMP process groups mapped onto Loop Engineering O-A-D-I-E-R.

## 1. Process-group → loop mapping

| PMP group | Loop phase | Activity |
|-----------|-----------|----------|
| Initiating | Observe (start) | Charter, scope, constraints (this doc + AUDIT_CHARTER.md) |
| Planning | Observe | Read-only inventory of code, tests, CI, docs |
| Executing | Analyse | Rank findings by severity; cross-verify agent claims |
| Monitoring | Design | Remediation design per finding; backward-compat plan |
| Executing | Implement | Apply fixes with tests; record evidence |
| Monitoring | Evaluate | Re-run build/test/typecheck/CI; confirm no regressions |
| Closing | Reflect | Update CONTEXT.md; write deliverables; GO/NO-GO |

## 2. Workstreams (14)

1. **Free-core usability** — does the server work with zero config / zero network?
2. **Own-Claude-key path** — can a Free user plug in their own key? (compliance)
3. **Paid/Pro separation** — are paid features server-side, not just local flags?
4. **Entitlement integrity** — can a local entitlement be forged to unlock Pro?
5. **Credit ledger correctness** — grant/topup/debit idempotency & race.
6. **HTTP bridge security** — CORS, auth, loopback binding, import side-effects.
7. **CV parser file scoping** — can `parse_cv` read arbitrary local files?
8. **Privacy / PII logging** — CV text or PII in logs? secret leakage?
9. **MVP exclusions** — CAPTCHA bypass, auto-submit, LinkedIn/Indeed automation?
10. **Submission-approval gate** — does anything submit without user approval?
11. **Desktop packaging** — does electron-builder actually produce installers?
12. **CI/release pipeline** — matrix, Node version, artifact upload, release publish.
13. **Extension** — MV3 permissions, host_permissions, token storage.
14. **Documentation accuracy** — tool counts, layout, config docs vs. reality.

## 3. Discovery method (Observe — read-only)

- Direct file reads of `src/`, `extension/`, `desktop/`, `.github/`, docs.
- Three parallel sub-agents (security lens, free/paid lens, build/release lens)
  fanned out, then their claims **cross-verified against direct reads** before
  being accepted as findings (no agent claim was trusted unverified).
- Test inspection: `tests/*.test.ts` coverage map vs. `src/` surface.
- Local reproduction of the CI/release failures (Node version, electron-builder
  CLI flags, publish-provider crash).

**Rule observed:** no production code was modified during Observe/Analyse.

## 4. Severity assignment

Findings were first collected raw, then ranked using the table in
AUDIT_CHARTER.md §5. Compounding effects were considered (e.g. the CV-parser
file read was raised Medium→Medium-High because it compounds with the open
bridge in H4). Each finding gets a stable ID: `C#`, `H#`, `M#`, `L#`.

## 5. Remediation discipline (Implement)

- Every fix backward-compatible: no tool signature, DB schema, or env-var
  break that would invalidate existing local data.
- Every fix accompanied by a test in `tests/audit-fixes.test.ts` (12 new
  tests) or by CI evidence (C1: green release run).
- No fix silently changes documented Free behaviour.

## 6. Re-test protocol (Evaluate)

1. `npm run typecheck` — clean.
2. `npm run build` — clean.
3. `npm test` — 40/40 pass.
4. stdio MCP smoke against `dist/src/index.js`: `tools/list` count + `status`
   on a **fresh** data dir (rules out stale-state false positives).
5. Push `v0.1.2` tag; watch `release.yml`; require all 5 jobs green,
   including the three desktop installer builds (the C1 target).
6. Confirm the GitHub Release is published (not draft) with all 8 assets.

## 7. Reflect protocol

- CONTEXT.md written **only** in this phase, per audit rule 7.
- No secrets, tokens, or PII in CONTEXT.md (rule 8).
- Final GO/CONDITIONAL GO/NO-GO recorded in RELEASE_READINESS.md.

## 8. Stop conditions

- A Critical finding stays open → release stopped (rule 9).
- A test regression introduced by a fix → revert the fix, re-analyse.
- A backward-incompatibility discovered → rework before merging.