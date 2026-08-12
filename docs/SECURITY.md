# Security and Threat Model

Evidence date: 2026-08-12. Production cloud and payments are disabled.

## Assets and trust boundaries

Assets: CV/profile PII, job text, generated documents, provider credentials, approval tokens, entitlements, and outcomes.

Boundaries: MCP client↔local server, browser page↔extension, extension/desktop↔loopback bridge, parser↔uploaded file, server↔AI provider, and future tenant↔hosted database.

## Confirmed controls

- stdio local transport; HTTP binds to loopback and supports bearer auth.
- CORS allow-list, 1 MB HTTP body limit, typed schemas, path allow-listing, parameterised SQL.
- Prompt text declares job/CV input untrusted and delimits it.
- Sensitive form fields require review; submission recording uses expiring single-use approval tokens.
- Provider keys entered through desktop are session-only after this recovery slice; legacy plaintext rows are purged.
- Webhook HMAC verification exists as a library seam; no production webhook endpoint is enabled.

## Risk register

| Severity | Risk | Current status / release impact |
|---|---|---|
| Critical | Hosted cross-tenant access | Hosted store absent; BLOCKS hosted pilot until RLS and isolation tests exist |
| High | Placeholder security contact | `security@example.com`; BLOCKS public production release |
| High | Local HTTP auth optional | Safe only for single-user loopback use; installer should generate/configure a token before broader release |
| High | File parser abuse (oversize/decompression/malformed DOCX/PDF) | Path-scoped but no robust file-size/decompression budget proven; BLOCKS hostile-upload claims |
| High | Client-bypassable local entitlement | Explicitly only a seam; BLOCKS paid capabilities until server-side enforcement |
| High | Remote MCP auth/session/SSRF | Remote transport absent; BLOCKS remote pilot |
| Medium | Extension host permissions and platform terms | User-invoked capture exists; LinkedIn automation must remain excluded |
| Medium | Installer signing/SBOM/reproducibility | Windows build works unsigned; BLOCKS public production release |
| Medium | Loopback error detail | Needs structured safe error codes and content-redaction audit |

## Required hosted controls

Before hosted data: authenticated tenant context derived server-side, RLS, negative isolation tests, HTTPS, OAuth authorization, short-lived audience-bound tokens, least-privilege scopes, rate limits, encrypted managed secrets, audit IDs without payloads, signed/replay-safe webhooks, backup/restore/deletion tests, and incident response.

Official references: [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices), [MCP authorization](https://modelcontextprotocol.io/docs/tutorials/security/authorization), [Malaysia PDPA amendment](https://www.pdp.gov.my/ppdpv1/en/amendment-of-personal-data-protection-act-2024/), [LinkedIn prohibited software](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions?lang=en).
