# Privacy

Status: accurate for the local v0.4.1 recovery branch; not legal advice. A Malaysian PDPA review is required before production cloud use.

## Data inventory and location

- Profile, CV text/path, jobs, applications, drafts, answers, reminders, approvals, entitlements, and usage metadata: local SQLite under `JOB_MCP_DATA_DIR`.
- Local backups: `JOB_MCP_DATA_DIR/backups`.
- HTTP bearer token: environment/extension local storage when configured.
- Provider API key: environment or process-session memory; not persisted in SQLite after the recovery migration path.
- Browser import: user-invoked page/job/form data sent only to the loopback bridge.

## Provider flows

Default heuristic and Ollama paths can remain local. If a user configures OpenAI, Anthropic, or another compatible endpoint, selected CV/job/question text is sent to that provider to generate the requested draft. Provider terms, retention, and training policies then apply. The product must not claim “nothing leaves your device” when such a provider is enabled.

Cloud sync is a no-op seam. Payment processing and hosted analytics are not live. No telemetry script is present in the static website.

## Consent and minimisation

- Parsing/import and each model call are user invoked.
- External submission, upload, or message sending is not implemented.
- Future consent records must bind purpose, data categories, actor, action, expiry, and revocation.
- Logs/audit events must use IDs and status, not raw CV/job content or credentials.

## Retention, export, deletion

Local backup/restore and Markdown export exist. A complete machine-readable export and tool-driven deletion are not yet implemented; deleting the local data directory is manual. Those gaps block production privacy claims.

Future hosted retention must define active, backup, tombstone, and deletion windows and identify processors/subprocessors. Cross-border transfers and breach-notification duties require owner/legal review under Malaysia’s amended PDPA.
