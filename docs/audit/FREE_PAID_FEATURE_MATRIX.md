# Free / Paid Feature Matrix — Job Application MCP

**Licence:** AGPL-3.0-or-later (open core). Free community core in this repo;
paid Pro/cloud services are deferred seams (not yet built).

## 1. Matrix

| Feature | Free (now) | Pro (future, server-side) | Enforcement | Audit ID |
|---------|-----------|----------------------------|-------------|----------|
| stdio MCP server (23 tools) | ✅ full | same | local, always free | — |
| Local SQLite store | ✅ full | same | local | — |
| CV parse (PDF/DOCX/TXT) | ✅ full | same | local; path-scoped (M1) | M1 |
| Job analyze / match scoring | ✅ full (heuristic) | same | local | — |
| `tailor_cv` / `cover_letter` / `draft_answer` | ✅ with **own** AI key (H2); heuristic mock if no key | hosted Claude (credit-debited) | own-key never debited; Pro path debits via `tryDebit` | H2, M4 |
| `autofill_form` (preview) | ✅ full | same | local; never submits | — |
| Application CRUD + analytics | ✅ full | team dashboard | local now; team = Pro server-side | M4 |
| `status` / `credits` / `topup_credits` / `grant_monthly_credits` | ✅ (admin/test tools) | credit-limited | ledger local; **Pro credit limits enforced server-side at launch** | M2, M3, M4 |
| `admin_*` (business/multi-candidate) | ✅ scaffold | team/business | local scaffold; enforcement deferred | M4 |
| Cloud sync (Supabase) | ❌ no-op stub | ✅ | **must be server-side** | M4 |
| Hosted Claude processing | ❌ | ✅ credit-debited | **must be server-side** | M4 |
| Premium adapter updates | ❌ | ✅ | **must be server-side** | M4 |
| Team dashboard | ❌ | ✅ | **must be server-side** | M4 |
| Usage analytics | ❌ | ✅ | **must be server-side** | M4 |
| Licence entitlement | local MAC (defense-in-depth) | ✅ server-signed | **must be server-side** | H1, M4 |
| Managed backups | ❌ | ✅ | **must be server-side** | M4 |
| Offline grace (14 days) | n/a | ✅ | local `entitlementWithGrace` | — |
| Safe downgrade on expiry | ✅ always-Free fallback | ✅ | data preserved | H1 |

## 2. Free-requirement compliance

| Free "Must" | Status | Evidence |
|-------------|--------|----------|
| Work without paid subscription | ✅ | default plan = Free; all 23 tools run with zero entitlement |
| Store data locally | ✅ | `node:sqlite` under `JOB_MCP_DATA_DIR`; no free-path network call |
| Allow own Claude API key | ✅ (fixed H2) | `resolveProvider` uses real provider when `AI_API_KEY` set, no debit |
| Basic application preparation | ✅ | tailor/cover/draft/autofill-preview |
| Never secretly upload personal data | ✅ | no free-path upload; bridge loopback + CORS allow-list (H4); CV never logged |
| Never require cloud for core | ✅ | sync seam is a local no-op until Pro |

## 3. Paid-requirement compliance (against the deferred service)

| Paid "Must" | Status | Evidence |
|-------------|--------|----------|
| Validate via licence server | ⚠️ deferred | local MAC is defense-in-depth (H1); server validation = M4 |
| Unlock only approved paid services | ⚠️ deferred | feature gating exists locally; server enforcement = M4 |
| Enforce device limits | ⚠️ deferred | entitlement schema field; server enforcement = M4 |
| Enforce AI-credit limits | 🔧 local only | `tryDebit` ledger works (M2 fixed); server authority = M4 |
| Offline grace periods | ✅ | `entitlementWithGrace` 14-day |
| Downgrade safely on expiry | ✅ | Free path always available; tamper → Free (H1) |
| Preserve local data after expiry | ✅ | entitlement never deletes user data |

## 4. "Server-side only" list — status

The mandate names seven features that must **not** be protected only by local
code flags. None are sold yet; all are deferred seams:

| Feature | Local code today | Server enforcement | Pre-Pro action |
|---------|------------------|--------------------|----------------|
| Hosted Claude | provider abstraction only | ❌ not built | build + gate by signed entitlement + credits |
| Cloud synchronization | `src/sync/supabase.ts` no-op stub | ❌ not built | implement server-side; never auto-upload |
| Premium adapter updates | none | ❌ not built | server-distributed |
| Team dashboard | admin schema scaffold | ❌ not built | server-side |
| Usage analytics | none | ❌ not built | server-side, opt-in |
| Licence entitlement | MAC-signed local token | ❌ not built | server-signed tokens (H1 true fix) |
| Managed backups | none | ❌ not built | server-side |

> **Hard rule:** until the "Server enforcement" column is ✅ for every row,
> **no paid plan may be offered.** This is the M4 gate.

## 5. Conclusion

The free core is fully compliant with the Free "Must" list (after H2). The
paid side is honestly a **seam**, not a product: every paid "Must" is either
implemented as a local placeholder or deferred, and the server-side-only list
is unenforced because the hosted service does not exist. This is acceptable
for a v0.1.x free-core release **only because no paid value is sold or
gated**; it becomes a release-blocking Critical the moment a Pro tier is
launched without the M4 obligations met.

---

## 6. Cycle 2 hardening additions (2026-07-20, branch `audit/mvp-hardening`)

| Feature | Free (now) | Pro (future) | Enforcement | Audit ID |
|---------|-----------|--------------|-------------|----------|
| AI token usage + cost accounting | ✅ measured locally (own key) | ✅ server-side budget | `ai_usage` table; `costFor`/`recordUsage` | N2 |
| AI monthly spend cap | ✅ env `JOB_MCP_AI_MONTHLY_LIMIT_USD` (default 20, 0=unlimited) | server-enforced | `canSpend` blocks over-cap calls | N3 |
| AI retry + rate limit | ✅ env-tunable (`maxRetries`, min interval) | same | `enforceRateLimit` + backoff | N3 |
| Graceful AI fallback (no debit on failure) | ✅ heuristic mock on failure/cap | credit debited only on success | `runAiOp` | N4 |
| Prompt-injection hardening | ✅ untrusted-content wrapper | same | `src/ai/prompt.ts` shared by both providers | N1 |
| Submission-approval gate (single-use token) | ✅ full (records only, never submits) | same | `approval_tokens` + `safeEqual` | N5 |
| Local backup / restore | ✅ full (safety snapshot on restore) | managed backups = Pro server-side | `backup_data`/`list_backups`/`restore_data` | N6 |
| Entitlement-activity log | ✅ local log (activate/renew/expire/downgrade) | server-side audit | `entitlement_events` | N7 |
| Form-field classification (pure) | ✅ full | same | `src/forms/fields.ts` | N8 |
| Standalone desktop (no system Node) | ✅ bundled bridge + Electron Node | same | `bridge-bundle.mjs` + `ELECTRON_RUN_AS_NODE` | M7 |

These additions keep the free core fully local and never gate a free feature
behind a paid call. The spend cap, retry, and fallback are **defensive**:
they protect the user's own AI budget and keep the workflow usable when the
paid-AI path is unavailable. The Pro hosted-Claude path still debits a credit
only on a successful result and still must be server-enforced before launch
(M4).