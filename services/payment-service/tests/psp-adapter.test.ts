import assert from "node:assert/strict";
import test from "node:test";
import {
  createPaymentProviderAdapter,
  MockPaymentProviderAdapter,
  parseProviderIntentId,
  parseProviderStatus,
  resolvePaymentAdapterConfig
} from "../src/pspAdapter";

test("maps iyzico webhook payload into canonical status", () => {
  const adapter = new MockPaymentProviderAdapter();
  const event = adapter.mapWebhookEvent("iyzico", {
    event: "payment.paid",
    payment_id: "pi_123"
  });
  assert.deepEqual(event, {
    paymentId: "pi_123",
    status: "paid",
    rawEventName: "payment.paid"
  });
});

test("maps stripe webhook payload into canonical status", () => {
  const adapter = new MockPaymentProviderAdapter();
  const event = adapter.mapWebhookEvent("stripe", {
    type: "charge.refunded",
    data: { object: { id: "ch_123" } }
  });
  assert.deepEqual(event, {
    paymentId: "ch_123",
    status: "refunded",
    rawEventName: "charge.refunded"
  });
});

test("returns null for unsupported provider payload", () => {
  const adapter = new MockPaymentProviderAdapter();
  const event = adapter.mapWebhookEvent("iyzico", { hello: "world" });
  assert.equal(event, null);
});

test("resolvePaymentAdapterConfig normalizes base url and timeout", () => {
  const cfg = resolvePaymentAdapterConfig({
    PAYMENT_PSP_TIMEOUT_MS: "4500",
    PAYMENT_IYZICO_BASE_URL: "https://api.iyzico.local/",
    PAYMENT_IYZICO_API_KEY: "iyzi-key"
  });
  assert.equal(cfg.requestTimeoutMs, 4500);
  assert.equal(cfg.iyzico?.baseUrl, "https://api.iyzico.local");
  assert.equal(cfg.iyzico?.apiKey, "iyzi-key");
  assert.equal(cfg.stripe, undefined);
});

test("createPaymentProviderAdapter defaults to mock mode", () => {
  const adapter = createPaymentProviderAdapter({});
  assert.equal(adapter instanceof MockPaymentProviderAdapter, true);
});

test("parseProviderIntentId supports provider specific response shapes", () => {
  assert.equal(parseProviderIntentId("iyzico", { paymentId: "iyzi-123" }), "iyzi-123");
  assert.equal(parseProviderIntentId("stripe", { id: "pi_123" }), "pi_123");
  assert.equal(parseProviderIntentId("stripe", { payment_intent: { id: "pi_nested" } }), "pi_nested");
});

test("parseProviderStatus maps iyzico statuses", () => {
  assert.equal(parseProviderStatus("iyzico", { paymentStatus: "success" }), "paid");
  assert.equal(parseProviderStatus("iyzico", { paymentStatus: "failure" }), "failed");
  assert.equal(parseProviderStatus("iyzico", { paymentStatus: "pending" }), "pending");
});

test("parseProviderStatus maps stripe statuses", () => {
  assert.equal(parseProviderStatus("stripe", { payment_status: "succeeded" }), "paid");
  assert.equal(parseProviderStatus("stripe", { payment_status: "canceled" }), "failed");
  assert.equal(parseProviderStatus("stripe", { charge: { status: "refunded" } }), "refunded");
});
