// Entitlement: the plan + limits + features a licence grants.
// This is a pure value type shared by the licence module and feature gating.

export type Plan = "free" | "pro" | "pro_plus" | "business";

export interface Entitlement {
  plan: Plan;
  device_limit: number;
  ai_credits_per_month: number;
  expires_at: string | null; // ISO date or null for never
  features: string[]; // e.g. ["cloud_sync", "ai_cv_tailoring", ...]
  device_id?: string;
  activated_at?: string;
}

export const FREE_ENTITLEMENT: Entitlement = {
  plan: "free",
  device_limit: 1,
  ai_credits_per_month: 0,
  expires_at: null,
  features: [],
};

export const PLAN_LIMITS: Record<Plan, { device_limit: number; ai_credits_per_month: number }> = {
  free: { device_limit: 1, ai_credits_per_month: 0 },
  pro: { device_limit: 2, ai_credits_per_month: 30 },
  pro_plus: { device_limit: 3, ai_credits_per_month: 100 },
  business: { device_limit: 5, ai_credits_per_month: 250 },
};

export function isPro(ent: Entitlement): boolean {
  return ent.plan === "pro" || ent.plan === "pro_plus" || ent.plan === "business";
}

/** Is the entitlement still valid right now (not expired)? */
export function isActive(ent: Entitlement, now = new Date()): boolean {
  if (!ent.expires_at) return true;
  return new Date(ent.expires_at).getTime() > now.getTime();
}

export function hasFeature(ent: Entitlement, feature: string): boolean {
  return ent.features.includes(feature);
}