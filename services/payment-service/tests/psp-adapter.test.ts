import assert from "node:assert/strict";
import test from "node:test";
import { MockPaymentProviderAdapter } from "../src/pspAdapter";

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
