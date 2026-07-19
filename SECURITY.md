# Security policy

## Supported versions

This is alpha software. Only the latest `main` and the most recent tagged
release receive security fixes.

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.** Instead, email the
maintainers at **security@example.com** (replace with a real contact before
launch) with:

- A description of the issue and its impact
- Steps to reproduce, if possible
- Any suggested fix

You will receive an acknowledgment within 72 hours. Please allow reasonable time
for a fix before public disclosure.

## Threat model (free core)

The free core is **local-first**:

- The stdio MCP server and the HTTP bridge bind to **loopback only** (127.0.0.1).
- The free core makes **no outbound network calls**. If you did not configure a
  Pro provider, nothing leaves your machine.
- CVs and applications are stored in `JOB_MCP_DATA_DIR` (default `./data`).

Known hardening points to be aware of:

- The HTTP bridge has **no auth by default**. If anything else runs on your
  machine (or could reach 127.0.0.1), set `JOB_MCP_HTTP_TOKEN` and use the
  bearer token in the extension options and desktop app.
- The bridge trusts the local user. Do not run it on a shared host without auth.
- CV parsing uses `pdf-parse` and `mammoth`. Treat parsed CV text as untrusted
  input (it is never `eval`'d, but don't feed adversarial files in production).

## Pro / cloud services (out of scope here)

Paid services run on separate hosted infrastructure and have their own security
documentation. This repository does not contain cloud credentials, payment
secrets, or AI provider keys — and it must never store them in the desktop app.