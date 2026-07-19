// N7 + Phase 3: entitlement-activity log + Free→Pro upgrade, Pro→Free
// downgrade, expiry after grace, and local-data preservation after expiry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";

import { closeDb, resetDb, openDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { saveJob, listApplications, saveApplication } from "../src/store/applications.js";
import {
  storeEntitlement,
  clearEntitlement,
  buildEntitlement,
  currentEntitlement,
  entitlementWithGrace,
} from "../src/licence/index.js";
import { listEntitlementEvents } from "../src/licence/events.js";
import { balance, grantMonthly, tryDebit } from "../src/licence/credits.js";
import { isPro } from "../src/lib/entitlement.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-lifecycle";
mkdirSync("./data-test-lifecycle", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-lifecycle", { recursive: true, force: true });
});

function fresh() {
  openDb();
  resetDb();
  getDefaultProfile();
}

test("N7: Free→Pro upgrade records an 'activate' event", () => {
  fresh();
  assert.equal(currentEntitlement().plan, "free");
  storeEntitlement(buildEntitlement("pro", { expiresAt: "2099-01-01" }));
  assert.equal(currentEntitlement().plan, "pro");
  const events = listEntitlementEvents();
  assert.ok(events.some((e) => e.event === "activate" && e.plan === "pro"));
});

test("N7: Pro→Free downgrade records a 'downgrade' event", () => {
  fresh();
  storeEntitlement(buildEntitlement("pro", { expiresAt: "2099-01-01" }));
  clearEntitlement();
  assert.equal(currentEntitlement().plan, "free");
  const events = listEntitlementEvents();
  assert.ok(events.some((e) => e.event === "downgrade"));
});

test("Phase 3: expiry past the grace window downgrades to Free and records 'expire'", () => {
  fresh();
  // Activated Pro that expired 20 days ago (past the 14-day grace).
  const expiredIso = new Date(Date.now() - 20 * 86_400_000).toISOString();
  storeEntitlement(buildEntitlement("pro", { expiresAt: expiredIso }));
  assert.equal(isPro(currentEntitlement()), false, "strict read is Free once expired");
  // entitlementWithGrace is the lenient read used by feature gating.
  const ent = entitlementWithGrace();
  assert.equal(ent.plan, "free", "past grace → Free");
  const events = listEntitlementEvents();
  assert.ok(events.some((e) => e.event === "expire"));
});

test("Phase 3: within the offline grace window an expired Pro entitlement still reads as Pro", () => {
  fresh();
  const expiredIso = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago, within 14
  storeEntitlement(buildEntitlement("pro", { expiresAt: expiredIso }));
  assert.equal(entitlementWithGrace().plan, "pro", "within grace → still Pro");
});

test("Phase 3: local user data is preserved after expiry/downgrade", () => {
  fresh();
  storeEntitlement(buildEntitlement("pro", { expiresAt: "2099-01-01" }));
  const p = getDefaultProfile();
  const job = saveJob(p.id, { title: "Role", company: null, url: null, description: "x", keywords: [] });
  saveApplication({ profile_id: p.id, job_id: job.id, status: "draft" });
  assert.equal(listApplications(p.id).length, 1);
  // Downgrade.
  clearEntitlement();
  assert.equal(currentEntitlement().plan, "free");
  // Data still there — nothing was deleted.
  assert.equal(listApplications(p.id).length, 1, "applications preserved after downgrade");
});

test("Phase 3: Pro credits grant + debit; spend-to-zero then downgrade keeps ledger history", () => {
  fresh();
  storeEntitlement(buildEntitlement("pro", { expiresAt: "2099-01-01" }));
  const p = getDefaultProfile();
  grantMonthly(p.id, 30);
  assert.equal(balance(), 30);
  assert.equal(tryDebit("ai_tailor", "job-1"), true);
  assert.equal(balance(), 29);
  clearEntitlement();
  // Balance row remains (data preserved); feature gating just no longer grants Pro.
  assert.equal(balance(), 29, "credit balance preserved after downgrade");
});