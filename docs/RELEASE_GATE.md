# Release Gate

Evidence date: 2026-08-13. Branch under evaluation: `codex/job-copilot-foundation`, reconciled locally with `origin/main` and prepared as v0.4.2.

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
| desktop installer | Working with limitations | Windows x64 NSIS install/start/restart/uninstall verified; unsigned and not byte-reproducible |
| cloud sync | Placeholder or no-op | `LocalNoopSync` always returned |
| hosted auth/tenant isolation | Roadmap only | no hosted store or RLS |
| payments/licensing | Present but unverified seam | client-bypassable local enforcement; no live checkout |
| bilingual Malaysia workflow | Roadmap only | no Bahasa Malaysia acceptance fixtures |
| context graph/provenance | Roadmap only | design in `docs/CONTEXT_GRAPH.md` |
| outcome learning | Roadmap only | basic status analytics are not causal/outcome learning |
| complete export/delete tools | Broken against target acceptance | partial Markdown export/manual directory deletion only |

## Gate decision

- Phase 0 evidence baseline: **PASS**.
- Phase 1 local foundation: **PASS** — clean installs, type-check, build, 138 tests, MCP smoke, bridge bundle, zero audit findings, and Windows runtime packaging pass.
- Windows unsigned-alpha installer: **PASS** for local delivery; signing remains an accepted prerelease limitation.
- Authoritative remote CI/release: **PASS for v0.4.2 unsigned alpha** — PR #2 passed the complete CI matrix, merged as `aee2c00`, and tag `v0.4.2` produced a successful prerelease workflow. PR #1 was closed as superseded.
- Paid pilots: **NO-GO** until the provenance vertical slice and manual entitlement boundary exist.
- Public production release: **NO-GO** due to missing real security contact, signing/SBOM, complete privacy controls, graph provenance, and hosted isolation.

The v0.4.2 prerelease is available at https://github.com/firyomaefx/job-application-mcp/releases/tag/v0.4.2. This does not change the paid-pilot or public-production NO-GO decisions.

## Phase 1 evidence

- `npm ci --ignore-scripts --no-audit --no-fund`: pass.
- `npm run typecheck`; `npm run build`; `npm test`: pass, 138/138.
- MCP initialize + `tools/list` using protocol `2024-11-05`: pass; server reports v0.4.2 and 41 tools.
- Root and desktop `npm audit --audit-level=high`: 0 vulnerabilities after MCP SDK 1.30.0, Electron 43.4.0, and electron-builder 26.15.3 upgrades.
- `npm run bundle:bridge`: pass.
- `desktop: npm ci`; bridge bundle; Windows x64 NSIS package: pass. Packaged `app.asar` contains `electron-updater` and every local main-process module.
- Clean install exit 0; packaged renderer and Node utility process start; `/health` returns 41 tools; restart returns 41 tools; clean uninstall removes the install directory and registry entry.
- Launch with `PATH=C:\\Windows\\System32;C:\\Windows` still starts the bridge, proving no system Node.js dependency.
- Final local Setup SHA-256: `B0492DA29767B32E7DCF00EA09D0B03834C672E107EDCC5B379E1F7ED8920B18`; size 101,418,107 bytes.
- Two builds used the same source and artifact name but differed by 3 bytes/hash due to embedded build metadata; byte-for-byte reproducibility is not achieved.
- Authenticode status: `NotSigned` (accepted only for the clearly labelled alpha prerelease).
- PR #2 CI: Node 22/24 on Windows and Linux plus MCP smoke all passed.
- Release workflow `31647314794`: core/extension, Windows, Linux, macOS, checksum generation, and publish jobs passed.
- Downloaded GitHub Windows asset: 101,418,980 bytes; SHA-256 `ECA204CF7DB592D8C6870CB92C36FD794A293E84DDA54AC65DA3FE019484E206`; matches the published `SHA256SUMS.txt`.
- The downloaded GitHub installer passed clean install, restricted-PATH startup, 41-tool bridge health, and clean uninstall; Authenticode remains `NotSigned`.
