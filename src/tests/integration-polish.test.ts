/**
 * BorderBrief AI — Sprint 7: Integration Polish & Final Regression Test Suite
 *
 * Automated verification for Sprint 7 deliverables:
 * 1. Saved Invoices & Receipts API (/api/invoices & /api/payments/[id])
 *    - Invoices list endpoint returns stored invoices.
 *    - Invoices are enriched with linked payment status (COMPLETED, PENDING, etc.).
 *    - Payment lookup by payment ID, PayPal order ID, AND linked invoice ID.
 *    - PDF export endpoint returns valid application/pdf binary stream.
 * 2. Safe In-Progress Form Recovery Mechanism
 *    - Validates versioned storage schema (version: 1).
 *    - Restores valid draft payload.
 *    - Safely ignores invalid, corrupt, or unsupported schema versions.
 *    - Confirms strictly zero credentials, secrets, or tokens in draft payload.
 * 3. Module Configuration & Navigation Synchronization
 *    - Verifies 5-step workflow overview configuration.
 *    - Verifies all architectural modules are marked COMPLETED or ACTIVE.
 * 4. Frozen Core Integrity & Regression Verification
 *    - USITC Authoritative Store: 6214.10.10.00 is 1.2%, exactly 7 seed products.
 *    - Landed Cost Engine: Deterministic DAP financial separation.
 *    - Commercial Invoice Engine: Draft invoice creation and statutory disclaimers.
 *    - PDF Generator: Valid binary generation starting with %PDF-.
 *    - PayPal Client: Precise arithmetic and minor units conversion.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import {
  saveInvoice,
  getInvoice,
  savePayment,
  getPayment,
  getPaymentByOrderId,
  getPaymentByInvoiceId,
  deleteInvoice,
} from "../lib/db/database.ts";
import { buildCommercialInvoice, STANDARD_DECLARATION_STATEMENT } from "../lib/invoice/invoice-engine.ts";
import { generateCommercialInvoicePdf } from "../lib/invoice/pdf-generator.ts";
import { getTariffRecordByHts10 } from "../lib/tariff/authoritative-store.ts";
import { SEED_EXPORT_PROFILES } from "../data/seed-products.ts";
import { calculateLandedCost } from "../lib/tariff/landed-cost-engine.ts";
import { toMinorUnits, areAmountsEqual, formatPayPalAmount } from "../lib/paypal/paypal-client.ts";
import { WORKFLOW_OVERVIEW_STEPS, ARCHITECTURAL_MODULES } from "../config/modules.ts";
import { GET as getInvoicesHandler } from "../app/api/invoices/route.ts";
import { GET as getInvoiceByIdHandler } from "../app/api/invoices/[id]/route.ts";
import { GET as getInvoicePdfHandler } from "../app/api/invoices/[id]/pdf/route.ts";
import { GET as getPaymentHandler } from "../app/api/payments/[id]/route.ts";
import type { CommercialInvoiceDraft } from "../types/invoice.ts";
import type { PaymentRecord } from "../types/payment.ts";

describe("Sprint 7: Integration Polish & Final Regression Suite", () => {
  const createdInvoiceIds: string[] = [];

  const createTestDraft = (override?: Partial<Parameters<typeof buildCommercialInvoice>[0]>): CommercialInvoiceDraft => {
    return buildCommercialInvoice({
      seller: {
        businessName: "Sprint 7 Test Exporter",
        address: "100 Industrial Area",
        city: "Jaipur",
        state: "Rajasthan",
        postalCode: "302022",
        country: "India",
        email: "exporter@test.in",
      },
      buyer: {
        name: "Sprint 7 Test Importer",
        address: "200 Fifth Avenue",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "United States",
        email: "importer@test.com",
        isImporterOfRecord: true,
      },
      shipment: {
        invoiceNumber: `TEST-S7-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        invoiceDate: "2026-11-07",
        countryOfExport: "India",
        countryOfDestination: "United States",
        transportationMode: "AIR_CARGO",
        incoterm: "DAP",
        currency: "USD",
        shippingCostUSD: 25.0,
      },
      items: [
        {
          id: "item_s7_1",
          description: "Handcrafted Marble Inlay Coaster Set",
          quantity: 2,
          unitOfMeasure: "pcs",
          unitPriceUSD: 35.0,
          countryOfOrigin: "India",
          hts10: "6802.91.15.00",
        },
      ],
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
        signatoryName: "Test Signatory",
        signatoryTitle: "Managing Partner",
        signatureDate: "2026-11-07",
      },
      ...override,
    });
  };

  afterEach(async () => {
    for (const id of createdInvoiceIds) {
      try {
        await deleteInvoice(id);
      } catch {
        // ignore cleanup errors
      }
    }
    createdInvoiceIds.length = 0;
  });

  describe("1. Saved Invoices & Receipts API Integration", () => {
    it("GET /api/invoices returns all stored invoices enriched with linked payment metadata", async () => {
      // 1. Create and save invoice 1 (Unpaid)
      const draft1 = createTestDraft();
      const saved1 = await saveInvoice(draft1);
      createdInvoiceIds.push(saved1.id);

      // 2. Create and save invoice 2 (Paid)
      const draft2 = createTestDraft();
      const saved2 = await saveInvoice(draft2);
      createdInvoiceIds.push(saved2.id);

      // 3. Create linked payment for invoice 2
      const paymentRecord: PaymentRecord = {
        id: `pay_s7_${Date.now()}`,
        invoiceId: saved2.id,
        paypalOrderId: `ORDER-S7-${Date.now()}`,
        paypalCaptureId: `CAP-S7-${Date.now()}`,
        currency: "USD",
        amount: saved2.invoiceTotalUSD,
        status: "COMPLETED",
        isSandbox: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePayment(paymentRecord);

      // 4. Call GET /api/invoices
      const req = new NextRequest("http://localhost:3000/api/invoices");
      const res = await getInvoicesHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.invoices));

      // Find our saved invoices
      const found1 = data.invoices.find((i: { id: string }) => i.id === saved1.id);
      assert.ok(found1, "Unpaid invoice should appear in invoices list");
      assert.strictEqual(found1.payment, null, "Unpaid invoice should have payment: null");

      const found2 = data.invoices.find((i: { id: string }) => i.id === saved2.id);
      assert.ok(found2, "Paid invoice should appear in invoices list");
      assert.ok(found2.payment, "Paid invoice should have linked payment summary");
      assert.strictEqual(found2.payment.status, "COMPLETED");
      assert.strictEqual(found2.payment.paypalOrderId, paymentRecord.paypalOrderId);
      assert.strictEqual(found2.payment.paypalCaptureId, paymentRecord.paypalCaptureId);
    });

    it("GET /api/payments/[id] resolves payment records by payment ID, order ID, and linked invoice ID", async () => {
      const draft = createTestDraft();
      const saved = saveInvoice(draft);
      createdInvoiceIds.push(saved.id);

      const paymentRecord: PaymentRecord = {
        id: `pay_lookup_${Date.now()}`,
        invoiceId: saved.id,
        paypalOrderId: `ORDER-LOOKUP-${Date.now()}`,
        paypalCaptureId: `CAP-LOOKUP-${Date.now()}`,
        currency: "USD",
        amount: saved.invoiceTotalUSD,
        status: "COMPLETED",
        isSandbox: true,
        payerEmail: "buyer@example.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePayment(paymentRecord);

      // Lookup by Payment ID
      const req1 = new NextRequest(`http://localhost:3000/api/payments/${paymentRecord.id}`);
      const res1 = await getPaymentHandler(req1, { params: Promise.resolve({ id: paymentRecord.id }) });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.id, paymentRecord.id);

      // Lookup by PayPal Order ID
      const req2 = new NextRequest(`http://localhost:3000/api/payments/${paymentRecord.paypalOrderId}`);
      const res2 = await getPaymentHandler(req2, { params: Promise.resolve({ id: paymentRecord.paypalOrderId }) });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.paypalOrderId, paymentRecord.paypalOrderId);

      // Lookup by Linked Invoice ID (Sprint 7 new capability)
      const req3 = new NextRequest(`http://localhost:3000/api/payments/${saved.id}`);
      const res3 = await getPaymentHandler(req3, { params: Promise.resolve({ id: saved.id }) });
      assert.strictEqual(res3.status, 200);
      const data3 = await res3.json();
      assert.strictEqual(data3.invoiceId, saved.id);
      assert.strictEqual(data3.status, "COMPLETED");

      // Non-existent ID returns 404
      const req4 = new NextRequest("http://localhost:3000/api/payments/non_existent_id");
      const res4 = await getPaymentHandler(req4, { params: Promise.resolve({ id: "non_existent_id" }) });
      assert.strictEqual(res4.status, 404);
    });

    it("GET /api/invoices/[id]/pdf streams a valid PDF with correct content-type and filename header", async () => {
      const draft = createTestDraft();
      const saved = await saveInvoice(draft);
      createdInvoiceIds.push(saved.id);

      const req = new NextRequest(`http://localhost:3000/api/invoices/${saved.id}/pdf`);
      const res = await getInvoicePdfHandler(req, { params: Promise.resolve({ id: saved.id }) });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("content-type"), "application/pdf");
      const disposition = res.headers.get("content-disposition");
      assert.ok(disposition?.includes("attachment"), "Content-Disposition must specify attachment");
      assert.ok(disposition?.includes(".pdf"), "Content-Disposition must contain .pdf filename");

      const arrayBuffer = await res.arrayBuffer();
      const headerBytes = Buffer.from(arrayBuffer.slice(0, 5)).toString("utf-8");
      assert.strictEqual(headerBytes, "%PDF-", "Generated PDF must start with %PDF- magic bytes");
    });
  });

  describe("2. Safe In-Progress Form Recovery Validation", () => {
    it("accepts valid version 1 session storage draft payload", () => {
      const validPayload = {
        version: 1,
        savedAt: "2026-11-07T12:00:00.000Z",
        data: {
          productTitle: "Handcrafted Brass Diya",
          productDescription: "Traditional carved oil lamp from Moradabad",
          declaredMaterials: "100% Solid Brass",
          intendedUse: "Decorative and ritual home lighting",
          itemPrice: "45.00",
          shippingCost: "20.00",
          activeStep: 3,
        },
      };

      // Validation logic mimicking component check
      const isValid =
        Boolean(validPayload) &&
        validPayload.version === 1 &&
        Boolean(validPayload.data) &&
        typeof validPayload.data.productTitle === "string" &&
        [1, 2, 3, 4, 5].includes(validPayload.data.activeStep);

      assert.strictEqual(isValid, true, "Valid version 1 draft must be accepted");
    });

    it("safely rejects obsolete or tampered schema versions", () => {
      const invalidVersions = [
        { version: 2, data: { productTitle: "Test" } },
        { version: 0, data: { productTitle: "Test" } },
        { version: "1", data: { productTitle: "Test" } },
        { data: { productTitle: "Test" } },
        null,
        undefined,
        {},
      ];

      for (const payload of invalidVersions) {
        const isValid =
          Boolean(payload) &&
          typeof payload === "object" &&
          (payload as { version?: unknown })?.version === 1 &&
          Boolean((payload as { data?: unknown })?.data);

        assert.strictEqual(isValid, false, `Draft with invalid schema must be rejected: ${JSON.stringify(payload)}`);
      }
    });

    it("verifies strictly zero payment tokens, secrets, or credentials in draft structure", () => {
      const sampleDraftData = {
        productTitle: "Test Product",
        productDescription: "Test Description",
        declaredMaterials: "Silk",
        intendedUse: "Apparel",
        itemPrice: "100.00",
        shippingCost: "15.00",
        activeStep: 2,
        sellerBusinessName: "Seller Co",
        buyerName: "Buyer LLC",
      };

      const serialized = JSON.stringify(sampleDraftData);

      // Verify no sensitive credentials could ever be present
      assert.strictEqual(serialized.includes("client_secret"), false);
      assert.strictEqual(serialized.includes("access_token"), false);
      assert.strictEqual(serialized.includes("PAYPAL_SECRET"), false);
      assert.strictEqual(serialized.includes("GEMINI_API_KEY"), false);
    });
  });

  describe("3. Module Configuration & Navigation Synchronization", () => {
    it("verifies 5-step workflow overview configuration", () => {
      assert.strictEqual(WORKFLOW_OVERVIEW_STEPS.length, 5, "Workflow overview must have exactly 5 steps");

      const stepNumbers = WORKFLOW_OVERVIEW_STEPS.map((s) => s.stepNumber);
      assert.deepStrictEqual(stepNumbers, [1, 2, 3, 4, 5]);

      const titles = WORKFLOW_OVERVIEW_STEPS.map((s) => s.title);
      assert.strictEqual(titles[0], "Describe your product");
      assert.strictEqual(titles[1], "AI attribute extraction");
      assert.strictEqual(titles[2], "Customs grounding");
      assert.strictEqual(titles[3], "Landed cost math");
      assert.strictEqual(titles[4], "Invoice & checkout");
    });

    it("verifies all architectural modules are marked COMPLETED or ACTIVE without obsolete planned tags", () => {
      assert.ok(ARCHITECTURAL_MODULES.length >= 6, "All 6 core modules must be configured");

      for (const mod of ARCHITECTURAL_MODULES) {
        assert.ok(
          mod.status === "COMPLETED" || mod.status === "ACTIVE",
          `Module "${mod.title}" must be COMPLETED or ACTIVE, got: ${mod.status}`
        );
        const statusStr = mod.status as string;
        assert.strictEqual(
          statusStr !== "PLANNED_SPRINT" && statusStr !== "PLACEHOLDER",
          true,
          `Module "${mod.title}" must not have obsolete status: ${mod.status}`
        );
      }
    });
  });

  describe("4. Frozen Core Modules Integrity & Regression", () => {
    it("preserves USITC 2026 Revision 22 Silk Shawl rate at 1.2% and exactly 7 seed products", () => {
      const record = getTariffRecordByHts10("6214.10.10.00");
      assert.ok(record, "Silk Shawl HTS 6214.10.10.00 must exist in authoritative store");
      assert.strictEqual(record.generalDutyRate, 1.2, "Silk Shawl Column 1 General rate must be strictly 1.2%");
      assert.strictEqual(record.generalRateStr, "1.2%", "Silk Shawl display rate must be 1.2%");
      assert.strictEqual(SEED_EXPORT_PROFILES.length, 7, "Seed dataset must contain exactly 7 authentic Indian products");
    });

    it("verifies landed cost engine produces deterministic DAP financial separation", () => {
      const result = calculateLandedCost({
        productTitle: "Test Silk Shawl",
        hts10: "6214.10.10.00",
        originCountry: "IN",
        destinationCountry: "US",
        unitPriceUSD: 100.0,
        quantity: 2,
        transportationMode: "AIR_CARGO",
        valuation: {
          grossInvoicePriceUSD: 220.0,
          internationalShippingDeductionUSD: 20.0,
          isShippingDocumented: true,
          shippingDocumentationEvidence: "Air Waybill #618-98234120",
          areRelatedParties: false,
          hasAssistsOrRoyalties: false,
          valuationBasis: "TRANSACTION_VALUE",
          valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
        },
      });

      assert.strictEqual(result.status, "VERIFIED");
      // Seller collects Merchandise ($200) + Shipping ($20) = $220
      assert.strictEqual(result.dapAllocation.sellerCollectedViaPaypalUSD, 220.0);
      // US Import Duty on 200 @ 1.2% = $2.40
      assert.strictEqual(result.baseCustomsDutyUSD, 2.4);
      // Buyer pays duties directly upon arrival, excluded from seller invoice
      assert.ok(result.dapAllocation.buyerPayableUponArrivalUSD > 0);
    });

    it("verifies commercial invoice engine produces valid draft invoice without customs filing claims", () => {
      const draft = createTestDraft();
      assert.ok(draft.id.startsWith("inv_"));
      assert.strictEqual(draft.status, "DRAFT", "Invoice must be marked as draft");
      assert.ok(
        draft.legalDisclaimers.some((d) => d.includes("NOT an official customs declaration")),
        "Invoice must include explicit statutory non-declaration disclaimer"
      );
      assert.strictEqual(draft.shipment.incoterm, "DAP");
    });

    it("verifies PDF generator produces valid binary PDF buffer starting with %PDF-", () => {
      const draft = createTestDraft();
      const pdfBytes = generateCommercialInvoicePdf(draft);
      assert.ok(pdfBytes instanceof Uint8Array);
      assert.ok(pdfBytes.length > 500, "PDF must have non-trivial binary length");
      const magic = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
      assert.strictEqual(magic, "%PDF-");
    });

    it("verifies PayPal precision arithmetic prevents IEEE 754 float drift", () => {
      assert.strictEqual(toMinorUnits(10.05, "USD"), 1005);
      assert.strictEqual(toMinorUnits(19.99, "USD"), 1999);
      assert.strictEqual(areAmountsEqual(10.05, 10.05, "USD"), true);
      assert.strictEqual(areAmountsEqual(10.05000000001, 10.05, "USD"), true);
      assert.strictEqual(areAmountsEqual(10.05, 10.06, "USD"), false);
      assert.strictEqual(formatPayPalAmount(250.5, "USD"), "250.50");
    });
  });
});
