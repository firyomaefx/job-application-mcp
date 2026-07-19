// Tests for the audit-driven fixes (Implement phase evidence).
// Covers: H1 entitlement integrity, H2 free-user own-key AI, H4 bridge CORS,
// M1 parse_cv path scoping, M2 grantMonthly idempotency.

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { type IncomingMessage } from "node:http";

import { closeDb, resetDb, openDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import {
  applyTopup,
  balance,
  grantMonthly,
  tryDebit,
} from "../src/licence/credits.js";
import {
  storeEntitlement,
  currentEntitlement,
  clearEntitlement,
  buildEntitlement,
  entitlementWithGrace,
} from "../src/licence/index.js";
import { parseCvFile } from "../src/cv/parser.js";
import { allowedOrigin } from "../src/http.js";
import { resolveProvider } from "../src/tools/matching.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-audit-fixes";
mkdirSync("./data-test-audit-fixes", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-audit-fixes", { recursive: true, force: true });
});

// ── H1: entitlement integrity (MAC) ────────────────────────────

test("H1: a MAC-signed entitlement round-trips through currentEntitlement", () => {
  const ent = buildEntitlement("pro", { expiresAt: "2099-01-01" });
  storeEntitlement(ent);
  assert.equal(currentEntitlement().plan, "pro");
});

test("H1: tampering with entitlement.json falls back to FREE", () => {
  const ent = buildEntitlement("business", { expiresAt: "2099-01-01" });
  storeEntitlement(ent);
  assert.equal(currentEntitlement().plan, "business");
  // Overwrite with a hand-crafted unsigned Pro entitlement (the bypass attempt).
  writeFileSync(
    join("./data-test-audit-fixes", "entitlement.json"),
    JSON.stringify({ plan: "business", device_limit: 5, ai_credits_per_month: 250, expires_at: null, features: ["ai_cv_tailoring"] }),
    "utf8",
  );
  assert.equal(currentEntitlement().plan, "free");
});

test("H1: a legacy unsigned entitlement file is rejected (FREE)", () => {
  clearEntitlement(); // writes a valid MAC-signed FREE
  writeFileSync(
    join("./data-test-audit-fixes", "entitlement.json"),
    JSON.stringify({ plan: "pro", device_limit: 2, ai_credits_per_month: 30, expires_at: null, features: [] }),
    "utf8",
  );
  assert.equal(currentEntitlement().plan, "free");
  assert.equal(entitlementWithGrace().plan, "free");
});

// ── H2: free users can use their own AI API key ────────────────

test("H2: with an own API key and no entitlement, resolveProvider uses real AI without debiting", async () => {
  clearEntitlement();
  const prevProvider = process.env.AI_PROVIDER;
  const prevKey = process.env.AI_API_KEY;
  process.env.AI_PROVIDER = "openai";
  process.env.AI_API_KEY = "test-key";
  try {
    const { provider, usedAi, debited } = await resolveProvider("ai_cv_tailoring", "ai_tailor", "1");
    assert.equal(usedAi, true, "own key → real AI path");
    assert.equal(debited, false, "free user with own key is not debited");
    assert.equal(provider.name, "openai");
  } finally {
    process.env.AI_PROVIDER = prevProvider;
    process.env.AI_API_KEY = prevKey;
  }
});

test("H2: without an API key, resolveProvider falls back to heuristic", async () => {
  clearEntitlement();
  const prevKey = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    const { provider, usedAi } = await resolveProvider("ai_cv_tailoring", "ai_tailor", "1");
    assert.equal(usedAi, false);
    assert.equal(provider.name, "mock");
  } finally {
    process.env.AI_API_KEY = prevKey;
  }
});

// ── H4: bridge CORS allow-list ─────────────────────────────────

function reqWithOrigin(origin: string | undefined): IncomingMessage {
  return { headers: origin ? { origin } : {} } as unknown as IncomingMessage;
}

test("H4: allowedOrigin reflects extension + loopback origins", () => {
  assert.equal(allowedOrigin(reqWithOrigin("chrome-extension://abcdefg")), "chrome-extension://abcdefg");
  assert.equal(allowedOrigin(reqWithOrigin("http://127.0.0.1:8787")), "http://127.0.0.1:8787");
  assert.equal(allowedOrigin(reqWithOrigin("http://localhost:3000")), "http://localhost:3000");
});

test("H4: allowedOrigin blocks arbitrary web origins (no ACAO)", () => {
  assert.equal(allowedOrigin(reqWithOrigin("https://evil.com")), null);
  assert.equal(allowedOrigin(reqWithOrigin("http://192.168.0.1:8787")), null);
  assert.equal(allowedOrigin(reqWithOrigin("http://127.0.0.1.evil.com")), null);
});

// ── M1: parse_cv path scoping ──────────────────────────────────

test("M1: parseCvFile rejects paths outside allowed roots", async () => {
  await assert.rejects(
    () => parseCvFile(resolve(process.cwd(), "..", "..", "secret.txt")),
    /outside the allowed CV import roots/,
  );
});

test("M1: parseCvFile accepts a file under the data dir", async () => {
  const dir = resolve("./data-test-audit-fixes", "cvs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "sample.txt");
  writeFileSync(file, "Jane Doe\nSkills: TypeScript, React\n", "utf8");
  const parsed = await parseCvFile(file);
  assert.equal(parsed.format, "txt");
  assert.ok(parsed.text.includes("TypeScript"));
});

// ── M2: grantMonthly idempotency after spend-out ───────────────

test("M2: re-granting after spending to zero does NOT double-grant", () => {
  openDb();
  resetDb();
  const p = getDefaultProfile();
  grantMonthly(p.id, 30);
  assert.equal(balance(), 30);
  // Spend all credits
  assert.equal(tryDebit("ai_tailor", "r1"), true);
  while (balance() > 0) tryDebit("ai_tailor", "r" + balance());
  assert.equal(balance(), 0);
  // Old bug: this would re-grant 30 because balance was 0. Now it must NOT.
  grantMonthly(p.id, 30);
  assert.equal(balance(), 0, "no double-grant in the same period after spend-out");
});

test("M2: topup is still rejected on duplicate code", () => {
  const p = getDefaultProfile();
  applyTopup(p.id, 5, "CODE-1");
  assert.throws(() => applyTopup(p.id, 5, "CODE-1"), /already applied/);
});