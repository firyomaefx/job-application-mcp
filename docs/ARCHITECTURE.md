# Architecture

## Verified current system

- TypeScript/Node 22 ESM domain and MCP server.
- SQLite local storage through `node:sqlite`.
- stdio MCP transport plus a loopback HTTP bridge for Electron/Chrome companions.
- AI adapters for local heuristic, Ollama, OpenAI-compatible, and Anthropic calls.
- Electron desktop wrapper and user-invoked Chrome page/form capture.
- Cloud sync and payment/licensing are seams, not production services.

Current flow: client → MCP/loopback transport → tool handler → store/domain helper → SQLite; configured AI calls pass delimited untrusted job/CV text to the selected provider.

## Target boundaries

- `domain/`: graph entities, provenance, policies, approvals, outcome learning.
- `application/`: task-oriented use cases and idempotency.
- `transport/`: stdio MCP, later standards-compliant Streamable HTTP.
- `storage/`: SQLite local; later tenant-tested PostgreSQL adapter.
- `providers/`: model adapters and untrusted-content framing.
- `adapters/`: user-invoked browser import and document parsing.
- `identity/`: consent, authorization, and server-side entitlements.
- `ui/`: minimal control centre; no domain rules.

## ADR-001: authoritative recovery base

Options considered:

1. Patch `main`: smallest diff, but omits nine v0.4.1 release-line commits and contradicts the latest published product.
2. Recover `roadmap/v0.2`: preserves the latest release line, fixes its schema/tests, and later reconciles the two divergent main commits.

Decision: option 2 on local branch `codex/job-copilot-foundation`. No merge, push, tag, or publication is authorized. Rollback is branch deletion; the original remote refs remain unchanged.

## ADR-002: provider-key handling

Options considered:

1. Add a native cross-platform credential-store dependency now.
2. Make desktop-entered keys session-only, retain environment configuration, and purge legacy plaintext rows.

Decision: option 2 for Phase 1 because it removes plaintext-at-rest risk without destabilising installers. An OS credential-store adapter may later add persistence behind the same settings boundary.

## Remote MCP constraint

Remote transport is deferred. Current official MCP security guidance requires OAuth-style authorization for user-specific HTTP resources, token audience validation, HTTPS, least-privilege scopes, and per-client consent. A shared hidden client key is not an acceptable hosted boundary.
