import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closeDb,
  resetDb,
} from "../src/store/db.js";
import { getDefaultProfile, updateProfile } from "../src/store/profile.js";
import {
  getApplication,
  getJob,
  listApplications,
  saveApplication,
  saveCv,
  saveJob,
  updateApplicationStatus,
} from "../src/store/applications.js";

// Isolate tests: use a temp data dir for this process.
process.env.JOB_MCP_DATA_DIR = "./data-test-store";

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  closeDb();
});

test("default profile is auto-created and updatable", () => {
  const p = getDefaultProfile();
  assert.equal(p.label, "default");
  const updated = updateProfile(p.id, { full_name: "Ada Lovelace", skills: ["python", "sql"] });
  assert.equal(updated.full_name, "Ada Lovelace");
  assert.deepEqual(updated.skills, ["python", "sql"]);
});

test("job + cv + application round-trip through the store", () => {
  const profile = getDefaultProfile();
  const job = saveJob(profile.id, {
    title: "Backend Engineer",
    company: "Acme",
    url: null,
    description: "Node, Postgres, AWS.",
    keywords: ["node", "postgres", "aws"],
  });
  const cv = saveCv(profile.id, "main", "Some CV text with node and aws.", null);
  const app = saveApplication({
    profile_id: profile.id,
    job_id: job.id,
    cv_id: cv.id,
    match_score: 77,
    answers: { "Why us?": "draft" },
  });
  assert.equal(app.status, "draft");
  assert.equal(app.match_score, 77);
  assert.deepEqual(app.answers, { "Why us?": "draft" });

  const fetched = getApplication(app.id);
  assert.equal(fetched?.answers["Why us?"], "draft");

  const submitted = updateApplicationStatus(app.id, "submitted");
  assert.equal(submitted?.status, "submitted");
  assert.ok(submitted?.submitted_at);

  const list = listApplications(profile.id);
  assert.equal(list.length, 1);
});

test("getJob returns parsed keywords", () => {
  const profile = getDefaultProfile();
  const job = saveJob(profile.id, {
    title: "X",
    company: null,
    url: null,
    description: "d",
    keywords: ["a", "b"],
  });
  const got = getJob(job.id);
  assert.deepEqual(got?.keywords, ["a", "b"]);
});