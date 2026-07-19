import { test } from "node:test";
import assert from "node:assert/strict";
import { closeDb, resetDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import {
  applyTopup,
  balance,
  grantMonthly,
  history,
  tryDebit,
} from "../src/licence/credits.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-credits";

test.beforeEach(() => resetDb());
test.after(() => closeDb());

test("grantMonthly adds credits and is idempotent within a period", () => {
  const p = getDefaultProfile();
  grantMonthly(p.id, 30);
  assert.equal(balance(), 30);
  grantMonthly(p.id, 30); // same period, balance > 0 → no double grant
  assert.equal(balance(), 30);
});

test("tryDebit decrements and returns false at zero", () => {
  const p = getDefaultProfile();
  grantMonthly(p.id, 2);
  assert.equal(tryDebit("ai_tailor", "job-1"), true);
  assert.equal(tryDebit("ai_answer", "job-1"), true);
  assert.equal(tryDebit("ai_cover", "job-1"), false); // empty
  assert.equal(balance(), 0);
});

test("applyTopup adds credits and rejects duplicate codes", () => {
  const p = getDefaultProfile();
  applyTopup(p.id, 20, "CODE-ABC");
  assert.equal(balance(), 20);
  assert.throws(() => applyTopup(p.id, 20, "CODE-ABC"));
  applyTopup(p.id, 10, "CODE-XYZ"); // different code ok
  assert.equal(balance(), 30);
});

test("history records grants, debits, and topups", () => {
  const p = getDefaultProfile();
  grantMonthly(p.id, 5);
  tryDebit("ai_tailor", "job-1");
  applyTopup(p.id, 3, "C1");
  const h = history(p.id, 20) as { delta: number; reason: string }[];
  const reasons = h.map((x) => x.reason);
  assert.ok(reasons.includes("grant"));
  assert.ok(reasons.includes("ai_tailor"));
  assert.ok(reasons.includes("topup"));
  const sum = h.reduce((acc, x) => acc + x.delta, 0);
  assert.equal(sum, 5 - 1 + 3);
});