import { test } from "node:test";
import assert from "node:assert/strict";
import { MockProvider } from "../src/ai/mock.js";
import { getProvider } from "../src/ai/provider.js";

const ctx = {
  jobTitle: "Backend Engineer",
  jobDescription: "Build data pipelines with Python and AWS.",
  jobKeywords: ["python", "aws", "sql"],
  cvText: "Engineer with python, sql, and docker experience.",
  candidateSkills: ["python", "sql", "docker"],
  question: "Tell us about a time you scaled a pipeline.",
};

test("MockProvider.tailorCv returns a heuristic draft and tags provider", async () => {
  const p = new MockProvider();
  const r = await p.tailorCv(ctx);
  assert.equal(r.provider, "mock");
  assert.ok(r.text.length > 0);
  assert.ok(r.text.includes("Backend Engineer"));
});

test("MockProvider.coverLetter and draftAnswer produce scaffolds", async () => {
  const p = new MockProvider();
  const cl = await p.coverLetter(ctx);
  const ans = await p.draftAnswer(ctx);
  assert.ok(cl.text.toLowerCase().includes("cover"));
  assert.ok(ans.text.includes("Tell us about a time"));
});

test("getProvider returns mock when useReal is false", async () => {
  const p = await getProvider({ useReal: false });
  assert.equal(p.name, "mock");
});

test("getProvider falls back to mock when no key/env is set even if useReal true", async () => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  const p = await getProvider({ useReal: true });
  assert.equal(p.name, "mock");
});