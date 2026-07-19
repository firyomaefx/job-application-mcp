// N8: pure form-field classification (wrong-field / sensitive-field prevention).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessFieldKey,
  isSensitiveField,
  classifyField,
  SENSITIVE_PATTERN,
  SKIP_FIELD_TYPES,
} from "../src/forms/fields.js";

test("N8: guessFieldKey maps common field names/labels", () => {
  assert.equal(guessFieldKey("name", "Full name"), "full_name");
  assert.equal(guessFieldKey("email", "Email address"), "email");
  assert.equal(guessFieldKey("phone", "Mobile"), "phone");
  assert.equal(guessFieldKey("loc", "City"), "location");
  assert.equal(guessFieldKey("cover", "Cover letter"), "cover_letter");
  assert.equal(guessFieldKey("title", "Headline"), "headline");
  assert.equal(guessFieldKey("random_xyz", "Anything"), "");
});

test("N8: isSensitiveField flags legal/salary/authorization fields", () => {
  assert.ok(isSensitiveField("salary", "Salary expectation"));
  assert.ok(isSensitiveField("q1", "Are you authorized to work in the US?"));
  assert.ok(isSensitiveField("visa", "Visa sponsorship needed?"));
  assert.ok(isSensitiveField("agree", "I agree to the terms"));
  assert.ok(!isSensitiveField("name", "Full name"));
  assert.ok(!isSensitiveField("email", "Email"));
});

test("N8: classifyField requires user review for sensitive or empty fields", () => {
  const vals = { full_name: "Jane Doe", email: "jane@example.com" };
  const ok = classifyField({ name: "name", label: "Full name" }, vals);
  assert.equal(ok.mapped_to, "full_name");
  assert.equal(ok.value, "Jane Doe");
  assert.equal(ok.requires_user_review, false);
  assert.equal(ok.sensitive, false);

  const sensitive = classifyField({ name: "salary", label: "Salary expectation" }, vals);
  assert.equal(sensitive.sensitive, true);
  assert.equal(sensitive.requires_user_review, true, "sensitive → always review");

  const empty = classifyField({ name: "phone", label: "Phone" }, vals);
  assert.equal(empty.value, "");
  assert.equal(empty.requires_user_review, true, "no mapped value → review");
  assert.equal(empty.confidence, "none");
});

test("N8: SENSITIVE_PATTERN and SKIP_FIELD_TYPES cover the extension rules", () => {
  assert.ok(SENSITIVE_PATTERN.test("criminal history"));
  assert.ok(SENSITIVE_PATTERN.test("national origin"));
  assert.ok(!SENSITIVE_PATTERN.test("first name"));
  assert.ok(SKIP_FIELD_TYPES.has("hidden"));
  assert.ok(SKIP_FIELD_TYPES.has("password"));
  assert.ok(!SKIP_FIELD_TYPES.has("text"));
});