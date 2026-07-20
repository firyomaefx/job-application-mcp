// Electron main process for the Job Application MCP desktop wrapper.
//
// Standalone build: the HTTP bridge is esbuild-bundled into a single
// self-contained ESM file (bridge-bundle.mjs — no TS imports, no system Node
// required). It is forked from Electron's OWN bundled Node runtime by setting
// ELECTRON_RUN_AS_NODE=1 and using process.execPath as the binary, so the app
// does not depend on a Node.js install on the user's PATH.
//
// Dev: the bundle lives next to main.js (build it with `npm run bundle:bridge`
// from the repo root, after `npm run build`). Packaged: electron-builder
// ships it as an extraResource under process.resourcesPath.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

// Resolve the repo root from this file's location: desktop/ -> ..
const REPO_ROOT = path.resolve(__dirname, "..");
const BRIDGE_PORT = Number(process.env.JOB_MCP_HTTP_PORT || 8787);
const BRIDGE_TOKEN = process.env.JOB_MCP_HTTP_TOKEN || "";

/** Path to the bundled bridge script. Dev: alongside main.js; packaged: in resources. */
function bridgeScript() {
  if (app.isPackaged) return path.join(process.resourcesPath, "bridge-bundle.mjs");
  return path.join(__dirname, "bridge-bundle.mjs");
}

/** Where user data lives. Dev: repo ./data; packaged: under Electron userData. */
function dataDir() {
  if (process.env.JOB_MCP_DATA_DIR) return process.env.JOB_MCP_DATA_DIR;
  if (app.isPackaged) return path.join(app.getPath("userData"), "data");
  return path.join(REPO_ROOT, "data");
}

let win = null;
let bridgeProc = null;
let bridgeStatus = "stopped"; // 'stopped' | 'starting' | 'running' | 'crashed'

function bridgeUrl(p = BRIDGE_PORT) {
  return `http://127.0.0.1:${p}`;
}

function startBridge() {
  if (bridgeProc) return;
  const BRIDGE_SCRIPT = bridgeScript();
  const DATA_DIR = dataDir();
  if (!fs.existsSync(BRIDGE_SCRIPT)) {
    bridgeStatus = "crashed";
    sendStatus(
      app.isPackaged
        ? `Bridge bundle not found: ${BRIDGE_SCRIPT}. The install may be corrupt — reinstall.`
        : `Bridge bundle not found: ${BRIDGE_SCRIPT}. Run "npm run build" then "npm run bundle:bridge" in the project root.`,
    );
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  bridgeStatus = "starting";
  sendStatus("Starting bridge…");

  // Fork the bundled bridge from Electron's own Node runtime (no system Node
  // needed). ELECTRON_RUN_AS_NODE makes process.execPath behave as plain `node`.
  bridgeProc = spawn(process.execPath, [BRIDGE_SCRIPT], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      JOB_MCP_DATA_DIR: DATA_DIR,
      JOB_MCP_HTTP_PORT: String(BRIDGE_PORT),
      JOB_MCP_HTTP_TOKEN: BRIDGE_TOKEN,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  bridgeProc.stdout.on("data", (d) => {
    const s = d.toString();
    if (s.includes("listening")) {
      bridgeStatus = "running";
      sendStatus("Bridge running");
    }
  });
  bridgeProc.stderr.on("data", (d) => {
    console.error("[bridge]", d.toString().trim());
  });
  bridgeProc.on("exit", (code) => {
    bridgeProc = null;
    if (bridgeStatus !== "stopped") {
      bridgeStatus = "crashed";
      sendStatus(`Bridge exited (code ${code}). Click "Restart bridge" or check it built.`);
    }
  });

  // Fallback status check: poll /health a few times in case the stdout hint is missed.
  pollHealth();
}

function stopBridge() {
  bridgeStatus = "stopped";
  if (bridgeProc) {
    try { bridgeProc.kill("SIGTERM"); } catch {}
    bridgeProc = null;
  }
  sendStatus("Bridge stopped");
}

function pollHealth() {
  let attempts = 0;
  const timer = setInterval(() => {
    if (bridgeStatus === "running" || bridgeStatus === "stopped" || attempts++ > 20) {
      clearInterval(timer);
      return;
    }
    const req = http.get(`${bridgeUrl()}/health`, (res) => {
      res.resume();
      if (res.statusCode === 200 && bridgeStatus !== "running") {
        bridgeStatus = "running";
        sendStatus("Bridge running");
        clearInterval(timer);
      }
    });
    req.on("error", () => {});
    req.end();
  }, 500);
}

function sendStatus(msg) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("bridge:status", { status: bridgeStatus, message: msg, url: bridgeUrl() });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 680,
    title: "Job Application MCP",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // L2: run the renderer in the Electron sandbox. The preload still works
      // (contextBridge is sandbox-safe) and exposes only the `jobMcp` surface.
      // The renderer has no Node access either way; sandbox adds a hard floor.
      sandbox: true,
      // L3: deny new windows/Webview and pepper 3D; the app is a single dashboard.
      javascript: true,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.on("did-finish-load", () => {
    sendStatus(bridgeStatus === "running" ? "Bridge running" : "Bridge stopped");
  });
}

// ── IPC ──────────────────────────────────────────────────────
ipcMain.handle("bridge:start", () => startBridge());
ipcMain.handle("bridge:stop", () => stopBridge());
ipcMain.handle("bridge:restart", () => { stopBridge(); setTimeout(startBridge, 300); });
ipcMain.handle("bridge:info", () => ({ url: bridgeUrl(), status: bridgeStatus, port: BRIDGE_PORT }));
ipcMain.handle("data:openDir", () => {
  const dir = dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
});

app.whenReady().then(() => {
  createWindow();
  startBridge();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBridge();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBridge());