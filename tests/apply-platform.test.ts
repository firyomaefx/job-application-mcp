import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyApplyUrl } from "../src/apply/platform.js";

test("classifyApplyUrl allows Greenhouse", () => {
  const r = classifyApplyUrl("https://boards.greenhouse.io/acme/jobs/123");
  assert.equal(r.allowed, true);
  if (r.allowed) assert.equal(r.adapter_id, "greenhouse");
});

test("classifyApplyUrl blocks LinkedIn apply", () => {
  const r = classifyApplyUrl("https://www.linkedin.com/jobs/view/123");
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.match(r.reason, /LinkedIn/i);
});

test("classifyApplyUrl blocks Indeed", () => {
  const r = classifyApplyUrl("https://www.indeed.com/viewjob?jk=abc");
  assert.equal(r.allowed, false);
});