import { test } from "node:test";
import assert from "node:assert/strict";
import { hmacSign } from "../src/lib/crypto.js";
import {
  verifyWebhook,
  processEvent,
  type WebhookEvent,
} from "../src/payments/webhook.js";
import {
  generateReferralCode,
  isValidReferralCode,
  resolveReferral,
} from "../src/licence/referral.js";

const SECRET = "wh-secret";

test("webhook: verifyWebhook accepts a valid signature and rejects bad ones", () => {
  const body = '{"type":"subscription_created"}';
  const sig = hmacSign(SECRET, body);
  assert.ok(verifyWebhook(body, sig, SECRET));
  assert.ok(!verifyWebhook(body, "deadbeef", SECRET));
  assert.ok(!verifyWebhook(body + "x", sig, SECRET));
});

test("webhook: subscription_created mints a signed entitlement token", () => {
  const ev: WebhookEvent = {
    type: "subscription_created",
    email: "u@example.com",
    variant: "pro",
    expires_at: "2099-01-01",
  };
  const { token, entitlement } = processEvent(ev, SECRET);
  assert.equal(entitlement.plan, "pro");
  assert.ok(token.length > 0);
  assert.ok(entitlement.features.includes("ai_cv_tailoring"));
});

test("webhook: subscription_cancelled downgrades to free", () => {
  const ev: WebhookEvent = {
    type: "subscription_cancelled",
    email: "u@example.com",
    variant: "pro",
  };
  const { entitlement } = processEvent(ev, SECRET);
  assert.equal(entitlement.plan, "free");
});

test("webhook: order_created requires credits + topup_code", () => {
  assert.throws(() =>
    processEvent({ type: "order_created", email: "u@example.com", variant: "pro" }, SECRET)
  );
  const r = processEvent(
    { type: "order_created", email: "u@example.com", variant: "pro", credits: 20, topup_code: "C1" },
    SECRET
  );
  assert.equal(r.credits_applied, 20);
});

test("referral: generated code is valid and matches format", () => {
  const code = generateReferralCode();
  assert.ok(code.startsWith("REF-"));
  assert.ok(isValidReferralCode(code));
});

test("referral: invalid codes are rejected", () => {
  assert.ok(!isValidReferralCode("nope"));
  assert.ok(!isValidReferralCode("REF-lower1"));
  assert.ok(!isValidReferralCode("REF-AB")); // too short
});

test("referral: resolveReferral returns grant amounts", () => {
  const r = resolveReferral({ refereeEmail: "u@example.com", code: generateReferralCode() });
  assert.equal(r?.referrer_grant, 10);
  assert.equal(r?.referee_grant, 5);
  assert.equal(resolveReferral({ refereeEmail: "u@e.com", code: "BAD" }), null);
});