import assert from "node:assert/strict";
import test from "node:test";
import { validatePaymentRuntime } from "../src/runtimeConfig";

test("allows development in-memory runtime", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("development", false));
});

test("blocks production in-memory runtime by default", () => {
  assert.throws(() => validatePaymentRuntime("production", false), /persistent payment backend/);
});

test("allows production only with explicit override", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("production", true));
});
