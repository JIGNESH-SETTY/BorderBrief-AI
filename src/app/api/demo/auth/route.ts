/**
 * BorderBrief AI — Demo Authentication Route (Sprint 8 Enhanced)
 * POST   /api/demo/auth — Validates passcode or issues 1-click Demo Account / Guest session cookie
 * GET    /api/demo/auth — Returns current demo gate status and authentication state
 * DELETE /api/demo/auth — Clears demo session cookie (Sign out)
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  isDemoGateActive,
  verifyPasscode,
  computeDemoToken,
  DEMO_COOKIE_NAME,
  DEMO_COOKIE_MAX_AGE,
  verifySessionToken,
} from "../../../../lib/security/demo-auth.ts";

export async function GET(req: NextRequest) {
  const active = isDemoGateActive();
  const token = req.cookies.get(DEMO_COOKIE_NAME)?.value;
  const isAuthenticated = !active || (await verifySessionToken(token));

  return NextResponse.json(
    {
      demoGateActive: active,
      authenticated: isAuthenticated,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  let body: { passcode?: string; guest?: boolean; demoAccount?: boolean; isGuest?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const isGuestRequest = Boolean(body.guest || body.demoAccount || body.isGuest);

  // If gate is not configured, grant immediate access and set session cookie
  if (!isDemoGateActive()) {
    const token = await computeDemoToken("open-demo-session");
    const res = NextResponse.json(
      { success: true, message: "Demo gate is open. Full access granted.", isGuest: true },
      { status: 200 }
    );
    res.cookies.set({
      name: DEMO_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_COOKIE_MAX_AGE,
    });
    return res;
  }

  // Handle "Continue without signing in" / Demo Account 1-Click Access
  if (isGuestRequest) {
    const secret = process.env.DEMO_ACCESS_SECRET!;
    const token = await computeDemoToken(secret);

    const res = NextResponse.json(
      {
        success: true,
        message: "Demo account unlocked. Welcome to BorderBrief AI!",
        isGuest: true,
      },
      { status: 200 }
    );

    res.cookies.set({
      name: DEMO_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_COOKIE_MAX_AGE,
    });

    return res;
  }

  // Handle Passcode verification
  const { passcode } = body;
  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json(
      {
        error: "Passcode is required, or click 'Continue without signing in' to view the site as a guest.",
        code: "MISSING_PASSCODE",
      },
      { status: 400 }
    );
  }

  const isValid = verifyPasscode(passcode);
  if (!isValid) {
    return NextResponse.json(
      {
        error: "Incorrect passcode. You can also click 'Continue without signing in' for instant evaluator demo access.",
        code: "INVALID_PASSCODE",
      },
      { status: 401 }
    );
  }

  const secret = process.env.DEMO_ACCESS_SECRET!;
  const token = await computeDemoToken(secret);

  const res = NextResponse.json(
    { success: true, message: "Demo access granted." },
    { status: 200 }
  );

  res.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE,
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json(
    { success: true, message: "Demo session cleared." },
    { status: 200 }
  );

  res.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}
