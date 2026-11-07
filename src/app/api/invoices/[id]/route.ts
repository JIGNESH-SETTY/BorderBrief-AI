/**
 * BorderBrief AI — Commercial Invoice Item Route (Sprint 5)
 * GET /api/invoices/[id] — Retrieve invoice by ID or invoiceNumber
 * DELETE /api/invoices/[id] — Delete invoice draft
 */

import { NextRequest, NextResponse } from "next/server.js";
import { getInvoice, getInvoiceByNumber, deleteInvoice } from "../../../../lib/db/database.ts";

const AUTH_HEADERS = {
  "X-BorderBrief-Auth-Mode": "single-user-demo-unauthenticated",
  "X-Privacy-Notice": "BorderBrief AI operates as a single-user demo workflow. Multi-user tenant authentication is not configured.",
};

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
        { status: 400, headers: AUTH_HEADERS }
      );
    }

    let invoice = getInvoice(id);
    if (!invoice) {
      invoice = getInvoiceByNumber(id);
    }

    if (!invoice) {
      return NextResponse.json(
        {
          error: `Commercial invoice draft "${id}" was not found.`,
          code: "INVOICE_NOT_FOUND",
          statusCode: 404,
        },
        { status: 404, headers: AUTH_HEADERS }
      );
    }

    return NextResponse.json(invoice, { status: 200, headers: AUTH_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load invoice draft.";
    return NextResponse.json(
      { error: message, code: "DATABASE_ERROR", statusCode: 500 },
      { status: 500, headers: AUTH_HEADERS }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string" || !ID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid or missing invoice ID parameter.", code: "INVALID_ID_FORMAT", statusCode: 400 },
        { status: 400, headers: AUTH_HEADERS }
      );
    }

    const deleted = deleteInvoice(id);
    if (!deleted) {
      return NextResponse.json(
        { error: `Invoice "${id}" could not be deleted or does not exist.`, code: "NOT_FOUND", statusCode: 404 },
        { status: 404, headers: AUTH_HEADERS }
      );
    }
    return NextResponse.json({ success: true, id }, { status: 200, headers: AUTH_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete invoice.";
    return NextResponse.json(
      { error: message, code: "DATABASE_ERROR", statusCode: 500 },
      { status: 500, headers: AUTH_HEADERS }
    );
  }
}

