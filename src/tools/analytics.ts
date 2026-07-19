import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { listApplications } from "../store/applications.js";
import { featureEnabled } from "../features.js";

const analyticsSchema = z.object({});

/**
 * Application analytics. Free core: a basic funnel + counts. Pro
 * (advanced_analytics feature): adds averages and outcome rate.
 */
export const analyticsTool: ToolDef<typeof analyticsSchema> = {
  name: "application_analytics",
  description:
    "Local analytics over your application pipeline: counts by status, funnel, " +
    "and (Pro) averages and outcome rate. No data leaves your machine.",
  inputSchema: analyticsSchema,
  run: () => {
    const profile = getDefaultProfile();
    const apps = listApplications(profile.id);

    const byStatus: Record<string, number> = {};
    let total = 0;
    let matchSum = 0;
    let matchCount = 0;
    for (const a of apps) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      total++;
      if (a.match_score != null) {
        matchSum += a.match_score;
        matchCount++;
      }
    }

    const funnel = ["draft", "ready", "submitted", "interview", "offer"].map((s) => ({
      stage: s,
      count: byStatus[s] ?? 0,
    }));

    const basic = { total, by_status: byStatus, funnel };

    if (!featureEnabled("advanced_analytics")) {
      return {
        summary: `${total} application(s). Basic analytics (free core).`,
        data: basic,
        notes: ["Advanced analytics (averages, outcome rate) is a Pro feature."],
      };
    }

    const avgMatch = matchCount ? Math.round(matchSum / matchCount) : null;
    const submitted = byStatus["submitted"] ?? 0;
    const offers = byStatus["offer"] ?? 0;
    const outcomeRate = submitted ? Math.round((offers / submitted) * 100) : null;

    return {
      summary: `${total} application(s). Advanced analytics (Pro).`,
      data: {
        ...basic,
        avg_match_score: avgMatch,
        submitted: submitted,
        offers: offers,
        outcome_rate_pct: outcomeRate,
      },
    };
  },
};

const statusSchema = z.object({});

/** Status / entitlement snapshot — useful for the desktop UI and debugging. */
export const statusTool: ToolDef<typeof statusSchema> = {
  name: "status",
  description:
    "Show the current plan, AI credit balance, active features, and store location. " +
    "Helpful for debugging Pro activation and the HTTP bridge.",
  inputSchema: statusSchema,
  run: async () => {
    const { statusSnapshot } = await import("../features.js");
    const { dbPath } = await import("../store/db.js");
    return {
      summary: `Plan: ${statusSnapshot().plan_label} · credits: ${statusSnapshot().ai_credits_balance}`,
      data: { ...statusSnapshot(), db_path: dbPath() },
    };
  },
};