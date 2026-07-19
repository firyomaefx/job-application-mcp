// Stage 4 — Business/admin tools (wire-ready).
//
// These operate on the accounts + team_members tables (schema v2). They are
// gated behind the "multi_candidate" / "team_dashboard" features in a real Pro
// deployment. Here they run locally for the default profile so the surface is
// buildable and testable without hosted business infra.

import { z } from "zod";
import type { ToolDef } from "./types.js";
import { openDb } from "../store/db.js";
import { featureEnabled } from "../features.js";

const createAccountSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  plan: z.enum(["pro", "pro_plus", "business"]).optional().default("business"),
});

export const createAccountTool: ToolDef<typeof createAccountSchema> = {
  name: "admin_create_account",
  description:
    "Business tier: create a coach/agency account (email, name, plan). " +
    "Requires the 'multi_candidate' feature in production; locally available for setup/testing.",
  inputSchema: createAccountSchema,
  run: (input) => {
    if (!featureEnabled("multi_candidate")) {
      return {
        summary: "Business tier not active on this install.",
        notes: ["Activate a Business entitlement to use admin tools.", "Local testing override aside, this is a Pro/Business feature."],
      };
    }
    const db = openDb();
    const ts = new Date().toISOString();
    const info = db
      .prepare("INSERT OR IGNORE INTO accounts (email, name, plan, created_at) VALUES (?, ?, ?, ?)")
      .run(input.email, input.name, input.plan, ts);
    if (info.changes === 0) {
      return { summary: `Account ${input.email} already exists.` };
    }
    return {
      summary: `Created account ${input.email} (plan ${input.plan}, id ${info.lastInsertRowid}).`,
      data: { id: Number(info.lastInsertRowid), email: input.email, plan: input.plan },
    };
  },
};

const addCandidateSchema = z.object({
  account_id: z.number().int(),
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["owner", "coach", "candidate"]).optional().default("candidate"),
});

export const addCandidateTool: ToolDef<typeof addCandidateSchema> = {
  name: "admin_add_candidate",
  description:
    "Business tier: add a candidate profile to an account's team and link them. " +
    "Creates a fresh profile for the candidate.",
  inputSchema: addCandidateSchema,
  run: (input) => {
    if (!featureEnabled("multi_candidate")) {
      return { summary: "Business tier not active on this install." };
    }
    const db = openDb();
    const ts = new Date().toISOString();
    const acct = db.prepare("SELECT id FROM accounts WHERE id = ?").get(input.account_id);
    if (!acct) return { summary: `Account ${input.account_id} not found.` };

    const profileInfo = db
      .prepare(
        `INSERT INTO profiles (full_name, email, skills, label, created_at, updated_at)
         VALUES (?, ?, '[]', ?, ?, ?)`
      )
      .run(input.full_name, input.email ?? null, `acct-${input.account_id}`, ts, ts);
    const profileId = Number(profileInfo.lastInsertRowid);

    db.prepare(
      "INSERT INTO team_members (account_id, profile_id, role, added_at) VALUES (?, ?, ?, ?)"
    ).run(input.account_id, profileId, input.role, ts);

    return {
      summary: `Added candidate "${input.full_name}" (profile ${profileId}) to account ${input.account_id} as ${input.role}.`,
      data: { profile_id: profileId, account_id: input.account_id, role: input.role },
    };
  },
};

const listTeamSchema = z.object({ account_id: z.number().int() });

export const listTeamTool: ToolDef<typeof listTeamSchema> = {
  name: "admin_list_team",
  description: "Business tier: list the candidates/members in an account's team.",
  inputSchema: listTeamSchema,
  run: (input) => {
    if (!featureEnabled("multi_candidate")) {
      return { summary: "Business tier not active on this install." };
    }
    const db = openDb();
    const rows = db
      .prepare(
        `SELECT tm.id, tm.role, tm.added_at, p.id AS profile_id, p.full_name
         FROM team_members tm JOIN profiles p ON p.id = tm.profile_id
         WHERE tm.account_id = ? ORDER BY tm.id`
      )
      .all(input.account_id);
    return {
      summary: `${(rows as unknown[]).length} member(s) in account ${input.account_id}.`,
      data: rows,
    };
  },
};

const usageSchema = z.object({});

/** Usage report — counts of applications/candidates for the install. */
export const usageReportTool: ToolDef<typeof usageSchema> = {
  name: "admin_usage_report",
  description: "Business tier: a simple usage report (accounts, profiles, applications).",
  inputSchema: usageSchema,
  run: () => {
    if (!featureEnabled("team_dashboard")) {
      return { summary: "Business tier not active on this install." };
    }
    const db = openDb();
    const accounts = (db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number }).n;
    const profiles = (db.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number }).n;
    const applications = (db.prepare("SELECT COUNT(*) AS n FROM applications").get() as { n: number }).n;
    return {
      summary: `Usage: ${accounts} accounts, ${profiles} profiles, ${applications} applications.`,
      data: { accounts, profiles, applications },
    };
  },
};