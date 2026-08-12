# Security policy

## Supported versions

This is alpha software. Only the latest `main` and the most recent tagged
release receive security fixes.

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.** A real private
security contact and GitHub private vulnerability reporting are not configured
yet. This is a release blocker. Until the owner publishes one, contact the
repository owner through an existing private channel with:

- A description of the issue and its impact
- Steps to reproduce, if possible
- Any suggested fix

You will receive an acknowledgment within 72 hours. Please allow reasonable time
for a fix before public disclosure.

## Threat model (free core)

The free core is **local-first**:

- The stdio MCP server and the HTTP bridge bind to **loopback only** (127.0.0.1).
- The default heuristic and Ollama paths can remain local. Configured remote AI,
  update, or licence endpoints make explicit outbound requests.
- CVs and applications are stored in `JOB_MCP_DATA_DIR` (default `./data`).

Known hardening points to be aware of:

- The HTTP bridge has **no auth by default**. If anything else runs on your
  machine (or could reach 127.0.0.1), set `JOB_MCP_HTTP_TOKEN` and use the
  bearer token in the extension options and desktop app.
- The bridge trusts the local user. Do not run it on a shared host without auth.
- Provider keys entered through the desktop are process-session-only; legacy
  plaintext settings rows are purged. Environment configuration remains supported.
- CV parsing uses `pdf-parse` and `mammoth`. Treat parsed CV text as untrusted
  input (it is never `eval`'d, but don't feed adversarial files in production).

## Pro / cloud services (out of scope here)

Paid services are not production-ready. The repository contains seams but no
tenant-isolated hosted service. See `docs/SECURITY.md` and `docs/RELEASE_GATE.md`.
