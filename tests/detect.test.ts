import { test, afterEach, after } from "node:test";
import assert from "node:assert/strict";

// Per-file data dir for the DB that buildSystemReport reads (profile/cv counts).
process.env.JOB_MCP_DATA_DIR = "./data-test-detect";

import { probeOllama } from "../src/lib/detect-probe.js";
import { buildSystemReport } from "../src/lib/detect.js";
import { closeDb, resetDb } from "../src/store/db.js";
import { clearSetting } from "../src/store/settings.js";
import { SETTINGS_KEYS } from "../src/lib/settings.js";

const ENV_NAMES = ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"];

function clearEnv() {
  for (const k of ENV_NAMES) delete process.env[k];
}
function clearSettings() {
  for (const k of SETTINGS_KEYS) clearSetting(k);
}

afterEach(() => {
  clearEnv();
  clearSettings();
});

/** Stub global fetch for the Ollama probe. Returns a function to restore. */
function stubFetch(impl: (url: string) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const r = await impl(url);
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return () => (globalThis.fetch = original);
}

test("probeOllama: 200 with OpenAI-shaped models list → reachable + models", async () => {
  const restore = stubFetch(() => ({ status: 200, body: { data: [{ id: "llama3.1" }, { id: "qwen2.5" }] } }));
  try {
    const r = await probeOllama("http://localhost:11434/v1", 1000);
    assert.equal(r.reachable, true);
    assert.deepEqual(r.models, ["llama3.1", "qwen2.5"]);
  } finally {
    restore();
  }
});

test("probeOllama: non-2xx → not reachable", async () => {
  const restore = stubFetch(() => ({ status: 500 }));
  try {
    const r = await probeOllama("http://localhost:11434/v1", 1000);
    assert.equal(r.reachable, false);
  } finally {
    restore();
  }
});

test("probeOllama: network error / timeout → not reachable (never throws)", async () => {
  const restore = stubFetch(() => { throw new Error("ECONNREFUSED"); });
  try {
    const r = await probeOllama("http://localhost:11434/v1", 1000);
    assert.equal(r.reachable, false);
  } finally {
    restore();
  }
});

test("buildSystemReport: empty store + no env → mock provider, no profile, key not set", async () => {
  clearEnv();
  clearSettings();
  resetDb();
  const restore = stubFetch(() => ({ status: 200, body: { data: [] } }));
  try {
    const r = await buildSystemReport({ bridgeStatus: "running", port: 8787, applyEnv: false });
    assert.equal(r.bridge.status, "running");
    assert.equal(r.bridge.port, 8787);
    assert.equal(r.ai.effective_provider, "mock");
    assert.equal(r.ai.key_present, false);
    assert.equal(r.ai.key_masked, "not set");
    assert.equal(r.data.profile_present, false);
    assert.equal(r.data.cv_count, 0);
    assert.ok(typeof r.data.db_path === "string" && r.data.db_path.length > 0);
    assert.equal(r.plan.plan_label, "Free");
  } finally {
    restore();
  }
});

test("buildSystemReport: AI_PROVIDER=ollama env + reachable probe → ollama_reachable true", async () => {
  clearSettings();
  resetDb();
  process.env.AI_PROVIDER = "ollama";
  delete process.env.AI_API_KEY;
  const restore = stubFetch(() => ({ status: 200, body: { data: [{ id: "llama3.1" }] } }));
  try {
    const r = await buildSystemReport({ bridgeStatus: "running", port: 8787, applyEnv: false });
    assert.equal(r.ai.effective_provider, "ollama");
    assert.equal(r.ai.ollama_reachable, true);
    assert.deepEqual(r.ai.ollama_models, ["llama3.1"]);
  } finally {
    restore();
  }
});

test("buildSystemReport: masked key reflects an env-injected key (not persisted)", async () => {
  clearSettings();
  resetDb();
  process.env.AI_PROVIDER = "openai";
  process.env.AI_API_KEY = "sk-abcdefghij";
  const restore = stubFetch(() => ({ status: 500 })); // openai → no ollama probe
  try {
    const r = await buildSystemReport({ bridgeStatus: "running", port: 8787, applyEnv: false });
    assert.equal(r.ai.effective_provider, "openai");
    assert.equal(r.ai.key_present, true);
    assert.equal(r.ai.key_masked, "sk-…ghij");
  } finally {
    restore();
  }
});

after(() => {
  closeDb();
});