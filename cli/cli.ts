#!/usr/bin/env node
import { createServer } from "../src/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const HELP = `job-application-mcp — local-first job application assistant (MCP)

Usage:
  job-mcp serve        Start the MCP server over stdio (for MCP clients).
  job-mcp --help       Show this help.

The free core runs entirely locally. Configure MCP clients (Claude Desktop,
Claude Code, etc.) to launch this server, e.g.:

  {
    "mcpServers": {
      "job-application-mcp": {
        "command": "node",
        "args": ["/absolute/path/to/job-application-mcp/dist/src/index.js"]
      }
    }
  }

Data is stored in JOB_MCP_DATA_DIR (default ./data).
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
  process.stderr.write(`Unknown command: ${arg}\n\n${HELP}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});