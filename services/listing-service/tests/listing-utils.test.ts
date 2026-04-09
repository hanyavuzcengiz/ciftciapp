import assert from "node:assert/strict";
import test from "node:test";
import { decodeCursor, encodeCursor, isPubliclyVisible } from "../src/listingUtils";

test("cursor encode/decode roundtrip works", () => {
  const cursor = encodeCursor(10);
  assert.equal(decodeCursor(cursor), 10);
});

test("invalid cursor safely returns zero", () => {
  assert.equal(decodeCursor("bad-cursor"), 0);
});

test("visibility rules block draft and banned", () => {
  assert.equal(isPubliclyVisible("active"), true);
  assert.equal(isPubliclyVisible("draft"), false);
  assert.equal(isPubliclyVisible("banned"), false);
});
