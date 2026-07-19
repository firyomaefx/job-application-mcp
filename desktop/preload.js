// Preload: safe, minimal bridge between renderer and main.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jobMcp", {
  bridgeStart: () => ipcRenderer.invoke("bridge:start"),
  bridgeStop: () => ipcRenderer.invoke("bridge:stop"),
  bridgeRestart: () => ipcRenderer.invoke("bridge:restart"),
  bridgeInfo: () => ipcRenderer.invoke("bridge:info"),
  openDataDir: () => ipcRenderer.invoke("data:openDir"),
  onStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("bridge:status", handler);
    return () => ipcRenderer.removeListener("bridge:status", handler);
  },
});