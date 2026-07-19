// N6: local backup / restore — MVP gate "Backup restoration works".

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";

import { closeDb, openDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { saveJob, listApplications, saveApplication } from "../src/store/applications.js";
import { backupDatabase, listBackups, restoreDatabase } from "../src/store/backup.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-backup";
mkdirSync("./data-test-backup", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-backup", { recursive: true, force: true });
});

test("N6: backupDatabase writes a snapshot under backups/ and listBackups sees it", () => {
  openDb();
  const p = getDefaultProfile();
  saveJob(p.id, { title: "Role A", company: null, url: null, description: "x", keywords: [] });
  const path = backupDatabase(new Date("2026-07-20T01:00:00Z"));
  assert.ok(existsSync(path));
  const list = listBackups();
  assert.ok(list.length >= 1);
  assert.ok(list.some((b) => b.path === path));
});

test("N6: restoreDatabase rolls the DB back to the snapshot state and takes a safety backup", () => {
  openDb();
  const p = getDefaultProfile();
  // Reset to a clean state, add one job + one application, snapshot it.
  const db = openDb();
  db.exec("DELETE FROM applications; DELETE FROM jobs;");
  const job = saveJob(p.id, { title: "Snapshotted", company: null, url: null, description: "x", keywords: [] });
  saveApplication({ profile_id: p.id, job_id: job.id, status: "draft" });
  assert.equal(listApplications(p.id).length, 1);
  const snap = backupDatabase(new Date("2026-07-20T02:00:00Z"));

  // Mutate after the snapshot: add a second application.
  saveApplication({ profile_id: p.id, job_id: job.id, status: "draft" });
  assert.equal(listApplications(p.id).length, 2);

  // Restore → should return to 1 application.
  const result = restoreDatabase(snap);
  assert.ok(existsSync(result.safety_backup), "safety backup created before overwrite");
  assert.equal(listApplications(p.id).length, 1, "restored to snapshot state");
});