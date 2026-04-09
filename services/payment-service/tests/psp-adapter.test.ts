import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentProviderAdapter, MockPaymentProviderAdapter, resolvePaymentAdapterConfig } from "../src/pspAdapter";

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
