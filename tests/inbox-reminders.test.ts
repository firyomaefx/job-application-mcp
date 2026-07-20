import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JOB_MCP_DATA_DIR = "./data-test-inbox";

import { resetDb, closeDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { saveJob, listInboxJobs, triageJob, saveApplication, listApplications } from "../src/store/applications.js";
import { addReminder, listReminders, dueReminders, completeReminder, deleteReminder } from "../src/store/reminders.js";
import { rankJobs, bestMatchScore, rankScore } from "../src/lib/inbox.js";

beforeEach(() => {
  closeDb();
  resetDb();
});

test("rankScore: match score + recency bonus; recency decays over 30 days", () => {
  const now = Date.parse("2026-07-20T00:00:00Z");
  const fresh = rankScore({ job: { id: 1, title: "a", company: null, inbox_status: "new" as const, created_at: "2026-07-19T00:00:00Z" }, match_score: 70 }, now);
  const old = rankScore({ job: { id: 2, title: "b", company: null, inbox_status: "new" as const, created_at: "2026-06-01T00:00:00Z" }, match_score: 70 }, now);
  assert.ok(fresh > old, "fresher job should outrank older one at equal score");
  assert.ok(fresh <= 90.1 && fresh >= 70);
});

test("rankJobs sorts high→low and excludes archived by default", () => {
  const now = Date.parse("2026-07-20T00:00:00Z");
  const jobs = [
    { job: { id: 1, title: "low", company: null, inbox_status: "new" as const, created_at: "2026-07-19T00:00:00Z" }, match_score: 40 },
    { job: { id: 2, title: "high", company: null, inbox_status: "new" as const, created_at: "2026-07-19T00:00:00Z" }, match_score: 90 },
    { job: { id: 3, title: "archived", company: null, inbox_status: "archived" as const, created_at: "2026-07-19T00:00:00Z" }, match_score: 99 },
  ];
  const ranked = rankJobs(jobs, now);
  assert.equal(ranked.length, 2, "archived excluded by default");
  assert.equal(ranked[0].job.title, "high");
  assert.equal(ranked[1].job.title, "low");
  const withArchived = rankJobs(jobs, now, { includeArchived: true });
  assert.equal(withArchived.length, 3);
});

test("bestMatchScore picks the highest application score for a job", () => {
  const apps = [{ job_id: 5, match_score: 60 }, { job_id: 5, match_score: 85 }, { job_id: 5, match_score: null }];
  assert.equal(bestMatchScore(5, apps as any), 85);
  assert.equal(bestMatchScore(99, apps as any), null);
});

test("inbox store: saveJob defaults to 'new'; triageJob changes status", () => {
  const p = getDefaultProfile();
  const j = saveJob(p.id, { title: "Eng", company: "Co", url: null, description: "x".repeat(20), keywords: [] });
  assert.equal(j.inbox_status, "new");
  const triaged = triageJob(p.id, j.id, "triaged");
  assert.equal(triaged?.inbox_status, "triaged");
  const archived = triageJob(p.id, j.id, "archived");
  assert.equal(archived?.inbox_status, "archived");
  const visible = listInboxJobs(p.id);
  assert.equal(visible.length, 1);
  const nonArchived = listInboxJobs(p.id).filter((x) => x.inbox_status !== "archived");
  assert.equal(nonArchived.length, 0);
});

test("reminders: add, list, due, complete, delete", () => {
  const p = getDefaultProfile();
  const past = "2026-07-19T09:00:00Z";
  const future = "2026-08-01T09:00:00Z";
  addReminder({ profile_id: p.id, kind: "follow_up", title: "Follow up Acme", due_at: past });
  addReminder({ profile_id: p.id, kind: "interview", title: "Prep interview", due_at: future });
  // list open
  const open = listReminders(p.id);
  assert.equal(open.length, 2);
  // due only the past one
  const due = dueReminders(p.id, "2026-07-20T00:00:00Z");
  assert.equal(due.length, 1);
  assert.equal(due[0].title, "Follow up Acme");
  // complete one
  const done = completeReminder(open[0].id)!;
  assert.equal(done.done, 1);
  assert.equal(listReminders(p.id).length, 1, "completed reminder excluded from open list");
  assert.equal(listReminders(p.id, { includeDone: true }).length, 2);
  // delete
  assert.equal(deleteReminder(open[1].id), true);
  assert.equal(listReminders(p.id, { includeDone: true }).length, 1);
});

test("application match_score feeds bestMatchScore via listApplications", () => {
  const p = getDefaultProfile();
  const j = saveJob(p.id, { title: "Eng", company: null, url: null, description: "x".repeat(20), keywords: ["python"] });
  saveApplication({ profile_id: p.id, job_id: j.id, cv_id: null, match_score: 77, status: "draft" });
  const apps = listApplications(p.id).map((a) => ({ job_id: a.job_id, match_score: a.match_score }));
  assert.equal(bestMatchScore(j.id, apps), 77);
});