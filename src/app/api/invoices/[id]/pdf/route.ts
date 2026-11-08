/**
 * BorderBrief AI — Commercial Invoice Binary PDF Download Route (Sprint 5)
 * GET /api/invoices/[id]/pdf
 */

import { NextRequest, NextResponse } from "next/server.js";
import { getInvoice, getInvoiceByNumber } from "../../../../../lib/db/database.ts";
import { generateCommercialInvoicePdf } from "../../../../../lib/invoice/pdf-generator.ts";

const ID_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string" || !ID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid or missing invoice ID parameter.", code: "INVALID_ID_FORMAT", statusCode: 400 },
        { status: 400 }
      );
    }

    let invoice = await getInvoice(id);
    if (!invoice) {
      invoice = await getInvoiceByNumber(id);
    }

    if (!invoice) {
      return NextResponse.json(
        { error: `Commercial invoice "${id}" not found.`, code: "NOT_FOUND", statusCode: 404 },
        { status: 404 }
      );
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
    const message = err instanceof Error ? err.message : "Failed to generate commercial invoice PDF.";
    return NextResponse.json(
      { error: message, code: "PDF_GENERATION_FAILED", statusCode: 500 },
      { status: 500 }
    );
  }
}

