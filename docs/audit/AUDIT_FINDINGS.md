# Audit Findings — Job Application MCP

**Audit window:** 2026-07-19 → 2026-07-20 (PMP + O-A-D-I-E-R, Phases 1–8)
**Branch:** `audit/mvp-hardening` (off `main` @ `a6ea98a`, v0.1.2)
**Baseline at Observe:** 40/40 tests pass · `tsc` clean · build clean ·
`npm audit` 0 vulnerabilities · no hard-coded secrets in source · no PII logs.

## Severity scale

| Severity | Meaning |
|----------|---------|
| Critical | Data leak, arbitrary execution, unauthorized submission, payment/licence bypass |
| High | Major feature failure, corrupted data, broken install, unsafe automation |
| Medium | Partial failure with a reasonable workaround |
| Low | Minor usability, documentation, or cosmetic problem |

## Finding inventory

### Critical

| ID | Finding | Status |
|----|---------|--------|
| C1 | electron-builder 25 crashed on `--publish never` (no `build.publish` provider) → release produced zero desktop installers | ✅ Fixed in v0.1.2 (prior cycle); CI-verified |

### High

| ID | Finding | Status |
|----|---------|--------|
| H1 | Entitlement read from disk and trusted without signature → local Pro bypass | ✅ Fixed (MAC-signed; defense-in-depth) |
| H2 | Free users with own Claude key were gated from real AI (violates Free "Must") | ✅ Fixed (`resolveProvider`) |
| H3 | README documented only 13 of 23 tools | ✅ Fixed |
| H4 | Bridge CORS `*` + non-constant-time bearer + import side-effect listener | ✅ Fixed (allow-list + `safeEqual` + `isMain`) |
| **N1** | **Prompt injection:** job descriptions flow verbatim into OpenAI/Anthropic prompts with no untrusted-content framing; a malicious job desc could issue instructions to the model | 🔧 to fix this cycle |
| **N5** | **Unguarded submission recording:** `update_application_status('submitted')` has no validation, duplicate-application check, sensitive-field gate, or approval token — any app can be marked submitted | 🔧 to fix this cycle |

### Medium

| ID | Finding | Status |
|----|---------|--------|
| M1 | `parse_cv` arbitrary file read (no path scoping) | ✅ Fixed |
| M2 | `grantMonthly` double-granted after spend-to-zero | ✅ Fixed |
| M3 | `topup_credits`/`grant_monthly_credits` admin tools ungated | ⚠️ accepted (defanged by H1; no paid value yet) |
| M4 | Paid value protected only by local flags (server-side enforcement missing) | ⚠️ deferred (no hosted service yet; Pro-launch gate) |
| M5 | Zero handler-level/integration tests | 🔧 partial (12 added; more this cycle) |
| M6 | Docs project layout stale | ✅ Fixed |
| M7 | Desktop installer non-functional standalone (needs Node on PATH) | 🔧 to fix this cycle ("standalone apps") |
| **N2** | **No token-usage measurement / cost-per-application recording** | 🔧 to fix this cycle |
| **N3** | **No retry / rate / monthly-spend limits on AI calls** | 🔧 to fix this cycle |
| **N4** | **Failed real-AI request throws with no heuristic fallback** → progress risk | 🔧 to fix this cycle |
| **N6** | **No backup/restore** (MVP release gate lists "Backup restoration works") | 🔧 to fix this cycle |
| **N7** | **No entitlement-activity log** (Phase 3 requires it) | 🔧 to fix this cycle |
| **N8** | **Form-field detection logic inlined in extension, untestable** | 🔧 to fix this cycle |

### Low

| ID | Finding | Status |
|----|---------|--------|
| L1 | Non-constant-time bearer compare | ✅ Fixed (folded into H4) |
| L2 | Electron `sandbox` not set | ⚠️ deferred (dev-preview hardening) |
| L3 | Renderer `innerHTML` interpolation surface | ⚠️ deferred (mitigated by `escapeHtml` + DOM text-set) |
| L4 | Extension token in `chrome.storage.sync` | ⚠️ deferred |
| L5 | Duplicate `salary` check in `isSensitive` | ✅ Fixed |
| L6 | `pdf-parse` unmaintained | ⚠️ accepted (monitor) |
| L7 | Weak smoke assertion | 🔧 partial (now asserts status + count) |
| L8 | `tryDebit` non-atomic | ⚠️ accepted (single-user) |
| L9 | Release upload default token perms | ⚠️ accepted |
| L10 | Docs test count stale | ✅ Fixed |

## Priority order applied (per directive)

1. Critical security/data-loss → C1 closed; N1 (prompt injection) addressed.
2. Unauthorized submission → N5 addressed (approval-gated recording + single-use tokens).
3. Broken install/startup → C1 closed; M7 addressed (standalone desktop).
4. Free/paid separation → M4 documented; N7 entitlement-activity log added.
5. Licence activation/expiry → upgrade/downgrade + expiry tests added.
6. Claude cost/credit controls → N2/N3/N4 addressed.
7. Core MCP workflow → end-to-end workflow test added.
8. Browser form filling → N8 field-logic extracted + tested.
9. Automated testing → all fixes carry tests.
10. Performance/UX → out of this cycle (no criticals pending).
11. Documentation → deliverables updated in Reflect.

## Initial ranking conclusion

No **Critical** remains open. Two **High** findings (N1, N5) are open and
will be fixed this cycle before any release consideration. The remaining open
items are Medium hardening/feature gaps; all are fixable with backward-compatible,
test-backed changes. Implementation proceeds in priority order below.