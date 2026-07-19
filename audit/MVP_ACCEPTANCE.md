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
- **Gate: PASS** — submission never occurs without approval.

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