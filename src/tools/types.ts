import type { ZodTypeAny, infer as zinfer } from "zod";

/**
 * A tool definition: a zod input schema plus a handler that returns
 * JSON-serializable content. The server maps these onto MCP tool calls.
 */
export interface ToolDef<S extends ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: S;
  run: (input: zinfer<S>) => Promise<ToolResult> | ToolResult;
}

/**
 * Loose, registry-friendly shape. The generic `ToolDef<S>` is invariant in S
 * (inputSchema is covariant, run's input is contravariant), so a concrete
 * ToolDef<ZodObject<...>> is NOT assignable to ToolDef<ZodTypeAny>. This
 * structural type relaxes that for collections.
 */
export interface AnyTool {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  run: (input: any) => Promise<ToolResult> | ToolResult;
}

export type ToolResult = {
  /** Short human-facing summary. */
  summary: string;
  /** Structured payload returned to the MCP client as JSON. */
  data?: unknown;
  /** Optional extra notes / next-step suggestions. */
  notes?: string[];
};

/** Convert a ToolResult into MCP content blocks. */
export function toContent(r: ToolResult) {
  const blocks: { type: "text"; text: string }[] = [
    { type: "text", text: r.summary },
  ];
  if (r.data !== undefined) {
    blocks.push({ type: "text", text: JSON.stringify(r.data, null, 2) });
  }
  if (r.notes && r.notes.length > 0) {
    blocks.push({ type: "text", text: "Notes:\n- " + r.notes.join("\n- ") });
  }
  return blocks;
}