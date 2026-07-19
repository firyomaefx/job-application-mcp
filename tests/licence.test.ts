import { test } from "node:test";
import assert from "node:assert/strict";
import { b64url, b64urlDecode, hmacSign, verifyHmac } from "../src/lib/crypto.js";
import {
  FREE_ENTITLEMENT,
  PLAN_LIMITS,
  isActive,
  isPro,
  hasFeature,
  type Entitlement,
} from "../src/lib/entitlement.js";

test("crypto: hmac sign + verify round-trips and rejects tampering", () => {
  const secret = "topsecret";
  const payload = '{"plan":"pro"}';
  const sig = hmacSign(secret, payload);
  assert.ok(verifyHmac(secret, payload, sig));
  assert.ok(!verifyHmac(secret, payload + "x", sig));
  assert.ok(!verifyHmac("wrong", payload, sig));
});

test("crypto: b64url round-trip", () => {
  const s = '{"a":"b/c+d=="}';
  const enc = b64url(s);
  assert.equal(b64urlDecode(enc).toString("utf8"), s);
});

test("entitlement: free is not pro; pro is pro", () => {
  assert.ok(!isPro(FREE_ENTITLEMENT));
  assert.ok(isPro({ ...FREE_ENTITLEMENT, plan: "pro" }));
  assert.ok(isPro({ ...FREE_ENTITLEMENT, plan: "business" }));
});

test("entitlement: isActive respects expiry", () => {
  const future: Entitlement = { ...FREE_ENTITLEMENT, plan: "pro", expires_at: "2099-01-01" };
  const past: Entitlement = { ...FREE_ENTITLEMENT, plan: "pro", expires_at: "2000-01-01" };
  assert.ok(isActive(future));
  assert.ok(!isActive(past));
  assert.ok(isActive(FREE_ENTITLEMENT)); // null expiry = never expires
});

test("entitlement: hasFeature checks the list", () => {
  const ent: Entitlement = { ...FREE_ENTITLEMENT, features: ["cloud_sync"] };
  assert.ok(hasFeature(ent, "cloud_sync"));
  assert.ok(!hasFeature(ent, "ai_cv_tailoring"));
});

test("PLAN_LIMITS: pro has 30 credits, 2 devices", () => {
  assert.equal(PLAN_LIMITS.pro.ai_credits_per_month, 30);
  assert.equal(PLAN_LIMITS.pro.device_limit, 2);
  assert.equal(PLAN_LIMITS.free.ai_credits_per_month, 0);
});