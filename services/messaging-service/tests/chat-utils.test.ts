import assert from "node:assert/strict";
import test from "node:test";
import { decodeCursor, encodeCursor, sameParticipantSets } from "../src/chatUtils";

test("cursor encode/decode roundtrip works", () => {
  const cursor = encodeCursor(25);
  assert.equal(decodeCursor(cursor), 25);
});

test("invalid cursor safely falls back to zero", () => {
  assert.equal(decodeCursor("%%%"), 0);
});

test("participant set compare ignores ordering", () => {
  assert.equal(sameParticipantSets(["u2", "u1"], ["u1", "u2"]), true);
  assert.equal(sameParticipantSets(["u1"], ["u1", "u2"]), false);
});
