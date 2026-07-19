// Electron main process for the Job Application MCP desktop wrapper.
//
// This is a thin, developer-preview UI. It launches the project's local HTTP
// bridge (../dist/src/http.js) as a child process using the system `node`,
// and the renderer talks to that bridge over loopback. It does NOT bundle the
// server — that's a later packaging step. Requires Node.js on PATH.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

// Resolve the repo root from this file's location: desktop/ -> ..
const REPO_ROOT = path.resolve(__dirname, "..");
const BRIDGE_SCRIPT = path.join(REPO_ROOT, "dist", "src", "http.js");
const DATA_DIR = process.env.JOB_MCP_DATA_DIR || path.join(REPO_ROOT, "data");
const BRIDGE_PORT = Number(process.env.JOB_MCP_HTTP_PORT || 8787);
const BRIDGE_TOKEN = process.env.JOB_MCP_HTTP_TOKEN || "";

let win = null;
let bridgeProc = null;
let bridgeStatus = "stopped"; // 'stopped' | 'starting' | 'running' | 'crashed'

function bridgeUrl(p = BRIDGE_PORT) {
  return `http://127.0.0.1:${p}`;
}

function startBridge() {
  if (bridgeProc) return;
  if (!fs.existsSync(BRIDGE_SCRIPT)) {
    bridgeStatus = "crashed";
    sendStatus(`Bridge script not found: ${BRIDGE_SCRIPT}. Run "npm run build" in the project root.`);
    return;
  }
  bridgeStatus = "starting";
  sendStatus("Starting bridge…");

  bridgeProc = spawn("node", [BRIDGE_SCRIPT], {
    env: {
      ...process.env,
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
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  shell.openPath(DATA_DIR);
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