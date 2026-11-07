/**
 * BorderBrief AI — Commercial Invoice Types (Sprint 5)
 * Defines structured data contracts for export commercial invoice generation,
 * live preview, PDF rendering, and persistence.
 *
 * Strict Statutory Guardrails:
 * - Commercial invoices generated are DRAFT documents for exporter review only.
 * - Never claims to be an official customs declaration, customs clearance approval,
 *   or guarantee of import eligibility.
 * - Seller invoice total strictly excludes estimated U.S. import duties and customs fees.
 */

import type { TransportationMode, LandedCostStatus, LandedCostCalculationResult } from "./export.ts";

export type IncotermCode = "DAP" | "FOB" | "CIF" | "EXW" | "DDP" | "CFR";
export type IncotermRule = IncotermCode;

export interface InvoiceSellerDetails {
  /** Legal or business name of the Indian exporter/artisan */
  businessName: string;
  /** Full physical address */
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Country of export (defaults to India) */
  country: string;
  email: string;
  phone: string;
  /** Directorate General of Foreign Trade (DGFT) Importer-Exporter Code, optional */
  iecNumber?: string;
  /** Goods and Services Tax Identification Number, optional */
  gstin?: string;
  /** Letter of Undertaking ARN for zero-rated exports, optional */
  lutArn?: string;
}

export interface InvoiceBuyerDetails {
  /** Name of the U.S. customer, buyer, or business entity */
  name: string;
  /** Complete physical delivery address */
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Destination country (defaults to United States) */
  country: string;
  email?: string;
  phone?: string;
  /**
   * Whether the buyer is also the U.S. Importer of Record (IOR) under 19 U.S.C. § 1484.
   * If false, separate IOR details may be specified.
   */
  isImporterOfRecord?: boolean;
  importerOfRecordDetails?: {
    name?: string;
    address?: string;
    einOrTaxId?: string;
  };
}

export interface InvoiceShipmentDetails {
  /** Draft invoice reference (e.g. "INV-DRAFT-2026-001") */
  invoiceNumber: string;
  /** Invoice issuance date (YYYY-MM-DD) */
  invoiceDate: string;
  /** Export corridor origin */
  countryOfExport: string; // "India"
  /** Export corridor destination */
  countryOfDestination: string; // "United States"
  /** Place of loading / origin facility */
  portOfLoading?: string;
  /** Port of entry / destination hub */
  portOfDischarge?: string;
  /** Mode of transport */
  transportationMode?: TransportationMode;
  /** Incoterms® 2020 delivery term (DAP recommended for B2C cross-border trade) */
  incoterm: IncotermCode;
  /** Commercial invoice currency (typically USD for exports to US) */
  currency: string;
  /** International freight / transit cost payable to seller */
  shippingCostUSD: number;
  /** Whether transit cargo insurance was contractually agreed and charged to the buyer */
  isInsuranceIncluded?: boolean;
  /** Transit insurance charge if charged to buyer (strictly optional under Incoterms® DAP) */
  insuranceCostUSD: number;
  /** Number of export cartons/packages, if known */
  totalPackages?: number;
  /** Gross weight in kg, if known */
  grossWeightKg?: number;
  /** Net weight in kg, if known */
  netWeightKg?: number;
  /** Genuine origin of goods (defaults to India) */
  countryOfOrigin: string;
}

export interface InvoiceLineItem {
  id: string;
  /** Commercial merchandise description */
  description: string;
  /** Physical material / composition (from Step 2 confirmed attributes) */
  materialComposition?: string;
  /** Quantity of items */
  quantity: number;
  /** Unit of quantity (e.g. "pcs", "units", "doz", "kg") */
  unitOfMeasure: string;
  /** Unit price in commercial invoice currency */
  unitPriceUSD: number;
  /** Total line merchandise price (quantity * unitPrice) */
  totalPriceUSD: number;
  /** Country of origin */
  countryOfOrigin: string;
  /** Suggested or declared 10-digit HTS code */
  hts10?: string;
  /** Suggested or declared 6-digit HS subheading */
  hs6?: string;
  /** Classification grounding status from Sprint 3 */
  classificationStatus?: "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY";
  /** Prominent warning if classification is unverified or ambiguous */
  classificationWarning?: string;
}

