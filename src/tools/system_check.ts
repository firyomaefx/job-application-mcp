import { z } from "zod";
import type { ToolDef } from "./types.js";

const systemCheckSchema = z.object({});

/**
 * One-click setup helper (v0.4.0). Returns the same `SystemReport` the bridge
 * `GET /detect` endpoint returns — bridge + AI provider reachability, profile
 * /CV presence, plan — so an MCP client (Claude Desktop, Claude Code, Cursor)
 * can verify the local environment is configured and tell the user what to fix.
 * No CV/PII in the report; the API key is masked.
 */
export const systemCheckTool: ToolDef<typeof systemCheckSchema> = {
  name: "system_check",
  description:
    "One-click setup helper: returns a system report — bridge status, effective AI " +
    "provider, Ollama reachability, whether an AI key is set (masked), profile/CV " +
    "presence, and plan. Use to verify the local environment is configured before " +
    "tailoring CVs or drafting cover letters. No secrets are returned.",
  inputSchema: systemCheckSchema,
  run: async () => {
    const { buildSystemReport } = await import("../lib/detect.js");
    const report = await buildSystemReport({ bridgeStatus: "n/a (stdio)", port: 0 });
    const ai = report.ai;
    return {
      summary:
        `AI: ${ai.effective_provider}` +
        ` · Ollama ${ai.ollama_reachable ? "up" : "down"}` +
        ` · key ${ai.key_present ? "set" : "none"}` +
        ` · CVs ${report.data.cv_count}` +
        ` · profile ${report.data.profile_present ? "set" : "empty"}`,
      data: report,
      notes: [
        ai.effective_provider === "mock"
          ? "AI is on the offline heuristic (mock). Set AI_PROVIDER=ollama or an API key for real AI."
          : "AI provider is configured.",
        report.data.profile_present
          ? undefined
          : "No profile yet — call update_profile to set your name/skills.",
        report.data.cv_count === 0
          ? "No CVs yet — call parse_cv with a local PDF/DOCX/TXT path."
          : undefined,
      ].filter((n): n is string => typeof n === "string"),
    };
  },
};