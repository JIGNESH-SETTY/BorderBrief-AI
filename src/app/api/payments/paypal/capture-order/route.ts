/**
 * BorderBrief AI — Capture PayPal Sandbox Order API Route (Sprint 6)
 * POST /api/payments/paypal/capture-order
 *
 * Responsibilities:
 * 1. Validate PayPal order ID and payload.
 * 2. Retrieve corresponding local payment record from SQLite.
 * 3. Prevent duplicate capture of already completed or failed orders.
 * 4. Execute server-side capture via official PayPal Orders API v2.
 * 5. Verify capture response: confirm final status is COMPLETED.
 * 6. Strictly verify captured amount and currency match the saved invoice.
 * 7. Atomically persist verified payment status and update invoice to PAID.
 * 8. Return verified payment receipt.
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  getPaymentByOrderId,
  getInvoice,
  updatePaymentStatus,
} from "../../../../../lib/db/database.ts";
import {
  capturePayPalOrder,
  isPayPalConfigured,
  areAmountsEqual,
  PayPalError,
} from "../../../../../lib/paypal/paypal-client.ts";

export async function POST(req: NextRequest) {
  let body: { orderId?: string; invoiceId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request payload. Expected JSON body.",
        code: "INVALID_JSON",
        statusCode: 400,
      },
      { status: 400 }
    );
  }

  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json(
      {
        error: "Missing mandatory parameter: orderId.",
        code: "MISSING_ORDER_ID",
        statusCode: 400,
      },
      { status: 400 }
    );
  }

  // Enforce idempotency: use client header or derive deterministic key per PayPal order
  const idempotencyKey = req.headers.get("x-idempotency-key") || `cap_order_${orderId}`;

  try {

    // 1. Retrieve local payment record
    const payment = getPaymentByOrderId(orderId);
    if (!payment) {
      return NextResponse.json(
        {
          error: `No local payment record found associated with PayPal Order ID: "${orderId}".`,
          code: "PAYMENT_RECORD_NOT_FOUND",
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // 2. Prevent duplicate capture
    if (payment.status === "COMPLETED") {
      return NextResponse.json(
        {
          error: `PayPal Order "${orderId}" has already been captured and completed.`,
          code: "ORDER_ALREADY_CAPTURED",
          statusCode: 409,
          captureId: payment.paypalCaptureId,
          status: "COMPLETED",
        },
        { status: 409 }
      );
    }

    // 3. Retrieve saved invoice for financial verification
    const invoice = getInvoice(payment.invoiceId);
    if (!invoice) {
      return NextResponse.json(
        {
          error: `Associated commercial invoice "${payment.invoiceId}" not found.`,
          code: "ASSOCIATED_INVOICE_NOT_FOUND",
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // 4. Check configuration
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        {
          error: "PayPal Sandbox credentials are not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to environment variables.",
          code: "PAYPAL_NOT_CONFIGURED",
          statusCode: 503,
        },
        { status: 503 }
      );
    }

    // 5. Execute server-side capture via PayPal Orders API v2
    const captureResult = await capturePayPalOrder(orderId, idempotencyKey);

    // 6. Strict financial verification: Amount and Currency must match saved invoice
    const expectedAmount = Number(invoice.invoiceTotalUSD.toFixed(2));
    const capturedAmount = Number(captureResult.amount.toFixed(2));
    const expectedCurrency = (invoice.currency || "USD").toUpperCase();
    const capturedCurrency = captureResult.currency.toUpperCase();

    if (capturedCurrency !== expectedCurrency) {
      updatePaymentStatus(
        payment.id,
        "FAILED",
        captureResult.captureId,
        captureResult.payerEmail,
        captureResult.payerName,
        {
          error: "CURRENCY_MISMATCH",
          expectedCurrency,
          capturedCurrency,
          rawCapture: captureResult.rawResponse,
        }
      );

      return NextResponse.json(
        {
          error: `Payment currency mismatch. Expected ${expectedCurrency}, but received ${capturedCurrency}.`,
          code: "CAPTURE_CURRENCY_MISMATCH",
          statusCode: 422,
        },
        { status: 422 }
      );
    }

    // Tolerating fractional epsilon for currency comparisons (0.01)
    if (!areAmountsEqual(capturedAmount, invoice.invoiceTotalUSD, invoice.currency)) {
      updatePaymentStatus(
        payment.id,
        "FAILED",
        captureResult.captureId,
        captureResult.payerEmail,
        captureResult.payerName,
        {
          error: "AMOUNT_MISMATCH",
          expectedAmount,
          capturedAmount,
          rawCapture: captureResult.rawResponse,
        }
      );

      return NextResponse.json(
        {
          error: `Payment amount mismatch. Expected $${expectedAmount.toFixed(2)}, but received $${capturedAmount.toFixed(2)}.`,
          code: "CAPTURE_AMOUNT_MISMATCH",
          statusCode: 422,
        },
        { status: 422 }
      );
    }

    // 7. Verify capture status
    if (captureResult.status !== "COMPLETED") {
      const interimStatus = captureResult.status === "PENDING" ? "CAPTURE_PENDING" : "FAILED";
      updatePaymentStatus(
        payment.id,
        interimStatus,
        captureResult.captureId,
        captureResult.payerEmail,
        captureResult.payerName,
        { rawCapture: captureResult.rawResponse }
      );

      return NextResponse.json(
        {
          error: `PayPal payment is not completed. Current status: ${captureResult.status}.`,
          code: `CAPTURE_${captureResult.status}`,
          statusCode: 402,
          captureId: captureResult.captureId,
          status: interimStatus,
        },
        { status: 402 }
      );
    }

    // 8. Atomically update payment record to COMPLETED and invoice to PAID
    // Recoverable Reconciliation Guard: if database write fails after PayPal successfully debited the buyer,
    // ensure the transaction does not silently disappear and provide structured reconciliation details.
    let updatedPayment;
    try {
      updatedPayment = updatePaymentStatus(
        payment.id,
        "COMPLETED",
        captureResult.captureId,
        captureResult.payerEmail,
        captureResult.payerName,
        { rawCapture: captureResult.rawResponse }
      );
    } catch (dbErr: unknown) {
      const dbMsg = dbErr instanceof Error ? dbErr.message : "Database write error";
      return NextResponse.json(
        {
          error: `Payment was successfully captured by PayPal (Capture ID: ${captureResult.captureId}), but local database update failed (${dbMsg}). Reconciliation is required.`,
          code: "CAPTURE_RECONCILIATION_REQUIRED",
          statusCode: 500,
          paypalOrderId: orderId,
          captureId: captureResult.captureId,
          amount: captureResult.amount,
          currency: captureResult.currency,
          reconciliationRequired: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        paymentId: updatedPayment?.id || payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paypalOrderId: orderId,
        captureId: captureResult.captureId,
        status: "COMPLETED",
        amount: captureResult.amount,
        currency: captureResult.currency,
        payerEmail: captureResult.payerEmail,
        payerName: captureResult.payerName,
        capturedAt: captureResult.capturedAt,
        environment: "sandbox",
        disclaimer:
          "PAYPAL SANDBOX PAYMENT VERIFIED. Estimated US import duties and customs fees are assessed separately under US customs law upon arrival and are NOT collected through this payment.",
      },
      {
        status: 200,
        headers: {
          "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
          "X-Privacy-Notice": "BorderBrief AI operates as a single-user demo workflow. Multi-user tenant authentication is not configured.",
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof PayPalError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          statusCode: err.statusCode,
          details: err.details,
        },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Internal error capturing PayPal Sandbox order";
    return NextResponse.json(
      {
        error: message,
        code: "ORDER_CAPTURE_FAILED",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