export interface InvoiceDeclarationDetails {
  /** Standard commercial exporter truth-in-billing statement */
  statement: string;
  /** Mandatory affirmative seller confirmation before finalizing draft */
  isConfirmedBySeller: boolean;
  /** Name of authorized signatory */
  signatoryName?: string;
  /** Title / designation of signatory */
  signatoryTitle?: string;
  /** Date of draft generation / signing (YYYY-MM-DD) */
  signatureDate?: string;
}

/**
 * Informational Landed Cost Summary (Sprint 4 Integration).
 * STRICT RULE: These amounts are FOR REFERENCE ONLY and are NEVER added
 * to the seller's commercial invoice total.
 */
export interface InvoiceEstimatedImportCosts {
  dutiableValueUSD: number;
  /** Statutory valuation basis under 19 U.S.C. § 1401a */
  valuationStatutoryBasis: string;
  baseCustomsDutyUSD: number;
  section301DutyUSD: number;
  totalCustomsDutyUSD: number;
  merchandiseProcessingFeeUSD: number;
  inboundEmsFeeUSD?: number;
  harborMaintenanceFeeUSD?: number;
  totalCustomsFeesUSD: number;
  totalEstimatedImportChargesUSD: number;
  calculationStatus: LandedCostStatus;
  statusNotice?: string;
  warnings: string[];
  disclaimer: string;
  /** Statutory valuation notes distinguishing invoice price from customs transaction value */
  valuationNotes?: string[];
}

export interface CommercialInvoiceDraft {
  /** Unique draft invoice identifier */
  id: string;
  /** Reference number (e.g. "INV-DRAFT-2026-0001") */
  invoiceNumber: string;
  /** Document status: "DRAFT", "ISSUED", "PAID", or "REFUNDED" */
  status: "DRAFT" | "ISSUED" | "PAID" | "REFUNDED";
  /** Refund audit information if payment was refunded */
  refundInfo?: {
    refundedAt: string;
    captureId?: string;
    reason?: string;
  };
  /** Timestamp created */
  createdAt: string;
  /** Timestamp last updated */
  updatedAt: string;
  /** Associated product ID from Step 1 */
  productId?: string;
  /** Associated landed cost calculation ID from Step 4 */
  calculationId?: string;

  /** Exporter / Seller section */
  seller: InvoiceSellerDetails;
  /** Buyer / Consignee section */
  buyer: InvoiceBuyerDetails;
  /** Shipment & transport metadata */
  shipment: InvoiceShipmentDetails;
  /** Itemized merchandise lines */
  items: InvoiceLineItem[];

  /** Financial Totals (Seller Commercial Amount) */
  subtotalUSD: number;
  shippingCostUSD: number;
  insuranceCostUSD: number;
  /**
   * Grand Total Payable to Seller (USD).
   * strictly: subtotalUSD + shippingCostUSD + insuranceCostUSD.
   * NEVER includes U.S. import duties or customs fees.
   */
  invoiceTotalUSD: number;
  currency: string;

  /** Legal & Exporter Truth Declaration */
  declaration: InvoiceDeclarationDetails;

  /**
   * Sprint 4 Landed Cost Estimate for Buyer Reference.
   * Displayed ONLY in a separate informational section.
   */
  estimatedImportCosts?: InvoiceEstimatedImportCosts;

  /** Completeness audit */
  isComplete: boolean;
  missingRequiredFields: string[];

  /** Prominent statutory disclaimers */
  legalDisclaimers: string[];
}

export interface CreateInvoiceRequest {
  productId?: string;
  calculationId?: string;
  seller: Partial<InvoiceSellerDetails>;
  buyer: Partial<InvoiceBuyerDetails>;
  shipment?: Partial<InvoiceShipmentDetails>;
  items?: Partial<InvoiceLineItem>[];
  declaration?: Partial<InvoiceDeclarationDetails>;
  landedCostResult?: LandedCostCalculationResult | null;
}
