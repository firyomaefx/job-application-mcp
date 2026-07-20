import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";

// Per-file data dir: node --test runs files in parallel processes that share
// the default ./data DB. Isolate to avoid "database is locked".
process.env.JOB_MCP_DATA_DIR = "./data-test-settings-store";

import {
  getSetting,
  setSetting,
  clearSetting,
  readAllSettings,
  writeSettings,
  applyPersistedSettingsToEnv,
} from "../src/store/settings.js";
import { resetDb, closeDb } from "../src/store/db.js";
import { SETTINGS_KEYS } from "../src/lib/settings.js";

const ENV_NAMES = { ai_provider: "AI_PROVIDER", ai_model: "AI_MODEL", ai_base_url: "AI_BASE_URL", ai_api_key: "AI_API_KEY" } as const;

function clearAllSettings() {
  for (const k of SETTINGS_KEYS) clearSetting(k);
}

beforeEach(() => {
  resetDb();
  clearAllSettings();
  for (const envName of Object.values(ENV_NAMES)) delete process.env[envName];
});

afterEach(() => {
  for (const envName of Object.values(ENV_NAMES)) delete process.env[envName];
});

test("setSetting/getSetting round-trip", () => {
  setSetting("ai_provider", "ollama");
  assert.equal(getSetting("ai_provider"), "ollama");
  assert.equal(getSetting("ai_model"), ""); // unset → ""
});

test("writeSettings partial patch stores only provided keys + returns full settings", () => {
  const after = writeSettings({ ai_provider: "ollama", ai_model: "llama3.1" });
  assert.equal(after.ai_provider, "ollama");
  assert.equal(after.ai_model, "llama3.1");
  assert.equal(after.ai_base_url, "");
  assert.equal(getSetting("ai_base_url"), "");
});

test("writeSettings: ai_api_key null deletes the row; string stores verbatim (incl empty)", () => {
  writeSettings({ ai_api_key: "sk-test12345" });
  assert.equal(getSetting("ai_api_key"), "sk-test12345");
  writeSettings({ ai_api_key: null });
  assert.equal(getSetting("ai_api_key"), ""); // row deleted
  writeSettings({ ai_api_key: "" });
  assert.equal(getSetting("ai_api_key"), ""); // stored empty (not a row, but reads as "")
});

test("readAllSettings fills missing keys with empty strings", () => {
  setSetting("ai_provider", "mock");
  const s = readAllSettings();
  assert.equal(s.ai_provider, "mock");
  assert.equal(s.ai_model, "");
  assert.equal(s.ai_base_url, "");
  assert.equal(s.ai_api_key, "");
});

test("applyPersistedSettingsToEnv overrides env when persisted non-empty", () => {
  process.env.AI_PROVIDER = "openai";
  process.env.AI_MODEL = "gpt-4o";
  writeSettings({ ai_provider: "ollama", ai_model: "llama3.1" });
  const { applied } = applyPersistedSettingsToEnv();
  assert.ok(applied.includes("ai_provider"));
  assert.ok(applied.includes("ai_model"));
  assert.equal(process.env.AI_PROVIDER, "ollama");
  assert.equal(process.env.AI_MODEL, "llama3.1");
});

test("applyPersistedSettingsToEnv leaves env untouched when persisted empty (fallback)", () => {
  process.env.AI_PROVIDER = "openai";
  process.env.AI_API_KEY = "sk-env";
  // Nothing persisted (cleared in beforeEach).
  const { applied } = applyPersistedSettingsToEnv();
  assert.equal(applied.length, 0);
  assert.equal(process.env.AI_PROVIDER, "openai"); // env preserved
  assert.equal(process.env.AI_API_KEY, "sk-env");
});

test("applyPersistedSettingsToEnv never unsets env", () => {
  process.env.AI_PROVIDER = "openai";
  writeSettings({ ai_model: "llama3.1" }); // only model persisted
  applyPersistedSettingsToEnv();
  assert.equal(process.env.AI_PROVIDER, "openai"); // not cleared
  assert.equal(process.env.AI_MODEL, "llama3.1");
});

test("applyPersistedSettingsToEnv applies the API key into env (so getProvider picks it up)", () => {
  delete process.env.AI_API_KEY;
  writeSettings({ ai_api_key: "sk-from-ui" });
  applyPersistedSettingsToEnv();
  assert.equal(process.env.AI_API_KEY, "sk-from-ui");
});

after(() => {
  closeDb();
});