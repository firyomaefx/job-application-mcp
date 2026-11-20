#!/usr/bin/env node
/**
 * Laptop sync agent — polls the Cloudflare edge Worker, ingests resumes locally,
 * runs parse_cv / start_campaign on the loopback HTTP bridge.
 *
 * Env:
 *   JOB_MCP_EDGE_URL     — e.g. https://job-application-mcp-edge.<account>.workers.dev
 *   JOB_MCP_EDGE_TOKEN   — same as Worker secret EDGE_API_TOKEN
 *   JOB_MCP_BRIDGE_URL   — default http://127.0.0.1:8787
 *   JOB_MCP_HTTP_TOKEN   — optional bridge bearer
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EDGE_URL = (process.env.JOB_MCP_EDGE_URL || "").replace(/\/$/, "");
const EDGE_TOKEN = process.env.JOB_MCP_EDGE_TOKEN || "";
const BRIDGE_URL = (process.env.JOB_MCP_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const BRIDGE_TOKEN = process.env.JOB_MCP_HTTP_TOKEN || "";
const DATA_DIR = process.env.JOB_MCP_DATA_DIR || "./data";

function bridgeHeaders() {
  return {
    "Content-Type": "application/json",
    ...(BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {}),
  };
}

async function bridgeCall(name, args = {}) {
  const res = await fetch(`${BRIDGE_URL}/call`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ name, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `bridge ${name} failed`);
  return data;
}

async function edgeFetch(path, init = {}) {
  if (!EDGE_URL || !EDGE_TOKEN) {
    throw new Error("Set JOB_MCP_EDGE_URL and JOB_MCP_EDGE_TOKEN");
  }
  const res = await fetch(`${EDGE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${EDGE_TOKEN}`,
      ...(init.headers || {}),
    },
  });
  return res;
}

async function main() {
  const health = await fetch(`${BRIDGE_URL}/health`).catch(() => null);
  if (!health?.ok) {
    console.error("Local bridge not reachable — start npm run serve:http or the desktop app.");
    process.exit(1);
  }

  const pendingRes = await edgeFetch("/api/sync/pending");
  const pendingJson = await pendingRes.json();
  if (!pendingRes.ok || !pendingJson.ok) {
    console.error("Edge pending failed:", pendingJson.error || pendingRes.status);
    process.exit(1);
  }

  const { uploads = [], applies = [] } = pendingJson.data || {};
  const ackUploads = [];
  const ackApplies = [];

  const incoming = join(DATA_DIR, "incoming");
  mkdirSync(incoming, { recursive: true });

  for (const up of uploads) {
    const dl = await edgeFetch(`/api/sync/download/${up.id}`);
    if (!dl.ok) {
      console.error(`Download failed for ${up.id}`);
      continue;
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const dest = join(incoming, `${Date.now()}-${up.filename.replace(/[^\w.\-()+@]/g, "_")}`);
    writeFileSync(dest, buf);
    await bridgeCall("parse_cv", { file_path: dest, label: "edge-upload" });
    console.log(`Parsed upload ${up.id} → ${dest}`);
    ackUploads.push(up.id);
  }

  for (const app of applies) {
    await bridgeCall("start_campaign", { urls: [app.url] });
    console.log(`Queued apply ${app.id} → ${app.url}`);
    ackApplies.push(app.id);
  }

  if (ackUploads.length || ackApplies.length) {
    const ack = await edgeFetch("/api/sync/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_ids: ackUploads, apply_ids: ackApplies }),
    });
    const ackJson = await ack.json();
    if (!ack.ok || !ackJson.ok) {
      console.error("Ack failed:", ackJson.error || ack.status);
      process.exit(1);
    }
  }

  console.log(`Sync done (${ackUploads.length} uploads, ${ackApplies.length} applies).`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});