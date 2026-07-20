import { test, afterEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.JOB_MCP_DATA_DIR = "./data-test-system-check";

import { systemCheckTool } from "../src/tools/system_check.js";
import { closeDb, resetDb } from "../src/store/db.js";
import { clearSetting } from "../src/store/settings.js";
import { SETTINGS_KEYS } from "../src/lib/settings.js";

afterEach(() => {
  for (const k of ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[k];
  for (const k of SETTINGS_KEYS) clearSetting(k);
});

test("system_check tool is named system_check and returns a SystemReport", async () => {
  assert.equal(systemCheckTool.name, "system_check");
  for (const k of SETTINGS_KEYS) clearSetting(k);
  resetDb();
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const r = await systemCheckTool.run({});
    assert.ok(r.summary && r.summary.includes("AI:"));
    assert.ok(r.data && typeof r.data === "object");
    const d = r.data as any;
    assert.ok(d.ai && d.bridge && d.data && d.plan);
    assert.equal(d.ai.effective_provider, "mock");
  } finally {
    globalThis.fetch = original;
  }
});

test("system_check summary mentions CV/profile state and next-step notes", async () => {
  for (const k of SETTINGS_KEYS) clearSetting(k);
  resetDb();
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const r = await systemCheckTool.run({});
    assert.match(r.summary, /CVs 0/);
    assert.match(r.summary, /profile empty/);
    assert.ok(r.notes && r.notes.some((n) => n.includes("parse_cv")));
  } finally {
    globalThis.fetch = original;
  }
});

after(() => {
  closeDb();
});