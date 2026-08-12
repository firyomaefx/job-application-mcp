# CAPA: Missing Desktop Module in Packaged App

## Incident

The Windows unpacked application failed during Electron main-process startup with `Cannot find module './version-util.js'`. The failing `main.js` was inside `resources/app.asar`, so the application exited before opening its UI or bridge.

## Root cause

Version 0.3.0 introduced `require("./version-util.js")` in `desktop/main.js`, but the electron-builder `files` allow-list still contained only `main.js`, `preload.js`, and `renderer/**/*`. The mismatch persisted through the 0.4.1 artifacts shown in this incident. The source module existed and unit tests could import it, but electron-builder omitted it from `app.asar`.

The immediate source fix in 0.4.2 added `version-util.js` to the allow-list. The systemic detection gap remained: tests asserted the allow-list text before packaging, while CI and release jobs did not inspect the produced archive. A stale 0.4.1 unpacked directory could therefore still reproduce the crash.

## Containment

- Do not use local 0.4.1 Setup, portable, or unpacked artifacts.
- Rebuild from current `main` and verify the generated `app.asar` before launch.
- Existing user data is not implicated; the crash occurs before database access.

## Corrective action

- Keep `version-util.js` in the package allow-list.
- Rebuild the Windows unpacked application and installer from current source.
- Verify the packaged executable remains running and the bundled local bridge becomes healthy without system Node.js.

## Preventive action

- `desktop/verify-package.cjs` uses a JavaScript AST to recursively discover static relative `require()`, `import`, and re-export paths reachable from the Electron main and preload entries. Non-static module expressions fail closed because their packaged target cannot be proven.
- It inspects every current generated `app.asar`, fails on missing or stale local modules and renderer assets by comparing packaged bytes with source, and requires a non-empty bundled bridge beside the archive. Explicitly quarantined/stale diagnostic directories are excluded from current-build verification.
- Desktop `pack` and `dist`, pull-request CI on Linux/Windows/macOS, and every release-platform job run the verifier after electron-builder.
- Windows pull-request and release jobs also launch the packaged executable on an isolated port and require a healthy bridge exposing at least 41 tools.
- Unit tests cover recursive dependency discovery, comments, template and concatenated static paths, non-static fail-closed behavior, and cross-platform paths. A real temporary ASAR test proves missing-module and stale-code failures before accepting a complete archive.

## Effectiveness check

The CAPA passes only when source tests, archive inspection, Windows packaging, packaged launch, bridge health, and installer install/uninstall checks all pass. A manifest-only assertion is not sufficient evidence.
