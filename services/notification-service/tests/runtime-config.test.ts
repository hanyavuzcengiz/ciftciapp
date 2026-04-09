import assert from "node:assert/strict";
import test from "node:test";
import { validateNotificationRuntime } from "../src/runtimeConfig";

test("allows development without postgres", () => {
  assert.doesNotThrow(() => validateNotificationRuntime("development", false));
});

test("blocks production without postgres", () => {
  assert.throws(() => validateNotificationRuntime("production", false), /requires Postgres configuration/);
});

test("allows production when postgres configured", () => {
  assert.doesNotThrow(() => validateNotificationRuntime("production", true));
});
