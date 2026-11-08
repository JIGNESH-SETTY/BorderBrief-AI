/**
 * BorderBrief AI — Demo Authentication Route (Sprint 8)
 * POST /api/demo/auth — Validates demo passcode and sets HttpOnly session cookie
 * GET  /api/demo/auth — Returns current demo gate status
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
  if (!isDemoGateActive()) {
    return NextResponse.json(
      { success: true, message: "Demo gate is not active. Full access permitted." },
      { status: 200 }
    );
  }

  let body: { passcode?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body. Expected { passcode: string }.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { passcode } = body;
  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json(
      { error: "Passcode is required.", code: "MISSING_PASSCODE" },
      { status: 400 }
    );
  }

  const isValid = verifyPasscode(passcode);
  if (!isValid) {
    return NextResponse.json(
      { error: "Incorrect demo passcode. Please contact the project author for evaluator access.", code: "INVALID_PASSCODE" },
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
