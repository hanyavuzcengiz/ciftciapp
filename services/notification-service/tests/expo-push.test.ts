import assert from "node:assert/strict";
import test from "node:test";
import { __expoPushInternals } from "../src/expoPush";

test("retry delay increases exponentially", () => {
  assert.equal(__expoPushInternals.retryDelayMs(1, 400), 400);
  assert.equal(__expoPushInternals.retryDelayMs(2, 400), 800);
  assert.equal(__expoPushInternals.retryDelayMs(3, 400), 1600);
});

test("retryable status detection covers 429 and 5xx", () => {
  assert.equal(__expoPushInternals.isRetryableStatus(429), true);
  assert.equal(__expoPushInternals.isRetryableStatus(503), true);
  assert.equal(__expoPushInternals.isRetryableStatus(400), false);
});
