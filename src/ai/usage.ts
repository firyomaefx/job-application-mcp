// Claude / AI cost controls (N2, N3, N4).
//
// - Token-usage measurement + cost-per-call recording (N2).
// - Monthly spend cap, retry limit, rate limit (N3).
// - Graceful fallback to the heuristic provider on failure so a failed real-AI
//   request never loses application progress (N4).
//
// All limits are env-configurable and default to safe values. The mock provider
// is free (cost 0); only real provider calls accrue cost. When the monthly cap
// is reached we fall back to heuristic (not throw) — graceful degradation.

import { openDb } from "../store/db.js";
import { getDefaultProfile } from "../store/profile.js";
import type { AiUsage } from "./provider.js";

export type AiFeature = "ai_cv_tailoring" | "ai_cover_letter" | "ai_answer";
export type AiStatus = "ok" | "fallback" | "failed";
export type ProviderName = "mock" | "openai" | "anthropic" | "ollama";

/**
 * USD per 1000 tokens (input, output). Conservative public-list defaults.
 * `ollama` is a local model (free, runs on the user's own machine) → cost 0.
 */
const PRICE_TABLE: Record<ProviderName, { in: number; out: number }> = {
  mock: { in: 0, out: 0 },
  openai: { in: 0.00015, out: 0.0006 }, // gpt-4o-mini band
  anthropic: { in: 0.003, out: 0.015 }, // Claude mid band
  ollama: { in: 0, out: 0 }, // local model — no per-token cost
};

export function priceFor(provider: ProviderName): { in: number; out: number } {
  return PRICE_TABLE[provider] ?? { in: 0, out: 0 };
}

export function costFor(provider: ProviderName, usage: AiUsage): number {
  const p = priceFor(provider);
  return (usage.input_tokens / 1000) * p.in + (usage.output_tokens / 1000) * p.out;
}

/** Deterministic estimate used by the mock provider (no network, no real cost). */
export function estimateUsage(inputText: string, outputText: string): AiUsage {
  return {
    input_tokens: Math.ceil((inputText ?? "").length / 4),
    output_tokens: Math.ceil((outputText ?? "").length / 4),
  };
}

function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sum of USD spent this calendar month for the default profile. */
export function monthlySpend(): number {
  const db = openDb();
  const profileId = getDefaultProfile().id;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage
       WHERE profile_id = ? AND created_at LIKE ?`,
    )
    .get(profileId, `${currentMonth()}-%`) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

/** Monthly spend cap in USD (0 = unlimited). Default $20. */
export function monthlyLimit(): number {
  const v = Number(process.env.JOB_MCP_AI_MONTHLY_LIMIT_USD ?? 20);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Is there budget left for another real-AI call? (false → fall back to mock) */
export function canSpend(): boolean {
  const limit = monthlyLimit();
  if (limit <= 0) return true; // unlimited
  return monthlySpend() < limit;
}

/** Max retry attempts for a failing real-AI call before falling back. Default 3. */
export function maxRetries(): number {
  const v = Number(process.env.JOB_MCP_AI_MAX_RETRIES ?? 3);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 3;
}

/** Minimum gap (ms) between real-AI calls per profile. Default 1000. 0 = none. */
export function minIntervalMs(): number {
  const v = Number(process.env.JOB_MCP_AI_MIN_INTERVAL_MS ?? 1000);
  return Number.isFinite(v) && v >= 0 ? v : 1000;
}

let lastCallAt = 0;

/** Enforce the rate limit by sleeping until the minimum interval has elapsed. */
export async function enforceRateLimit(): Promise<void> {
  const gap = minIntervalMs();
  if (gap <= 0) return;
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < gap) await sleep(gap - elapsed);
  lastCallAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Record an AI usage row. Returns the recorded cost. */
export function recordUsage(
  feature: AiFeature,
  provider: ProviderName,
  usage: AiUsage,
  status: AiStatus,
): number {
  const db = openDb();
  const profileId = getDefaultProfile().id;
  const cost = provider === "mock" ? 0 : costFor(provider, usage);
  db.prepare(
    `INSERT INTO ai_usage
       (profile_id, feature, provider, input_tokens, output_tokens, cost_usd, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    profileId,
    feature,
    provider,
    usage.input_tokens,
    usage.output_tokens,
    cost,
    status,
    new Date().toISOString(),
  );
  return cost;
}

/** Per-profile AI usage history (newest first). */
export function usageHistory(limit = 50) {
  const db = openDb();
  const profileId = getDefaultProfile().id;
  return db
    .prepare(
      "SELECT id, feature, provider, input_tokens, output_tokens, cost_usd, status, created_at "
        + "FROM ai_usage WHERE profile_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(profileId, limit);
}