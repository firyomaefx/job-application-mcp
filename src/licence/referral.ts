// Referral program — wire-ready stub (Stage 3).
//
// In production, referrals grant bonus AI credits to both referrer and referee
// after the referee's first paid subscription. The hosted service tracks
// referral codes and triggers the grant via the payment webhook. This module
// provides the code format + validation the client and server share.

import { randomBytes } from "node:crypto";

/** Generate a referral code like REF-AB12CD. */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += chars[b % chars.length];
  return `REF-${code}`;
}

const REFERRAL_RE = /^REF-[A-Z2-9]{6,10}$/;

export function isValidReferralCode(code: string): boolean {
  return REFERRAL_RE.test(code);
}

/**
 * Resolve a referral on a paid event. The hosted service calls this; it returns
 * the credit grants to apply. Free core never calls it.
 */
export function resolveReferral(opts: {
  refereeEmail: string;
  code: string;
  referrerCredits?: number;
  refereeCredits?: number;
}): { referrer_grant: number; referee_grant: number } | null {
  if (!isValidReferralCode(opts.code)) return null;
  return {
    referrer_grant: opts.referrerCredits ?? 10,
    referee_grant: opts.refereeCredits ?? 5,
  };
}