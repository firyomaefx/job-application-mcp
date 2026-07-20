// Preload: safe, minimal bridge between renderer and main.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jobMcp", {
  bridgeStart: () => ipcRenderer.invoke("bridge:start"),
  bridgeStop: () => ipcRenderer.invoke("bridge:stop"),
  bridgeRestart: () => ipcRenderer.invoke("bridge:restart"),
  bridgeInfo: () => ipcRenderer.invoke("bridge:info"),
  openDataDir: () => ipcRenderer.invoke("data:openDir"),
  exportPdf: (payload) => ipcRenderer.invoke("export:pdf", payload),
  // Auto-update (Phase 4). Nothing installs without an explicit user click.
  installUpdate: () => ipcRenderer.invoke("update:install"),
  // Jump-list deep-link intent ("open-inbox" | "new-cv" | null) from argv.
  launchIntent: () => ipcRenderer.sendSync("app:launchIntent"),
  onUpdateAvailable: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },
  onStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("bridge:status", handler);
    return () => ipcRenderer.removeListener("bridge:status", handler);
  },
});