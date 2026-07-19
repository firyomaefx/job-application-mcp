// N5: approval-gated submission recording. The tool never submits to a browser;
// it records a user-performed submission only after a validated, single-use,
// short-lived approval token is issued and consumed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";

import { closeDb, resetDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { saveJob, saveCv, saveApplication, getApplication } from "../src/store/applications.js";
import {
  requestApproval,
  confirmSubmission,
  validateForSubmission,
  APPROVAL_TTL_MS,
} from "../src/submission/approval.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-approval";
mkdirSync("./data-test-approval", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-approval", { recursive: true, force: true });
});

function seed(withCv = true) {
  resetDb();
  const p = getDefaultProfile();
  const job = saveJob(p.id, { title: "Backend Eng", company: "Acme", url: null, description: "Node + SQL", keywords: ["node", "sql"] });
  const cv = saveCv(p.id, "cv1", "Jane Doe\nSkills: node, sql", null);
  const app = saveApplication({ profile_id: p.id, job_id: job.id, cv_id: withCv ? cv.id : null, status: "draft" });
  return { p, job, cv, app };
}

test("N5: request_approval issues a token after passing the gate", () => {
  const { app } = seed();
  const r = requestApproval(app.id);
  assert.ok(r.approval_token.length >= 32);
  assert.equal(r.application_id, app.id);
  assert.ok(r.checks.includes("approved CV attached"));
});

test("N5: blocks when no approved CV is attached", () => {
  const { app } = seed(false);
  assert.throws(() => requestApproval(app.id), /no approved CV attached/);
});

test("N5: blocks duplicate submission for the same job", () => {
  const { p, job, cv, app } = seed();
  const app2 = saveApplication({ profile_id: p.id, job_id: job.id, cv_id: cv.id, status: "draft" });
  const r = requestApproval(app.id);
  confirmSubmission(app.id, r.approval_token);
  assert.throws(() => requestApproval(app2.id), /already submitted for this job/);
});

test("N5: confirm_submission marks submitted and consumes the token (single-use)", () => {
  const { app } = seed();
  const r = requestApproval(app.id);
  const confirmed = confirmSubmission(app.id, r.approval_token, "CONF-123");
  assert.equal(confirmed.status, "submitted");
  assert.ok(confirmed.submitted_at);
  // Reusing the same token must fail.
  assert.throws(() => confirmSubmission(app.id, r.approval_token), /invalid or already-used/);
});

test("N5: an expired token is rejected", () => {
  const { app } = seed();
  const r = requestApproval(app.id);
  const future = new Date(Date.now() + APPROVAL_TTL_MS + 60_000);
  assert.throws(() => confirmSubmission(app.id, r.approval_token, undefined, future), /expired/);
});

test("N5: an unresolved sensitive field blocks request_approval", () => {
  const { app } = seed();
  const sensitive = [{ name: "salary_expectation", label: "Salary expectation", value: "", requires_user_review: true }];
  assert.throws(() => requestApproval(app.id, sensitive), /unresolved sensitive field/);
  // Resolved sensitive field (value set, reviewed) is allowed.
  const resolved = [{ name: "salary_expectation", label: "Salary expectation", value: "90000", requires_user_review: false }];
  const r = requestApproval(app.id, resolved);
  assert.ok(r.approval_token);
});

test("N5: a bogus token is rejected (constant-time safe compare)", () => {
  const { app } = seed();
  requestApproval(app.id);
  assert.throws(() => confirmSubmission(app.id, "0".repeat(64)), /invalid or already-used/);
});

test("N5: validateForSubmission rejects an already-submitted app", () => {
  const { app } = seed();
  const r = requestApproval(app.id);
  confirmSubmission(app.id, r.approval_token);
  assert.throws(() => validateForSubmission(app.id), /already submitted/);
  // And the app really is submitted in storage.
  assert.equal(getApplication(app.id)?.status, "submitted");
});