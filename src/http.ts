#!/usr/bin/env node
// Local HTTP bridge for Job Application MCP.
//
// Exposes a tiny HTTP API on 127.0.0.1 so non-stdio clients (e.g. the Chrome
// extension) can invoke the same free-core tools. Bind is localhost-only.
// Optional bearer token via JOB_MCP_HTTP_TOKEN.
//
// This is part of the FREE CORE — no network egress, only a local loopback
// listener. It never submits anything; it only runs the same local tools the
// stdio server exposes.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { toolByName, tools } from "./tools/index.js";
import { openDb } from "./store/db.js";
import { createServer as createMcpServer } from "./server.js";
import { safeEqual } from "./lib/crypto.js";

const PORT = Number(process.env.JOB_MCP_HTTP_PORT ?? 8787);
const TOKEN = process.env.JOB_MCP_HTTP_TOKEN; // optional shared secret

interface BridgeResponse {
  ok: boolean;
  tool?: string;
  summary?: string;
  data?: unknown;
  notes?: string[];
  error?: string;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * CORS: this bridge is loopback-only, but we still must not let an arbitrary
 * web origin drive it. Allow only the Chrome extension scheme and localhost
 * loopback origins. The Origin is reflected only if it matches; otherwise no
 * ACAO header is sent, so the browser blocks cross-origin reads.
 */
export function allowedOrigin(req: IncomingMessage): string | null {
  const origin = req.headers["origin"];
  if (!origin) return null; // non-browser clients (curl, extension bg) — no CORS header needed
  if (/^chrome-extension:\/\/[a-z]+$/i.test(origin)) return origin;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return origin;
  return null;
}

function send(res: ServerResponse, status: number, payload: BridgeResponse, req?: IncomingMessage) {
  const json = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
  };
  if (req) {
    const origin = allowedOrigin(req);
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
  }
  res.writeHead(status, headers);
  res.end(json);
}

function authorized(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  const header = req.headers["authorization"] ?? "";
  // Constant-time compare so a shared secret on loopback isn't leaked via timing.
  return safeEqual(header, `Bearer ${TOKEN}`);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    // Only preflight for allowed origins; others get a bare 204 (no ACAO).
    send(res, 204, { ok: true }, req);
    return;
  }

  if (req.url === "/health" && req.method === "GET") {
    send(res, 200, {
      ok: true,
      data: { tools: tools.map((t) => t.name) },
    }, req);
    return;
  }

  if (req.url === "/call" && req.method === "POST") {
    if (!authorized(req)) {
      send(res, 401, { ok: false, error: "unauthorized" }, req);
      return;
    }
    let parsed: { name?: string; arguments?: unknown };
    try {
      parsed = JSON.parse(await readBody(req)) as { name?: string; arguments?: unknown };
    } catch {
      send(res, 400, { ok: false, error: "invalid JSON body" }, req);
      return;
    }
    const tool = toolByName.get(parsed.name ?? "");
    if (!tool) {
      send(res, 404, { ok: false, error: `unknown tool: ${parsed.name}` }, req);
      return;
    }
    const validation = tool.inputSchema.safeParse(parsed.arguments ?? {});
    if (!validation.success) {
      send(res, 400, {
        ok: false,
        tool: parsed.name,
        error: `invalid arguments: ${validation.error.message}`,
      }, req);
      return;
    }
    try {
      const result = await tool.run(validation.data);
      send(res, 200, {
        ok: true,
        tool: parsed.name,
        summary: result.summary,
        data: result.data,
        notes: result.notes,
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { ok: false, tool: parsed.name, error: message }, req);
    }
    return;
  }

  send(res, 404, { ok: false, error: `not found: ${req.method} ${req.url}` }, req);
}

async function main(): Promise<void> {
  // Initialise the DB and (defensively) the MCP server factory so any startup
  // errors surface immediately.
  openDb();
  createMcpServer();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { ok: false, error: message });
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    const addr = server.address();
    const host = addr && typeof addr === "object" ? `http://${addr.address}:${addr.port}` : "?";
    process.stdout.write(
      `job-application-mcp HTTP bridge listening on ${host}\n` +
        `  GET  /health        — list available tools\n` +
        `  POST /call          — invoke a tool: { "name", "arguments" }\n` +
        (TOKEN ? "  auth: Bearer token required (JOB_MCP_HTTP_TOKEN)\n" : "  auth: none (set JOB_MCP_HTTP_TOKEN to require a bearer token)\n")
    );
  });

  const shutdown = (sig: string) => {
    process.stderr.write(`\n${sig} received, shutting down.\n`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Only start the server when run as the entry point, not when imported (e.g. by
// tests importing `allowedOrigin`). Avoids a side-effect listener on import.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("job-application-mcp HTTP bridge failed to start:", err);
    process.exit(1);
  });
}