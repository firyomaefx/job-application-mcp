# Project Context

## Project Summary
- Purpose: Local-first MCP job-application assistant; target is evidence-locked, human-approved application packs.
- Main technologies: TypeScript, Node 22, MCP SDK, SQLite, Electron, Chrome MV3.
- Primary entry points: `src/index.ts`, `src/http.ts`, `cli/cli.ts`, `desktop/main.js`.

## Current State
- Current version: 0.4.2 unsigned-alpha candidate on local branch `codex/job-copilot-foundation`, reconciled with `origin/main`.
- Working features: stdio MCP, local bridge, CV/job/application stores, heuristic/optional AI drafting, approval recording, reminders, backup/restore, Windows packaging.
- Recent verified changes: schema v6 migration; clean lockfiles/CI; session-only provider keys; Electron utility-process bridge; complete packaged-module manifest; clean Windows install/start/restart/uninstall; current product/security/privacy documents.
- Known issues: no provenance graph/golden path; cloud sync no-op; hosted tenancy/payments not production; HTTP auth optional; parsers lack full hostile-file budgets; installer unsigned and not byte-reproducible; no real security contact; GitHub authentication invalid.
- Pending work: restore GitHub authentication; push draft PR and run remote CI; publish the approved v0.4.2 prerelease only after green CI; then implement Phase 2 provenance.

## Architecture
- Main components: Domain/tool handlers, stdio MCP and loopback HTTP transports, SQLite store, AI adapters, Electron and Chrome companions.
- Important directories: `src/`, `tests/`, `desktop/`, `extension/`, `docs/`.
- Data flow: MCP/UI request → typed tool → domain/store/provider → local SQLite or explicitly configured AI endpoint.
- External dependencies: MCP SDK; optional Ollama/OpenAI/Anthropic-compatible endpoint; Electron packaging.

## Constraints
- Compatibility requirements: Node >=22; preserve stdio/local tools and local-first free path.
- Security requirements: No fabricated claims, plaintext provider keys, automatic submission, or unapproved external action.
- Files or logic that must not be changed: Remote branches/tags/releases and production services without owner approval.

## Loop History

### 2026-08-12 — Phase 0 baseline and Phase 1 recovery
- Request: Audit the repository, establish a current evidence baseline, then implement the highest-value safe foundation repairs.
- Changes: Selected v0.4.1 as recovery base; fixed CV migration; repaired root/desktop lockfiles and CI `npm ci`; patched production dependencies; made UI keys session-only; added required strategy, graph, threat, privacy, market, monetisation, and release-gate docs.
- Files affected: Storage/settings/tests, package manifests/locks, CI/release workflows, README/security policy, `docs/*`, `CONTEXT.md`.
- Validation: Clean install; type-check/build; 136/136 tests; MCP smoke; zero root/desktop audit findings; bridge bundle; Windows NSIS and portable packages; packaged updater check; `git diff --check`.
- Result: Phase 0 PASS; Phase 1 local foundation PASS. Paid pilots and public production remain NO-GO.
- Remaining work: Implement Phase 2 provenance vertical slice; configure a real security contact; sign/SBOM releases; reconcile and validate remote CI only with owner authorization.

### 2026-08-13 — v0.4.2 Windows alpha recovery
- Request: Reconcile the recovery work, produce a verified Windows installer, and deliver it through a draft PR and GitHub prerelease.
- Changes: Bumped all surfaces to 0.4.2; reconciled `origin/main`; added prerelease checksums; fixed packaged startup by including `version-util.js` and moving the bridge to Electron `utilityProcess`; added packaging regression tests.
- Files affected: Release workflow/version docs, desktop manifest/runtime, CV merge resolution, and tests.
- Validation: Clean root/desktop installs; zero audit findings; type-check/build; 138/138 tests; MCP smoke; two NSIS builds; clean install/start/restart/restricted-PATH/uninstall; final Setup SHA-256 `B0492DA29767B32E7DCF00EA09D0B03834C672E107EDCC5B379E1F7ED8920B18`; Authenticode `NotSigned`.
- Result: Local Windows unsigned-alpha installer gate PASS. Paid pilots and public production remain NO-GO.
- Remaining work: GitHub push/PR/CI/tag/prerelease is blocked by an invalid `gh` token; installer signing, SBOM, provenance graph, and production controls remain open.
