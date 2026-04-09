import assert from "node:assert/strict";
import test from "node:test";
import { validatePaymentRuntime } from "../src/runtimeConfig";

test("allows development in-memory runtime", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("development", false));
});

test("allows production runtime with persistent backend mode", () => {
  assert.doesNotThrow(() => validatePaymentRuntime("production", false));
});

test("blocks production in-memory runtime override", () => {
  assert.throws(() => validatePaymentRuntime("production", true), /persistent payment backend/);
});
