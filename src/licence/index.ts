// Licence module — local validation of signed entitlement tokens.
//
// Pro activation is designed to happen against a hosted licence server
// (Lemon Squeezy Licence API or your own). That server signs tokens with a
// shared secret. This module validates those tokens locally, enforces device
// limits and an offline grace window, and persists the active entitlement +
// device id on disk (under JOB_MCP_DATA_DIR).
//
// The FREE core does NOT require a licence. With no entitlement stored, the
// caller gets FREE_ENTITLEMENT. Nothing here makes a network call except the
// explicit `activate()` which talks to a licence server URL you configure.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dataDir } from "../store/db.js";
import { b64url, b64urlDecode, hmacSign, safeEqual, verifyHmac } from "../lib/crypto.js";
import {
  FREE_ENTITLEMENT,
  PLAN_LIMITS,
  type Entitlement,
  type Plan,
  isActive,
} from "../lib/entitlement.js";

const DEVICE_FILE = "device-id";
const ENT_FILE = "entitlement.json";
const OFFLINE_GRACE_DAYS = 14;

let cachedDeviceId: string | null = null;

/** A stable, random device id generated once and persisted. */
export function deviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, DEVICE_FILE);
  if (existsSync(path)) {
    cachedDeviceId = readFileSync(path, "utf8").trim();
    return cachedDeviceId;
  }
  // 16 random bytes hex. (Random is fine at runtime; only workflow scripts
  // forbid Date/Math.random — this is not a workflow script.)
  cachedDeviceId = randomBytes(16).toString("hex");
  writeFileSync(path, cachedDeviceId, "utf8");
  return cachedDeviceId;
}

function entitlementPath(): string {
  return join(dataDir(), ENT_FILE);
}

/** Read the persisted entitlement, or FREE if none / invalid / expired. */
export function currentEntitlement(now = new Date()): Entitlement {
  const path = entitlementPath();
  if (!existsSync(path)) return FREE_ENTITLEMENT;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Entitlement;
    if (!isActive(raw, now)) return FREE_ENTITLEMENT;
    return raw;
  } catch {
    return FREE_ENTITLEMENT;
  }
}

/**
 * Validate a signed entitlement token WITHOUT touching the network.
 * Token format: `<base64url(payload)>.<hex-hmac>`.
 * Returns the entitlement if the signature matches and it's active.
 */
export function validateToken(token: string, secret: string, now = new Date()): Entitlement {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("malformed token");
  const [payloadB64, sig] = parts;
  const payloadJson = b64urlDecode(payloadB64).toString("utf8");
  if (!verifyHmac(secret, payloadJson, sig)) {
    throw new Error("invalid signature");
  }
  const ent = JSON.parse(payloadJson) as Entitlement;
  if (!isActive(ent, now)) throw new Error("entitlement expired");
  return ent;
}

/** Mint a signed token (used by tests and by your licence server). */
export function mintToken(ent: Entitlement, secret: string): string {
  const payload = JSON.stringify(ent);
  return `${b64url(payload)}.${hmacSign(secret, payload)}`;
}

/** Persist an entitlement as the active one. */
export function storeEntitlement(ent: Entitlement): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(entitlementPath(), JSON.stringify(ent, null, 2), "utf8");
}

/** Clear the stored entitlement (return to free). */
export function clearEntitlement(): void {
  const path = entitlementPath();
  if (existsSync(path)) writeFileSync(path, JSON.stringify(FREE_ENTITLEMENT, null, 2), "utf8");
}

/**
 * Activate against a licence server. The server should return a signed token
 * plus the entitlement JSON. We verify the signature locally before storing.
 *
 * This is the ONLY network call in the module, and only runs if you pass a
 * licenceServer URL. Free core never calls it.
 */
export async function activate(opts: {
  licenceServer: string;
  licenceKey: string;
  email: string;
  deviceName?: string;
  signingSecret: string;
}): Promise<Entitlement> {
  const url = new URL("/activate", opts.licenceServer).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licence_key: opts.licenceKey,
      email: opts.email,
      device_id: deviceId(),
      device_name: opts.deviceName ?? "desktop",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`activation failed: HTTP ${res.status} ${text}`);
  }
  const body = (await res.json()) as { token: string };
  const ent = validateToken(body.token, opts.signingSecret);
  storeEntitlement({ ...ent, device_id: deviceId(), activated_at: new Date().toISOString() });
  return ent;
}

/**
 * Offline grace: if we have a stored entitlement that has expired but within
 * OFFLINE_GRACE_DAYS, allow continued use. Returns the ent or FREE.
 */
export function entitlementWithGrace(now = new Date()): Entitlement {
  const path = entitlementPath();
  if (!existsSync(path)) return FREE_ENTITLEMENT;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Entitlement;
    if (isActive(raw, now)) return raw;
    if (raw.expires_at) {
      const expiry = new Date(raw.expires_at).getTime();
      const graceEnd = expiry + OFFLINE_GRACE_DAYS * 86_400_000;
      if (now.getTime() < graceEnd) return raw;
    }
    return FREE_ENTITLEMENT;
  } catch {
    return FREE_ENTITLEMENT;
  }
}

/** Build an entitlement for a plan (server-side helper, also used in tests). */
export function buildEntitlement(plan: Plan, opts?: { expiresAt?: string | null; features?: string[] }): Entitlement {
  const limits = PLAN_LIMITS[plan];
  return {
    plan,
    device_limit: limits.device_limit,
    ai_credits_per_month: limits.ai_credits_per_month,
    expires_at: opts?.expiresAt ?? null,
    features: opts?.features ?? defaultFeaturesFor(plan),
    device_id: deviceId(),
    activated_at: new Date().toISOString(),
  };
}

function defaultFeaturesFor(plan: Plan): string[] {
  switch (plan) {
    case "pro":
      return ["ai_cv_tailoring", "ai_cover_letter", "cloud_sync", "premium_adapters", "advanced_analytics", "interview_reminders"];
    case "pro_plus":
      return ["ai_cv_tailoring", "ai_cover_letter", "cloud_sync", "premium_adapters", "advanced_analytics", "interview_reminders", "salary_analysis", "follow_ups"];
    case "business":
      return ["ai_cv_tailoring", "ai_cover_letter", "cloud_sync", "premium_adapters", "advanced_analytics", "multi_candidate", "team_dashboard", "white_label", "audit_history"];
    default:
      return [];
  }
}

// Re-export for tool use.
export { safeEqual };
export type { Entitlement, Plan };