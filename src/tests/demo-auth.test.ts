import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDemoToken,
  verifyPasscode,
  verifySessionToken,
  isDemoMutationRestricted,
  DEMO_COOKIE_NAME,
  DEMO_EXEMPT_ROUTES,
} from "../lib/security/demo-auth.ts";

describe("Sprint 8: Demo Security & Gatekeeper", () => {
  it("enforces strict webhook exemption for unauthenticated PayPal callbacks", () => {
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/api/payments/paypal/webhook"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/demo-login"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/api/demo/auth"));
    assert.equal(DEMO_COOKIE_NAME, "bb_demo_session");
  });

  it("verifies passcode correctly when configured", () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    try {
      process.env.DEMO_ACCESS_SECRET = "HackathonEvaluator2026";
      assert.equal(verifyPasscode("HackathonEvaluator2026"), true);
      assert.equal(verifyPasscode("WrongPasscode"), false);
      assert.equal(verifyPasscode(""), false);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
    }
  });

  it("permits access when DEMO_ACCESS_SECRET is unconfigured (open local dev mode)", async () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    try {
      delete process.env.DEMO_ACCESS_SECRET;
      assert.equal(verifyPasscode("any-password"), true);
      assert.equal(await verifySessionToken(undefined), true);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
    }
  });

  it("generates deterministic tokens that verify cleanly", async () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    try {
      process.env.DEMO_ACCESS_SECRET = "SuperSecretKey999";
      const token = await computeDemoToken(process.env.DEMO_ACCESS_SECRET);
      assert.ok(token);
      assert.equal(typeof token, "string");
      assert.equal(token.length, 64); // SHA-256 hex length

      const isValid = await verifySessionToken(token);
      assert.equal(isValid, true);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
    }
  });

  it("rejects tampered or forged session tokens", async () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    try {
      process.env.DEMO_ACCESS_SECRET = "SuperSecretKey999";
      const token = await computeDemoToken(process.env.DEMO_ACCESS_SECRET);
      const tampered = token.slice(0, -4) + "abcd";

      assert.equal(await verifySessionToken(tampered), false);
      assert.equal(await verifySessionToken("invalid-format"), false);
      assert.equal(await verifySessionToken(""), false);
      assert.equal(await verifySessionToken(undefined), false);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
    }
  });

  it("enforces demo mutation restrictions when secret or production is active", () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.DEMO_ACCESS_SECRET = "evaluator123";
      assert.equal(isDemoMutationRestricted(), true);

      delete process.env.DEMO_ACCESS_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      assert.equal(isDemoMutationRestricted(), true);

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      assert.equal(isDemoMutationRestricted(), false);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});
