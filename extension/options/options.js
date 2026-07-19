const DEFAULTS = { bridgeUrl: "http://127.0.0.1:8787", token: "" };

const urlEl = document.getElementById("bridge-url");
const tokenEl = document.getElementById("token");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

(async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  urlEl.value = s.bridgeUrl;
  tokenEl.value = s.token;
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
  await chrome.storage.sync.set({ bridgeUrl: url, token: tokenEl.value.trim() });
  savedEl.hidden = false;
  savedEl.textContent = "Saved.";
  setTimeout(() => (savedEl.hidden = true), 1500);
});