import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKeywords, scoreMatch } from "../src/lib/scoring.js";

test("extractKeywords surfaces tech terms and ignores stopwords", () => {
  const kws = extractKeywords(
    "We are looking for a React and TypeScript engineer with AWS and PostgreSQL experience. " +
      "You will build APIs and work with the team on CI/CD pipelines.",
    20
  );
  assert.ok(kws.includes("react"));
  assert.ok(kws.includes("typescript"));
  assert.ok(kws.includes("aws"));
  assert.ok(kws.includes("postgresql"));
  assert.ok(!kws.includes("the"));
  assert.ok(!kws.includes("you"));
});

test("scoreMatch rewards overlapping skills and reports missing", () => {
  const result = scoreMatch(
    ["react", "typescript", "node", "aws"],
    ["react", "typescript", "python", "docker"]
  );
  assert.equal(result.matched.length, 2);
  assert.ok(result.missing.includes("python"));
  assert.ok(result.missing.includes("docker"));
  assert.ok(result.score > 0 && result.score < 100);
});

test("scoreMatch full overlap yields a high score", () => {
  const result = scoreMatch(["react", "typescript", "aws"], ["react", "typescript", "aws"]);
  assert.equal(result.matched.length, 3);
  assert.equal(result.missing.length, 0);
  assert.ok(result.score >= 90);
});

test("scoreMatch stem-matches react ~ reactjs", () => {
  const result = scoreMatch(["react"], ["reactjs"]);
  assert.equal(result.matched.length, 1);
});

test("scoreMatch empty job keywords warns the caller", () => {
  const result = scoreMatch(["react"], []);
  assert.equal(result.score, 0);
  assert.ok(result.notes.some((n) => n.includes("No job keywords")));
});