import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { toolByName, tools } from "./tools/index.js";
import { toContent } from "./tools/types.js";
import { openDb } from "./store/db.js";

const SERVER_INFO = {
  name: "job-application-mcp",
  version: "0.1.2",
} as const;

/** Build the MCP server with all free-core tools registered. */
export function createServer(): Server {
  // Ensure the local DB exists before serving.
  openDb();

  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: jsonSchemaFor(t),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolByName.get(name);
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
function jsonSchemaFor(tool: (typeof tools)[number]): Record<string, unknown> {
  return zodToJsonSchema(tool.inputSchema, { target: "openApi3" }) as Record<string, unknown>;
}