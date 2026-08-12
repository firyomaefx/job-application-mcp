# Context Graph

Status: **designed, not yet implemented**. SQLite remains the selected local store.

## Relational representation

`graph_nodes(id, tenant_id, type, payload_json, source_type, source_ref, source_hash, confidence, consent_id, created_at, updated_at, deleted_at, audit_actor)`

`graph_edges(id, tenant_id, from_id, relation, to_id, source_ref, source_hash, confidence, consent_id, created_at, updated_at, deleted_at, audit_actor)`

Node types: Candidate, CareerEvidence, Skill, Achievement, Experience, Education, Job, JobRequirement, Employer, Application, ArtifactVersion, Contact, Interaction, Task, Outcome, Consent, Entitlement.

Relations: OWNS, PROVES, CONTAINS, HAS_REQUIREMENT, SATISFIES, MATCHES, TARGETS, GENERATED_FOR, CITES, HAS_TASK, HAS_INTERACTION, PRODUCES, UPDATES, PERMITS, GRANTS.

## Invariants

- Every row is tenant-scoped; local mode uses one generated tenant ID.
- Stable IDs are opaque UUIDs. Imports use `(tenant_id, source_type, source_hash)` for idempotency.
- A CareerEvidence item is not `confirmed` until a user confirms extracted content.
- Every material ArtifactVersion claim has at least one `CITES` edge to confirmed CareerEvidence, or is explicitly `unverified_user_input` and cannot pass approval preflight.
- Job text, documents, URLs, and embedded instructions are untrusted data.
- Consent is purpose/action-specific and expires or is revoked; it is not a global boolean.
- Entitlements grant server capabilities only; local data remains accessible after expiry.
- Deletion uses tombstones until retention cleanup; audit records never contain raw CV/job payloads.

## Context assembly

For a tool call, load only:

`Candidate + relevant confirmed evidence + target requirements + current application/artifact state + applicable consent + entitlement`.

Selection is deterministic by tenant, target IDs, evidence relevance, confirmation state, and token budget. Redact direct identifiers unless needed for the requested artifact. Untrusted text is delimited and cannot change system/tool policy.

## Learning loop

Verified Evidence → Job Match → Application Pack → User Edits → Submission → Outcome → Updated Recommendation.

Outcome recommendations must report sample size, observed association, confidence, and time window. They must never present correlation as causation.

## Migration approach

1. Add graph tables and indexes without removing current domain tables.
2. Backfill nodes/edges transactionally with source hashes.
3. Dual-read behind a feature flag; compare outputs in tests.
4. Switch golden-path tools only after parity and integrity checks.
5. Roll back by disabling graph reads; retain additive tables for inspection.
