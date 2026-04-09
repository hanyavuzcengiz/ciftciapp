import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyReplayStore, InMemoryIdempotencyStore } from "../src/idempotencyStore";

test("idempotency store accepts first key and rejects duplicates", () => {
  const store = new InMemoryIdempotencyStore();
  assert.equal(store.remember("webhook:iyzico:abc"), true);
  assert.equal(store.remember("webhook:iyzico:abc"), false);
  assert.equal(store.remember("webhook:iyzico:def"), true);
});

test("replay store returns missing before first write", () => {
  const store = new InMemoryIdempotencyReplayStore();
  const result = store.probe("intent:anonymous:key-1", "fp-1");
  assert.equal(result.kind, "missing");
});

test("replay store returns replay on matching fingerprint", () => {
  const store = new InMemoryIdempotencyReplayStore();
  store.remember("intent:anonymous:key-1", {
    fingerprint: "fp-1",
    statusCode: 201,
    body: { id: "pay_1", status: "pending" }
  });
  const result = store.probe("intent:anonymous:key-1", "fp-1");
  assert.equal(result.kind, "replay");
  if (result.kind !== "replay") {
    throw new Error("expected replay result");
  }
  assert.equal(result.record.statusCode, 201);
});

test("replay store returns conflict on different fingerprint", () => {
  const store = new InMemoryIdempotencyReplayStore();
  store.remember("intent:anonymous:key-1", {
    fingerprint: "fp-1",
    statusCode: 201,
    body: { id: "pay_1", status: "pending" }
  });
  const result = store.probe("intent:anonymous:key-1", "fp-2");
  assert.equal(result.kind, "conflict");
});
