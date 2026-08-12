// Bridge settings. bridgeUrl is non-secret → chrome.storage.sync (roams with
// the account, convenient). The token is a LOCAL secret → chrome.storage.local
// (L4 fix: never sync a bearer token to the user's Chrome account).
const DEFAULTS = { bridgeUrl: "http://127.0.0.1:8787" };

const urlEl = document.getElementById("bridge-url");
const tokenEl = document.getElementById("token");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

(async function load() {
  const sync = await chrome.storage.sync.get(DEFAULTS);
  const local = await chrome.storage.local.get({ token: "" });
  urlEl.value = sync.bridgeUrl;
  tokenEl.value = local.token || "";
})();

saveBtn.addEventListener("click", async () => {
  let url = urlEl.value.trim().replace(/\/+$/, "");
  if (!url) url = DEFAULTS.bridgeUrl;
  try {
    new URL(url); // validate
  } catch {
    savedEl.hidden = false;
    savedEl.textContent = "Invalid URL.";
    return;
  }
  await chrome.storage.sync.set({ bridgeUrl: url });
  await chrome.storage.local.set({ token: tokenEl.value.trim() });
  // L4: ensure no stale token remains in sync (one-time cleanup on save).
  await chrome.storage.sync.remove("token");
  savedEl.hidden = false;
  savedEl.textContent = "Saved.";
  setTimeout(() => (savedEl.hidden = true), 1500);
});