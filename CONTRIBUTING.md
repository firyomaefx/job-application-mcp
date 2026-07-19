# Contributing to Job Application MCP

Thanks for considering a contribution. This project is the **free community core**
of an open-core product (see [`BUSINESS_PROPOSAL.md`](./BUSINESS_PROPOSAL.md)).

## The one rule that matters most

**No feature in this repo may gate a free-core capability behind a paid or
network service.** The free core must stay fully local and fully free. Pro/cloud
features live in separate hosted services, not here. Tool handlers may include
*seams* (an `AIProvider` interface, a licence module) as long as the free path
works without them.

Other invariants — please respect them in every PR:

- Submission is **always manual**. Never add automated submission.
- Never automate LinkedIn or Indeed (their ToS prohibit it).
- No CV text or PII in logs at info level.
- Local data only in the free core; nothing egresses without an explicit,
  documented, env-gated Pro path.

## Getting started

```bash
git clone https://github.com/firyomaefx/job-application-mcp.git
cd job-application-mcp
npm install
npm run build
npm test
```

For the companion apps:

```bash
# Chrome extension: load extension/ unpacked in chrome://extensions
node extension/build-icons.js     # regenerate icons

# Desktop app
cd desktop && npm install && npm start
```

## Workflow

1. Open an issue first for anything non-trivial, so we can align on approach.
2. Branch from `main`.
3. Keep PRs focused. Run `npm run typecheck && npm run build && npm test` before pushing.
4. Use the PR template; fill in the free-core guard checklist.
5. By submitting, you agree your contributions are licensed under AGPL-3.0-or-later.

## Adding a tool

1. Create `src/tools/<name>.ts` exporting a `ToolDef<z.ZodObject<…>>`.
2. Register it in `src/tools/index.ts`.
3. Add a test in `tests/` for any pure logic.
4. Document it in the root `README.md` tool table.

Tools receive zod-parsed input and return `ToolResult` (`{ summary, data?, notes? }`).
The server handles JSON Schema generation, validation, and error wrapping.

## Code style

- TypeScript strict mode. No `any` in new code unless typing an external seam.
- Pure logic (scoring, parsing helpers) lives in `src/lib/` with tests — no I/O.
- Match the surrounding style (naming, comment density).

## Reporting security issues

See [`SECURITY.md`](./SECURITY.md). Do not open public issues for security problems.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Be kind.