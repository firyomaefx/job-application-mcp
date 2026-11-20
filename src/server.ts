import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "./tools/index.js";
import { simpleTools } from "./tools/simple.js";
import { toContent, type AnyTool } from "./tools/types.js";
import { openDb } from "./store/db.js";

const SERVER_INFO = {
  name: "job-application-mcp",
  version: "0.4.2",
} as const;

/**
 * Tools a client is allowed to see and call.
 * Default is the two paste actions. Set JOB_MCP_ALL_TOOLS=1 for the full list.
 */
export function listedTools(): AnyTool[] {
  return process.env.JOB_MCP_ALL_TOOLS === "1" ? tools : simpleTools;
}

/** Build the MCP server. The default list is save_my_cv and check_this_job. */
export function createServer(): Server {
  // Ensure the local DB exists before serving.
  openDb();

  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listedTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: jsonSchemaFor(t),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = listedTools().find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments for ${name}: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.run(parsed.data);
      return { content: toContent(result) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Tool ${name} failed: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/** Convert a zod schema to a JSON schema for the MCP protocol. */
function jsonSchemaFor(tool: AnyTool): Record<string, unknown> {
  return zodToJsonSchema(tool.inputSchema, { target: "openApi3" }) as Record<string, unknown>;
}
