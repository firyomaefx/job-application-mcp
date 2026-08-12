# Project Context

## Project Summary
- Purpose: Local-first MCP job-application assistant; target is evidence-locked, human-approved application packs.
- Main technologies: TypeScript, Node 22, MCP SDK, SQLite, Electron, Chrome MV3.
- Primary entry points: `src/index.ts`, `src/http.ts`, `cli/cli.ts`, `desktop/main.js`.

## Current State
- Current version: 0.4.1 recovery on local branch `codex/job-copilot-foundation` from `origin/roadmap/v0.2`.
- Working features: stdio MCP, local bridge, CV/job/application stores, heuristic/optional AI drafting, approval recording, reminders, backup/restore, Windows packaging.
- Recent verified changes: schema v6 CV-version migration; clean lockfiles/CI installs; session-only desktop provider keys with legacy plaintext purge; audit-clean MCP/Electron packaging chain with packaged updater; current market/product/security/privacy architecture documents.
- Known issues: no provenance graph/golden path; cloud sync no-op; hosted tenancy/payments not production; HTTP auth optional; parsers lack full hostile-file budgets; installer unsigned; no real security contact; remote PR is conflicting and CI is not rerun.
- Pending work: Phase 2 evidence graph and provenance-locked pack; complete export/delete; owner-approved remote reconciliation.

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
