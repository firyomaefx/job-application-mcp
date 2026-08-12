# Release Gate

Evidence date: 2026-08-12. Branch under evaluation: `codex/job-copilot-foundation`, based on `origin/roadmap/v0.2` / tag v0.4.1.

## Phase 0 baseline

- `main` CI failed at TypeScript: missing `Cv.parent_cv_id` typing.
- v0.4.1 release built all desktop installers but failed 3/134 CV-version tests; publish job skipped.
- Clean `npm ci` failed because the lockfile still described v0.1.0 and mismatched `esbuild`.
- PR #1 is open and GitHub reports `CONFLICTING`; branches diverge by 2 main commits and 9 release-line commits.
- Latest GitHub release exists, but its workflow conclusion is failure. Release existence is not proof of a green gate.

## Feature truth table

| Capability | Status | Evidence / limitation |
|---|---|---|
| stdio MCP and local SQLite | Working and verified | build/tests and MCP smoke |
| loopback bridge | Working with limitations | bearer auth optional; local only |
| CV parsing/versioning/export | Working and verified after recovery | migration and CV-version tests |
| heuristic job match | Working with limitations | keyword score, not evidence graph |
| AI drafts | Working with limitations | configured provider or heuristic; claims are not provenance-locked |
| prompt-injection framing | Working with limitations | tested delimiter/system policy; no complete adversarial parser suite |
| approval-gated submission recording | Working and verified | records submission; does not submit externally |
| job tracker/reminders/backups | Working and verified | local only |
| Chrome import/autofill preview | Present but unverified in a real browser this cycle | user-invoked; never submit |
| desktop installers | Working with limitations | Windows NSIS + portable built locally; unsigned |
| cloud sync | Placeholder or no-op | `LocalNoopSync` always returned |
| hosted auth/tenant isolation | Roadmap only | no hosted store or RLS |
| payments/licensing | Present but unverified seam | client-bypassable local enforcement; no live checkout |
| bilingual Malaysia workflow | Roadmap only | no Bahasa Malaysia acceptance fixtures |
| context graph/provenance | Roadmap only | design in `docs/CONTEXT_GRAPH.md` |
| outcome learning | Roadmap only | basic status analytics are not causal/outcome learning |
| complete export/delete tools | Broken against target acceptance | partial Markdown export/manual directory deletion only |

## Gate decision

- Phase 0 evidence baseline: **PASS**.
- Phase 1 local foundation: **PASS** — clean installs, type-check, build, 136 tests, MCP smoke, bridge bundle, zero production audit findings, and Windows packaging pass.
- Authoritative remote CI: **BLOCKED/UNVERIFIED** — changes are local only; PR #1 remains conflicting and no push/merge was authorized.
- Paid pilots: **NO-GO** until the provenance vertical slice and manual entitlement boundary exist.
- Public production release: **NO-GO** due to missing real security contact, signing/SBOM, complete privacy controls, graph provenance, and hosted isolation.

No push, merge, tag, deployment, payment activation, or publication is authorized by this report.

## Phase 1 evidence

- `npm ci --ignore-scripts --no-audit --no-fund`: pass.
- `npm run typecheck`; `npm run build`; `npm test`: pass, 136/136.
- MCP initialize + `tools/list` using protocol `2025-06-18`: pass.
- Root and desktop `npm audit --audit-level=high`: 0 vulnerabilities after MCP SDK 1.30.0, Electron 43.4.0, and electron-builder 26.15.3 upgrades.
- `npm run bundle:bridge`: pass.
- `desktop: npm ci`; `electron-builder --win nsis portable --publish never`: pass; packaged `app.asar` contains `electron-updater`.
- Portable SHA-256: `78429592B447CEB63D9E18E77A13D315DA577E8B37B56AA0072E4563F946C1D2`.
- Setup SHA-256: `310E2C86719A5A11B399893A36766258A7B089309B085EE42299DEF1A3AE6FD3`.
- Authenticode status for both artifacts: `NotSigned` (public-release blocker).
