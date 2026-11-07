/**
 * BorderBrief AI — PayPal Client SDK Configuration API Route (Sprint 6)
 * GET /api/payments/paypal/config
 *
 * Exposes ONLY safe public client parameters for initializing the PayPal JavaScript SDK in the browser.
 * NEVER exposes client secret, webhook secrets, or private tokens.
 */

import { NextResponse } from "next/server.js";
import { isPayPalConfigured } from "../../../../../lib/paypal/paypal-client.ts";
import type { PayPalConfigResponse } from "../../../../../types/payment.ts";

export async function GET() {
  const isConfigured = isPayPalConfigured();
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;

  const payload: PayPalConfigResponse = {
    clientId: isConfigured ? clientId : null,
    environment: "sandbox",
    isConfigured,
    currency: "USD",
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
    },
  });
}
