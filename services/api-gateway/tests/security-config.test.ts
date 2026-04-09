import assert from "node:assert/strict";
import test from "node:test";
import { resolveSecurityEnv } from "../src/securityConfig";

test("uses safe dev defaults outside production", () => {
  const cfg = resolveSecurityEnv("development", {});
  assert.equal(cfg.jwtSecret, "dev-secret");
  assert.equal(cfg.adminApiKey, "dev-admin-key");
  assert.equal(cfg.requestSigningSecret, "dev-secret");
});

test("requires non-dev secrets in production", () => {
  assert.throws(
    () =>
      resolveSecurityEnv("production", {
        JWT_SECRET: "dev-secret",
        ADMIN_API_KEY: "dev-admin-key",
        REQUEST_SIGNING_SECRET: "dev-secret"
      }),
    /Insecure/
  );
});

test("accepts explicit secure production config", () => {
  const cfg = resolveSecurityEnv("production", {
    JWT_SECRET: "super-strong-secret",
    ADMIN_API_KEY: "admin-key-prod-123",
    REQUEST_SIGNING_SECRET: "hmac-secret-prod"
  });
  assert.equal(cfg.jwtSecret, "super-strong-secret");
  assert.equal(cfg.adminApiKey, "admin-key-prod-123");
  assert.equal(cfg.requestSigningSecret, "hmac-secret-prod");
});
