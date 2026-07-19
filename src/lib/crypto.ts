import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stable, dependency-free HMAC-SHA256 helpers used by the licence module.
 * No external crypto deps — Node built-ins only.
 */

export function hmacSign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time string comparison. Returns true if equal. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Verify a signature for a payload given the secret. */
export function verifyHmac(secret: string, payload: string, signature: string): boolean {
  const expected = hmacSign(secret, payload);
  return safeEqual(expected, signature);
}

/**
 * URL-safe base64 (no padding). Used for the signature segment of a token.
 */
export function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

export function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}