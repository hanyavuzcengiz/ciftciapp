import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyStore } from "../src/idempotencyStore";

test("idempotency store accepts first key and rejects duplicates", () => {
  const store = new InMemoryIdempotencyStore();
  assert.equal(store.remember("webhook:iyzico:abc"), true);
  assert.equal(store.remember("webhook:iyzico:abc"), false);
  assert.equal(store.remember("webhook:iyzico:def"), true);
});
