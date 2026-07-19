#!/usr/bin/env node
import { createServer } from "../src/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const HELP = `job-application-mcp — local-first job application assistant (MCP)

Usage:
  job-mcp serve        Start the MCP server over stdio (for MCP clients).
  job-mcp serve:http   Start the local HTTP bridge (127.0.0.1:8787 by default).
                       Used by the Chrome extension and other non-stdio clients.
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
`;

async function main(): Promise<void> {
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
  process.stderr.write(`Unknown command: ${arg}\n\n${HELP}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});