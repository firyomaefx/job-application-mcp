# Job Application MCP — Desktop app (Electron)

A thin desktop wrapper that launches the project's local HTTP bridge and shows a
small dashboard: server status, your candidate profile, and your applications.

This is a **developer preview**. It launches the bridge as a child process using
the system `node` (it does not yet bundle the server). It only **reads** local
data — submission stays manual, as in the rest of the project.

## Prerequisites

- The main project built: from the repo root, `npm install && npm run build`
  (so `dist/src/http.js` exists).
- Node.js on your PATH (used to run the bridge).
- Electron installed in this folder (see below).

## Run

```bash
cd desktop
npm install        # installs Electron + electron-builder
npm start          # launches the Electron app
```

On launch it:

1. Creates a window with the dashboard.
2. Spawns `node ../dist/src/http.js` with `JOB_MCP_DATA_DIR=../data` and
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
| `JOB_MCP_DATA_DIR` | `../data` | SQLite + parsed data location. |
| `JOB_MCP_HTTP_PORT` | `8787` | Bridge port the UI talks to. |
| `JOB_MCP_HTTP_TOKEN` | (none) | If set, the bridge requires it; the UI currently assumes no token. |

## Packaging (later step)

```bash
npm run dist   # uses electron-builder -> release/ (NSIS on Windows, dmg on mac, AppImage on linux)
```

`electron-builder` config is in `desktop/package.json`. A fully bundled build
that embeds the server (no system Node) is a future task — see the root
`BUSINESS_PROPOSAL.md` Stage 1.

## Files

```text
desktop/
├── package.json          # Electron + electron-builder
├── main.js               # main process: spawns bridge, IPC, window
├── preload.js            # safe contextBridge API
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