import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { closeDb, openDb, resetDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { enqueueApply, listApplyQueue, cancelQueueItem } from "../src/store/apply-queue.js";
import { classifyApplyUrl } from "../src/apply/platform.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-apply-queue";
mkdirSync("./data-test-apply-queue", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-apply-queue", { recursive: true, force: true });
});

test("enqueue and cancel apply queue item", () => {
  openDb();
  resetDb();
  const p = getDefaultProfile();
  const url = "https://jobs.lever.co/example/apply";
  assert.equal(classifyApplyUrl(url).allowed, true);
  const item = enqueueApply(p.id, url, null);
  assert.equal(item.status, "pending");
  const listed = listApplyQueue(p.id);
  assert.equal(listed.length, 1);
  const cancelled = cancelQueueItem(item.id);
  assert.equal(cancelled?.status, "cancelled");
});