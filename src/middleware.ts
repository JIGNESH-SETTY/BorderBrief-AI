/**
 * BorderBrief AI — Next.js Edge Middleware (Sprint 8)
 *
 * Implements demo access protection:
 * 1. Checks for DEMO_ACCESS_SECRET. If unset, permits all traffic.
 * 2. CRITICAL EXEMPTION: Strictly permits PayPal webhook requests at
 *    `/api/payments/paypal/webhook` without requiring demo session cookies.
 * 3. Exempts demo authentication routes and static assets.
 * 4. Rejects unauthenticated API calls with HTTP 401.
 * 5. Redirects unauthenticated web visitors to `/demo-login`.
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  isDemoGateActive,
  verifySessionToken,
  DEMO_COOKIE_NAME,
  sanitizeReturnTo,
} from "./lib/security/demo-auth.ts";

export async function middleware(req: NextRequest) {
  if (!isDemoGateActive()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // 1. MANDATORY EXEMPTION: PayPal Webhook (server-to-server webhook callback)
  if (pathname === "/api/payments/paypal/webhook") {
    return NextResponse.next();
  }

  // 2. EXEMPTION: Public landing pages, corridor guide, demo login page and demo auth API
  if (
    pathname === "/" ||
    pathname === "/corridor/india-usa" ||
    pathname === "/demo-login" ||
    pathname === "/api/demo/auth"
  ) {
    return NextResponse.next();
  }

  // 3. EXEMPTION: Next.js system internals and static media
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|webp)$/)
  ) {
    return NextResponse.next();
  }

  // 4. Validate session cookie or header
  const sessionToken = req.cookies.get(DEMO_COOKIE_NAME)?.value;
  const headerKey = req.headers.get("x-demo-access-key");

  const isSessionValid = await verifySessionToken(sessionToken);
  const isHeaderValid = Boolean(headerKey) && headerKey === process.env.DEMO_ACCESS_SECRET;

  if (isSessionValid || isHeaderValid) {
    return NextResponse.next();
  }

  // 5. Unauthenticated: API routes return 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Access to this demonstration API requires a valid demo passcode session. Please unlock at /demo-login or provide x-demo-access-key header.",
        code: "DEMO_ACCESS_REQUIRED",
      },
      { status: 401 }
    );
  }

  // 6. Unauthenticated: Browser visits redirect to /demo-login
  const loginUrl = new URL("/demo-login", req.url);
  loginUrl.searchParams.set("returnTo", sanitizeReturnTo(pathname));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
