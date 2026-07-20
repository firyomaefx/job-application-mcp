# Packaging

Reference packaging artifacts for Windows distribution (roadmap Phase 4,
v0.3.0).

- `powershell/` — `JobMcp.psd1` + `JobMcp.psm1`: a thin PowerShell module that
  wraps the `job-mcp` CLI for Windows power users (`Start-JobMcpBridge`,
  `Stop-JobMcpBridge`, `Get-JobMcpStatus`, `Import-Job`, `Get-JobInbox`).
  Install: copy into a module path (e.g. `~/Documents/PowerShell/Modules/JobMcp`)
  and `Import-Module JobMcp`. It only talks to the loopback bridge — no direct
  network egress.
- `winget/JobApplicationMCP.yaml` — reference winget manifest. Submitting to
  `microsoft/winget-pkgs` is a manual external PR; it is **not** automated by CI.
  Fill in the release asset `InstallerSha256` before submission.

## ⚠️ Code-signing certificate gap (blocking for "signed" distribution)

The MSIX and NSIS installers produced by `cd desktop && npm run dist` are
**unsigned** until a code-signing certificate is obtained. Consequences:

- Windows SmartScreen will show a "Windows protected your PC" warning on first
  install; users must choose "More info → Run anyway".
- MSIX, in particular, requires a **trusted** cert to install without side
  loading; unsigned MSIX will only install on a developer-unlocked machine
  (`Add-AppxPackage -AllowDevelopment ...`).
- winget-pkgs may reject the manifest until installers are signed and have
  stable reputation.

A code-signing certificate (EV or standard OV for MSIX/SmartScreen reputation)
is a **paid, external** requirement and is out of scope for this repo. Until it
is obtained:

1. The desktop installer is labeled a **developer preview** ("unsigned").
2. The release notes call out the SmartScreen warning explicitly.
3. We do **not** claim the build is signed anywhere in the UI or docs.

When a cert is available, wire it into `desktop/package.json`:

```json
"win": {
  "certificateFile": "...",
  "certificateSubjectName": "...",
  "signingHashAlgorithms": ["sha256"]
}
```

and remove the "unsigned developer preview" language from the release notes.

## Auto-update

`desktop/main.js` wires `electron-updater` (guarded, packaged-only). The update
feed is GitHub Releases (public repo). Update checks therefore contact
`github.com` — this is documented as opt-out. The version-compare decision is a
pure, tested helper (`desktop/version-util.js`); a malformed feed never
downgrades the app. Nothing installs without the user clicking
**Install & restart** in the in-app banner.