import assert from "node:assert/strict";
import test from "node:test";
import { validateSearchRuntime } from "../src/runtimeConfig";

test("allows development without elasticsearch", () => {
  assert.doesNotThrow(() => validateSearchRuntime("development", undefined, false));
});

test("blocks production without elasticsearch unless fallback explicitly enabled", () => {
  assert.throws(() => validateSearchRuntime("production", undefined, false), /Production mode requires ELASTICSEARCH_URL/);
});

test("allows production with elasticsearch url", () => {
  assert.doesNotThrow(() => validateSearchRuntime("production", "http://localhost:9200", false));
});
