import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSignedPayload,
  computeWebhookSignature,
  resolveWebhookSecret,
  verifyWebhookSignature
} from "../src/webhookSecurity";

test("resolveWebhookSecret allows dev fallback", () => {
  assert.equal(resolveWebhookSecret("development", undefined), "dev-secret");
});

test("resolveWebhookSecret blocks insecure production secret", () => {
  assert.throws(() => resolveWebhookSecret("production", "dev-secret"), /requires secure REQUEST_SIGNING_SECRET/);
});

test("verifyWebhookSignature accepts valid signatures", () => {
  const body = { event: "payment.paid", payment_id: "pay_1" };
  const ts = "1712660000";
  const secret = "prod-secret-123";
  const payload = buildSignedPayload(ts, body);
  const sig = computeWebhookSignature(payload, secret);
  assert.equal(verifyWebhookSignature(sig, ts, body, secret), true);
});

test("verifyWebhookSignature rejects invalid signatures", () => {
  const body = { event: "payment.paid", payment_id: "pay_1" };
  assert.equal(verifyWebhookSignature("deadbeef", "1712660000", body, "prod-secret-123"), false);
});
