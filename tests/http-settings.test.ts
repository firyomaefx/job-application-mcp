import { test, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

// Per-file data dir + a bearer token. TOKEN is read at http.ts module load, so
// set it BEFORE the dynamic import. isMain guard means importing won't bind.
process.env.JOB_MCP_DATA_DIR = "./data-test-http-settings";
process.env.JOB_MCP_HTTP_TOKEN = "t-secret";
process.env.JOB_MCP_HTTP_PORT = "0";

let handle: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>;
let server: Server;
let port = 0;
const TOKEN = "t-secret";

function clearAiEnv() {
  for (const k of ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[k];
}

before(async () => {
  const mod = await import("../src/http.js");
  handle = mod.handle;
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => handle(req, res).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
    }));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = addr && typeof addr === "object" ? addr.port : 0;
      resolve();
    });
  });
  // Cross-run safety: the data dir persists on disk between `npm test` runs, so
  // clear any AI settings a previous run left behind so the "expects mock"
  // tests start from a clean slate.
  const { clearSetting } = await import("../src/store/settings.js");
  const { SETTINGS_KEYS } = await import("../src/lib/settings.js");
  for (const k of SETTINGS_KEYS) clearSetting(k);
  clearAiEnv();
});

after(() => {
  if (server) server.close();
});

afterEach(() => {
  clearAiEnv();
});

async function req(path: string, method = "GET", body?: unknown, auth = true) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${TOKEN}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

test("GET /detect without bearer when TOKEN set → 401", async () => {
  const r = await req("/detect", "GET", undefined, false);
  assert.equal(r.status, 401);
  assert.equal(r.json.ok, false);
});

test("GET /detect with bearer → 200 + SystemReport shape", async () => {
  // Stub the Ollama probe so it doesn't hang on a real localhost call.
  const original = globalThis.fetch;
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/models")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const r = await req("/detect");
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    const d = r.json.data;
    assert.ok(d.bridge && typeof d.bridge.port === "number");
    assert.equal(d.ai.effective_provider, "mock");
    assert.equal(d.ai.key_present, false);
    assert.equal(d.ai.key_masked, "not set");
    assert.equal(typeof d.data.db_path, "string");
  } finally {
    globalThis.fetch = original;
  }
});

test("GET /settings masks the API key and reports presence", async () => {
  // Seed a key directly via a POST (authorized), then GET.
  await req("/settings", "POST", { ai_api_key: "sk-abcdefghij" });
  const r = await req("/settings");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.ai_api_key, "sk-…ghij"); // masked, never raw
  assert.equal(r.json.data.ai_api_key_present, true);
});

test("POST /settings applies provider to process.env (no restart) + persists", async () => {
  clearAiEnv();
  const r = await req("/settings", "POST", { ai_provider: "ollama" });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.applied.includes("ai_provider"), true);
  assert.equal(process.env.AI_PROVIDER, "ollama"); // applied live
  // Persists across a fresh read:
  const g = await req("/settings");
  assert.equal(g.json.data.ai_provider, "ollama");
});

test("POST /settings with null ai_api_key deletes the row (clear); env fallback returns", async () => {
  clearAiEnv();
  await req("/settings", "POST", { ai_api_key: "sk-fromui12345" });
  let g = await req("/settings");
  assert.equal(g.json.data.ai_api_key_present, true);
  await req("/settings", "POST", { ai_api_key: null });
  g = await req("/settings");
  assert.equal(g.json.data.ai_api_key_present, false);
  assert.equal(g.json.data.ai_api_key, "not set");
});

test("POST /settings with bad provider → 400", async () => {
  const r = await req("/settings", "POST", { ai_provider: "bedrock" });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /unknown AI provider/);
});

test("POST /call system_check returns the same report shape as /detect", async () => {
  const original = globalThis.fetch;
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/models")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const r = await req("/call", "POST", { name: "system_check", arguments: {} });
    assert.equal(r.status, 200);
    assert.equal(r.json.tool, "system_check");
    assert.ok(r.json.data.ai && r.json.data.data && r.json.data.bridge);
  } finally {
    globalThis.fetch = original;
  }
});