import assert from "node:assert/strict";
import test from "node:test";
import { validatePaymentRuntime } from "../src/runtimeConfig";

test("allows development in-memory runtime", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("development", false, "mock", false));
});

test("allows production runtime with persistent backend mode", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("production", false, "live", false));
});

test("blocks production in-memory runtime override", () => {
  assert.throws(() => validatePaymentRuntime("production", true, "live", false), /persistent payment backend/);
});

test("blocks production mock provider mode by default", () => {
  assert.throws(() => validatePaymentRuntime("production", false, "mock", false), /PAYMENT_PROVIDER_MODE=live/);
});

test("allows production mock mode only with explicit override", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("production", false, "mock", true));
});
