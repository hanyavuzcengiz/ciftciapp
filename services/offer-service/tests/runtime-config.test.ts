import assert from "node:assert/strict";
import test from "node:test";
import { validateOfferRuntime } from "../src/runtimeConfig";

test("allows development without postgres", () => {
  assert.doesNotThrow(() => validateOfferRuntime("development", false));
});

test("blocks production without postgres", () => {
  assert.throws(() => validateOfferRuntime("production", false), /requires Postgres configuration/);
});

test("allows production when postgres configured", () => {
  assert.doesNotThrow(() => validateOfferRuntime("production", true));
});
