// Service worker. Minimal for now — listens for install and could later
// coordinate capture commands or bridge health checks.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.get(
      { bridgeUrl: "http://127.0.0.1:8787", token: "" },
      (defaults) => chrome.storage.sync.set(defaults)
    );
  }
});