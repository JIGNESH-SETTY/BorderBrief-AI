/**
 * BorderBrief AI — Commercial Invoice Generation Test Suite (Sprint 5)
 *
 * Verifies:
 * 1. Deterministic Commercial Invoice Building & Financial Arithmetic
 * 2. Strict Financial Separation (Seller Invoice Total vs. U.S. Import Costs)
 * 3. Regulatory Registration Number Non-Fabrication (IEC, GSTIN, LUT ARN)
 * 4. Preservation of Tariff Classification Ambiguity Warnings
 * 5. Invoice Completeness Audit & Validation Guardrails
 * 6. Pure Zero-Dependency Standards-Compliant PDF 1.4 Generation
 * 7. SQLite Database Persistence, Retrieval, and Listing
 * 8. API Endpoints (POST /api/invoices, GET /api/invoices, GET /api/invoices/[id], GET /api/invoices/[id]/pdf, POST /api/invoices/generate-pdf)
 * 9. Idempotency Key Handling & Replay Prevention
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import {
  buildCommercialInvoice,
  auditInvoiceCompleteness,
  generateDraftInvoiceNumber,
  INVOICE_LEGAL_DISCLAIMERS,
  STANDARD_DECLARATION_STATEMENT,
} from "../lib/invoice/invoice-engine.ts";
import {
  generateCommercialInvoicePdf,
  sanitizePdfText,
  escapePdfString,
  wrapText,
} from "../lib/invoice/pdf-generator.ts";
import {
  saveInvoice,
  getInvoice,
  getInvoiceByNumber,
  listInvoices,
  deleteInvoice,
} from "../lib/db/database.ts";
import { POST as createInvoicePost, GET as listInvoicesGet } from "../app/api/invoices/route.ts";
import { GET as getInvoiceByIdGet, DELETE as deleteInvoiceByIdDelete } from "../app/api/invoices/[id]/route.ts";
import { GET as getInvoicePdfGet } from "../app/api/invoices/[id]/pdf/route.ts";
import { POST as directPdfPost } from "../app/api/invoices/generate-pdf/route.ts";
import type { CreateInvoiceRequest, CommercialInvoiceDraft } from "../types/invoice.ts";
import type { LandedCostCalculationResult } from "../types/export.ts";

describe("Sprint 5: Commercial Invoice Deterministic Engine", () => {
  const sampleRequest: CreateInvoiceRequest = {
    seller: {
      businessName: "Royal Jaipur Handicrafts LLP",
      address: "12 Heritage Craft Village, Amber Road",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302002",
      country: "India",
      email: "exports@jaipurcrafts.example.in",
      phone: "+91 141 260 0110",
      // Notice: No IEC or GSTIN provided
    },
    buyer: {
      name: "American Heritage Home LLC",
      address: "450 Lexington Ave, Suite 1200",
      city: "New York",
      state: "NY",
      postalCode: "10017",
      country: "United States",
      email: "procurement@americanheritage.example.com",
      phone: "+1 (212) 555-0199",
      isImporterOfRecord: true,
    },
    shipment: {
      invoiceDate: "2026-11-07",
      countryOfExport: "India",
      countryOfDestination: "United States",
      transportationMode: "POSTAL",
      incoterm: "DAP",
      currency: "USD",
      shippingCostUSD: 18.5,
      insuranceCostUSD: 2.5,
    },
    items: [
      {
        id: "item_1",
        description: "Handcrafted Cotton Canvas Tote Bag",
        materialComposition: "100% woven cotton canvas",
        quantity: 10,
        unitOfMeasure: "pcs",
        unitPriceUSD: 25.0,
        countryOfOrigin: "India",
        hts10: "4202.92.15.00",
        classificationStatus: "CLASSIFIED",
      },
    ],
    declaration: {
      statement: STANDARD_DECLARATION_STATEMENT,
      isConfirmedBySeller: true,
      signatoryName: "Rajesh Sharma",
      signatoryTitle: "Managing Partner",
      signatureDate: "2026-11-07",
    },
    landedCostResult: {
      calculationId: "calc_cotton_123",
      calculatedAt: "2026-11-07T10:00:00Z",
      calculationDate: "2026-11-07",
      importDate: "2026-11-07",
      isSimulation: false,
      status: "VERIFIED",
      datasetCoverageStatus: "SUPPORTED_CURATED_STORE",
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      originCountry: "IN",
      destinationCountry: "US",
      quantity: 10,
      unitPriceUSD: 25.0,
      dutiableCustomsValueUSD: 250.0,
      customsValuationMethod: "19 U.S.C. § 1401a(b) Transaction Value",
      valuationScenarioType: "EX_FACTORY_TRANSACTION_VALUE",
      baseCustomsDutyUSD: 15.75, // 6.3%
      section301DutyUSD: 25.0,   // 10.0%
      otherChapter99DutyUSD: 0.0,
      totalCustomsDutyUSD: 40.75,
      totalCustomsFeesUSD: 0.0,  // Mail exempt under 19 CFR 24.23(c)(1)(v)
      internationalShippingUSD: 18.5,
      insuranceUSD: 2.5,
      estimatedBrokerageUSD: 0.0,
      totalLandedCostUSD: 309.25,
      dapAllocation: {
        sellerDirectInvoiceUSD: 271.0,
        buyerUsArrivalObligationsUSD: 40.75,
        totalCombinedCostUSD: 309.25,
        disclaimer: "Under Incoterm DAP, seller invoice covers merchandise + freight.",
      },
      dutyBreakdown: {
        dutiableCustomsValueUSD: 250.0,
        valuationLegalBasis: "19 U.S.C. § 1401a(b)",
        hts10: "4202.92.15.00",
        baseAdValoremRate: 6.3,
        baseAdValoremRateStr: "6.3%",
        baseDutyAmountUSD: 15.75,
        section301: {
          subheading9903: "9903.05.44",
          actionRate: 10.0,
          actionRateStr: "10.0%",
          isApplicable: true,
          additionalDutyAmountUSD: 25.0,
          legalAuthority: "USTR 91 FR 15181",
          exemptionEvaluation: "NOT_EXEMPT",
        },
        totalDutyRate: 16.3,
        totalDutyAmountUSD: 40.75,
        statutoryReference: "USITC 2026 Revision 22",
      },
      mpfBreakdown: {
        dutiableValueUSD: 250.0,
        customsEntryType: "INFORMAL_MAIL_ENTRY",
        postalEntryProcedure: "INFORMAL_MAIL_EXTENDED",
        adValoremRate: 0.003464,
        rawMpfAmountUSD: 0.0,
        minMpfCapUSD: 33.56,
        maxMpfCapUSD: 651.99,
        isExempt: true,
        exemptionBasis: "19 CFR § 24.23(c)(1)(v) International Mail Exemption",
        finalMpfAmountUSD: 0.0,
      },
      hmfBreakdown: {
        dutiableValueUSD: 250.0,
        transportationMode: "POSTAL",
        customsEntryType: "INFORMAL_MAIL_ENTRY",
        adValoremRate: 0.00125,
        hmfAmountUSD: 0.0,
        isExempt: true,
        exemptionBasis: "19 CFR § 24.24(c)(1) Mail exemption",
      },
      statutoryRevision: "USITC 2026 HTS Revision 22",
      section301Authority: "USTR 91 FR 15181",
      mpfScheduleAuthority: "91 FR 48398",
      effectiveDate: "2026-10-30",
      disclaimer: "Under 19 U.S.C. § 1484, Importer of Record exercises reasonable care.",
      assumptions: ["Mail informal entry applies."],
      missingInformation: [],
      advisoryWarnings: [],
    } as unknown as LandedCostCalculationResult,
  };

  it("1. builds valid commercial invoice with correct deterministic arithmetic", () => {
    const invoice = buildCommercialInvoice(sampleRequest);

    // Subtotal: 10 pcs * $25.00 = $250.00
    assert.equal(invoice.subtotalUSD, 250.0);
    // Shipping: $18.50
    assert.equal(invoice.shippingCostUSD, 18.5);
    // Insurance: $2.50
    assert.equal(invoice.insuranceCostUSD, 2.5);
    // Invoice Total = Subtotal + Shipping + Insurance = 250 + 18.5 + 2.5 = 271.00
    assert.equal(invoice.invoiceTotalUSD, 271.0);
    assert.equal(invoice.currency, "USD");
    assert.equal(invoice.status, "DRAFT");
    assert.equal(invoice.isComplete, true);
    assert.equal(invoice.missingRequiredFields.length, 0);
  });

  it("2. STRICT FINANCIAL SEPARATION: seller invoice total does NOT contain U.S. customs duties or fees", () => {
    const invoice = buildCommercialInvoice(sampleRequest);

    // The seller invoice total must be exactly merchandise + freight + insurance
    assert.equal(invoice.invoiceTotalUSD, 271.0);

    // It must NOT equal the landed cost of $309.25
    assert.notEqual(invoice.invoiceTotalUSD, 309.25);

    // U.S. import costs must be isolated in estimatedImportCosts for buyer reference only
    assert.ok(invoice.estimatedImportCosts);
    assert.equal(invoice.estimatedImportCosts.totalCustomsDutyUSD, 40.75);
    assert.equal(invoice.estimatedImportCosts.baseCustomsDutyUSD, 15.75);
    assert.equal(invoice.estimatedImportCosts.section301DutyUSD, 25.0);
    assert.equal(invoice.estimatedImportCosts.totalEstimatedImportChargesUSD, 40.75);
    assert.ok(invoice.estimatedImportCosts.disclaimer.includes("ESTIMATED U.S. IMPORT COSTS"));
    assert.ok(invoice.estimatedImportCosts.disclaimer.includes("NOT included in the seller's commercial invoice total"));
  });

  it("3. REGULATORY REGISTRATION INTEGRITY: does NOT invent or fabricate IEC, GSTIN, or LUT ARN", () => {
    const invoice = buildCommercialInvoice(sampleRequest);

    // Because sampleRequest had no IEC, GSTIN, or LUT ARN, they must remain undefined
    assert.equal(invoice.seller.iecNumber, undefined);
    assert.equal(invoice.seller.gstin, undefined);
    assert.equal(invoice.seller.lutArn, undefined);

    // Now test with user-provided valid identifiers
    const withIds = buildCommercialInvoice({
      ...sampleRequest,
      seller: {
        ...sampleRequest.seller,
        iecNumber: "0512345678",
        gstin: "08AAAAA0000A1Z5",
        lutArn: "AD0810260012345",
      },
    });
    assert.equal(withIds.seller.iecNumber, "0512345678");
    assert.equal(withIds.seller.gstin, "08AAAAA0000A1Z5");
    assert.equal(withIds.seller.lutArn, "AD0810260012345");
  });

  it("4. preserves classification warnings for unresolved ambiguity or alternative candidates", () => {
    const ambiguousReq: CreateInvoiceRequest = {
      ...sampleRequest,
      items: [
        {
          id: "item_ambig",
          description: "Ambiguous Silk Textile",
          quantity: 5,
          unitPriceUSD: 50.0,
          classificationStatus: "UNRESOLVED_AMBIGUITY",
        },
      ],
    };

    const invoice = buildCommercialInvoice(ambiguousReq);
    assert.equal(invoice.items[0].classificationStatus, "UNRESOLVED_AMBIGUITY");
    assert.ok(invoice.items[0].classificationWarning);
    assert.ok(invoice.items[0].classificationWarning.includes("WARNING: Tariff classification"));
    assert.ok(invoice.items[0].classificationWarning.includes("ambiguous/unresolved"));
  });

  it("5. aggregates multi-item invoice subtotals accurately with fractional rounding", () => {
    const multiItemReq: CreateInvoiceRequest = {
      ...sampleRequest,
      items: [
        {
          id: "item_1",
          description: "Blue Pottery Coaster",
          quantity: 4,
          unitPriceUSD: 12.33,
          countryOfOrigin: "India",
        },
        {
          id: "item_2",
          description: "Hand-Block Printed Scarf",
          quantity: 3,
          unitPriceUSD: 19.99,
          countryOfOrigin: "India",
        },
      ],
      shipment: {
        ...sampleRequest.shipment,
        shippingCostUSD: 14.5,
        insuranceCostUSD: 1.25,
      },
    };

    const invoice = buildCommercialInvoice(multiItemReq);
    // Item 1: 4 * 12.33 = 49.32
    assert.equal(invoice.items[0].totalPriceUSD, 49.32);
    // Item 2: 3 * 19.99 = 59.97
    assert.equal(invoice.items[1].totalPriceUSD, 59.97);
    // Subtotal: 49.32 + 59.97 = 109.29
    assert.equal(invoice.subtotalUSD, 109.29);
    // Shipping: 14.50, Insurance: 1.25
    // Total = 109.29 + 14.50 + 1.25 = 125.04
    assert.equal(invoice.invoiceTotalUSD, 125.04);
  });

  it("6. audits missing required exporter and buyer fields", () => {
    const audit = auditInvoiceCompleteness({
      seller: { businessName: "" },
      buyer: { name: "" },
      declaration: { isConfirmedBySeller: false },
    });

    assert.equal(audit.isComplete, false);
    assert.ok(audit.missingFields.some((f) => f.includes("Business Name")));
    assert.ok(audit.missingFields.some((f) => f.includes("Buyer")));
    assert.ok(audit.missingFields.some((f) => f.includes("Declaration")));
  });

  it("7. generates draft invoice number with deterministic format", () => {
    const num = generateDraftInvoiceNumber("2026-11-07");
    assert.ok(num.startsWith("INV-DRAFT-20261107-"));
    assert.match(num, /^INV-DRAFT-20261107-\d{4}$/);
  });

  it("8. DAP optional insurance: excludes unagreed insurance from seller total and includes only when agreed", () => {
    // Case A: Seller does NOT charge insurance (standard DAP default)
    const withoutInsuranceReq: CreateInvoiceRequest = {
      ...sampleRequest,
      shipment: {
        ...sampleRequest.shipment,
        isInsuranceIncluded: false,
        insuranceCostUSD: 15.0, // Should be ignored because isInsuranceIncluded is false
      },
    };
    const invWithout = buildCommercialInvoice(withoutInsuranceReq);
    assert.equal(invWithout.shipment.isInsuranceIncluded, false);
    assert.equal(invWithout.insuranceCostUSD, 0);
    // Subtotal: 250 + Shipping: 18.50 + Insurance: 0 = 268.50
    assert.equal(invWithout.invoiceTotalUSD, 268.5);

    // Case B: Seller and buyer expressly agreed on insurance
    const withInsuranceReq: CreateInvoiceRequest = {
      ...sampleRequest,
      shipment: {
        ...sampleRequest.shipment,
        isInsuranceIncluded: true,
        insuranceCostUSD: 15.0,
      },
    };
    const invWith = buildCommercialInvoice(withInsuranceReq);
    assert.equal(invWith.shipment.isInsuranceIncluded, true);
    assert.equal(invWith.insuranceCostUSD, 15.0);
    // Subtotal: 250 + Shipping: 18.50 + Insurance: 15 = 283.50
    assert.equal(invWith.invoiceTotalUSD, 283.5);
  });

  it("9. 19 U.S.C. § 1401a customs valuation separation and statutory basis integrity", () => {
    const invoice = buildCommercialInvoice(sampleRequest);
    assert.ok(invoice.estimatedImportCosts);
    assert.equal(
      invoice.estimatedImportCosts.valuationStatutoryBasis,
      "19 U.S.C. § 1401a(b) Transaction Value"
    );
    assert.ok(invoice.estimatedImportCosts.valuationNotes);
    assert.equal(invoice.estimatedImportCosts.valuationNotes.length, 3);
    assert.ok(invoice.estimatedImportCosts.valuationNotes[0].includes("19 U.S.C. § 1401a(b)(4)(A)"));
    assert.ok(invoice.estimatedImportCosts.valuationNotes[1].includes("19 U.S.C. § 1401a(b)(1)"));
    assert.ok(invoice.estimatedImportCosts.valuationNotes[2].includes("distinct from customs dutiable value"));
    // Ensure dutiable value remains pure merchandise value ($250.00), separate from freight and insurance
    assert.equal(invoice.estimatedImportCosts.dutiableValueUSD, 250.0);
  });
});

describe("Sprint 5: Pure Zero-Dependency PDF Generator", () => {
  it("generates a valid binary PDF 1.4 document with required structural objects", () => {
    const invoice = buildCommercialInvoice({
      seller: {
        businessName: "Kashmir Shawl Emporium",
        address: "7 Polo View, Residency Road",
        city: "Srinagar",
        state: "Jammu & Kashmir",
        postalCode: "190001",
        country: "India",
        email: "contact@kashmirshawls.example.in",
        phone: "+91 194 245 0000",
      },
      buyer: {
        name: "Fifth Avenue Luxury Boutiques Inc.",
        address: "712 Fifth Avenue, 14th Floor",
        city: "New York",
        state: "NY",
        postalCode: "10019",
        country: "United States",
      },
      shipment: {
        invoiceDate: "2026-11-07",
        countryOfExport: "India",
        countryOfDestination: "United States",
        incoterm: "DAP",
        currency: "USD",
        shippingCostUSD: 35.0,
        insuranceCostUSD: 10.0,
      },
      items: [
        {
          id: "item_1",
          description: "Hand-Woven Mulberry Silk Shawl",
          quantity: 2,
          unitPriceUSD: 85.0,
          hts10: "6214.10.10.00",
        },
      ],
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
        signatoryName: "Tariq Ahmad",
        signatoryTitle: "Managing Director",
      },
    });

    const pdfBuffer = generateCommercialInvoicePdf(invoice);

    // 1. Check Buffer type and length
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 500);

    // 2. Check PDF Magic Header: %PDF-1.4
    const pdfStr = pdfBuffer.toString("binary");
    assert.ok(pdfStr.startsWith("%PDF-1.4"));

    // 3. Check PDF End of File Marker: %%EOF
    assert.ok(pdfStr.includes("%%EOF"));

    // 4. Check essential PDF objects
    assert.ok(pdfStr.includes("/Type /Catalog"));
    assert.ok(pdfStr.includes("/Type /Pages"));
    assert.ok(pdfStr.includes("/Type /Page"));
    assert.ok(pdfStr.includes("/Type /Font"));
    assert.ok(pdfStr.includes("/BaseFont /Helvetica"));

    // 5. Check watermark and text content
    assert.ok(pdfStr.includes("DRAFT"));
    assert.ok(pdfStr.includes("COMMERCIAL INVOICE"));
    assert.ok(pdfStr.includes("Kashmir Shawl Emporium"));
    assert.ok(pdfStr.includes("Fifth Avenue Luxury Boutiques"));
    assert.ok(pdfStr.includes("6214.10.10.00"));
    assert.ok(pdfStr.includes("19 U.S.C."));
  });

  it("sanitizes Unicode currency symbols, typographic quotes, em-dashes and control characters via sanitizePdfText", () => {
    // Currency symbols
    assert.equal(sanitizePdfText("Price: ₹2500"), "Price: INR 2500");
    assert.equal(sanitizePdfText("Cost: €50.00 and £40.00 and ¥6000"), "Cost: EUR 50.00 and GBP 40.00 and JPY 6000");

    // Typographic quotes & em-dashes
    assert.equal(sanitizePdfText('“Handmade” ‘Silk’ — Premium – Grade'), '"Handmade" \'Silk\' - Premium - Grade');

    // Accented latin characters
    assert.equal(sanitizePdfText("Café de Jaipur Crème"), "Cafe de Jaipur Creme");

    // Malicious control characters (null byte, bell, escape)
    assert.equal(sanitizePdfText("Malicious\x00Text\x07With\x1bControls"), "Malicious Text With Controls");

    // Null/undefined/empty
    assert.equal(sanitizePdfText(null), "");
    assert.equal(sanitizePdfText(undefined), "");
    assert.equal(sanitizePdfText(""), "");
  });

  it("safely escapes PDF syntax characters (parentheses, backslashes) via escapePdfString", () => {
    const input = "Handicrafts (Set of 2) \\ 100% Cotton (Special)";
    const escaped = escapePdfString(input);
    assert.equal(escaped, "Handicrafts \\(Set of 2\\) \\\\ 100% Cotton \\(Special\\)");
  });

  it("intelligently wraps long descriptions and address lines via wrapText", () => {
    const longAddress = "Plot 123, Sector 45, Phase II Industrial Area, Near Old Toll Plaza, Gurgaon, Haryana 122003";
    const wrapped = wrapText(longAddress, 35);
    assert.ok(wrapped.length > 1);
    for (const line of wrapped) {
      assert.ok(line.length <= 35, `Line length ${line.length} exceeds 35: "${line}"`);
    }

    // Short text stays in 1 line
    const shortWrapped = wrapText("Short text", 35);
    assert.equal(shortWrapped.length, 1);
    assert.equal(shortWrapped[0], "Short text");

    // Empty text
    assert.deepEqual(wrapText("", 35), []);
  });

  it("generates multi-page PDF with correct page counts, continuation headers, and footers for >5 items", () => {
    // Generate an invoice with 10 line items
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      id: `item_${i + 1}`,
      description: `Artisanal Craft Product Variant Number ${i + 1}`,
      materialComposition: "Natural wood and brass",
      quantity: 5,
      unitOfMeasure: "pcs",
      unitPriceUSD: 20.0,
      totalPriceUSD: 100.0,
      countryOfOrigin: "India",
      hts10: "4421.99.97.80",
      classificationStatus: "CLASSIFIED" as const,
    }));

    const multiPageInvoice: CommercialInvoiceDraft = {
      id: "inv_multipage_test_123",
      invoiceNumber: "INV-DRAFT-20261107-9999",
      status: "DRAFT",
      createdAt: "2026-11-07T10:00:00Z",
      updatedAt: "2026-11-07T10:00:00Z",
      seller: {
        businessName: "Multi-Item Exporter India",
        address: "100 Export Zone",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India",
        email: "multi@exporter.example.in",
        phone: "+91 22 2222 3333",
      },
      buyer: {
        name: "American Importer LLC",
        address: "500 Broadway",
        city: "New York",
        state: "NY",
        postalCode: "10012",
        country: "United States",
      },
      shipment: {
        invoiceNumber: "INV-DRAFT-20261107-9999",
        invoiceDate: "2026-11-07",
        countryOfExport: "India",
        countryOfDestination: "United States",
        transportationMode: "POSTAL",
        incoterm: "DAP",
        currency: "USD",
        shippingCostUSD: 50.0,
        isInsuranceIncluded: false,
        insuranceCostUSD: 0,
        countryOfOrigin: "India",
      },
      items: manyItems,
      subtotalUSD: 1000.0,
      shippingCostUSD: 50.0,
      insuranceCostUSD: 0.0,
      invoiceTotalUSD: 1050.0,
      currency: "USD",
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
        signatoryName: "Rajesh Sharma",
        signatoryTitle: "Managing Partner",
        signatureDate: "2026-11-07",
      },
      isComplete: true,
      missingRequiredFields: [],
      legalDisclaimers: INVOICE_LEGAL_DISCLAIMERS,
    };

    const pdfBuf = generateCommercialInvoicePdf(multiPageInvoice);
    const pdfStr = pdfBuf.toString("binary");

    // Multi-page structural verification
    assert.ok(pdfStr.includes("/Count 2"), "Should declare 2 pages in /Pages catalog");
    assert.ok(pdfStr.includes("Page 1 of 2"), "Should include Page 1 of 2 footer");
    assert.ok(pdfStr.includes("Page 2 of 2"), "Should include Page 2 of 2 footer");
    assert.ok(pdfStr.includes("CONTINUATION"), "Continuation page should have continuation header");
    assert.ok(pdfStr.includes("DRAFT - FOR REVIEW ONLY"), "Watermark should appear");
    assert.ok(pdfStr.includes("%%EOF"), "Should have standard PDF EOF marker");
  });

  it("gracefully handles missing optional exporter and buyer fields without crashing", () => {
    const minimalInvoice: CommercialInvoiceDraft = {
      id: "inv_minimal_test",
      invoiceNumber: "INV-DRAFT-MINIMAL",
      status: "DRAFT",
      createdAt: "2026-11-07T10:00:00Z",
      updatedAt: "2026-11-07T10:00:00Z",
      seller: {
        businessName: "Minimal Exporter",
        address: "Minimal St",
        country: "India",
        email: "min@example.in",
        phone: "+91 99999 00000",
        // Optional fields undefined: iecNumber, gstin, lutArn, city, state, postalCode
      },
      buyer: {
        name: "Minimal Buyer",
        address: "Minimal Ave",
        country: "United States",
        // Optional fields undefined: city, state, postalCode, email, phone
      },
      shipment: {
        invoiceNumber: "INV-DRAFT-MINIMAL",
        invoiceDate: "2026-11-07",
        countryOfExport: "India",
        countryOfDestination: "United States",
        incoterm: "DAP",
        currency: "USD",
        shippingCostUSD: 0,
        insuranceCostUSD: 0,
        countryOfOrigin: "India",
      },
      items: [
        {
          id: "item_min",
          description: "Minimal Item",
          quantity: 1,
          unitOfMeasure: "pcs",
          unitPriceUSD: 10.0,
          totalPriceUSD: 10.0,
          countryOfOrigin: "India",
          classificationStatus: "CLASSIFIED",
        },
      ],
      subtotalUSD: 10.0,
      shippingCostUSD: 0,
      insuranceCostUSD: 0,
      invoiceTotalUSD: 10.0,
      currency: "USD",
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
      },
      isComplete: true,
      missingRequiredFields: [],
      legalDisclaimers: INVOICE_LEGAL_DISCLAIMERS,
    };

    const pdfBuf = generateCommercialInvoicePdf(minimalInvoice);
    assert.ok(Buffer.isBuffer(pdfBuf));
    const pdfStr = pdfBuf.toString("binary");
    assert.ok(pdfStr.startsWith("%PDF-1.4"));
    assert.ok(pdfStr.includes("IEC: Unspecified"));
    assert.ok(pdfStr.includes("GSTIN: Unspecified"));
    assert.ok(pdfStr.includes("No Landed Cost Calculation Attached"));
  });
});

describe("Sprint 5: SQLite Database Persistence", () => {
  it("saves, retrieves, lists, and deletes commercial invoices", () => {
    const draft = buildCommercialInvoice({
      seller: {
        businessName: "Test Exporter Pvt Ltd",
        address: "10 Industrial Estate",
        country: "India",
        email: "test@exporter.example.in",
        phone: "+91 99999 88888",
      },
      buyer: {
        name: "Test Buyer LLC",
        address: "20 Commercial Way",
        country: "United States",
      },
      shipment: {
        invoiceDate: "2026-11-07",
        countryOfExport: "India",
        countryOfDestination: "United States",
        incoterm: "DAP",
        currency: "USD",
        shippingCostUSD: 10.0,
      },
      items: [
        {
          id: "item_db_1",
          description: "Database Test Widget",
          quantity: 1,
          unitPriceUSD: 50.0,
        },
      ],
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
      },
    });

    // 1. Save
    const saved = saveInvoice(draft);
    assert.ok(saved);
    assert.equal(saved.id, draft.id);
    assert.equal(saved.invoiceNumber, draft.invoiceNumber);

    // 2. Retrieve by ID
    const retrievedById = getInvoice(draft.id);
    assert.ok(retrievedById);
    assert.equal(retrievedById.id, draft.id);
    assert.equal(retrievedById.seller.businessName, "Test Exporter Pvt Ltd");
    assert.equal(retrievedById.invoiceTotalUSD, 60.0);

    // 3. Retrieve by Invoice Number
    const retrievedByNum = getInvoiceByNumber(draft.invoiceNumber);
    assert.ok(retrievedByNum);
    assert.equal(retrievedByNum.id, draft.id);

    // 4. List invoices
    const list = listInvoices(10, 0);
    assert.ok(list.length > 0);
    assert.ok(list.some((inv) => inv.id === draft.id));

    // 5. Delete
    const deleted = deleteInvoice(draft.id);
    assert.equal(deleted, true);

    const postDelete = getInvoice(draft.id);
    assert.equal(postDelete, null);
  });
});

describe("Sprint 5: Commercial Invoice API Routes", () => {
  it("POST /api/invoices creates and validates a draft commercial invoice (HTTP 201)", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: {
          businessName: "Agra Inlay Works",
          address: "5 Taj Ganj",
          city: "Agra",
          state: "Uttar Pradesh",
          country: "India",
          email: "sales@agrainlay.example.in",
          phone: "+91 562 222 0000",
        },
        buyer: {
          name: "Global Decor Stores LLC",
          address: "1000 Broadway",
          city: "Seattle",
          state: "WA",
          postalCode: "98101",
          country: "United States",
        },
        shipment: {
          invoiceDate: "2026-11-07",
          transportationMode: "AIR_CARGO",
          incoterm: "DAP",
          currency: "USD",
          shippingCostUSD: 45.0,
          insuranceCostUSD: 5.0,
        },
        items: [
          {
            description: "Handcrafted Marble Inlay Trinket Box",
            quantity: 5,
            unitPriceUSD: 30.0,
            countryOfOrigin: "India",
            hts10: "6802.91.15.00",
          },
        ],
        declaration: {
          statement: STANDARD_DECLARATION_STATEMENT,
          isConfirmedBySeller: true,
          signatoryName: "Amitabh Verma",
        },
      }),
    });

    const res = await createInvoicePost(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.ok(json.id);
    assert.equal(json.subtotalUSD, 150.0);
    assert.equal(json.invoiceTotalUSD, 200.0); // 150 + 45 + 5
    assert.equal(json.status, "DRAFT");
  });

  it("POST /api/invoices rejects invalid negative prices or quantities (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: {
          businessName: "Negative Test",
          address: "Test Road",
          email: "neg@test.in",
          phone: "+91 9999999999",
        },
        buyer: {
          name: "Buyer",
          address: "Address",
        },
        items: [
          {
            description: "Invalid Item",
            quantity: -5,
            unitPriceUSD: 20.0,
          },
        ],
      }),
    });

    const res = await createInvoicePost(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, "INVALID_QUANTITY");
    assert.ok(json.error.toLowerCase().includes("quantity"));
  });

  it("POST /api/invoices handles idempotency deduplication (x-idempotency-key)", async () => {
    const idKey = `idemp_test_${Date.now()}`;
    const payload = {
      seller: {
        businessName: "Idempotent Exporter",
        address: "Address",
        email: "idemp@example.in",
        phone: "+91 1234567890",
      },
      buyer: {
        name: "Idempotent Buyer",
        address: "Address",
      },
      items: [
        {
          description: "Item",
          quantity: 1,
          unitPriceUSD: 10.0,
        },
      ],
      declaration: {
        statement: STANDARD_DECLARATION_STATEMENT,
        isConfirmedBySeller: true,
      },
    };

    // First request
    const req1 = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idKey,
      },
      body: JSON.stringify(payload),
    });
    const res1 = await createInvoicePost(req1);
    assert.equal(res1.status, 201);
    const json1 = await res1.json();

    // Replayed request with same key
    const req2 = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idKey,
      },
      body: JSON.stringify(payload),
    });
    const res2 = await createInvoicePost(req2);
    assert.equal(res2.status, 200); // Replay returns 200 with cached payload
    const json2 = await res2.json();
    assert.equal(json2.id, json1.id);
  });

  it("GET /api/invoices lists saved drafts with pagination", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices?limit=5&offset=0");
    const res = await listInvoicesGet(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(Array.isArray(json.invoices));
    assert.equal(json.limit, 5);
  });

  it("GET /api/invoices/[id] and /pdf retrieve and stream invoice", async () => {
    // 1. Create invoice
    const draft = buildCommercialInvoice({
      seller: {
        businessName: "Route Test Exporter",
        address: "Route Address",
        email: "route@example.in",
        phone: "+91 99999 22222",
      },
      buyer: {
        name: "Route Buyer",
        address: "Route Way",
      },
      items: [
        {
          description: "Route Item",
          quantity: 1,
          unitPriceUSD: 75.0,
        },
      ],
      declaration: {
        isConfirmedBySeller: true,
      },
    });
    saveInvoice(draft);

    // 2. GET by ID
    const getReq = new NextRequest(`http://localhost:3000/api/invoices/${draft.id}`);
    const getRes = await getInvoiceByIdGet(getReq, { params: Promise.resolve({ id: draft.id }) });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.id, draft.id);

    // 3. GET PDF
    const pdfReq = new NextRequest(`http://localhost:3000/api/invoices/${draft.id}/pdf`);
    const pdfRes = await getInvoicePdfGet(pdfReq, { params: Promise.resolve({ id: draft.id }) });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    assert.ok(pdfBytes.toString("binary").startsWith("%PDF-1.4"));

    // 4. Cleanup
    deleteInvoice(draft.id);
  });

  it("POST /api/invoices/generate-pdf directly generates a downloadable PDF", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: {
          businessName: "Direct PDF Exporter",
          address: "Direct St",
          email: "direct@example.in",
          phone: "+91 99999 11111",
        },
        buyer: {
          name: "Direct PDF Buyer",
          address: "Direct Ave",
        },
        items: [
          {
            description: "Direct Item",
            quantity: 2,
            unitPriceUSD: 40.0,
          },
        ],
        declaration: {
          isConfirmedBySeller: true,
        },
      }),
    });

    const res = await directPdfPost(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.ok(res.headers.get("content-disposition")?.includes(".pdf"));

    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    assert.ok(buf.toString("binary").startsWith("%PDF-1.4"));
  });

  it("POST /api/invoices rejects negative shipping or insurance costs (HTTP 400)", async () => {
    // Negative shipping cost
    const req1 = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: { businessName: "Test", address: "Addr", email: "a@b.com", phone: "123" },
        buyer: { name: "Buyer", address: "Addr" },
        shipment: { shippingCostUSD: -10 },
        items: [{ description: "Item", quantity: 1, unitPriceUSD: 10 }],
      }),
    });
    const res1 = await createInvoicePost(req1);
    assert.equal(res1.status, 400);
    const json1 = await res1.json();
    assert.equal(json1.code, "INVALID_SHIPPING_COST");

    // Negative insurance cost
    const req2 = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: { businessName: "Test", address: "Addr", email: "a@b.com", phone: "123" },
        buyer: { name: "Buyer", address: "Addr" },
        shipment: { insuranceCostUSD: -5 },
        items: [{ description: "Item", quantity: 1, unitPriceUSD: 10 }],
      }),
    });
    const res2 = await createInvoicePost(req2);
    assert.equal(res2.status, 400);
    const json2 = await res2.json();
    assert.equal(json2.code, "INVALID_INSURANCE_COST");
  });

  it("POST /api/invoices rejects invalid date formats (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: { businessName: "Test", address: "Addr", email: "a@b.com", phone: "123" },
        buyer: { name: "Buyer", address: "Addr" },
        shipment: { invoiceDate: "07/11/2026" }, // Invalid YYYY-MM-DD
        items: [{ description: "Item", quantity: 1, unitPriceUSD: 10 }],
      }),
    });
    const res = await createInvoicePost(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, "INVALID_DATE_FORMAT");
  });

  it("POST /api/invoices and GET /api/invoices emit single-user demo privacy headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices?limit=1");
    const res = await listInvoicesGet(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-borderbrief-auth-mode"), "single-user-demo-unauthenticated");
    assert.ok(res.headers.get("x-privacy-notice")?.includes("single-user demo workflow"));
    const json = await res.json();
    assert.equal(json.privacyMode, "SINGLE_USER_DEMO_UNAUTHENTICATED");
  });

  it("GET /api/invoices/[id] rejects path traversal and invalid IDs with HTTP 400", async () => {
    const invalidId = "../../../etc/passwd";
    const req = new NextRequest(`http://localhost:3000/api/invoices/${invalidId}`);
    const res = await getInvoiceByIdGet(req, { params: Promise.resolve({ id: invalidId }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, "INVALID_ID_FORMAT");
  });

  it("POST /api/invoices/generate-pdf rejects missing seller or buyer details with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: { businessName: "" },
        items: [{ description: "Item", quantity: 1, unitPriceUSD: 10 }],
      }),
    });
    const res = await directPdfPost(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, "MISSING_MANDATORY_PAYLOAD");
  });
});
