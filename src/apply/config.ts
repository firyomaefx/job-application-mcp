/** Opt-in auto-apply module (default off). */

export const DEFAULT_MAX_APPLIES_PER_DAY = 10;
export const DEFAULT_MIN_MATCH_SCORE = 0;

export function isAutoApplyEnabled(): boolean {
  return process.env.JOB_MCP_AUTO_APPLY === "1";
}

export function requireAutoApplyEnabled(): void {
  if (!isAutoApplyEnabled()) {
    throw new Error(
      "auto-apply is disabled. Set JOB_MCP_AUTO_APPLY=1 on the MCP server / HTTP bridge to enable.",
    );
  }
}