import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getProvider } from "../src/ai/provider.js";
import { OllamaProvider } from "../src/ai/ollama.js";
import { costFor } from "../src/ai/usage.js";

// These env vars drive provider selection at call time; clean up so this file
// never leaks AI_PROVIDER=ollama into other tests (node --test runs files in
// alphabetical order, ai-provider before ai/workflow).
afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;
});

const ctx = {
  jobTitle: "Backend Engineer",
  jobDescription: "Build data pipelines with Python and AWS.",
  jobKeywords: ["python", "aws", "sql"],
  cvText: "Engineer with python, sql, and docker experience.",
  candidateSkills: ["python", "sql", "docker"],
  question: "Tell us about a time you scaled a pipeline.",
};

/** Stub global fetch to capture the request and return an OpenAI-shaped response. */
function stubFetch(capture: { url: string; body: any; auth: string | null }) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capture.url = url;
    capture.body = JSON.parse(init?.body as string);
    capture.auth = (init?.headers as Record<string, string>)?.Authorization ?? null;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "LOCAL MODEL DRAFT" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
  return () => (globalThis.fetch = original);
}

test("getProvider returns ollama (keyless) when AI_PROVIDER=ollama and useReal true", async () => {
  process.env.AI_PROVIDER = "ollama";
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;
  const p = await getProvider({ useReal: true });
  assert.equal(p.name, "ollama");
  assert.ok(p instanceof OllamaProvider);
});

test("ollama provider posts to the Ollama /v1/chat/completions endpoint with the configured model", async () => {
  process.env.AI_PROVIDER = "ollama";
  process.env.AI_MODEL = "llama3.1";
  process.env.AI_BASE_URL = "http://localhost:11434/v1";
  delete process.env.AI_API_KEY;
  const cap: { url: string; body: any; auth: string | null } = { url: "", body: null, auth: null };
  const restore = stubFetch(cap);
  try {
    const p = await getProvider({ useReal: true });
    const r = await p.tailorCv(ctx);
    assert.equal(cap.url, "http://localhost:11434/v1/chat/completions");
    assert.equal(cap.body.model, "llama3.1");
    assert.equal(r.provider, "ollama");
    assert.equal(r.text, "LOCAL MODEL DRAFT");
    assert.equal(r.usage?.input_tokens, 10);
    assert.equal(r.usage?.output_tokens, 5);
  } finally {
    restore();
  }
});

test("ollama calls cost 0 USD (local model)", async () => {
  assert.equal(costFor("ollama", { input_tokens: 1000, output_tokens: 1000 }), 0);
  process.env.AI_PROVIDER = "ollama";
  delete process.env.AI_API_KEY;
  const cap: { url: string; body: any; auth: string | null } = { url: "", body: null, auth: null };
  const restore = stubFetch(cap);
  try {
    const p = await getProvider({ useReal: true });
    const r = await p.coverLetter(ctx);
    assert.equal(r.cost_usd, 0);
  } finally {
    restore();
  }
});

test("ollama still works through the shared untrusted-prompt framing (system message present)", async () => {
  process.env.AI_PROVIDER = "ollama";
  delete process.env.AI_API_KEY;
  const cap: { url: string; body: any; auth: string | null } = { url: "", body: null, auth: null };
  const restore = stubFetch(cap);
  try {
    const p = await getProvider({ useReal: true });
    await p.draftAnswer(ctx);
    const system = cap.body.messages[0];
    assert.equal(system.role, "system");
    assert.ok(typeof system.content === "string" && system.content.length > 0);
    // The user turn must wrap the untrusted job content (N1 hardening).
    const user = cap.body.messages[1];
    assert.ok(user.content.includes("<untrusted>"), "expected <untrusted> framing in user prompt");
  } finally {
    restore();
  }
});

test("ollama is selected even with useReal but openai path still requires a key", async () => {
  process.env.AI_PROVIDER = "openai";
  delete process.env.AI_API_KEY;
  const p = await getProvider({ useReal: true });
  assert.equal(p.name, "mock"); // no key → falls back to mock, NOT a misconfigured real call
});