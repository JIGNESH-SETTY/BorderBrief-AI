/**
 * BorderBrief AI — Create PayPal Sandbox Order API Route (Sprint 6)
 * POST /api/payments/paypal/create-order
 *
 * Responsibilities:
 * 1. Validate invoice ID and payload.
 * 2. Retrieve confirmed commercial invoice from SQLite database.
 * 3. Validate invoice status and financial amounts.
 * 4. Confirm invoice is eligible for payment (not already PAID).
 * 5. Create PayPal Sandbox order via official Orders API v2.
 * 6. Store pending payment record in SQLite.
 * 7. Support idempotency keys to prevent duplicate orders.
 * 8. Return required checkout details.
 */

import { NextRequest, NextResponse } from "next/server.js";
import { getInvoice, savePayment, getPaymentByOrderId } from "../../../../../lib/db/database.ts";
import { createPayPalOrder, isPayPalConfigured, PayPalError } from "../../../../../lib/paypal/paypal-client.ts";
import {
  getIdempotencyRecord,
  startIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from "../../../../../lib/services/idempotency.ts";
import type { PaymentRecord } from "../../../../../types/payment.ts";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("x-idempotency-key") || "";

  // 1. Idempotency Check
  if (idempotencyKey) {
    const existing = await getIdempotencyRecord(idempotencyKey);
    if (existing && existing.status === "COMPLETED" && existing.responseJson) {
      try {
        const cached = JSON.parse(existing.responseJson);
        return NextResponse.json(cached, {
          status: 200,
          headers: {
            "X-Idempotency-Cached": "true",
            "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
          },
        });
      } catch {
        // Fallback
      }
    }
  }

  try {
    let body: { invoiceId?: string } = {};
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

    const invoiceId = body.invoiceId?.trim();
    if (!invoiceId) {
      return NextResponse.json(
        {
          error: "Missing mandatory parameter: invoiceId.",
          code: "MISSING_INVOICE_ID",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // 2. Retrieve invoice from SQLite / Turso
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return NextResponse.json(
        {
          error: `Commercial invoice with ID "${invoiceId}" not found in local database. Save the draft invoice first before starting checkout.`,
          code: "INVOICE_NOT_FOUND",
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // 3. Validate invoice eligibility
    if (invoice.status === "PAID") {
      return NextResponse.json(
        {
          error: "This commercial invoice has already been paid.",
          code: "INVOICE_ALREADY_PAID",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (!invoice.invoiceTotalUSD || invoice.invoiceTotalUSD <= 0) {
      return NextResponse.json(
        {
          error: "Commercial invoice total must be greater than zero.",
          code: "INVALID_INVOICE_AMOUNT",
          statusCode: 400,
        },
        { status: 400 }
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

    if (idempotencyKey) {
      await startIdempotentRequest(idempotencyKey, req.nextUrl.pathname);
    }

    // 5. Create PayPal Sandbox Order
    const orderResult = await createPayPalOrder(invoice, idempotencyKey || undefined);

    // 6. Store local payment record in SQLite / Turso
    const paymentId = `pay_${randomUUID()}`;
    const now = new Date().toISOString();

    const paymentRecord: PaymentRecord = {
      id: paymentId,
      invoiceId: invoice.id,
      paypalOrderId: orderResult.orderId,
      amount: invoice.invoiceTotalUSD,
      currency: invoice.currency || "USD",
      status: "CREATED",
      isSandbox: true,
      createdAt: now,
      updatedAt: now,
      paymentData: {
        invoiceNumber: invoice.invoiceNumber,
        subtotalUSD: invoice.subtotalUSD,
        shippingCostUSD: invoice.shippingCostUSD,
        insuranceCostUSD: invoice.insuranceCostUSD,
        rawOrderResponse: orderResult.rawResponse,
      },
    };

    await savePayment(paymentRecord);

    const responsePayload = {
      orderId: orderResult.orderId,
      paymentId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.invoiceTotalUSD,
      currency: invoice.currency || "USD",
      status: "CREATED",
      approveUrl: orderResult.approveUrl,
      environment: "sandbox",
      notice: "Estimated US import duties and customs charges are not collected through this PayPal payment.",
    };

    if (idempotencyKey) {
      await completeIdempotentRequest(idempotencyKey, responsePayload);
    }

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
        "X-Privacy-Notice": "BorderBrief AI operates as a single-user demo workflow. Multi-user tenant authentication is not configured.",
      },
    });
  } catch (err: unknown) {
    if (idempotencyKey) {
      await failIdempotentRequest(idempotencyKey);
    }

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

    const message = err instanceof Error ? err.message : "Internal error creating PayPal Sandbox order";
    return NextResponse.json(
      {
        error: message,
        code: "ORDER_CREATION_FAILED",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
