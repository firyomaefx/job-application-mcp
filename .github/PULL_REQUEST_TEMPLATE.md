## Summary

<!-- What does this change do, in one or two sentences? -->

## Component

<!-- core / stdio / http bridge / extension / desktop / docs / ci -->

## Free-core guard

- [ ] This change does **not** gate any free-core feature behind a paid or network service.
- [ ] No CV text or PII is logged at info level.
- [ ] Submission stays manual by default, OR new auto-submit paths are behind `JOB_MCP_AUTO_APPLY=1` with caps and ATS-only guards.

## Tests

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes (or N/A — explain why)
- [ ] New/changed behavior covered by a test or a manual smoke check (describe below)