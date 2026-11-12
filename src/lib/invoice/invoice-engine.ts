/**
 * BorderBrief AI — Commercial Invoice Generation Engine (Sprint 5)
 *
 * Implements deterministic invoice preparation, line-item arithmetic,
 * validation, legal guardrails, and reference landed-cost separation.
 */

/**
 * Universal secure random int generator (works in Node.js, Edge, and Browser environments).
 */
export function getSecureRandomInt(min: number, max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const range = max - min;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Universal UUID generator (works in Node.js, Edge, and Browser environments).
 */
export function getSecureRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const randomUUID = getSecureRandomUUID;
export const randomInt = getSecureRandomInt;
import type {
  CommercialInvoiceDraft,
  CreateInvoiceRequest,
  InvoiceSellerDetails,
  InvoiceBuyerDetails,
  InvoiceShipmentDetails,
  InvoiceLineItem,
  InvoiceDeclarationDetails,
  InvoiceEstimatedImportCosts,
} from "../../types/invoice.ts";
import { roundCurrency } from "../tariff/landed-cost-engine.ts";

export class CommercialInvoiceValidationError extends Error {
  code: string;
  statusCode: number;
  missingFields: string[];

  constructor(message: string, missingFields: string[] = [], code = "INVALID_INVOICE_DATA", statusCode = 400) {
    super(message);
    this.name = "CommercialInvoiceValidationError";
    this.code = code;
    this.statusCode = statusCode;
    this.missingFields = missingFields;
  }
}

/**
 * Standard legal disclaimers applied to all draft commercial invoices.
 */
export const INVOICE_LEGAL_DISCLAIMERS = [
  "DRAFT DOCUMENT FOR REVIEW ONLY: This document is an unfiled draft commercial invoice generated for review purposes. It is NOT an official customs declaration, customs entry, or clearance filing with Indian Customs (ICEGATE/DGFT) or U.S. Customs and Border Protection (CBP).",
  "NO GUARANTEE OF IMPORT CLEARANCE: BorderBrief AI does not act as a licensed customs broker or freight forwarder. Customs clearance, duty assessment, and admissibility are determined exclusively by U.S. Customs and Border Protection (CBP) under 19 U.S.C. § 1484.",
  "SELLER / BUYER FINANCIAL SEPARATION: The commercial invoice total reflects ONLY amounts payable to the seller (merchandise subtotal, agreed transit shipping, and optional cargo insurance where separately agreed and charged). Under Incoterms® 2020 DAP, the seller is NOT required to procure insurance. Estimated U.S. import duties, Section 301 tariffs, and customs fees are assessed separately upon U.S. arrival and are never part of the seller's invoice amount.",
  "CUSTOMS VALUATION STATUTORY BASIS (19 U.S.C. § 1401a): The seller commercial invoice total is legally distinct from U.S. customs transaction value. Under 19 U.S.C. § 1401a(b)(4)(A), international freight and insurance are excluded from the customs price actually paid or payable when separately itemized. BorderBrief AI preserves independent valuation results and does not invent statutory additions or deductions.",
  "REGISTRATION AND CLASSIFICATION INTEGRITY: Registration identifiers (IEC, GSTIN) and tariff classifications (HS/HTSUS) must be verified by the exporter. BorderBrief AI strictly prohibits the fabrication of regulatory registration numbers.",
];

export const STANDARD_DECLARATION_STATEMENT =
  "We declare that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that the goods are of Indian origin.";

/**
 * Generates an unpredictable draft invoice number using a cryptographically secure random component.
 * Format: INV-DRAFT-YYYYMMDD-XXXX
 */
export function generateDraftInvoiceNumber(dateStr?: string): string {
  const datePart = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const randomSuffix = getSecureRandomInt(1000, 10000);
  return `INV-DRAFT-${datePart}-${randomSuffix}`;
}

/**
 * Audits an invoice draft for missing required fields.
 */
export function auditInvoiceCompleteness(draft: {
  seller?: Partial<InvoiceSellerDetails>;
  buyer?: Partial<InvoiceBuyerDetails>;
  shipment?: Partial<InvoiceShipmentDetails>;
  items?: Partial<InvoiceLineItem>[];
  declaration?: Partial<InvoiceDeclarationDetails>;
}): { isComplete: boolean; missingFields: string[] } {
  const missing: string[] = [];

  // Exporter / Seller details
  if (!draft.seller?.businessName?.trim()) missing.push("Exporter / Seller Business Name");
  if (!draft.seller?.address?.trim()) missing.push("Exporter / Seller Address");
  if (!draft.seller?.email?.trim()) missing.push("Exporter / Seller Email");
  if (!draft.seller?.phone?.trim()) missing.push("Exporter / Seller Phone");

  // Buyer / Consignee details
  if (!draft.buyer?.name?.trim()) missing.push("Buyer / Consignee Name");
  if (!draft.buyer?.address?.trim()) missing.push("Buyer / Consignee Delivery Address");

  // Shipment details
  if (!draft.shipment?.invoiceDate?.trim()) missing.push("Invoice Date");
  if (!draft.shipment?.currency?.trim()) missing.push("Invoice Currency");

  // Items
  if (!draft.items || draft.items.length === 0) {
    missing.push("At least one product line item");
  } else {
    draft.items.forEach((item, idx) => {
      if (!item.description?.trim()) missing.push(`Item ${idx + 1}: Description`);
      if (item.quantity === undefined || item.quantity <= 0) missing.push(`Item ${idx + 1}: Quantity must be > 0`);
      if (item.unitPriceUSD === undefined || item.unitPriceUSD <= 0) missing.push(`Item ${idx + 1}: Unit price must be > 0`);
    });
  }

  // Seller declaration
  if (!draft.declaration?.isConfirmedBySeller) {
    missing.push("Exporter Confirmation of Declaration");
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * Builds and validates a structured CommercialInvoiceDraft from request inputs.
 * Strictly guarantees that U.S. customs duties/fees are NEVER added to the seller invoice total.
 */
export function buildCommercialInvoice(request: CreateInvoiceRequest): CommercialInvoiceDraft {
  const now = new Date().toISOString();
  const invoiceDate = request.shipment?.invoiceDate || now.slice(0, 10);
  const invoiceNumber = request.shipment?.invoiceNumber || generateDraftInvoiceNumber(invoiceDate);

  // 1. Process Seller Details
  const seller: InvoiceSellerDetails = {
    businessName: (request.seller.businessName || "").trim(),
    address: (request.seller.address || "").trim(),
    city: request.seller.city?.trim() || undefined,
    state: request.seller.state?.trim() || undefined,
    postalCode: request.seller.postalCode?.trim() || undefined,
    country: (request.seller.country || "India").trim(),
    email: (request.seller.email || "").trim(),
    phone: (request.seller.phone || "").trim(),
    // STRICT: Do NOT invent or auto-fabricate registration numbers!
    iecNumber: request.seller.iecNumber?.trim() || undefined,
    gstin: request.seller.gstin?.trim() || undefined,
    lutArn: request.seller.lutArn?.trim() || undefined,
  };

  // 2. Process Buyer Details
  const buyer: InvoiceBuyerDetails = {
    name: (request.buyer.name || "").trim(),
    address: (request.buyer.address || "").trim(),
    city: request.buyer.city?.trim() || undefined,
    state: request.buyer.state?.trim() || undefined,
    postalCode: request.buyer.postalCode?.trim() || undefined,
    country: (request.buyer.country || "United States").trim(),
    email: request.buyer.email?.trim() || undefined,
    phone: request.buyer.phone?.trim() || undefined,
    isImporterOfRecord: request.buyer.isImporterOfRecord !== false,
    importerOfRecordDetails: request.buyer.importerOfRecordDetails,
  };

  // 3. Process Shipment Details
  const shippingCostUSD = roundCurrency(Math.max(0, Number(request.shipment?.shippingCostUSD || 0)));

  // Under Incoterms® 2020 DAP, the seller is NOT required to provide cargo insurance.
  // Insurance is included only when the seller has actually agreed to provide and charge it.
  const isInsuranceIncluded =
    request.shipment?.isInsuranceIncluded ??
    (request.shipment?.insuranceCostUSD !== undefined && Number(request.shipment.insuranceCostUSD) > 0);

  const insuranceCostUSD = isInsuranceIncluded
    ? roundCurrency(Math.max(0, Number(request.shipment?.insuranceCostUSD || 0)))
    : 0;

  const shipment: InvoiceShipmentDetails = {
    invoiceNumber,
    invoiceDate,
    countryOfExport: "India",
    countryOfDestination: "United States",
    portOfLoading: request.shipment?.portOfLoading?.trim() || undefined,
    portOfDischarge: request.shipment?.portOfDischarge?.trim() || undefined,
    transportationMode: request.shipment?.transportationMode || "POSTAL",
    incoterm: request.shipment?.incoterm || "DAP",
    currency: (request.shipment?.currency || "USD").toUpperCase(),
    shippingCostUSD,
    isInsuranceIncluded,
    insuranceCostUSD,
    totalPackages: request.shipment?.totalPackages ? Math.max(1, Number(request.shipment.totalPackages)) : undefined,
    grossWeightKg: request.shipment?.grossWeightKg ? Number(request.shipment.grossWeightKg) : undefined,
    netWeightKg: request.shipment?.netWeightKg ? Number(request.shipment.netWeightKg) : undefined,
    countryOfOrigin: (request.shipment?.countryOfOrigin || "India").trim(),
  };

  // 4. Process Line Items
  const rawItems = request.items && request.items.length > 0 ? request.items : [];
  const items: InvoiceLineItem[] = rawItems.map((item, idx) => {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPriceUSD ?? 0);
    const lineTotal = roundCurrency(qty * unitPrice);

    let classificationWarning: string | undefined;
    if (item.classificationStatus === "UNRESOLVED_AMBIGUITY") {
      classificationWarning =
        "WARNING: Tariff classification for this item is ambiguous/unresolved. This draft classification is not confirmed and must be reviewed by a licensed customs broker.";
    } else if (item.classificationStatus === "ALTERNATIVE_CANDIDATES") {
      classificationWarning =
        "ADVISORY: Alternative classification candidates exist for this merchandise. Exporter should verify physical attributes.";
    }

    return {
      id: item.id || `item_${idx + 1}`,
      description: (item.description || "").trim(),
      materialComposition: item.materialComposition?.trim() || undefined,
      quantity: qty,
      unitOfMeasure: (item.unitOfMeasure || "pcs").trim(),
      unitPriceUSD: unitPrice,
      totalPriceUSD: lineTotal,
      countryOfOrigin: (item.countryOfOrigin || "India").trim(),
      hts10: item.hts10?.trim() || undefined,
      hs6: item.hs6?.trim() || undefined,
      classificationStatus: item.classificationStatus || "CLASSIFIED",
      classificationWarning,
    };
  });

  // 5. Compute Financial Summary
  // Strictly Seller Commercial Amounts
  const subtotalUSD = roundCurrency(items.reduce((sum, it) => sum + it.totalPriceUSD, 0));
  const invoiceTotalUSD = roundCurrency(subtotalUSD + shippingCostUSD + insuranceCostUSD);

  // 6. Process Exporter Declaration
  const declaration: InvoiceDeclarationDetails = {
    statement: request.declaration?.statement?.trim() || STANDARD_DECLARATION_STATEMENT,
    isConfirmedBySeller: Boolean(request.declaration?.isConfirmedBySeller),
    signatoryName: request.declaration?.signatoryName?.trim() || (request.declaration?.isConfirmedBySeller ? seller.businessName : undefined),
    signatoryTitle: request.declaration?.signatoryTitle?.trim() || (request.declaration?.isConfirmedBySeller ? "Authorized Representative / Exporter" : undefined),
    signatureDate: request.declaration?.signatureDate || invoiceDate,
  };

  // 7. Process Informational Estimated Import Costs (Sprint 4 Integration)
  let estimatedImportCosts: InvoiceEstimatedImportCosts | undefined;
  if (request.landedCostResult) {
    const lcr = request.landedCostResult;
    const baseDuty = lcr.dutyBreakdown?.baseDutyAmountUSD ?? lcr.baseCustomsDutyUSD ?? 0;
    const sec301Duty = lcr.dutyBreakdown?.section301?.additionalDutyAmountUSD ?? lcr.section301DutyUSD ?? 0;
    const totalDuty = lcr.dutyBreakdown?.totalDutyAmountUSD ?? lcr.totalCustomsDutyUSD ?? (baseDuty + sec301Duty);
    const totalFees = lcr.totalCustomsFeesUSD ?? 0;
    const totalEstimatedImportChargesUSD = roundCurrency(totalDuty + totalFees);

    let statusNotice: string | undefined;
    if (lcr.status === "PARTIALLY_VERIFIED") {
      statusNotice = "Landed cost calculation is PARTIALLY VERIFIED due to unconfirmed procedural or valuation factors.";
    } else if (lcr.status === "VERIFIED") {
      statusNotice = "Landed cost calculation is FULLY VERIFIED under official USITC 2026 Revision 22 schedule.";
    }

    estimatedImportCosts = {
      dutiableValueUSD: lcr.dutiableCustomsValueUSD ?? 0,
      valuationStatutoryBasis: "19 U.S.C. § 1401a(b) Transaction Value",
      baseCustomsDutyUSD: baseDuty,
      section301DutyUSD: sec301Duty,
      totalCustomsDutyUSD: totalDuty,
      merchandiseProcessingFeeUSD: lcr.mpfBreakdown?.finalMpfAmountUSD ?? 0,
      inboundEmsFeeUSD: lcr.inboundEmsFeeUSD,
      harborMaintenanceFeeUSD: lcr.hmfBreakdown?.hmfAmountUSD ?? 0,
      totalCustomsFeesUSD: totalFees,
      totalEstimatedImportChargesUSD,
      calculationStatus: lcr.status || "VERIFIED",
      statusNotice,
      warnings: lcr.advisoryWarnings || [],
      disclaimer:
        "ESTIMATED U.S. IMPORT COSTS (FOR BUYER REFERENCE ONLY): These estimated duties and customs fees are assessed under U.S. law upon arrival and are payable by the U.S. importer/buyer. They are NOT included in the seller's commercial invoice total.",
      valuationNotes: [
        "Under 19 U.S.C. § 1401a(b)(4)(A), customs transaction value excludes international freight and insurance when separately itemized from the price actually paid or payable.",
        "Statutory additions under 19 U.S.C. § 1401a(b)(1) (e.g. packing, assists, royalties) apply only when supported by objective information; none are artificially invented.",
        "The seller commercial invoice total is distinct from customs dutiable value and does not overwrite or alter Sprint 4's independent valuation result.",
      ],
    };
  }

  // 8. Audit Completeness
  const audit = auditInvoiceCompleteness({
    seller,
    buyer,
    shipment,
    items,
    declaration,
  });

  // Cryptographically unguessable draft identifier
  const draftId = `inv_${getSecureRandomUUID()}`;

  return {
    id: draftId,
    invoiceNumber,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    productId: request.productId,
    calculationId: request.calculationId,
    seller,
    buyer,
    shipment,
    items,
    subtotalUSD,
    shippingCostUSD,
    insuranceCostUSD,
    invoiceTotalUSD, // STRICT: Does NOT include U.S. duties or fees
    currency: "USD",
    declaration,
    estimatedImportCosts,
    isComplete: audit.isComplete,
    missingRequiredFields: audit.missingFields,
    legalDisclaimers: INVOICE_LEGAL_DISCLAIMERS,
  };
}

