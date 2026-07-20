// Auto-detect a job posting on a matched career page and tell the background
// worker about it (so the toolbar action can show a "job detected" badge and
// the popup can offer one-click import). Runs after extract.js in the same
// isolated world, so `self.parseJobPosting` is available.
//
// Privacy: this reads the page's JSON-LD + title + body text ON THE PAGE, then
// sends only the structured {title, description, ...} to the extension's own
// background worker — which is in-process, never the network. The popup later
// posts it to the user's LOCAL bridge on 127.0.0.1 only. Nothing leaves the
// machine except to the user's own local server.

(function detect() {
  const jsonLd = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
    .map((s) => s.textContent || "")
    .join("\n");

  const bodyText =
    (document.body && document.body.innerText) ||
    (document.documentElement ? document.documentElement.textContent : "") ||
    "";

  let job = null;
  try {
    job = self.parseJobPosting({
      jsonLdText: jsonLd,
      title: document.title || "",
      bodyText,
      url: location.href,
    });
  } catch {
    job = null;
  }

  if (job) {
    try {
      chrome.runtime.sendMessage({ type: "job-detected", job, url: location.href });
    } catch {
      // popup may not be open; background still stores it
    }
  }
})();