# Release Readiness — Job Application MCP (v0.1.2)

**Audit dates:** 2026-07-19 → 2026-07-20
**Release:** v0.1.2 · commit `24ca9d9` · tag `v0.1.2`
**Published:** https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.1.2
**Release strategy:** non-destructive re-release (fresh version tags; no
force-push / no tag rewrite), per product-owner decision.

---

## FINAL DECISION: ✅ GO

The v0.1.2 free-core release is **approved**. All release-gating findings are
fixed with test or CI evidence; no Critical remains open (audit rule 9
satisfied); the release pipeline is green and the GitHub Release is published
with all assets.

The decision is **GO**, not "CONDITIONAL GO", because the only residual
items are explicitly scoped to a **future Pro launch** (no paid value is sold
or gated today) and to a **desktop hardening track** that is honestly labelled
"developer preview". Neither blocks the free-core release.

---

## 1. Finding summary by severity

| Severity | Total | Fixed | Accepted/Deferred | Partial | Open Critical |
|----------|-------|-------|-------------------|---------|---------------|
| Critical | 1 | 1 | 0 | 0 | **0** |
| High | 4 | 4 | 0 | 0 | — |
| Medium | 7 | 4 | 3 (M3,M4,M7) | 1 (M5) | — |
| Low | 10 | 4 | 6 (L2,L3,L4,L6,L8,L9) | 1 (L7) | — |

Detail: RISK_REGISTER.md.

### Fixed before release (with evidence)
- **C1** desktop installers build — `release.yml` run 29697683404, 3 desktop jobs green.
- **H1** entitlement integrity — MAC-signed local token; tests (round-trip/tamper/legacy→Free).
- **H2** free-user own-Claude-key — `resolveProvider`; tests (own-key real AI no debit; no-key→mock).
- **H3** docs 23 tools — README/CLAUDE updated.
- **H4** bridge CORS + auth + import guard — `allowedOrigin`/`safeEqual`/`isMain`; tests.
- **M1** parse_cv path scoping — `assertAllowed`; tests (accept inside / reject outside).
- **M2** grantMonthly idempotency — ledger-keyed; tests (spend-to-zero / topup dedup).
- **M6/L10** docs layout + test count — folded into H3.
- **L1** constant-time bearer — folded into H4.
- **L5** duplicate salary check — removed.
- **L7** smoke assertion — now checks `status` + count (partial).

---

## 2. Status by dimension

### Free ✅ PASS
All six Free "Must" requirements met. Free core works with zero config, zero
network, stores data locally, allows the user's own Claude key (H2 fixed),
does basic application prep, never uploads personal data, never requires
cloud. (REQUIREMENTS_TRACEABILITY.md §1; FREE_PAID_FEATURE_MATRIX.md §2.)

### Paid ⚠️ DEFERRED (acceptable — not a release blocker)
No paid plan is sold or gated. Every paid "Must" is a seam/placeholder; the
seven server-side-only features are unenforced because the hosted service
does not exist. **This is acceptable for a free-core v0.1.x release and
becomes a Critical the day a Pro tier launches without M4 met.**
(FREE_PAID_FEATURE_MATRIX.md §3–4.)

### Security ✅ PASS (free-core scope)
All security findings that gate the free-core release are fixed with tests:
H1 (entitlement MAC), H4 (CORS/auth/import), M1 (parse_cv scoping), L1
(constant-time). Residuals L2/L3/L4/L8 and M3 are dev-preview/single-user
scope; M4 is the Pro-launch obligation. (SECURITY_AUDIT.md.)

### Claude Cost ✅ PASS
No unlimited-Claude path exists. Free users use their **own** key (their own
quota/budget). The future Pro hosted-Claude path is credit-debited via
`tryDebit` and does not exist yet. MVP exclusion "unlimited Claude usage" is
honoured. (MVP_ACCEPTANCE.md §2; H2.)

### Browser (extension) ✅ PASS with deferred hardening
Chrome MV3 extension uses `activeTab`, `scripting`, `storage`, and
host_permissions limited to `127.0.0.1`/`localhost`. It captures form fields
and shows an autofill **preview** — never submits. Deferred: move bridge token
from `chrome.storage.sync` to `chrome.storage.local` (L4). No release blocker.

### Licence ✅ PASS (free-core) / ⚠️ DEFERRED (Pro)
Free: always-available fallback; tamper/legacy entitlements fall back to Free
(H1). Pro: true licence validation is server-side and deferred (M4). No paid
entitlement is currently granted or trusted for value.

---

## 3. Required actions before this release — ALL DONE

| # | Action | Status |
|---|--------|--------|
| R1 | Fix C1 (desktop build) | ✅ done + CI-verified |
| R2 | Fix H1–H4 | ✅ done + tested |
| R3 | Fix M1, M2 | ✅ done + tested |
| R4 | Docs H3/M6/L10 | ✅ done |
| R5 | Cut fresh v0.1.2 tag (no force-push) | ✅ done |
| R6 | Confirm release run green + published | ✅ done |

