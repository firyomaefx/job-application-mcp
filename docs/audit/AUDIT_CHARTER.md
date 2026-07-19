# Audit Charter — Job Application MCP

**Project:** Job Application MCP (`firyomaefx/job-application-mcp`)
**Audit dates:** 2026-07-19 → 2026-07-20
**Release under audit:** v0.1.2 (cut fresh; v0.1.0/v0.1.1 release runs were red)
**Framework:** PMP process groups + Loop Engineering (O-A-D-I-E-R:
Observe → Analyse → Design → Implement → Evaluate → Reflect)
**Auditor:** Claude Code (assisted, with parallel sub-agent discovery)

## 1. Purpose

Independently verify that the v0.1.x release of Job Application MCP is
safe to ship: that the **free community core** genuinely works without any
paid subscription or cloud service, that **paid/Pro features** are correctly
separated and cannot be bypassed by local code alone, that the **MVP gates**
are honoured, and that the release pipeline actually produces installable
artifacts. Produce a ranked finding set and a release-readiness decision.

## 2. Scope

**In scope**
- Free-core runtime: stdio MCP server (23 tools), local HTTP bridge,
  CV parser, local SQLite store, AI provider abstraction, licence/entitlement
  + credit ledger, Chrome MV3 extension, Electron desktop wrapper.
- Build/release pipeline: `ci.yml`, `release.yml`, electron-builder config.
- Security & privacy posture: CORS, auth, file-path scoping, PII logging,
  secret handling, entitlement integrity.
- Documentation accuracy vs. actual shipped behaviour.

**Out of scope (this audit)**
- The not-yet-built hosted Pro service (licensing server, hosted Claude,
  cloud sync, team dashboard, managed backups). These are deferred seams;
  the audit records the obligations they will create but cannot test code
  that does not exist yet.
- Third-party dependency CVE sweep beyond the one maintained-package note
  (L6); a full SCA/SCA tool run is a future workstream.
- Penetration testing of the Chrome extension against live career sites.

## 3. Governing constraints (verbatim, from the project mandate)

Free Version Must: work without paid subscription; store data locally;
allow users to use their own Claude API key; allow basic application
preparation; never secretly upload personal data; never require cloud
services for core features.

Paid Version Must: validate subscription through the licence server;
unlock only approved paid services; enforce device limits; enforce
AI-credit limits; support offline grace periods; downgrade safely when
subscription expires; preserve local user data after expiry.

Do not protect paid features only with local code flags. Keep these
server-side: Hosted Claude processing, Cloud synchronization, Premium
adapter updates, Team dashboard, Usage analytics, Licence entitlement,
Managed backups.

MVP Must Exclude: CAPTCHA bypass, Unrestricted automatic submission,
Unlimited Claude usage, Full LinkedIn automation, Full Indeed automation,
Automatic legal declarations.

Submission never occurs without approval. HTTP bridge is loopback-only.
No payment secrets or AI keys in the desktop app. No CV text/PII in logs.

## 4. Audit rules (binding for this engagement)

1. Do not modify production code during discovery (Observe/Analyse).
2. Record every finding, even if later judged acceptable.
3. Rank findings by severity: Critical / High / Medium / Low.
4. Fix critical issues before release.
5. Changes must remain backward-compatible.
6. Every fix must include testing evidence.
7. CONTEXT.md is updated only during the Reflect phase.
8. Do not place private secrets inside CONTEXT.md.
9. Stop the release if a Critical issue remains unresolved.

## 5. Severity definitions

| Severity | Meaning | Action |
|----------|---------|--------|
| Critical | Data leak, unauthorized submission, or licence bypass; or release pipeline cannot ship | Must fix |
| High | Major feature failure or data corruption; compliance breach | Must fix |
| Medium | Partial feature failure with workaround | Fix or formally accept |
| Low | Cosmetic or minor usability / hardening gap | Can defer |

## 6. Deliverables (11)

`AUDIT_CHARTER.md` · `AUDIT_PLAN.md` · `REQUIREMENTS_TRACEABILITY.md` ·
`RISK_REGISTER.md` · `SECURITY_AUDIT.md` · `FREE_PAID_FEATURE_MATRIX.md` ·
`TEST_PLAN.md` · `TEST_RESULTS.md` · `MVP_ACCEPTANCE.md` ·
`RELEASE_READINESS.md` · `CONTEXT.md`

## 7. Final decision authority

The audit produces a recommendation (GO / CONDITIONAL GO / NO-GO). The
release is **stopped** if any Critical finding remains open. The product
owner (user) retains final release authority and chose the non-destructive
re-release strategy: cut fresh version tags rather than rewrite history.