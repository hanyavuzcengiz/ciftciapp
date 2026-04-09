import assert from "node:assert/strict";
import test from "node:test";
import { parseIdempotencyKeyHeader } from "../src/idempotencyKey";

test("accepts empty header as optional idempotency key", () => {
  const result = parseIdempotencyKeyHeader(undefined, 128);
  assert.deepEqual(result, { ok: true, key: null });
});

test("accepts valid idempotency key", () => {
  const result = parseIdempotencyKeyHeader("order-1:confirm_abc.123", 128);
  assert.deepEqual(result, { ok: true, key: "order-1:confirm_abc.123" });
});

test("rejects idempotency key with unsupported characters", () => {
  const result = parseIdempotencyKeyHeader("bad key with spaces", 128);
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("expected validation failure");
  }
  assert.match(result.message, /invalid characters/);
});

test("rejects key longer than max length", () => {
  const result = parseIdempotencyKeyHeader("x".repeat(129), 128);
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("expected max-length validation failure");
  }
  assert.match(result.message, /max length/);
});
