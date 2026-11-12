import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDemoToken,
  verifyPasscode,
  verifySessionToken,
  isDemoMutationRestricted,
  DEMO_COOKIE_NAME,
  DEMO_EXEMPT_ROUTES,
  sanitizeReturnTo,
} from "../lib/security/demo-auth.ts";

describe("Sprint 8: Demo Security & Gatekeeper", () => {
  it("enforces strict webhook exemption for unauthenticated PayPal callbacks and public routes", () => {
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/api/payments/paypal/webhook"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/demo-login"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/api/demo/auth"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/"));
    assert.ok(DEMO_EXEMPT_ROUTES.includes("/corridor/india-usa"));
    assert.equal(DEMO_COOKIE_NAME, "bb_demo_session");
  });

  it("verifies guest session tokens for 'Continue without signing in' demo access", async () => {
    const originalSecret = process.env.DEMO_ACCESS_SECRET;
    try {
      process.env.DEMO_ACCESS_SECRET = "ProductionHackathonSecret2026";
      const guestToken = await computeDemoToken("guest:" + process.env.DEMO_ACCESS_SECRET);
      assert.equal(await verifySessionToken(guestToken), true);

      const openToken = await computeDemoToken("open-demo-session");
      assert.equal(await verifySessionToken(openToken), true);
    } finally {
      process.env.DEMO_ACCESS_SECRET = originalSecret;
    }
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

  describe("sanitizeReturnTo — Open Redirect Prevention", () => {
    it("permits safe, legitimate internal application paths", () => {
      assert.equal(sanitizeReturnTo("/"), "/");
      assert.equal(sanitizeReturnTo("/invoices"), "/invoices");
      assert.equal(sanitizeReturnTo("/export/new"), "/export/new");
      assert.equal(sanitizeReturnTo("/corridor/india-usa"), "/corridor/india-usa");
      assert.equal(sanitizeReturnTo("/invoices?page=2"), "/invoices?page=2");
      assert.equal(
        sanitizeReturnTo("/invoices?id=INV-2026-001&tab=details"),
        "/invoices?id=INV-2026-001&tab=details"
      );
      assert.equal(sanitizeReturnTo("/invoices#summary"), "/invoices#summary");
      assert.equal(sanitizeReturnTo("  /invoices  "), "/invoices");
    });

    it("rejects absolute external URLs and falls back to root", () => {
      assert.equal(sanitizeReturnTo("https://evil.com"), "/");
      assert.equal(sanitizeReturnTo("http://evil.com"), "/");
      assert.equal(sanitizeReturnTo("https://evil.com/phishing/login"), "/");
      assert.equal(sanitizeReturnTo("http://localhost:3000/bypass"), "/");
      assert.equal(sanitizeReturnTo("ftp://malicious.org/payload"), "/");
    });

    it("rejects protocol-relative URLs and falls back to root", () => {
      assert.equal(sanitizeReturnTo("//evil.com"), "/");
      assert.equal(sanitizeReturnTo("//evil.com/path"), "/");
      assert.equal(sanitizeReturnTo("///evil.com"), "/");
      assert.equal(sanitizeReturnTo("//localhost"), "/");
    });

    it("rejects backslash bypasses and normalization tricks", () => {
      assert.equal(sanitizeReturnTo("\\evil.com"), "/");
      assert.equal(sanitizeReturnTo("/\\evil.com"), "/");
      assert.equal(sanitizeReturnTo("/\\/evil.com"), "/");
      assert.equal(sanitizeReturnTo("/invoices\\evil.com"), "/");
      assert.equal(sanitizeReturnTo("\\\\evil.com"), "/");
    });

    it("rejects javascript:, data:, and pseudo-protocol injection", () => {
      assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/");
      assert.equal(sanitizeReturnTo("javascript:void(0)"), "/");
      assert.equal(
        sanitizeReturnTo("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="),
        "/"
      );
      assert.equal(sanitizeReturnTo("/javascript:alert(1)"), "/");
      assert.equal(sanitizeReturnTo("/http://evil.com"), "/");
      assert.equal(sanitizeReturnTo("/evil.com:8080"), "/");
    });

    it("rejects unencoded whitespace, control characters, and newlines", () => {
      assert.equal(sanitizeReturnTo("/invoices\n/evil"), "/");
      assert.equal(sanitizeReturnTo("/invoices\r\n"), "/");
      assert.equal(sanitizeReturnTo("/evil com"), "/");
      assert.equal(sanitizeReturnTo("/\t/tabbed"), "/");
    });

    it("falls back to root for null, undefined, empty, or non-string inputs", () => {
      assert.equal(sanitizeReturnTo(null), "/");
      assert.equal(sanitizeReturnTo(undefined), "/");
      assert.equal(sanitizeReturnTo(""), "/");
      assert.equal(sanitizeReturnTo("     "), "/");
      assert.equal(sanitizeReturnTo(123 as unknown as string), "/");
      assert.equal(sanitizeReturnTo({} as unknown as string), "/");
    });
  });
});
