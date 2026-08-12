#!/usr/bin/env node
import { createServer } from "../src/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const HELP = `job-application-mcp — local-first job application assistant (MCP)

Usage:
  job-mcp serve        Start the MCP server over stdio (for MCP clients).
  job-mcp serve:http   Start the local HTTP bridge (127.0.0.1:8787 by default).
                       Used by the Chrome extension and other non-stdio clients.
  job-mcp licence show                       Show current plan + credit balance.
  job-mcp licence clear                      Return to the free plan.
  job-mcp licence apply-token <token>        Store a signed entitlement token (dev/test).
  job-mcp licence activate <key> <email>     Activate against JOB_MCP_LICENCE_SERVER.
  job-mcp --help       Show this help.

Stdio MCP config (Claude Desktop / Claude Code):

  {
    "mcpServers": {
      "job-application-mcp": {
        "command": "node",
        "args": ["/absolute/path/to/job-application-mcp/dist/src/index.js"]
      }
    }
  }

Environment:
  JOB_MCP_DATA_DIR      Local data directory (default ./data)
  JOB_MCP_HTTP_PORT     HTTP bridge port (default 8787)
  JOB_MCP_HTTP_TOKEN    Optional bearer token for the HTTP bridge
  AI_PROVIDER           mock | openai | anthropic | ollama (default mock)
  AI_API_KEY            Your own key for openai/anthropic (ollama needs none)
  AI_MODEL              Model id (ollama default: llama3.1)
  AI_BASE_URL           Override endpoint (ollama default: http://localhost:11434/v1)
`;

/** `--ai <provider>` convenience flag for serve/serve:http. */
function applyAiFlag(): void {
  const aiIdx = process.argv.indexOf("--ai");
  if (aiIdx !== -1 && process.argv[aiIdx + 1]) {
    process.env.AI_PROVIDER = process.argv[aiIdx + 1];
  }
}

async function main(): Promise<void> {
  applyAiFlag();
  const arg = process.argv[2];
  if (!arg || arg === "--help" || arg === "-h" || arg === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (arg === "serve") {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }
  if (arg === "serve:http") {
    // Dynamically import the HTTP entrypoint; its top-level main() starts the
    // loopback server in this same process.
    await import("../src/http.js");
    return;
  }
  if (arg === "licence") {
    await runLicence(process.argv.slice(3));
    return;
  }
  process.stderr.write(`Unknown command: ${arg}\n\n${HELP}`);
  process.exit(1);
}

async function runLicence(args: string[]): Promise<void> {
  const sub = args[0];
  if (sub === "show") {
    const { statusSnapshot } = await import("../src/features.js");
    const snap = statusSnapshot();
    process.stdout.write(JSON.stringify(snap, null, 2) + "\n");
    return;
  }
  if (sub === "clear") {
    const { clearEntitlement } = await import("../src/licence/index.js");
    clearEntitlement();
    process.stdout.write("Entitlement cleared (back to free).\n");
    return;
  }
  if (sub === "apply-token") {
    // Dev/test path: verify and store a signed token directly (no network).
    const token = args[1];
    const secret = process.env.JOB_MCP_LICENCE_SECRET ?? "";
    if (!token || !secret) {
      process.stderr.write("usage: job-mcp licence apply-token <token> (set JOB_MCP_LICENCE_SECRET)\n");
      process.exit(1);
    }
    const { validateToken, storeEntitlement, deviceId } = await import("../src/licence/index.js");
    const ent = validateToken(token, secret);
    storeEntitlement({ ...ent, device_id: deviceId(), activated_at: new Date().toISOString() });
    process.stdout.write(`Activated: ${ent.plan} (features: ${ent.features.join(", ") || "none"})\n`);
    return;
  }
  if (sub === "activate") {
    const licenceServer = process.env.JOB_MCP_LICENCE_SERVER;
    const secret = process.env.JOB_MCP_LICENCE_SECRET;
    const key = args[1];
    const email = args[2];
    if (!licenceServer || !secret || !key || !email) {
      process.stderr.write(
        "usage: job-mcp licence activate <key> <email> (set JOB_MCP_LICENCE_SERVER + JOB_MCP_LICENCE_SECRET)\n"
      );
      process.exit(1);
    }
    const { activate } = await import("../src/licence/index.js");
    const ent = await activate({ licenceServer, licenceKey: key, email, signingSecret: secret });
    process.stdout.write(`Activated: ${ent.plan}\n`);
    return;
  }
  process.stderr.write(`licence subcommands: show | clear | apply-token <token> | activate <key> <email>\n`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});