/**
 * BorderBrief AI — Payment Status Retrieval API Route (Sprint 6)
 * GET /api/payments/[id]
 *
 * Responsibilities:
 * 1. Validate payment identifier (supports internal payment ID or PayPal Order ID).
 * 2. Retrieve payment record from SQLite database.
 * 3. Return sanitized transaction status and audit details.
 * 4. Never leak PayPal secrets, access tokens, or sensitive credentials.
 */

import { NextRequest, NextResponse } from "next/server.js";
import { getPayment, getPaymentByOrderId, getPaymentByInvoiceId } from "../../../../lib/db/database.ts";

const ID_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;

function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const id = rawId?.trim();

    if (!id || !ID_REGEX.test(id)) {
      return NextResponse.json(
        {
          error: "Invalid payment identifier. ID must be alphanumeric and up to 64 characters.",
          code: "INVALID_PAYMENT_ID",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Lookup by internal payment ID, PayPal Order ID, or linked invoice ID
    const payment = getPayment(id) || getPaymentByOrderId(id) || getPaymentByInvoiceId(id);

    if (!payment) {
      return NextResponse.json(
        {
          error: `Payment record "${id}" not found.`,
          code: "PAYMENT_NOT_FOUND",
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // Return sanitized public receipt with masked PII
    const responsePayload = {
      id: payment.id,
      invoiceId: payment.invoiceId,
      paypalOrderId: payment.paypalOrderId,
      paypalCaptureId: payment.paypalCaptureId || null,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      isSandbox: payment.isSandbox,
      payerEmail: maskEmail(payment.payerEmail),
      captureTime: payment.captureTime || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      demoNotice: "BorderBrief AI operates as a single-user unauthenticated demo. Multi-user tenant isolation is not configured. This endpoint is not an authorization boundary.",
      disclaimer: "PAYPAL SANDBOX PAYMENT RECORD. Import duties and taxes are excluded.",
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
        "X-Privacy-Notice": "BorderBrief AI operates as a single-user demo workflow. Multi-user tenant authentication is not configured.",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve payment record";
    return NextResponse.json(
      {
        error: message,
        code: "PAYMENT_RETRIEVAL_FAILED",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