---

## 4. Deferred actions (post-release, tracked)

| # | Action | Gate | Finding |
|---|--------|------|---------|
| D1 | Build hosted licence server; sign entitlements; enforce device + credit limits server-side | **Before any Pro launch** | H1 true fix, M4 |
| D2 | Move paid features (hosted Claude, sync, adapter updates, team dashboard, analytics, managed backups) to server-side enforcement | **Before any Pro launch** | M4 |
| D3 | Desktop hardening: Electron `sandbox`, safe DOM (no `innerHTML`), bundle bridge or keep Node-on-PATH doc | Before desktop leaves "developer preview" | L2, L3, M7 |
| D4 | Extension: bridge token → `chrome.storage.local` | Next extension release | L4 |
| D5 | `tryDebit` atomic transaction | If multi-writer surfaces added | L8 |
| D6 | Replace/monitor `pdf-parse` | If maintenance/CVE risk | L6 |
| D7 | Full http-bridge black-box test + least-privilege release token | Future hardening | M5, L9 |
| D8 | Re-evaluate ungated admin credit tools (topup/grant) before credits gate real value | Before Pro launch | M3 |

---

## 5. Final recommendation

**Ship v0.1.2 as the free community core.** It is the first green release
(v0.1.0/v0.1.1 release runs were red), all Critical/High findings are closed
with evidence, MVP gates are honoured, and privacy/security posture for the
free core is sound.

Treat the deferred items (§4) as a **Pro-launch checklist**: none may be sold
or gated until M4 (server-side enforcement) and H1's true fix (server-signed
entitlements) are delivered. The desktop installer remains a labelled
developer preview until D3.

**Decision: GO.**

---

## 6. Cycle 2 — production-readiness hardening (2026-07-20, branch `audit/mvp-hardening`, UNRELEASED)

A second `/goal` audit pass closed the remaining production-readiness gaps.
Per the directive's change rules, **no publish/deploy occurred and nothing
was pushed to `main`** — all work is committed on the dedicated
`audit/mvp-hardening` branch and awaits explicit authorization to merge/release.

### What changed
- Closed 8 new findings (N1–N8) — 2 High (N1 prompt injection, N5 unguarded
  submission), 6 Medium (N2–N4 cost controls, N6 backup/restore, N7
  entitlement log, N8 form classification) — each with tests.
- Closed M7: the desktop app is now **standalone** (esbuild-bundled bridge
  forked from Electron's own Node via `ELECTRON_RUN_AS_NODE`; no system
  Node.js required). release.yml runs `bundle:bridge` before packaging.
- Tool count 23 → **28** (request_approval, confirm_submission, backup_data,
  list_backups, restore_data). Suite 40 → **72** tests, all green.
- typecheck clean, build clean.

### Release-readiness status (Cycle 2)

| Dimension | Status |
|-----------|--------|
| Open Critical | **0** |
| Open High | **0** (N1, N5 closed) |
| Free core | ✅ PASS (all 6 Free "Must"; own-key AI with cost cap + fallback) |
| Paid / Pro | ⚠️ DEFERRED (unchanged — M4 server-side obligations, no paid value sold) |
| Claude cost controls | ✅ PASS (N2–N4: usage/cost, spend cap, retry/rate, graceful fallback) |
| Submission approval | ✅ PASS (N5: validation gate + single-use short-lived token; never submits) |
| Backup / restore | ✅ PASS (N6; safety snapshot on restore) |
| Licence lifecycle | ✅ PASS (N7: events + data preservation across up/down/expiry) |
| Browser (extension) | ✅ PASS with deferred L4 |
| Desktop (standalone) | ✅ PASS (M7 fixed); L2/L3 hardening still deferred |
| Security (free-core) | ✅ PASS (N1 prompt injection closed) |

### Cycle 2 decision: ✅ GO (to merge) — pending explicit authorization

All release gates pass on the audit branch: no Critical, no High, no
unauthorized submission, free workflow intact, Pro entitlement seam preserved,
Claude cost controls in place, sensitive data protected, standalone installer
builds, backup/restore works, 72/72 core tests pass, docs accurate. The work
is **ready to merge and cut a fresh tag (e.g. v0.1.3)** when the product owner
authorizes it. **No tag was cut and nothing was pushed to `main` or published.**

### Required actions to ship Cycle 2
| # | Action | Status |
|---|--------|--------|
| R7 | Review + merge `audit/mvp-hardening` into `main` | ⏳ awaiting authorization |
| R8 | Cut a **fresh** `v0.1.3` tag (no force-push, no tag rewrite) | ⏳ awaiting authorization |
| R9 | Bump version strings (`package.json`, `desktop/package.json`, `extension/manifest.json`, `src/server.ts`) | ⏳ do at release time |
| R10 | `gh run watch <id> --exit-status`; require all 5 release.yml jobs green (now incl. `bundle:bridge`) | ⏳ at release time |

> Per directive: "Do not publish or deploy without explicit user
> authorization." Cycle 2 stops here, staged and verified, not shipped.