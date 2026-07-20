import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Isolate the SQLite file per test file (node --test runs files in parallel
// processes that would otherwise share ./data/job-mcp.db and lock each other).
process.env.JOB_MCP_DATA_DIR = "./data-test-cv-versions";

import { resetDb, closeDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { saveCv, getCv, updateCv, getCvHistory } from "../src/store/applications.js";
import { listCvs } from "../src/store/profile.js";
import { cvToMarkdown, applicationToMarkdown } from "../src/export/markdown.js";

beforeEach(() => {
  closeDb();
  resetDb();
});

test("updateCv creates a new active version and preserves the old text", () => {
  const p = getDefaultProfile();
  const v1 = saveCv(p.id, "cv", "version one text", null);
  const v2 = updateCv(p.id, v1.id, { text: "version two text" })!;
  assert.ok(v2);
  assert.equal(v2.parent_cv_id, v1.id);
  assert.equal(v2.is_active, 1);
  assert.equal(v2.text, "version two text");
  // old version still exists, now inactive, with original text
  const old = getCv(v1.id)!;
  assert.equal(old.is_active, 0);
  assert.equal(old.text, "version one text");
});

test("listCvs returns only active versions by default; includeInactive shows all", () => {
  const p = getDefaultProfile();
  const a = saveCv(p.id, "cv", "a", null);
  updateCv(p.id, a.id, { text: "b" });
  updateCv(p.id, a.id, { text: "c" }); // careful: a.id is now inactive; update again on a.id
  // Note: updateCv always links to the given id's row as parent, so chaining on a.id still works.
  const active = listCvs(p.id) as { id: number; is_active: number }[];
  assert.equal(active.length, 1, "exactly one active CV after two revisions");
  assert.equal(active[0].is_active, 1);
  const all = listCvs(p.id, { includeInactive: true }) as { id: number; is_active: number }[];
  assert.equal(all.length, 3, "three rows total across the chain");
});

test("getCvHistory returns the full chain oldest→newest from any member", () => {
  const p = getDefaultProfile();
  const v1 = saveCv(p.id, "cv", "one", null);
  const v2 = updateCv(p.id, v1.id, { text: "two" })!;
  const v3 = updateCv(p.id, v2.id, { text: "three" })!;
  // Resolving from the oldest should give the same chain as from the newest.
  const fromRoot = getCvHistory(p.id, v1.id).map((c) => c.id);
  const fromLeaf = getCvHistory(p.id, v3.id).map((c) => c.id);
  assert.deepEqual(fromRoot, [v1.id, v2.id, v3.id]);
  assert.deepEqual(fromLeaf, [v1.id, v2.id, v3.id]);
  const chain = getCvHistory(p.id, v3.id);
  assert.equal(chain[chain.length - 1].is_active, 1, "latest is active");
  assert.equal(chain[0].is_active, 0, "oldest is inactive");
});

test("cvToMarkdown renders profile + cv + skills without HTML injection", () => {
  const md = cvToMarkdown({
    profile: {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      location: "London",
      headline: "Computer Scientist",
      skills: ["analytical engine", "maths"],
      experience_years: 10,
      summary: "Pioneer of computation.",
    },
    cv: { label: "Main CV", text: "## Experience\nDid cool things <script>x</script>" },
    job: { title: "Analyst", company: "Acme" },
    coverLetter: "Dear team,",
  });
  assert.ok(md.includes("# Ada Lovelace"));
  assert.ok(md.includes("Tailored for **Analyst**"));
  assert.ok(md.includes("`analytical engine`"));
  assert.ok(md.includes("## Cover letter"));
  // raw text preserved (we do not strip, just render); the <script> is literal CV text
  assert.ok(md.includes("<script>x</script>"));
});

test("applicationToMarkdown includes status, answers, and notes", () => {
  const md = applicationToMarkdown(
    { id: 7, status: "ready", match_score: 82, answers: { "Why us?": "Because." }, cover_letter: "Hi", tailored_cv_text: null, notes: "Follow up Friday" },
    { title: "Eng", company: "Co" },
    { full_name: "A", email: null, phone: null, location: null, headline: null, skills: [], experience_years: null, summary: null },
    { label: "CV", text: "body" }
  );
  assert.ok(md.includes("# Application 7"));
  assert.ok(md.includes("Status: `ready`"));
  assert.ok(md.includes("Match score: 82/100"));
  assert.ok(md.includes("Why us?"));
  assert.ok(md.includes("Follow up Friday"));
});