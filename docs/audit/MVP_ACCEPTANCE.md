# MVP Acceptance — Job Application MCP (v0.1.2)

Verifies the MVP scope is honoured: the free core is genuinely useful and
fully local, and every MVP-excluded capability is **absent**.

## 1. Free-core MVP acceptance criteria

| # | Criterion | Method | Result |
|---|-----------|--------|--------|
| A1 | Server starts with zero config and no network | `node dist/src/index.js` in a fresh `JOB_MCP_DATA_DIR` | ✅ starts, creates local DB |
| A2 | Lists 23 tools via MCP `tools/list` | stdio smoke | ✅ count = 23 |
| A3 | `status` works on a fresh install | stdio smoke | ✅ `Plan: Free · credits: 0` |
| A4 | CV parse works locally (PDF/DOCX/TXT) | unit + path-scope tests | ✅ local, path-scoped (M1) |
| A5 | Match scoring is pure & local | `tests/scoring.test.ts` | ✅ |
| A6 | `tailor_cv`/`cover_letter`/`draft_answer` work with own key on Free | `audit-fixes.test.ts` H2 | ✅ (fixed) |
| A7 | `autofill_form` returns a **preview**, never submits | tool source + grep | ✅ |
| A8 | Application CRUD + analytics work locally | `tests/store*.test.ts` | ✅ |
| A9 | No outbound network call on the free path | grep audit | ✅ |
| A10 | Bridge loopback-only + CORS allow-list | `audit-fixes.test.ts` H4 | ✅ (fixed) |
| A11 | Local data preserved; nothing auto-deleted | schema review | ✅ |

**MVP free-core acceptance: PASS (11/11).**

## 2. MVP exclusion acceptance (must be ABSENT)

| Excluded capability | Method | Result |
|---------------------|--------|--------|
| CAPTCHA bypass | grep for captcha/solver/token-bypass | ✅ absent |
| Unrestricted automatic submission | read `autofill_form`; grep for submit | ✅ absent — preview only |
| Unlimited Claude usage | own-key use = user's own quota; Pro path debits | ✅ — no unlimited path (H2) |
| Full LinkedIn automation | grep linkedin + automation | ✅ absent (analysis-and-manual only) |
| Full Indeed automation | grep indeed + automation | ✅ absent |
| Automatic legal declarations | grep declare/affirm/legal auto | ✅ absent |

**MVP exclusion acceptance: PASS (6/6 absent).**

## 3. Submission-approval gate

- `autofill_form` returns a structured preview of mapped fields; it performs
  **no** DOM submission, no `form.submit()`, no click on a submit button.
- Tool descriptions explicitly state submission is user-approved only.
- Chrome extension popup shows a preview and requires the user to act; it
  does not auto-submit.
- **Cycle 2 (N5):** submission *recording* is now gated end-to-end.
  `request_approval` runs a validation gate (valid app id · approved CV · not
  already submitted · no duplicate for the same job · no unresolved sensitive
  field) and issues a short-lived (10-min) single-use `randomBytes(24)` token.
  `confirm_submission` consumes the token via constant-time `safeEqual`,
  re-runs the gate, and marks the application submitted. **No browser
  submission is ever performed** — the tool only records a user-performed
  submission. Tests: `approval.test.ts` (8) + `workflow.test.ts`.
- **Gate: PASS** — submission never occurs without approval, and a submission
  cannot be recorded without a valid, unused, unexpired approval token.

## 4. Privacy acceptance

| Criterion | Result |
|-----------|--------|
| No secret upload of personal data | ✅ no free-path upload |
| CV text / PII not logged | ✅ |
| No payment secrets / AI keys in desktop | ✅ keys read from env at call time |
| Bridge loopback + CORS allow-list | ✅ (H4) |
| parse_cv path-scoped | ✅ (M1) |

**Privacy acceptance: PASS.**

## 5. MVP verdict

The v0.1.2 free core satisfies every MVP acceptance criterion and excludes
every capability the MVP gates forbid. **MVP ACCEPTED.**

---

## 6. Cycle 2 hardening acceptance (2026-07-20, branch `audit/mvp-hardening`)

| # | Criterion | Method | Result |
|---|-----------|--------|--------|
| B1 | No prompt-injection escape from job/CV content | `ai-cost.test.ts` N1 (wrapper, tag-strip, no escape) | ✅ |
| B2 | AI usage + cost measured; mock = 0 cost | `ai-cost.test.ts` N2 | ✅ |
| B3 | Monthly spend cap + retry + rate limit enforced | `ai-cost.test.ts` N3 | ✅ |
| B4 | Paid-AI failure → heuristic fallback, no debit, workflow continues | `ai-cost.test.ts` N4 | ✅ |
| B5 | Submission recording requires valid + unused + unexpired single-use token + full validation gate | `approval.test.ts` + `workflow.test.ts` | ✅ |
| B6 | Local backup/restore works; restore makes a safety snapshot first | `backup.test.ts` | ✅ |
| B7 | Entitlement lifecycle logged; data preserved across upgrade/downgrade/expiry | `licence-lifecycle.test.ts` | ✅ |
| B8 | Form-field classification is pure + testable; extension aligned | `forms.test.ts` | ✅ |
| B9 | Desktop app is standalone (bundled bridge, no system Node) | bridge bundle smoke: /health, get_profile, parse_cv | ✅ |
| B10 | No real job submission during automated testing | all submission tests use the recording-only path; no browser/DOM submission | ✅ |

**Cycle 2 acceptance: PASS (10/10).** No Critical or High finding remains open.
MVP exclusions remain honoured (X1–X6 unchanged).