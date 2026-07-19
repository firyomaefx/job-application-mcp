# Job Application MCP — Desktop app (Electron)

A thin desktop wrapper that launches the project's local HTTP bridge and shows a
small dashboard: server status, your candidate profile, and your applications.

The app is **standalone**: the HTTP bridge is esbuild-bundled into a single
self-contained ESM file (`bridge-bundle.mjs`) and forked from Electron's own
bundled Node runtime (`ELECTRON_RUN_AS_NODE=1`), so **no system Node.js is
required** on the user's machine. It only **reads** local data — submission
stays manual, as in the rest of the project.

## Prerequisites (development only)

End users need nothing but the installer. For development:

- The main project built and bundled: from the repo root,
  `npm install && npm run build && npm run bundle:bridge`
  (produces `desktop/bridge-bundle.mjs`).
- Electron installed in this folder (see below).

## Run (dev)

```bash
cd desktop
npm install        # installs Electron + electron-builder
npm start          # launches the Electron app (forks bridge-bundle.mjs)
```

On launch it:

1. Creates a window with the dashboard.
2. Forks `bridge-bundle.mjs` via Electron's bundled Node with
   `JOB_MCP_DATA_DIR=<repo>/data` (dev) or `userData/data` (packaged) and
   `JOB_MCP_HTTP_PORT=8787` (override via env).
3. Polls `/health` until the bridge is up, then loads your profile + applications
   from the bridge.

Buttons:

- **Refresh** — re-fetch profile + applications.
- **Restart bridge** — kill and respawn the child process.
- **Open data folder** — reveal `JOB_MCP_DATA_DIR` in your file manager.

## Configuration (env vars, set before `npm start`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOB_MCP_DATA_DIR` | `../data` (dev) / `userData/data` (packaged) | SQLite + parsed data location. |
| `JOB_MCP_HTTP_PORT` | `8787` | Bridge port the UI talks to. |
| `JOB_MCP_HTTP_TOKEN` | (none) | If set, the bridge requires it; the UI currently assumes no token. |

## Packaging

```bash
# from the repo root, first build the bridge bundle:
npm run build && npm run bundle:bridge

# then package the desktop app:
cd desktop
npm run dist   # electron-builder -> release/ (NSIS on Windows, dmg on mac, AppImage on linux)
```

`electron-builder` config is in `desktop/package.json`. The bundle is shipped as
an `extraResource` (extracted to `resources/bridge-bundle.mjs`); `main.js`
resolves it there when packaged. No system Node.js is required at runtime.

## Files

```text
desktop/
├── package.json          # Electron + electron-builder (extraResources: bridge-bundle.mjs)
├── main.js               # main process: forks bundled bridge via ELECTRON_RUN_AS_NODE, IPC, window
├── preload.js            # safe contextBridge API
├── bridge-bundle.mjs     # esbuild-bundled HTTP bridge (generated; self-contained, no system Node)
└── renderer/
    ├── index.html        # dashboard markup (CSP-limited)
    ├── style.css
    └── app.js            # fetches the bridge; renders profile + applications
```

## Security notes

- Renderer has `contextIsolation: true`, `nodeIntegration: false`, and a CSP
  that only allows `connect-src` to `http://127.0.0.1:*`.
- The bridge binds to `127.0.0.1` only — not reachable from the network.
- The UI only reads via `get_profile` / `list_applications`; it never submits.

## License

AGPL-3.0-or-later (same as the project).