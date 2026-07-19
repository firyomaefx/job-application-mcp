import { z } from "zod";
import type { ToolDef } from "./types.js";
import { applyTopup, balance, grantMonthly, history } from "../licence/credits.js";
import { getDefaultProfile } from "../store/profile.js";

const topupSchema = z.object({
  code: z.string().min(4),
  amount: z.number().int().min(1).max(1000),
});

export const topupCreditsTool: ToolDef<typeof topupSchema> = {
  name: "topup_credits",
  description:
    "Apply an AI-credit top-up code (Pro add-on). Idempotent per code. " +
    "In production, codes are issued by the payment webhook; here you can apply one directly for testing.",
  inputSchema: topupSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    try {
      const newBalance = applyTopup(profile.id, input.amount, input.code);
      return {
        summary: `Applied top-up ${input.code} (+${input.amount}). New balance: ${newBalance}.`,
        data: { balance: newBalance, code: input.code },
      };
    } catch (e) {
      return { summary: `Top-up failed: ${(e as Error).message}` };
    }
  },
};

const creditsSchema = z.object({});

export const creditsTool: ToolDef<typeof creditsSchema> = {
  name: "credits",
  description: "Show the current AI credit balance and recent ledger entries.",
  inputSchema: creditsSchema,
  run: () => {
    const profile = getDefaultProfile();
    return {
      summary: `AI credit balance: ${balance()}.`,
      data: { balance: balance(), recent: history(profile.id, 10) },
    };
  },
};

const grantSchema = z.object({ amount: z.number().int().min(1).max(1000).optional() });

/**
 * Admin: grant the monthly allowance. Used after Pro activation or by tests.
 * In production the entitlement's `ai_credits_per_month` drives the amount.
 */
export const grantMonthlyTool: ToolDef<typeof grantSchema> = {
  name: "grant_monthly_credits",
  description:
    "Admin/test: grant the monthly AI credit allowance for the current profile. " +
    "Idempotent per calendar month.",
  inputSchema: grantSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const amount = input.amount ?? 30;
    const newBalance = grantMonthly(profile.id, amount);
    return {
      summary: `Monthly grant applied (${amount}). Balance: ${newBalance}.`,
      data: { balance: newBalance, granted: amount },
    };
  },
};