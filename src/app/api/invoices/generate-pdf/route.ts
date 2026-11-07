/**
 * BorderBrief AI — Direct Commercial Invoice PDF Generation Endpoint (Sprint 5)
 * POST /api/invoices/generate-pdf
 *
 * Accepts either a CommercialInvoiceDraft or CreateInvoiceRequest,
 * builds the draft if needed, and streams a binary PDF 1.4 document.
 */

import { NextRequest, NextResponse } from "next/server.js";
import { buildCommercialInvoice } from "../../../../lib/invoice/invoice-engine.ts";
import { generateCommercialInvoicePdf } from "../../../../lib/invoice/pdf-generator.ts";
import type { CommercialInvoiceDraft, CreateInvoiceRequest } from "../../../../types/invoice.ts";

export async function POST(req: NextRequest) {
  try {
    let json: Record<string, unknown> = {};
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body.", code: "INVALID_JSON", statusCode: 400 },
        { status: 400 }
      );
    }

    if (!json || typeof json !== "object" || !json.seller || !json.buyer) {
      return NextResponse.json(
        { error: "Payload must include seller and buyer information.", code: "MISSING_MANDATORY_PAYLOAD", statusCode: 400 },
        { status: 400 }
      );
    }

    let invoice: CommercialInvoiceDraft;
    // Check if body is already a built CommercialInvoiceDraft
    if (json.invoiceNumber && json.seller && json.buyer && Array.isArray(json.items) && json.status === "DRAFT") {
      invoice = json as unknown as CommercialInvoiceDraft;
    } else {
      invoice = buildCommercialInvoice(json as unknown as CreateInvoiceRequest);
    }

    const pdfBuffer = generateCommercialInvoicePdf(invoice);
    const filename = `${invoice.invoiceNumber || "draft-invoice"}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
        "X-Privacy-Notice": "BorderBrief AI operates as a single-user demo workflow. Multi-user tenant authentication is not configured.",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF document.";
    return NextResponse.json(
      { error: message, code: "PDF_GENERATION_FAILED", statusCode: 500 },
      { status: 500 }
    );
  }
}
