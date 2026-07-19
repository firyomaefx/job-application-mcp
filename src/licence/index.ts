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
  isPro,
} from "../lib/entitlement.js";
import { recordEvent } from "./events.js";

const DEVICE_FILE = "device-id";
const ENT_FILE = "entitlement.json";
const SECRET_FILE = "licence-secret";
const OFFLINE_GRACE_DAYS = 14;

let cachedDeviceId: string | null = null;
let cachedSecret: string | null = null;

/**
 * A per-install signing secret, generated once and persisted under the data
 * dir. It MACs the stored entitlement so a user casually editing
 * entitlement.json to unlock Pro invalidates it (the read path falls back to
 * FREE). NOTE: this is defense-in-depth, NOT a true enforcement boundary — a
 * determined user with the source can recompute the MAC. Real Pro enforcement
 * is server-side (signed entitlements verified with an embedded public key, and
 * paid value hosted server-side). That is deferred until the hosted Pro service
 * launches; today the release ships the free community core only.
 */
function licenceSecret(): string {
  if (cachedSecret) return cachedSecret;
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, SECRET_FILE);
  if (existsSync(path)) {
    cachedSecret = readFileSync(path, "utf8").trim();
    return cachedSecret;
  }
  cachedSecret = randomBytes(32).toString("hex");
  writeFileSync(path, cachedSecret, "utf8");
  return cachedSecret;
}

interface StoredEntitlement {
  entitlement: Entitlement;
  mac: string;
}

function withMac(ent: Entitlement): StoredEntitlement {
  return { entitlement: ent, mac: hmacSign(licenceSecret(), JSON.stringify(ent)) };
}

/** Verify the MAC on a stored entitlement. Returns the entitlement or null. */
function readEntitlementFile(): Entitlement | null {
  const path = entitlementPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    // Legacy unsigned format (pre-hardening) is rejected — safe default to FREE.
    if (!raw || typeof raw !== "object" || !("mac" in raw) || !("entitlement" in raw)) return null;
    const stored = raw as StoredEntitlement;
    const expected = hmacSign(licenceSecret(), JSON.stringify(stored.entitlement));
    if (!safeEqual(expected, stored.mac)) return null;
    return stored.entitlement;
  } catch {
    return null;
  }
}

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

/** Read the persisted entitlement, or FREE if none / tampered / expired. */
export function currentEntitlement(now = new Date()): Entitlement {
  const ent = readEntitlementFile();
  if (!ent) return FREE_ENTITLEMENT;
  if (!isActive(ent, now)) return FREE_ENTITLEMENT;
  return ent;
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

/** Persist an entitlement as the active one (MAC-signed for integrity). */
export function storeEntitlement(ent: Entitlement): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const prev = currentEntitlement();
  writeFileSync(entitlementPath(), JSON.stringify(withMac(ent), null, 2), "utf8");
  // Record the plan transition (N7). activate = Free→Pro; renew = Pro→Pro;
  // downgrade = any →Free.
  if (isPro(ent) && !isPro(prev)) recordEvent("activate", ent.plan);
  else if (isPro(ent) && isPro(prev)) recordEvent("renew", ent.plan);
  else if (!isPro(ent) && isPro(prev)) recordEvent("downgrade", ent.plan, "stored as free");
}

/** Clear the stored entitlement (return to free). */
export function clearEntitlement(): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const prev = currentEntitlement();
  writeFileSync(entitlementPath(), JSON.stringify(withMac(FREE_ENTITLEMENT), null, 2), "utf8");
  if (isPro(prev)) recordEvent("downgrade", "free", "cleared");
  else recordEvent("clear", "free");
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
 * OFFLINE_GRACE_DAYS, allow continued use. Returns the ent or FREE. Records an
 * 'expire' event (once per stored entitlement) once the grace window passes.
 */
let expireRecorded = false;
export function entitlementWithGrace(now = new Date()): Entitlement {
  const raw = readEntitlementFile();
  if (!raw) return FREE_ENTITLEMENT;
  if (isActive(raw, now)) {
    expireRecorded = false;
    return raw;
  }
  if (raw.expires_at) {
    const expiry = new Date(raw.expires_at).getTime();
    const graceEnd = expiry + OFFLINE_GRACE_DAYS * 86_400_000;
    if (now.getTime() < graceEnd) return raw;
  }
  if (isPro(raw) && !expireRecorded) {
    recordEvent("expire", "free", `expired ${raw.expires_at ?? "?"}`);
    expireRecorded = true;
  }
  return FREE_ENTITLEMENT;
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