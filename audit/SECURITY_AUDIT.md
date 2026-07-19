# Security Audit — Job Application MCP

**Scope:** free-core runtime + bridge + extension + desktop + release pipeline.
**Method:** read-only discovery (direct reads + 3 cross-verified sub-agents),
then targeted exploitation checks, then fixes with tests.

## 1. Threat model

- **Asset:** local CV/application data (PII), the user's own AI API key,
  and (future) Pro entitlement.
- **Attacker position:** malicious/compromised MCP client, or a malicious
  web page on the user's browser while the bridge runs. Remote network
  access to the bridge is **not** assumed (loopback-only).
- **Acceptable loss:** none of the Free-requirements or MVP-gates may be
  violated. Local-only privilege escalation to "Pro" is acceptable **only**
  if no paid value exists yet and the true fix is server-side (M3/M4).

## 2. Findings (security-relevant)

See RISK_REGISTER.md for full detail. Security-relevant IDs:

- **H1** entitlement forgery → ✅ MAC-signed local entitlement (defense-in-depth).
- **H4** bridge CORS `*` + weak auth + import side-effect → ✅ allow-list + constant-time + `isMain` guard.
- **M1** `parse_cv` arbitrary file read → ✅ path allow-list.
- **L1** non-constant-time bearer compare → ✅ `safeEqual`.
- **L2** Electron sandbox not set → ⚠️ deferred (dev-preview).
- **L3** renderer `innerHTML` XSS surface → ⚠️ deferred (dev-preview, local data).
- **L4** extension token in `chrome.storage.sync` → ⚠️ deferred.
- **L8** `tryDebit` non-atomic → ⚠️ accepted (single-user).
- **M3** ungated admin credit tools → ⚠️ accepted (defanged by H1; no paid value yet).
- **M4** paid value not server-enforced → ⚠️ deferred (no hosted service yet).

## 3. Verification of invariant claims

| Claim | How verified | Result |
|-------|--------------|--------|
| Free core makes **no outbound network call** | grep for `fetch`/`http`/`https`/`WebSocket` across `src/store`, `src/tools`, `src/cv`, `src/lib`; only `src/ai/openai.ts`+`anthropic.ts` and `src/sync/supabase.ts` (no-op stub) have any, both opt-in | ✅ No call on the default Free path |
| Bridge binds **loopback only** | read `src/http.ts` listen call | ✅ `127.0.0.1` |
| Nothing **submits** a form | read `autofill_form`; grep for submit/`form.submit`/`HTMLFormElement` | ✅ Preview only; no submit |
| No **CAPTCHA / LinkedIn / Indeed automation / auto legal declarations** | grep audit | ✅ None present |
| No **CV text / PII** in logs | grep for logging of cv payloads | ✅ Not logged |
| No **payment secrets / AI keys** baked into desktop | grep `desktop/` for keys/secrets | ✅ Keys read from env at call time, not stored |

## 4. Fixes applied (with evidence)

### H4 + L1 — bridge CORS & auth
- `allowedOrigin(req)`: returns the origin only if it matches
  `chrome-extension://<id>` or `http://(127.0.0.1|localhost)(:port)?`; else `null`.
- `send(res, status, body, req?)`: emits `Access-Control-Allow-Origin` **only**
  for allowed origins.
- `authorized()`: `safeEqual(header, \`Bearer ${TOKEN}\`)` (constant-time).
- `isMain` guard: listener starts only when run as entry point, not on import.
- Tests: `tests/audit-fixes.test.ts` — allow extension+loopback, block arbitrary.

### H1 — entitlement integrity
- `licenceSecret()`: `randomBytes(32)` persisted to a `licence-secret` file.
- `withMac(ent)` / `readEntitlementFile()`: store `{entitlement, mac}`;
  verify `mac === HMAC(secret, JSON.stringify(entitlement))` via `safeEqual`;
  reject legacy unsigned files → Free.
- Tests: round-trip OK; tamper → Free; legacy → Free.
- **Residual:** true enforcement is server-signed entitlements (deferred, M4).

### M1 — parse_cv path scoping
- `allowedRoots()`: `JOB_MCP_DATA_DIR`, `<dataDir>/cvs`, each `JOB_MCP_CV_DIRS`.
- `assertAllowed(filePath)`: resolved path must equal a root or start with
  `root + sep`.
- Tests: accept inside data dir; reject outside.

### M2 — grantMonthly idempotency
- Idempotency keyed on a `credit_ledger` grant row for the period, not on
  balance>0.
- Tests: spend-to-zero then re-grant → no double-grant; topup dedup intact.

## 5. Residual risk & required follow-ups

1. **Server-side entitlement & paid-feature enforcement (M4)** — the single
   most important pre-Pro-launch obligation. Until the hosted licence server
   signs entitlements and gates hosted Claude/sync/analytics/team/backups,
   no paid plan may be sold.
2. **Desktop hardening pass (L2, L3, M7)** — enable Electron sandbox, replace
   `innerHTML` with safe DOM construction, and bundle the bridge (or document
   Node-on-PATH) before desktop leaves "developer preview".
3. **Extension token storage (L4)** — move to `chrome.storage.local`.
4. **`tryDebit` atomicity (L8)** — wrap in a transaction if multi-writer
   surfaces are added.
5. **Dependency hygiene (L6)** — monitor `pdf-parse`; migrate to `pdfjs-dist`
   if needed.

## 6. Conclusion

All security findings that gate the **free-core v0.1.x release** are fixed
with test evidence (H1, H4, M1, L1). Remaining items are either deferred to
the Pro-launch track (M4, the server-side obligations) or to a desktop/
extension hardening track (L2–L4, M7) — none block the current release.