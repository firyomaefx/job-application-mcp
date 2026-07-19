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
import { toolByName, tools } from "./tools/index.js";
import { openDb } from "./store/db.js";
import { createServer as createMcpServer } from "./server.js";

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

function send(res: ServerResponse, status: number, payload: BridgeResponse) {
  const json = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(json);
}

function authorized(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  const header = req.headers["authorization"] ?? "";
  return header === `Bearer ${TOKEN}`;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    send(res, 204, { ok: true });
    return;
  }

  if (req.url === "/health" && req.method === "GET") {
    send(res, 200, {
      ok: true,
      data: { tools: tools.map((t) => t.name) },
    });
    return;
  }

  if (req.url === "/call" && req.method === "POST") {
    if (!authorized(req)) {
      send(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
    let parsed: { name?: string; arguments?: unknown };
    try {
      parsed = JSON.parse(await readBody(req)) as { name?: string; arguments?: unknown };
    } catch {
      send(res, 400, { ok: false, error: "invalid JSON body" });
      return;
    }
    const tool = toolByName.get(parsed.name ?? "");
    if (!tool) {
      send(res, 404, { ok: false, error: `unknown tool: ${parsed.name}` });
      return;
    }
    const validation = tool.inputSchema.safeParse(parsed.arguments ?? {});
    if (!validation.success) {
      send(res, 400, {
        ok: false,
        tool: parsed.name,
        error: `invalid arguments: ${validation.error.message}`,
      });
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
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { ok: false, tool: parsed.name, error: message });
    }
    return;
  }

  send(res, 404, { ok: false, error: `not found: ${req.method} ${req.url}` });
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

main().catch((err) => {
  console.error("job-application-mcp HTTP bridge failed to start:", err);
  process.exit(1);
});