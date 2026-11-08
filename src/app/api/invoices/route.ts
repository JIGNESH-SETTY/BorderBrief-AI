/**
 * BorderBrief AI — Commercial Invoice API Route (Sprint 5)
 * POST /api/invoices — Create and validate a draft commercial invoice
 * GET /api/invoices — List saved commercial invoice drafts
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  buildCommercialInvoice,
  auditInvoiceCompleteness,
} from "../../../lib/invoice/invoice-engine.ts";
import { saveInvoice, listInvoices, getPaymentByInvoiceId } from "../../../lib/db/database.ts";
import {
  getIdempotencyRecord,
  startIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from "../../../lib/services/idempotency.ts";
import type { CreateInvoiceRequest } from "../../../types/invoice.ts";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("x-idempotency-key") || "";

  if (idempotencyKey) {
    const existing = await getIdempotencyRecord(idempotencyKey);
    if (existing && existing.status === "COMPLETED" && existing.responseJson) {
      try {
        const cached = JSON.parse(existing.responseJson);
        return NextResponse.json(cached, {
          status: 200,
          headers: { "X-Idempotency-Cached": "true" },
        });
      } catch {
        // Fallback to recalculation
      }
    }
  }

  try {
    let json: Partial<CreateInvoiceRequest> = {};
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "The request body could not be parsed as valid JSON.",
          code: "INVALID_JSON",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Input Validation
    const seller = json.seller || {};
    const buyer = json.buyer || {};
    const items = json.items || [];
    const missing: string[] = [];

    if (!seller.businessName?.trim()) missing.push("Exporter / Seller Business Name");
    if (!seller.address?.trim()) missing.push("Exporter / Seller Address");
    if (!seller.email?.trim()) missing.push("Exporter / Seller Email");
    if (!seller.phone?.trim()) missing.push("Exporter / Seller Phone");

    if (!buyer.name?.trim()) missing.push("Buyer / Consignee Name");
    if (!buyer.address?.trim()) missing.push("Buyer / Consignee Delivery Address");

    // Email format validation
    if (seller.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seller.email.trim())) {
      return NextResponse.json(
        {
          error: "Exporter email must be a valid email address.",
          code: "INVALID_EMAIL_FORMAT",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Shipment numerical validation
    if (json.shipment?.shippingCostUSD !== undefined) {
      const shipCost = Number(json.shipment.shippingCostUSD);
      if (isNaN(shipCost) || shipCost < 0) {
        return NextResponse.json(
          {
            error: "Shipping cost cannot be negative or invalid.",
            code: "INVALID_SHIPPING_COST",
            statusCode: 400,
          },
          { status: 400 }
        );
      }
    }

    if (json.shipment?.insuranceCostUSD !== undefined) {
      const insCost = Number(json.shipment.insuranceCostUSD);
      if (isNaN(insCost) || insCost < 0) {
        return NextResponse.json(
          {
            error: "Insurance cost cannot be negative or invalid.",
            code: "INVALID_INSURANCE_COST",
            statusCode: 400,
          },
          { status: 400 }
        );
      }
    }

    // Date validation
    if (json.shipment?.invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(json.shipment.invoiceDate.trim())) {
      return NextResponse.json(
        {
          error: "Invoice date must follow ISO YYYY-MM-DD format.",
          code: "INVALID_DATE_FORMAT",
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      missing.push("At least one product line item");
    } else {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.description?.trim()) missing.push(`Item ${i + 1}: Description`);
        if (it.quantity === undefined || Number(it.quantity) <= 0) {
          return NextResponse.json(
            {
              error: `Item ${i + 1} quantity must be a positive number greater than 0.`,
              code: "INVALID_QUANTITY",
              statusCode: 400,
            },
            { status: 400 }
          );
        }
        if (it.unitPriceUSD === undefined || Number(it.unitPriceUSD) <= 0) {
          return NextResponse.json(
            {
              error: `Item ${i + 1} unit price must be a positive number greater than 0.`,
              code: "INVALID_PRICE",
              statusCode: 400,
            },
            { status: 400 }
          );
        }
      }
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing mandatory invoice fields: ${missing.join(", ")}`,
          code: "MISSING_MANDATORY_FIELDS",
          statusCode: 400,
          missingFields: missing,
        },
        { status: 400 }
      );
    }

    // Idempotency lock
    if (idempotencyKey) {
      const locked = await startIdempotentRequest(idempotencyKey, "/api/invoices");
      if (!locked) {
        return NextResponse.json(
          {
            error: "A draft generation request with this idempotency key is already in progress.",
            code: "CONCURRENT_REQUEST",
            statusCode: 409,
          },
          { status: 409 }
        );
      }
    }

    // Build deterministic draft
    const invoiceDraft = buildCommercialInvoice(json as CreateInvoiceRequest);

    // Persist invoice draft to SQLite / Turso
    try {
      await saveInvoice(invoiceDraft);
    } catch (dbErr) {
      // In stateless serverless production without persistent volume, log and proceed with generated draft
      console.warn("Invoice database persistence notice:", dbErr);
    }

    // Complete idempotency
    if (idempotencyKey) {
      await completeIdempotentRequest(idempotencyKey, invoiceDraft);
    }

    return NextResponse.json(invoiceDraft, {
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
    const message = err instanceof Error ? err.message : "Failed to process commercial invoice draft.";
    return NextResponse.json(
      {
        error: message,
        code: "INVOICE_GENERATION_FAILED",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const invoices = await listInvoices(limit, offset);
    const enrichedInvoices = await Promise.all(
      invoices.map(async (inv) => {
        const payment = await getPaymentByInvoiceId(inv.id);
        return {
          ...inv,
          payment: payment
            ? {
                id: payment.id,
                paypalOrderId: payment.paypalOrderId,
                paypalCaptureId: payment.paypalCaptureId || null,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                captureTime: payment.captureTime || null,
              }
            : null,
        };
      })
    );

    return NextResponse.json(
      {
        privacyMode: "SINGLE_USER_DEMO_UNAUTHENTICATED",
        notice: "Single-user local workflow. Multi-user tenant authentication is not configured in this environment.",
        invoices: enrichedInvoices,
        count: enrichedInvoices.length,
        limit,
        offset,
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
    const message = err instanceof Error ? err.message : "Failed to retrieve invoices.";
    return NextResponse.json(
      {
        error: message,
        code: "DATABASE_READ_ERROR",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}

