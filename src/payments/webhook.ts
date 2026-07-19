// Payment webhook seam — server-side, NOT part of the free core.
//
// In production this runs on your hosted service (Vercel function / small API)
// behind Lemon Squeezy or Stripe. It verifies the webhook signature, then maps
// the event to local licence/credit actions via the same modules the desktop
// app uses. It is included here so the contract is concrete and testable.
//
// SECURITY: the signing secret must live in server env, never in the client.
// This module never runs inside the desktop app or the stdio server.

import { verifyHmac } from "../lib/crypto.js";
import {
  buildEntitlement,
  clearEntitlement,
  mintToken,
  storeEntitlement,
  type Entitlement,
} from "../licence/index.js";

export type LemonEventType =
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "license_key_created"
  | "order_created";

export interface WebhookEvent {
  type: LemonEventType;
  email: string;
  licence_key?: string;
  variant: "pro" | "pro_plus" | "business";
  credits?: number; // for top-up orders
  topup_code?: string;
  expires_at?: string | null;
}

/**
 * Verify a Lemon Squeezy-style webhook: signature is HMAC-SHA256 of the raw
 * body, sent in the `X-Signature` header. Returns true if valid.
 */
export function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  return verifyHmac(secret, rawBody, signature);
}

/**
 * Process a verified event into licence/credit side effects. Returns a signed
 * entitlement token the client can store via `job-mcp licence apply-token`.
 *
 * This is the bridge between "payment captured" and "client unlocked". It must
 * run on a server that holds the signing secret.
 */
export function processEvent(ev: WebhookEvent, signingSecret: string): {
  token: string;
  entitlement: Entitlement;
  credits_applied?: number;
} {
  switch (ev.type) {
    case "subscription_created":
    case "subscription_updated": {
      const ent = buildEntitlement(ev.variant, { expiresAt: ev.expires_at ?? null });
      storeEntitlement(ent);
      return { token: mintToken(ent, signingSecret), entitlement: ent };
    }
    case "subscription_cancelled": {
      // Downgrade: keep local data, clear entitlement. Client falls back to free.
      clearEntitlement();
      const free = buildEntitlement("free", { expiresAt: null });
      return { token: mintToken(free, signingSecret), entitlement: free };
    }
    case "order_created": {
      // Top-up order: credits are applied by the hosted service, which resolves
      // a profileId from the email and calls applyTopup(profileId, credits, code).
      // This seam validates the event shape only.
      if (!ev.credits || !ev.topup_code) {
        throw new Error("order_created missing credits/topup_code");
      }
      return {
        token: "",
        entitlement: buildEntitlement("pro", { expiresAt: ev.expires_at ?? null }),
        credits_applied: ev.credits,
      };
    }
    default:
      throw new Error(`unhandled event type: ${ev.type}`);
  }
}