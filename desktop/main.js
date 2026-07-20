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

// PDF export: the renderer passes Markdown (from the export_cv_markdown tool,
// fetched from the local bridge). We render it to a hidden, sandboxed
// BrowserWindow and print to PDF — zero extra npm dependency (Electron's own
// printToPDF). The user picks the save path. The Markdown is the user's OWN
// local CV text; we still escape it before the conservative MD→HTML conversion
// so nothing can break out of the document.
ipcMain.handle("export:pdf", async (_e, payload) => {
  const { markdown } = payload || {};
  if (!markdown) throw new Error("No markdown provided for PDF export.");
  const { BrowserWindow, dialog } = require("electron");
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Export as PDF",
    defaultPath: "cv.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  const html = buildPrintableHtml(markdown);
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    await printWin.webContents.executeJavaScript("window.__ready = true");
    const pdf = await printWin.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
    fs.writeFileSync(filePath, pdf);
    return { ok: true, path: filePath };
  } finally {
    printWin.destroy();
  }
});

/** Build a self-contained printable HTML doc from Markdown. Escapes all text,
 *  then applies a conservative subset (headings, bold, inline code, blockquote,
 *  paragraph). No remote resources. Exported for a future desktop test. */
function buildPrintableHtml(markdown) {
  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");
  }
  const lines = String(markdown).split("\n");
  const out = [];
  for (const l of lines) {
    if (/^#\s/.test(l)) out.push("<h1>" + inline(l.replace(/^#\s+/, "")) + "</h1>");
    else if (/^##\s/.test(l)) out.push("<h2>" + inline(l.replace(/^##\s+/, "")) + "</h2>");
    else if (/^>\s/.test(l)) out.push("<blockquote>" + inline(l.replace(/^>\s+/, "")) + "</blockquote>");
    else if (/^\s*$/.test(l)) out.push("");
    else out.push("<p>" + inline(l) + "</p>");
  }
  const body = out.join("\n");
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title>' +
    "<style>" +
    "body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:780px;margin:32px auto;padding:0 24px;color:#0f172a}" +
    "h1{font-size:24px;border-bottom:2px solid #4f46e5;padding-bottom:6px}" +
    "h2{font-size:16px;margin-top:20px;color:#334155}" +
    "code{background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:12px}" +
    "blockquote{border-left:3px solid #4f46e5;margin:0;padding:2px 12px;color:#475569;background:#f8fafc}" +
    "p{margin:6px 0}" +
    "</style></head><body>" +
    body +
    "</body></html>"
  );
}

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