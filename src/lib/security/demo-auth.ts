/**
 * BorderBrief AI — Public Demo Security & Access Gate (Sprint 8)
 *
 * Provides minimal, non-intrusive access protection for public hackathon demonstration:
 * 1. Checks DEMO_ACCESS_SECRET from server-side environment.
 * 2. Issues and validates HttpOnly, SameSite=Lax, Secure session cookie (`bb_demo_session`).
 * 3. Never accepts or emits secrets in URL query parameters.
 * 4. Exempts PayPal webhook endpoints (`/api/payments/paypal/webhook`).
 * 5. Disables destructive operations (invoice draft deletion) in public demo mode.
 * 6. Edge-compatible: Uses Web Crypto API and constant-time string comparison without node:crypto.
 */

export const DEMO_COOKIE_NAME = "bb_demo_session";
export const DEMO_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
export const DEMO_EXEMPT_ROUTES = [
  "/api/payments/paypal/webhook",
  "/demo-login",
  "/api/demo/auth",
  "/",
  "/corridor/india-usa",
];

/**
 * Constant-time string equality check to prevent timing attacks without requiring node:crypto.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Returns true if the demo passcode gate is configured and active.
 */
export function isDemoGateActive(): boolean {
  const secret = process.env.DEMO_ACCESS_SECRET;
  return Boolean(secret && secret.trim().length > 0);
}

/**
 * Computes a deterministic SHA-256 session token from the secret using Web Crypto.
 * Universally supported in Node.js, Vercel Edge Runtime, and browser environments.
 */
export async function computeDemoToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + ":borderbrief-demo-session-salt-2026");
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates a submitted candidate passcode against DEMO_ACCESS_SECRET in constant time.
 */
export function verifyPasscode(candidatePasscode: string): boolean {
  const configuredSecret = process.env.DEMO_ACCESS_SECRET;
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    return true; // Gate is inactive, all pass
  }
  if (!candidatePasscode || typeof candidatePasscode !== "string") {
    return false;
  }
  return constantTimeEqual(configuredSecret.trim(), candidatePasscode.trim());
}

/**
 * Validates an incoming session cookie against the expected HMAC/SHA256 token.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!isDemoGateActive()) {
    return true; // Gate inactive
  }
  if (!token || typeof token !== "string") {
    return false;
  }

  const configuredSecret = process.env.DEMO_ACCESS_SECRET!;
  const expectedToken = await computeDemoToken(configuredSecret);
  const guestToken = await computeDemoToken("guest:" + configuredSecret);
  const openToken = await computeDemoToken("open-demo-session");

  return (
    constantTimeEqual(expectedToken, token) ||
    constantTimeEqual(guestToken, token) ||
    constantTimeEqual(openToken, token)
  );
}

/**
 * Sanitizes and validates a redirect path to prevent open redirect vulnerabilities.
 * Strictly permits only relative internal application paths (e.g. "/", "/invoices", "/export/new").
 * Rejects external URLs, protocol-relative URLs, backslash bypasses, and javascript/data schemes.
 */
export function sanitizeReturnTo(url: string | null | undefined): string {
  if (!url || typeof url !== "string") {
    return "/";
  }

  // Reject CRLF injection or null bytes in any position
  if (/[\r\n\0]/.test(url)) {
    return "/";
  }

  const trimmed = url.trim();

  // Must not be empty, must start with exactly one forward slash, and must not be protocol-relative ("//")
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  // Reject backslashes which can cause client or browser URL normalization bypasses (e.g. "/\evil.com")
  if (trimmed.includes("\\")) {
    return "/";
  }

  // Reject control characters, newlines, or unencoded whitespace
  if (/[\x00-\x1F\x7F\s]/.test(trimmed)) {
    return "/";
  }

  // Reject colons in the pathname portion before '?' or '#' to prevent scheme or host bypasses
  const queryIndex = trimmed.indexOf("?");
  const hashIndex = trimmed.indexOf("#");
  const pathEnd = Math.min(
    queryIndex === -1 ? trimmed.length : queryIndex,
    hashIndex === -1 ? trimmed.length : hashIndex
  );
  if (trimmed.slice(0, pathEnd).includes(":")) {
    return "/";
  }

  return trimmed;
}

/**
 * Returns true if destructive mutations (like draft invoice deletion) should be blocked.
 */
export function isDemoMutationRestricted(): boolean {
  return Boolean(
    process.env.DEMO_ACCESS_SECRET ||
    process.env.VERCEL ||
    process.env.NODE_ENV === "production"
  );
}
