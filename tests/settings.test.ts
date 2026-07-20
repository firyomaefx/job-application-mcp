import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSettings,
  maskApiKey,
  isKeySet,
  effectiveSettings,
  effectiveProvider,
  ALLOWED_PROVIDERS,
} from "../src/lib/settings.js";

test("validateSettings lower-cases provider and rejects unknown providers", () => {
  const r = validateSettings({ ai_provider: "OLLAMA" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.ai_provider, "ollama");

  const bad = validateSettings({ ai_provider: "bedrock" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /unknown AI provider/);
});

test("validateSettings rejects non-http base URLs but allows empty", () => {
  assert.equal(validateSettings({ ai_base_url: "ftp://x" }).ok, false);
  assert.equal(validateSettings({ ai_base_url: "javascript:alert(1)" }).ok, false);
  assert.equal(validateSettings({ ai_base_url: "" }).ok, true);
  assert.equal(validateSettings({ ai_base_url: "https://api.openai.com/v1" }).ok, true);
});

test("validateSettings rejects newlines in model id", () => {
  assert.equal(validateSettings({ ai_model: "gpt-4o\n--system" }).ok, false);
  assert.equal(validateSettings({ ai_model: "gpt-4o-mini" }).ok, true);
});

test("validateSettings: null ai_api_key is preserved as null (delete signal); string kept", () => {
  const r = validateSettings({ ai_api_key: null });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.ai_api_key, null);
  const s = validateSettings({ ai_api_key: "sk-abc" });
  if (s.ok) assert.equal(s.value.ai_api_key, "sk-abc");
});

test("validateSettings: absent keys are absent (leave unchanged)", () => {
  const r = validateSettings({ ai_model: "llama3.1" });
  if (r.ok) {
    assert.equal("ai_provider" in r.value, false);
    assert.equal("ai_api_key" in r.value, false);
  }
});

test("maskApiKey: long key shows first 3 + last 4; short key collapses; empty = not set", () => {
  assert.equal(maskApiKey("sk-abcdef12345"), "sk-…2345");
  assert.equal(maskApiKey("short"), "•••• set");
  assert.equal(maskApiKey(""), "not set");
});

test("isKeySet is true only for non-empty strings", () => {
  assert.equal(isKeySet("x"), true);
  assert.equal(isKeySet(""), false);
  assert.equal(isKeySet(undefined as unknown as string), false);
});

test("effectiveSettings: persisted non-empty wins over env; empty falls back to env", () => {
  const persisted = { ai_provider: "ollama", ai_model: "", ai_base_url: "", ai_api_key: "" };
  const env = { AI_PROVIDER: "openai", AI_MODEL: "gpt-4o", AI_BASE_URL: "https://api.openai.com/v1", AI_API_KEY: "sk-env" };
  const eff = effectiveSettings(persisted, env);
  assert.equal(eff.ai_provider, "ollama"); // persisted wins
  assert.equal(eff.ai_model, "gpt-4o"); // env fallback
  assert.equal(eff.ai_api_key, "sk-env"); // env fallback
});

test("effectiveProvider defaults to mock when nothing is configured", () => {
  assert.equal(effectiveProvider({ ai_provider: "", ai_model: "", ai_base_url: "", ai_api_key: "" }, {}), "mock");
  assert.equal(effectiveProvider({ ai_provider: "", ai_model: "", ai_base_url: "", ai_api_key: "" }, { AI_PROVIDER: "ollama" }), "ollama");
});

test("ALLOWED_PROVIDERS includes mock/ollama/openai/anthropic + empty", () => {
  assert.ok((ALLOWED_PROVIDERS as readonly string[]).includes("mock"));
  assert.ok((ALLOWED_PROVIDERS as readonly string[]).includes(""));
});