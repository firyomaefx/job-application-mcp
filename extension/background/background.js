// Service worker.
// - Seeds default settings on install.
// - Relays "job-detected" messages from content scripts into session storage so
//   the popup can offer one-click import, and sets a toolbar badge.
// - Re-runs detection on SPA navigations (pushState) for matched tabs.
//
// The bridge token lives in chrome.storage.local (NOT sync) — see L4 fix. It is
// a local secret and must not be synced to the user's Chrome account.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({ bridgeUrl: "http://127.0.0.1:8787" });
    chrome.storage.local.set({ token: "" });
  }
});

// Store the most recent job detected on a tab so the popup can read it on open.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "job-detected" && msg.job && sender.tab && sender.tab.id != null) {
    const tabId = sender.tab.id;
    chrome.storage.session
      .set({
        lastJob: msg.job,
        lastJobUrl: msg.url || sender.tab.url || "",
        lastJobTabId: tabId,
      })
      .then(() => {
        chrome.action.setBadgeText({ text: "job", tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#4f46e5", tabId });
      })
      .catch(() => {});
    sendResponse?.({ ok: true });
    return true; // async
  }
  if (msg && msg.type === "clear-badge" && sender.tab && sender.tab.id != null) {
    chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
  }
});

// SPA navigations (history.pushState) don't re-trigger content_scripts. Re-run
// detection by re-injecting the extractor + detector on tabs that update.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url || !/^https:/.test(tab.url)) return;
  // Only re-inject on likely job pages; the static content_scripts handle full loads.
  if (!/jobs?\/|viewjob|job-listing|lever\.co|greenhouse|workday|smartrecruiters/i.test(tab.url)) return;
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ["content/extract.js", "content/import-detector.js"],
    })
    .catch(() => {
      // host permission may be missing on this tab; ignore.
    });
});