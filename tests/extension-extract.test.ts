import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// extract.js is a classic (non-module) content script — it cannot use ESM
// `export`. Load it in a sandbox that provides `self` + `module.exports` so we
// can grab the pure `parseJobPosting` function for testing.
const src = readFileSync(
  new URL("../extension/content/extract.js", import.meta.url),
  "utf8"
);
const sandboxSelf: Record<string, unknown> = {};
const moduleObj = { exports: {} as Record<string, unknown> };
const loader = new Function(
  "self",
  "module",
  "exports",
  `${src}\nreturn module.exports;`
);
const exported = loader(sandboxSelf, moduleObj, moduleObj.exports) as {
  parseJobPosting: (i: unknown) => JobResult | null;
};
const parseJobPosting = exported.parseJobPosting;

interface JobResult {
  title: string;
  description: string;
  location: string;
  company: string;
  url: string;
  source: string;
}
void sandboxSelf; // self.parseJobPosting is also set in-content; assert it below

test("extract.js also exposes parseJobPosting on self for the content script", () => {
  assert.equal(typeof (sandboxSelf.parseJobPosting as unknown), "function");
});

test("parseJobPosting extracts a structured job from a JSON-LD JobPosting block", () => {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: "Senior Backend Engineer",
    description: "<p>Build data pipelines with <b>Python</b> and AWS.</p>",
    hiringOrganization: { "@type": "Organization", name: "Acme Corp" },
    jobLocation: {
      "@type": "Place",
      address: { addressLocality: "Kuala Lumpur", addressCountry: "Malaysia" },
    },
  });
  const r = parseJobPosting({ jsonLdText: jsonLd, title: "Senior Backend Engineer | Acme", bodyText: "", url: "https://example.com/job" });
  assert.ok(r, "expected a job");
  assert.equal(r.title, "Senior Backend Engineer");
  assert.equal(r.company, "Acme Corp");
  assert.equal(r.location, "Kuala Lumpur, Malaysia");
  assert.ok(r.description.includes("Python"), "description keeps content");
  assert.ok(!r.description.includes("<p>"), "HTML tags stripped");
  assert.equal(r.url, "https://example.com/job");
  assert.equal(r.source, "jsonld");
});

test("parseJobPosting picks the JobPosting block out of multiple JSON-LD blocks", () => {
  const jsonLd = [
    JSON.stringify({ "@type": "WebSite", name: "Board" }),
    JSON.stringify({ "@type": "JobPosting", title: "Data Analyst", description: "Analyze data with SQL and Python for reporting dashboards." }),
  ].join("\n");
  const r = parseJobPosting({ jsonLdText: jsonLd, title: "Board", bodyText: "", url: "u" });
  assert.ok(r);
  assert.equal(r.title, "Data Analyst");
});

test("parseJobPosting falls back to <title> + body text when there is no JSON-LD", () => {
  const body = "We are hiring a Frontend Engineer to build React apps. " + "x".repeat(80);
  const r = parseJobPosting({ jsonLdText: "", title: "Frontend Engineer | Jobs Board", bodyText: body, url: "u" });
  assert.ok(r, "expected a fallback job");
  assert.equal(r.title, "Frontend Engineer");
  assert.equal(r.source, "fallback");
  assert.ok(r.description.length >= 20);
  assert.equal(r.company, "Frontend Engineer"); // heuristic from "Title | Board" — left side
});

test("parseJobPosting returns null when the description is too short for analyze_job", () => {
  // analyze_job requires description min(20); a page with no real body should not import.
  const r = parseJobPosting({ jsonLdText: "", title: "Home", bodyText: "hi", url: "u" });
  assert.equal(r, null);
});

test("parseJobPosting returns null when there is no title and no JSON-LD", () => {
  const r = parseJobPosting({ jsonLdText: "", title: "", bodyText: "A reasonably long body of text that is long enough to pass the twenty char floor.", url: "u" });
  assert.equal(r, null);
});

test("parseJobPosting handles an array @type and array jobLocation", () => {
  const jsonLd = JSON.stringify({
    "@type": ["JobPosting", "Organization"],
    title: "ML Engineer",
    description: "Build and ship machine learning models in production at scale.",
    hiringOrganization: "Acme",
    jobLocation: [
      { address: { addressLocality: "Penang", addressRegion: "MY" } },
    ],
  });
  const r = parseJobPosting({ jsonLdText: jsonLd, title: "x", bodyText: "", url: "u" });
  assert.ok(r);
  assert.equal(r.title, "ML Engineer");
  assert.equal(r.company, "Acme");
  assert.equal(r.location, "Penang, MY");
});

test("parseJobPosting falls back to body text when JSON-LD JobPosting has too-short description", () => {
  const jsonLd = JSON.stringify({ "@type": "JobPosting", title: "X", description: "short" });
  const body = "Senior Engineer role requiring distributed systems and Go experience. " + "y".repeat(100);
  const r = parseJobPosting({ jsonLdText: jsonLd, title: "Senior Engineer - Board", bodyText: body, url: "u" });
  assert.ok(r, "should fall back to body text");
  assert.equal(r.source, "fallback");
  assert.equal(r.title, "Senior Engineer");
});