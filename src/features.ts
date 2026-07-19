// Feature gating — the single place tools ask "is this Pro feature available?".
//
// It composes the active entitlement (with offline grace) and the local credit
// balance. Free core features are always available. Pro features require an
// active Pro entitlement; AI features additionally require credits OR fall
// back to the free heuristic path.

import { entitlementWithGrace, currentEntitlement } from "./licence/index.js";
import { balance } from "./licence/credits.js";
import { hasFeature, isPro, type Entitlement } from "./lib/entitlement.js";

export { isPro, hasFeature };

export function entitlement(): Entitlement {
  return entitlementWithGrace();
}

export function plan(): Entitlement["plan"] {
  return entitlement().plan;
}

/** Is a given feature flag enabled for the current entitlement? */
export function featureEnabled(feature: string): boolean {
  return hasFeature(entitlement(), feature);
}

/** Is AI available (Pro + at least one credit)? */
export function aiAvailable(): boolean {
  return isPro(entitlement()) && balance() > 0;
}

/**
 * Resolve how to handle an AI op: 'ai' (use the provider, debit a credit),
 * or 'heuristic' (free local fallback). The caller does the actual work.
 */
export type AiMode = "ai" | "heuristic";

export function resolveAiMode(feature: string): AiMode {
  if (featureEnabled(feature) && balance() > 0) return "ai";
  return "heuristic";
}

/** Human-readable plan label for UIs / logs. */
export function planLabel(): string {
  const p = plan();
  return p === "free" ? "Free" : p === "pro" ? "Pro" : p === "pro_plus" ? "Pro Plus" : "Business";
}

/** Snapshot for status/debug tools. */
export function statusSnapshot() {
  return {
    plan: plan(),
    plan_label: planLabel(),
    ai_credits_balance: balance(),
    features: entitlement().features,
    expires_at: entitlement().expires_at,
    strict_active: currentEntitlement().plan !== "free",
  };
}