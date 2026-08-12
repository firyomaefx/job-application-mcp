// Pure job-posting extractor — shared by the content script (auto-detect) and
// the popup's on-demand "Import this job" action. It works on plain strings so
// it can be unit-tested in Node with fixture HTML (no DOM/jsdom dependency).
//
// Both the content-script context and Node see the function: in the extension
// it is injected as a content_scripts file (shared isolated-world scope), and
// in Node `module.exports` exposes it for tests.

var QUOTE = String.fromCharCode(34);   // "
var SQUOTE = String.fromCharCode(39);  // '

/**
 * Extract a structured job posting from page strings.
 *
 * @param {{ jsonLdText: string, title: string, bodyText: string, url: string }} input
 *   - jsonLdText: concatenated text of all <script type="application/ld+json"> blocks
 *   - title: document.title
 *   - bodyText: document.body.innerText (or a stripped-text fallback)
 *   - url: location.href
 * @returns {{ title: string, description: string, location: string, company: string, url: string, source: string } | null}
 *   Returns null when there is no usable job signal (description too short for
 *   analyze_job's min-20 constraint, or no title at all).
 */
function parseJobPosting(input) {
  var jsonLdText = (input && input.jsonLdText) || "";
  var title = ((input && input.title) || "").trim();
  var bodyText = (input && input.bodyText) || "";
  var url = (input && input.url) || "";

  // 1) Prefer structured JSON-LD JobPosting if present (most reliable).
  var ld = findJobPostingLd(jsonLdText);
  if (ld) {
    var ldTitle = (ld.title || ld.jobTitle || ld.headline || title || "").trim();
    var description = stripHtml(ld.description || "").trim();
    var company = orgName(ld.hiringOrganization || ld.employer || {});
    var location = jobLocation(ld.jobLocation || ld.applicantLocation || ld.jobLocations || "");
    if (ldTitle && description.length >= 20) {
      return {
        title: ldTitle,
        description: description,
        location: location || "",
        company: company || "",
        url: url,
        source: "jsonld",
      };
    }
  }

  // 2) Fallback: title from <title> (trim site suffixes), description from body text.
  var cleanTitle = cleanDocTitle(title);
  var desc = collapseWhitespace(bodyText).trim();
  if (cleanTitle && desc.length >= 20) {
    return {
      title: cleanTitle,
      description: desc.slice(0, 4000),
      location: "",
      company: guessCompanyFromTitle(title),
      url: url,
      source: "fallback",
    };
  }
  return null;
}

/** Find the first JSON-LD object whose @type is JobPosting (or contains it). */
function findJobPostingLd(jsonLdText) {
  if (!jsonLdText) return null;
  var blocks = recoverBlocks(jsonLdText);
  for (var i = 0; i < blocks.length; i++) {
    var obj;
    try {
      obj = JSON.parse(blocks[i]);
    } catch (e) {
      continue;
    }
    var cand = unwrapArray(obj).filter(isJobPosting)[0];
    if (cand) return cand;
  }
  return null;
}

/** Heuristically split concatenated ld+json text into individual JSON objects. */
function recoverBlocks(text) {
  var out = [];
  var depth = 0;
  var start = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) out.push(text.slice(start, i + 1));
    }
  }
  if (out.length === 0 && text.trim()) out.push(text);
  return out;
}

function unwrapArray(obj) {
  return Array.isArray(obj) ? obj : [obj];
}

function isJobPosting(obj) {
  if (!obj || typeof obj !== "object") return false;
  var t = obj["@type"];
  if (!t) return false;
  var types = Array.isArray(t) ? t : [t];
  return types.some(function (x) { return String(x).toLowerCase() === "jobposting"; });
}

function orgName(org) {
  if (!org) return "";
  if (typeof org === "string") return org;
  return (org.name || org.legalName || "").trim();
}

function jobLocation(loc) {
  if (!loc) return "";
  var arr = Array.isArray(loc) ? loc : [loc];
  for (var i = 0; i < arr.length; i++) {
    var l = arr[i];
    if (!l) continue;
    if (typeof l === "string") return l;
    var a = l.address || l;
    var country = a && a.addressCountry;
    var countryName = typeof country === "string" ? country : (country && country.name);
    var parts = [a && a.addressLocality, a && a.addressRegion, countryName].filter(Boolean);
    if (parts.length) return parts.join(", ");
    if (l.name) return l.name;
  }
  return "";
}

/** Remove HTML tags and decode a few common entities (JSON-LD descriptions are often HTML). */
function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, QUOTE)
    .replace(/&#39;/gi, SQUOTE);
}

function collapseWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/** Trim common site suffixes from <title>: "Job Title | LinkedIn", "Title - Indeed". */
function cleanDocTitle(title) {
  var t = collapseWhitespace(title);
  t = t.split(/\s[\|\-–—]\s.*$/)[0].trim();
  t = t.replace(/^(job|hiring|we.?re hiring):\s*/i, "");
  return t;
}

/** "Company Name — Job Title" guess from the raw title (left side of separator). */
function guessCompanyFromTitle(title) {
  var t = collapseWhitespace(title);
  var m = t.match(/^(.*?)\s[\|\-–—]\s/);
  return m ? m[1].trim() : "";
}

// Expose to the content-script isolated world and to Node tests.
if (typeof self !== "undefined") self.parseJobPosting = parseJobPosting;
if (typeof module !== "undefined" && module.exports) module.exports = { parseJobPosting: parseJobPosting };