/**
 * BorderBrief AI — Deterministic Landed-Cost Calculation Engine (Sprint 4)
 * Pure TypeScript deterministic math engine with zero AI in the calculation loop.
 * 
 * Statutory & Regulatory Grounding:
 * - 19 U.S.C. § 1401a: Customs Valuation / Transaction Value / PAPP
 * - 19 U.S.C. § 1401a(b)(4)(A): International freight & transit insurance exclusion (documented only)
 * - USITC 2026 HTS Revision 22 (Oct 30, 2026): Column 1 General tariff rates
 * - USTR Section 301 Actions (91 FR Doc. 2026-15181; Presidential Memo July 23, 2026; Heading 9903.05.44 @ 10%)
 * - 19 U.S.C. § 58c & 19 C.F.R. § 24.23: Merchandise Processing Fee (FY2027 Schedule 91 FR 48398)
 * - 19 C.F.R. § 24.23(b)(4): Express Consignment Carrier Facility & Centralized Hub Facility $1.38 Waybill Fee
 * - 26 U.S.C. § 4461 & 19 C.F.R. § 24.24: Harbor Maintenance Fee & § 24.24(d)(3)(i) Informal Entry Exemption
 * - 19 U.S.C. § 1484: Reasonable Care Statutory Notice for Importer of Record
 */

import type {
  AuthoritativeTariffRecord,
  CustomsValuationDeclaration,
  CustomsEntryType,
  TransportationMode,
  PostalServiceType,
  PostalEntryProcedure,
  VoluntaryPostalCompliance,
  CarrierPostalProcedure,
  PostalProcedureCertainty,
  EntryType13TestEligibility,
  PostalComplianceDetails,
  ValuationScenarioType,
  LandedCostStatus,
  Section301DutyBreakdown,
  DutyComponentBreakdown,
  MpfComponentBreakdown,
  HmfComponentBreakdown,
  DapResponsibilityAllocation,
  LandedCostCalculationRequest,
  LandedCostCalculationResult,
} from "../../types/export.ts";
import { getTariffRecordByHts10 } from "./authoritative-store.ts";

/**
 * Injectable server-side clock interface for deterministic date evaluation.
 */
export type DateClock = () => Date;

/**
 * Default production system clock.
 */
export const defaultSystemClock: DateClock = () => new Date();

/**
 * Validates an ISO 8601 date string (YYYY-MM-DD).
 * Ensures correct format, real calendar day/month, and reasonable commercial year bounds (2020-2035).
 */
export function validateIsoDate(
  dateStr: unknown,
  fieldName = "date"
): { isValid: boolean; normalized?: string; error?: string } {
  if (typeof dateStr !== "string" || !dateStr.trim()) {
    return { isValid: false, error: `${fieldName} must be a non-empty string in YYYY-MM-DD format.` };
  }
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { isValid: false, error: `${fieldName} must follow strict YYYY-MM-DD format (received: "${trimmed}").` };
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 2020 || year > 2035) {
    return { isValid: false, error: `${fieldName} year (${year}) is outside supported commercial bounds (2020-2035).` };
  }
  if (month < 1 || month > 12) {
    return { isValid: false, error: `${fieldName} month (${month}) is invalid.` };
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { isValid: false, error: `${fieldName} day (${day}) is invalid for month ${month} of year ${year}.` };
  }

  return { isValid: true, normalized: trimmed };
}

/**
 * Statutory Postal Rule Constants:
 * - Interim Final Rule: CBP 91 FR 37801 (Doc. 2026-12669, effective July 24, 2026)
 * - Extension Rule: CBP Final Rule Doc. 2026-21600 (published October 22, 2026, extending compliance to January 20, 2027)
 * - Entry Type 13 Test Modification: CBP Doc. 2026-21570, 91 FR 66707 (published October 22, 2026, page 66707)
 */
export const POSTAL_RULE_EFFECTIVE_DATE = "2026-07-24";
export const POSTAL_MANDATORY_COMPLIANCE_DATE = "2027-01-20";
export const ENTRY_TYPE_13_TEST_CITATION =
  "CBP Document 2026-21570, Federal Register, October 22, 2026, page 66707 (91 FR 66707)";
export const ENTRY_TYPE_13_PGA_TEMPORARY_NOTICE =
  "CBP Document 2026-21570 (91 FR 66707, Oct 22, 2026): Entry Type 13 test filings in ACE are temporarily accepted with or without complete electronic Partner Government Agency (PGA) data during CBP's temporary acceptance period.";
export const POSTAL_RULE_EXTENSION_NOTICE =
  "CBP Final Rule Document 2026-21600 (published October 22, 2026) extended the mandatory compliance date for 19 C.F.R. § 145.12(a)(2)(v) and (vi) to January 20, 2027. Under Document 2026-21600 and Document 2026-21570 (91 FR 66707), qualifying Chapter 99 postal shipments may be entered via formal entry on CBP Form 7501 or via the qualifying Entry Type 13 informal-entry test.";

export class LandedCostCalculationError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode = 422, details?: Record<string, unknown>) {
    super(message);
    this.name = "LandedCostCalculationError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Standard financial rounding to 2 decimal places (round-half-up).
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface CustomsValuationResult {
  dutiableCustomsValueUSD: number;
  customsValuationMethod: string;
  valuationScenarioType: ValuationScenarioType;
  valuationStatus: "TRANSACTION_VALUE_DOCUMENTED" | "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION" | "UNRESOLVED";
  grossInvoicePriceUSD: number;
  merchandisePriceUSD: number;
  shippingDeductedUSD: number;
  insuranceDeductedUSD: number;
  undocumentedShippingUSD: number;
  undocumentedInsuranceUSD: number;
  statutoryAdditionsAppliedUSD: number;
  missingDocumentation: string[];
  warnings: string[];
}

/**
 * 1. Customs Valuation Engine (19 U.S.C. § 1401a)
 * 
 * Computes Price Actually Paid or Payable (PAPP), applies statutory additions (§ 1401a(b)(1)),
 * and strictly regulates international freight/insurance exclusions (§ 1401a(b)(4)(A)).
 * When deductions are unproven, labels as Conservative Illustrative Assessment Scenario.
 */
export function calculateCustomsValuation(declaration: CustomsValuationDeclaration): CustomsValuationResult {
  const warnings: string[] = [];
  const missingDocumentation: string[] = [];

  if (declaration.valuationBasis === "UNRESOLVED_SECONDARY_VALUATION") {
    throw new LandedCostCalculationError(
      "Transaction value cannot be determined under 19 U.S.C. § 1401a(a)(1). Secondary valuation methods require formal CBP appraisal.",
      "INVALID_VALUATION",
      422
    );
  }

  if (declaration.grossInvoicePriceUSD <= 0) {
    throw new LandedCostCalculationError(
      "Gross commercial invoice price must be a strictly positive number.",
      "INVALID_PRICE",
      400
    );
  }

  if (declaration.internationalShippingDeductionUSD < 0) {
    throw new LandedCostCalculationError(
      "International shipping deduction cannot be negative.",
      "INVALID_SHIPPING_DEDUCTION",
      400
    );
  }

  if (declaration.internationalShippingDeductionUSD >= declaration.grossInvoicePriceUSD) {
    throw new LandedCostCalculationError(
      "International shipping deduction equals or exceeds the total gross invoice price. Deductions must not absorb 100% of merchandise value.",
      "INVALID_SHIPPING_DEDUCTION",
      422
    );
  }

  // Statutory additions under 19 U.S.C. § 1401a(b)(1)
  const additions = roundCurrency(
    (declaration.packingCostsUSD || 0) + (declaration.statutoryAdditionsUSD || 0)
  );

  // International Freight & Transit Insurance Exclusion under 19 U.S.C. § 1401a(b)(4)(A)
  // RULE: Deduction is permitted ONLY if supported by actual transaction facts and sufficient documentation.
  let shippingDeducted = 0;
  let undocumentedShippingUSD = 0;
  let insuranceDeducted = 0;
  let undocumentedInsuranceUSD = 0;
  let status: "TRANSACTION_VALUE_DOCUMENTED" | "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION" | "UNRESOLVED" = "TRANSACTION_VALUE_DOCUMENTED";
  let scenarioType: ValuationScenarioType = "TRANSACTION_VALUE_DOCUMENTED";

  if (declaration.internationalShippingDeductionUSD > 0) {
    if (declaration.isShippingDocumented) {
      shippingDeducted = declaration.internationalShippingDeductionUSD;
    } else {
      status = "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION";
      scenarioType = "CONSERVATIVE_ILLUSTRATIVE_GROSS";
      shippingDeducted = 0; // DO NOT deduct undocumented freight from customs value!
      undocumentedShippingUSD = declaration.internationalShippingDeductionUSD;
      missingDocumentation.push("Verifiable carrier air waybill, bill of lading, or freight invoice pursuant to 19 U.S.C. § 1401a(b)(4)(A)");
      warnings.push(
        "Conservative illustrative assessment: International shipping deduction was excluded from customs value reduction because carrier documentation (air waybill / bill of lading / freight invoice) was not provided. Under 19 U.S.C. § 1401a(b)(4)(A), CBP assesses duties on the full unadjusted gross price if freight charges are undocumented."
      );
    }
  }

  if ((declaration.insuranceDeductionUSD || 0) > 0) {
    if (declaration.isInsuranceDocumented) {
      insuranceDeducted = declaration.insuranceDeductionUSD || 0;
    } else {
      status = "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION";
      scenarioType = "CONSERVATIVE_ILLUSTRATIVE_GROSS";
      insuranceDeducted = 0;
      undocumentedInsuranceUSD = declaration.insuranceDeductionUSD || 0;
      missingDocumentation.push("Verifiable transit insurance policy certificate or invoice pursuant to 19 U.S.C. § 1401a(b)(4)(A)");
      warnings.push(
        "Conservative illustrative assessment: Transit insurance deduction was excluded from customs value reduction due to lack of documented policy receipt."
      );
    }
  }

  if (declaration.areRelatedParties) {
    warnings.push(
      "Buyer and seller are related parties under 19 U.S.C. § 1401a(g). Transaction value is acceptable only if relationship did not influence the price or approximates test values."
    );
  }

  const rawDutiableValue = declaration.grossInvoicePriceUSD - shippingDeducted - insuranceDeducted + additions;
  const dutiableCustomsValueUSD = roundCurrency(Math.max(0.01, rawDutiableValue));

  const merchandisePriceUSD = roundCurrency(
    declaration.merchandisePriceUSD ??
      Math.max(
        0.01,
        declaration.grossInvoicePriceUSD -
          declaration.internationalShippingDeductionUSD -
          (declaration.insuranceDeductionUSD || 0)
      )
  );

  const customsValuationMethod = scenarioType === "CONSERVATIVE_ILLUSTRATIVE_GROSS"
    ? "19 U.S.C. § 1401a(b) Conservative Illustrative Assessment Scenario (Undocumented Freight/Insurance)"
    : "19 U.S.C. § 1401a(b) Transaction Value (Price Actually Paid or Payable)";

  return {
    dutiableCustomsValueUSD,
    customsValuationMethod,
    valuationScenarioType: scenarioType,
    valuationStatus: status,
    grossInvoicePriceUSD: declaration.grossInvoicePriceUSD,
    merchandisePriceUSD,
    shippingDeductedUSD: shippingDeducted,
    insuranceDeductedUSD: insuranceDeducted,
    undocumentedShippingUSD,
    undocumentedInsuranceUSD,
    statutoryAdditionsAppliedUSD: additions,
    missingDocumentation,
    warnings,
  };
}

/**
 * 2. Section 301 Additional Duty Evaluation Engine (July 2026 Action / Heading 9903.05.44)
 * 
 * Reconciled against USTR Notice 91 FR Doc. 2026-15181 (Section 24 Determination, Annex I & Annex II Part A),
 * Presidential Memorandum dated July 23, 2026, and CBP CSMS #69326983.
 */
export function evaluateSection301Duty(
  hts10: string,
  dutiableCustomsValueUSD: number,
  originCountry: string
): Section301DutyBreakdown {
  if (originCountry.toUpperCase() !== "IN") {
    return {
      isApplicable: false,
      chapter99Heading: "N/A",
      additionalAdValoremRate: 0.0,
      additionalDutyAmountUSD: 0.0,
      effectiveDate: "N/A",
      legalAuthority: "Section 301 India action applies only to products of Indian origin",
      annexIChecked: false,
      annexIExemptionApplied: false,
      annexIIChecked: false,
      annexIIExclusionApplied: false,
      exemptionStatus: "VERIFIED_EXEMPT",
      exemptionNotes: "Country of origin is not India.",
    };
  }

  const cleanHts = hts10.replace(/\./g, "").trim();

  // 1. Check Darjeeling loose-leaf black tea (0902.30.00.90)
  // Agricultural exclusion review on Annex II Part A remains unverified in primary legal sources.
  if (cleanHts.startsWith("09023000")) {
    return {
      isApplicable: true, // Conditionally modeled; unverified whether exempt
      chapter99Heading: "9903.05.44",
      additionalAdValoremRate: 10.0,
      additionalDutyAmountUSD: roundCurrency(dutiableCustomsValueUSD * 0.10),
      effectiveDate: "2026-07-24",
      legalAuthority: "USTR 91 FR Doc. 2026-15181 (Sec. 24) / CSMS #69326983",
      annexIChecked: true,
      annexIExemptionApplied: false,
      annexIIChecked: true,
      annexIIExclusionApplied: false,
      annexIIPageRef: "pp. 42–43 (Ch. 09 agricultural review)",
      exemptionStatus: "UNRESOLVED",
      exemptionNotes:
        "Subheading 0902.30.00 is absent from Annex I exemptions. Whether loose-leaf black tea qualifies under Annex II Part A agricultural exclusions (USTR Doc. 2026-15181, pp. 42–43) remains unverified in official publication. Scenarios: 0.0% (if exempt) vs 10.0% (if covered under Heading 9903.05.44).",
    };
  }

  // 2. Check Wooden Coasters (4419.20.90.00 or 4419.90.91.00)
  // Heading 4419 finished tableware is NOT covered by Note 52(f) Section 232 coordination (9903.76.xx),
  // and is not confirmed on Annex II Part A.
  if (cleanHts.startsWith("4419")) {
    return {
      isApplicable: true,
      chapter99Heading: "9903.05.44",
      additionalAdValoremRate: 10.0,
      additionalDutyAmountUSD: roundCurrency(dutiableCustomsValueUSD * 0.10),
      effectiveDate: "2026-07-24",
      legalAuthority: "USTR 91 FR Doc. 2026-15181 (Sec. 24) / U.S. Note 52(f)",
      annexIChecked: true,
      annexIExemptionApplied: false,
      annexIIChecked: true,
      annexIIExclusionApplied: false,
      annexIIPageRef: "p. 49 (Ch. 44 tableware exclusion scope)",
      exemptionStatus: "UNRESOLVED",
      exemptionNotes:
        "Heading 4419 finished tableware is not covered by Note 52(f) / 9903.05.90 (which coordinates with Section 232 provisions 9903.76.xx), and is absent from Annex I exemptions. Annex II Part A exclusion status remains unadjudicated. Scenarios: 3.2% (if exempt) vs 13.2% (if covered under Heading 9903.05.44).",
    };
  }

  // 3. Products verified as absent from Annex I & Annex II Part A exemptions
  // - Cotton Tote Bag (4202.92.15.00)
  // - Brass Figurine / Statue (8306.29.00.00)
  // - Silk Scarf / Shawl (6214.10.10.00)
  // - Glazed Ceramic Mug (6912.00.44.00 or 6911.10.45.00)
  // - Leather Wallet (4202.31.60.00)
  // - Brass Bell (8306.10.00.00)
  // - Silver Earrings (7113.11.50.00)
  return {
    isApplicable: true,
    chapter99Heading: "9903.05.44",
    additionalAdValoremRate: 10.0,
    additionalDutyAmountUSD: roundCurrency(dutiableCustomsValueUSD * 0.10),
    effectiveDate: "2026-07-24",
    legalAuthority: "USTR 91 FR Doc. 2026-15181 (Sec. 24) / CSMS #69326983",
    annexIChecked: true,
    annexIExemptionApplied: false,
    annexIIChecked: true,
    annexIIExclusionApplied: false,
    exemptionStatus: "VERIFIED_SUBJECT",
    exemptionNotes:
      "Merchandise is subject to Section 301 under Heading 9903.05.44 (10.0% ad valorem, effective July 24, 2026). Documented search confirms provision is absent from Annex I (India exemptions) and Annex II Part A (General exemptions, pp. 42–60), and does not qualify under Chapter 99 Note 52 subheadings 9903.05.85–92.",
  };
}

/**
 * 3. Customs Duty Component Calculation Engine
 * 
 * Computes Column 1 General base duty, Section 301 additional duty, and other Chapter 99 measures.
 * Strictly maintains separate calculation lines and prohibits hardcoded combined percentages.
 */
export function calculateDutyComponents(
  hts10: string,
  dutiableCustomsValueUSD: number,
  originCountry: string
): {
  dutyBreakdown: DutyComponentBreakdown;
  record: AuthoritativeTariffRecord;
} {
  const record = getTariffRecordByHts10(hts10);
  if (!record) {
    throw new LandedCostCalculationError(
      `HTS-10 code "${hts10}" is not present in the curated authoritative tariff database (30 validated records). BorderBrief AI strictly refuses to fabricate or estimate duty rates for uncataloged tariff lines.`,
      "DATASET_COVERAGE_UNSUPPORTED",
      422,
      { requestedCode: hts10 }
    );
  }

  // Column 1 General Base Duty (USITC 2026 HTS Revision 22)
  // Special trade program indicators (GSP) are strictly disregarded for India.
  const baseRate = record.generalDutyRate;
  const baseDutyAmountUSD = roundCurrency(dutiableCustomsValueUSD * (baseRate / 100));

  // Section 301 Additional Duty (Heading 9903.05.44)
  const section301 = evaluateSection301Duty(hts10, dutiableCustomsValueUSD, originCountry);

  const totalDutyRate = roundCurrency(baseRate + (section301.isApplicable ? section301.additionalAdValoremRate : 0));
  const totalDutyAmountUSD = roundCurrency(baseDutyAmountUSD + section301.additionalDutyAmountUSD);

  const dutyBreakdown: DutyComponentBreakdown = {
    dutiableCustomsValueUSD,
    valuationLegalBasis: "19 U.S.C. § 1401a(b) Transaction Value",
    hts10: record.hts10,
    baseAdValoremRate: baseRate,
    baseAdValoremRateStr: record.generalRateStr,
    baseDutyAmountUSD,
    section301,
    otherChapter99DutyAmountUSD: 0.0,
    totalDutyRate,
    totalDutyAmountUSD,
    statutoryReference: `${record.statutoryRevision} • Chapter ${record.chapter}`,
  };

  return { dutyBreakdown, record };
}

/**
 * 4. Merchandise Processing Fee (MPF) Engine (19 C.F.R. § 24.23) & Inbound EMS Fee (19 C.F.R. § 24.22(l))
 * 
 * Implements:
 * - FY2027 Schedule (91 FR 48398, effective Oct 1, 2026)
 * - Express Consignment Carrier Facility & Centralized Hub Facility $1.38 fee (19 C.F.R. § 24.23(b)(4))
 * - Inbound EMS $1.00 per-item statutory fee (19 C.F.R. § 24.22(l)(1)(i); unadjusted in FY2027 notice 91 FR 48398)
 * - International mail statutory MPF exemption (19 C.F.R. § 24.23(c)(1)(v))
 * - Formally entered Inbound EMS regulatory exception to MPF exemption (85 FR 47018)
 * - Postal entry procedures under 19 C.F.R. Part 145, CBP Interim Final Rule 91 FR 37801 (Doc. 2026-12669, July 24, 2026),
 *   and CBP Final Rule Doc. 2026-21600 (published October 22, 2026, extending mandatory compliance to January 20, 2027).
 */
export function calculateMpf(
  dutiableCustomsValueUSD: number,
  entryType: CustomsEntryType = "AUTO_DETECT",
  isQualifyingEccfOrHub = false,
  isMandatoryFormal = false,
  transportationMode: TransportationMode = "AIR_CARGO",
  postalServiceType?: PostalServiceType,
  hasChapter99Duties = false,
  importDate?: string,
  voluntaryPostalCompliance?: VoluntaryPostalCompliance,
  carrierPostalProcedure?: CarrierPostalProcedure,
  isPostalProcedureConfirmed = false,
  entryType13Eligibility?: EntryType13TestEligibility
): MpfComponentBreakdown {
  const isInformalEligible = dutiableCustomsValueUSD <= 2500.0 && !isMandatoryFormal;
  const adValoremRate = 0.003464; // 0.3464%
  const unclampedAmountUSD = roundCurrency(dutiableCustomsValueUSD * adValoremRate);

  // FY2027 Clamps (91 FR 48398)
  const formalMin = 34.58;
  const formalMax = 670.86;
  const formalManualSurcharge = 4.15;
  const informalAutoFee = 2.77;
  const informalManualNotCbp = 8.30;
  const informalManualCbp = 12.45;

  let appliedEntryType: "INFORMAL_AUTOMATED" | "INFORMAL_MANUAL" | "INFORMAL_CBP_PREP" | "FORMAL_ELECTRONIC" | "FORMAL_MANUAL" | "EXEMPT_POSTAL";
  let finalMpfAmountUSD = 0;
  let appliedMin: number | undefined;
  let appliedMax: number | undefined;
  let manualSurcharge: number | undefined;
  let carrierFacilityFeeNote: string | undefined;
  let mpfStatus: "VERIFIED_ASSESSED" | "VERIFIED_EXEMPT" | "UNRESOLVED" = "VERIFIED_ASSESSED";
  let statutoryNotes = "Assessed under 19 U.S.C. § 58c and 19 C.F.R. § 24.23. FY2027 statutory schedule.";

  // 1. POSTAL CONSIGNMENTS (19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), 85 FR 47018, 91 FR 37801 & Doc. 2026-21600)
  if (transportationMode === "POSTAL") {
    const evaluationDate = importDate || "2026-11-07";
    const isPostComplianceDate = evaluationDate >= POSTAL_MANDATORY_COMPLIANCE_DATE;
    const complianceMode: VoluntaryPostalCompliance =
      voluntaryPostalCompliance ||
      (entryType === "FORMAL_ELECTRONIC" || entryType === "FORMAL_MANUAL" ? "FORMAL_EARLY" : "NONE");

    let legallyAvailableProcedure: PostalEntryProcedure;
    let actualCarrierProcedure: CarrierPostalProcedure;
    let isShipmentEligible = true;
    let ineligibilityReason: string | undefined;
    let procedureCertainty: PostalProcedureCertainty;
    const missingOperationalFacts: string[] = [];
    const entryType13MissingPrerequisites: string[] = [];
    let entryType13PrerequisitesVerified = false;

    // A. Determine Legally Available Procedure & Shipment Eligibility
    let legallyAvailablePathways: string[];
    if (!isInformalEligible || isMandatoryFormal) {
      legallyAvailableProcedure = "FORMAL_MAIL_REQUIRED";
      isShipmentEligible = false;
      ineligibilityReason =
        "Merchandise dutiable value exceeds $2,500 statutory informal ceiling or restricted merchandise requires formal entry under 19 C.F.R. § 145.12(a)(1).";
      legallyAvailablePathways = [
        "Formal entry on CBP Form 7501 under 19 C.F.R. § 145.12(a)(1)",
      ];
    } else if (hasChapter99Duties) {
      if (isPostComplianceDate) {
        // Under CBP Document 2026-21600 and Document 2026-21570 (91 FR 66707),
        // qualifying Chapter 99 postal shipments <= $2,500 may use either Formal Entry or Entry Type 13!
        legallyAvailableProcedure = "FORMAL_MAIL_REQUIRED";
        isShipmentEligible = true;
        legallyAvailablePathways = [
          "Formal entry on CBP Form 7501 under 19 C.F.R. § 145.12(a)(2)(v) and (vi) (91 FR 37801 & Doc. 2026-21600)",
          "Qualifying Entry Type 13 informal-entry test under CBP Document 2026-21600 & Document 2026-21570 (91 FR 66707)",
        ];
      } else {
        legallyAvailableProcedure = "INFORMAL_MAIL_EXTENDED";
        isShipmentEligible = true;
        legallyAvailablePathways = [
          "Existing informal postal clearance under 19 C.F.R. Part 145 & CBP Doc. 2026-21600",
          "Voluntary early formal entry on CBP Form 7501",
          "Voluntary Entry Type 13 informal-entry test (91 FR 56936 & 91 FR 66707)",
        ];
      }
    } else {
      legallyAvailableProcedure = "INFORMAL_MAIL";
      isShipmentEligible = true;
      legallyAvailablePathways = [
        "Standard informal postal clearance under 19 C.F.R. Part 145",
      ];
    }

    // B. Determine Actual Carrier/Operator Procedure Selected & Certainty
    let postalEntryProcedure: PostalEntryProcedure;
    let isMandatoryFormalResult = false;
    let postalEntryProcedureNotice: string;
    let pgaWarning: string | undefined;

    const isEntryType13Selected =
      complianceMode === "ENTRY_TYPE_13_TEST" ||
      complianceMode === "ENTRY_TYPE_13" ||
      carrierPostalProcedure === "VOLUNTARY_ENTRY_TYPE_13" ||
      carrierPostalProcedure === "ENTRY_TYPE_13";

    const isFormalSelected =
      complianceMode === "FORMAL_EARLY" ||
      complianceMode === "FORMAL_ENTRY" ||
      carrierPostalProcedure === "VOLUNTARY_FORMAL_EARLY" ||
      carrierPostalProcedure === "FORMAL_ENTRY" ||
      carrierPostalProcedure === "MANDATORY_FORMAL";

    if (!isShipmentEligible) {
      actualCarrierProcedure = "MANDATORY_FORMAL";
      procedureCertainty = "MANDATORY_STATUTORY";
      postalEntryProcedure = "FORMAL_MAIL_REQUIRED";
      isMandatoryFormalResult = true;
      postalEntryProcedureNotice =
        "Mandatory formal entry required under 19 C.F.R. § 145.12(a)(1) (dutiable value exceeds $2,500 statutory informal ceiling or restricted merchandise). Entry must be filed on CBP Form 7501.";
    } else if (isEntryType13Selected) {
      // CBP Entry Type 13 Test Verification (19 U.S.C. § 1484, 91 FR 56936, Doc. 2026-21570, 91 FR 66707)
      const hasRight = Boolean(entryType13Eligibility?.hasRightToMakeEntry);
      const isParticipant =
        entryType13Eligibility?.isTestParticipant !== false &&
        entryType13Eligibility?.isCbpTestParticipant !== false;
      const hasAce = Boolean(entryType13Eligibility?.hasAceFilingCapability);
      const hasReqData = Boolean(entryType13Eligibility?.hasRequiredDataElements);
      const hasCh99Data =
        !hasChapter99Duties ||
        (entryType13Eligibility?.hasChapter99Data !== false &&
          (entryType13Eligibility?.hasChapter99Data === true ||
            entryType13Eligibility?.hasRequiredDataElements === true));
      const isPgaTempActive =
        entryType13Eligibility?.isPgaTemporaryAcceptanceActive !== false;
      const isPgaComplete = Boolean(entryType13Eligibility?.isPgaDataComplete);

      if (!hasRight) {
        entryType13MissingPrerequisites.push(
          "Filer right to make entry under 19 U.S.C. § 1484 unconfirmed (foreign exporters cannot file directly without a U.S. IOR or licensed customs broker acting as IOR)."
        );
      }
      if (!isParticipant) {
        entryType13MissingPrerequisites.push(
          "Filer test participation under CBP Entry Type 13 notices (91 FR 56936 & 91 FR 66707) unconfirmed."
        );
      }
      if (!hasAce) {
        entryType13MissingPrerequisites.push(
          "Electronic Automated Commercial Environment (ACE) / ABI filing capability unverified."
        );
      }
      if (!hasReqData) {
        entryType13MissingPrerequisites.push(
          "Mandatory Entry Type 13 electronic data elements in ACE (IOR ID, postal tracking number, 10-digit HTSUS, declared value) incomplete."
        );
      }
      if (!hasCh99Data) {
        entryType13MissingPrerequisites.push(
          "Additional Chapter 98/99 electronic data not supplied in ACE for trade remedy assessment under Heading 9903.05.44."
        );
      }
      if (!isPgaTempActive && !isPgaComplete) {
        entryType13MissingPrerequisites.push(
          "Complete electronic Partner Government Agency (PGA) data is mandatory after CBP's temporary acceptance period under 91 FR 66707."
        );
      } else if (isPgaTempActive && !isPgaComplete) {
        pgaWarning = ENTRY_TYPE_13_PGA_TEMPORARY_NOTICE;
      }

      const allPrereqsMet =
        hasRight &&
        isParticipant &&
        hasAce &&
        hasReqData &&
        hasCh99Data &&
        (isPgaTempActive || isPgaComplete);

      if (allPrereqsMet) {
        actualCarrierProcedure = isPostComplianceDate ? "ENTRY_TYPE_13" : "VOLUNTARY_ENTRY_TYPE_13";
        procedureCertainty = "CONFIRMED";
        postalEntryProcedure = isPostComplianceDate ? "ENTRY_TYPE_13" : "VOLUNTARY_TEST_ENTRY_TYPE_13";
        entryType13PrerequisitesVerified = true;
        isMandatoryFormalResult = false;
        postalEntryProcedureNotice = isPostComplianceDate
          ? "Qualifying Entry Type 13 informal entry test procedure verified under CBP Document 2026-21600 and Document 2026-21570 (91 FR 66707, Oct 22, 2026): Filer has legal right to make entry (19 U.S.C. § 1484), established test participation, ACE electronic filing capability, and required transmission data."
          : "Voluntary Entry Type 13 test procedure verified under CBP Document 2026-21570 (91 FR 66707): Filer has legal right to make entry (19 U.S.C. § 1484), established test participation, ACE filing capability, and complete transmission data.";
      } else {
        actualCarrierProcedure = "UNCONFIRMED";
        procedureCertainty = "UNCONFIRMED_CARRIER_HANDLING";
        postalEntryProcedure = "UNRESOLVED";
        entryType13PrerequisitesVerified = false;
        isMandatoryFormalResult = false;
        missingOperationalFacts.push(...entryType13MissingPrerequisites);
        postalEntryProcedureNotice =
          "CBP Entry Type 13 test eligibility unresolved: Pilot test (91 FR 56936 & 91 FR 66707) requires verified right to make entry (19 U.S.C. § 1484), test participation, ACE electronic filing capability, and required transmission data.";
      }
    } else if (isFormalSelected) {
      if (isPostComplianceDate) {
        actualCarrierProcedure = "FORMAL_ENTRY";
        procedureCertainty = "CONFIRMED";
        postalEntryProcedure = "FORMAL_ENTRY";
        isMandatoryFormalResult = true;
        postalEntryProcedureNotice =
          "Formal entry filed on CBP Form 7501 under 19 C.F.R. § 145.12(a)(2)(v) and (vi) (CBP Interim Final Rule 91 FR 37801 & Final Rule Doc. 2026-21600).";
      } else {
        actualCarrierProcedure = "VOLUNTARY_FORMAL_EARLY";
        procedureCertainty = "CONFIRMED";
        postalEntryProcedure = "VOLUNTARY_FORMAL_EARLY";
        isMandatoryFormalResult = false;
        postalEntryProcedureNotice =
          "Voluntary early formal compliance: CBP Form 7501 formal entry elected prior to the January 20, 2027 mandatory compliance date established by CBP Doc. 2026-21600 (Document 2026-21600, extending 91 FR 37801, Doc. 2026-12669).";
      }
    } else if (
      !isPostComplianceDate &&
      hasChapter99Duties &&
      (isPostalProcedureConfirmed || carrierPostalProcedure === "CONFIRMED_INFORMAL") &&
      complianceMode !== "UNKNOWN"
    ) {
      actualCarrierProcedure = "CONFIRMED_INFORMAL";
      procedureCertainty = "CONFIRMED";
      postalEntryProcedure = "INFORMAL_MAIL_EXTENDED";
      isMandatoryFormalResult = false;
      postalEntryProcedureNotice =
        "Eligible for existing informal postal clearance under 19 C.F.R. Part 145 during the compliance extension period established by CBP Doc. 2026-21600 (Document 2026-21600, published October 22, 2026), extending mandatory formal entry under 91 FR 37801 to January 20, 2027. Carrier informal clearance handling confirmed.";
    } else if (!hasChapter99Duties && complianceMode !== "UNKNOWN" && carrierPostalProcedure !== "UNCONFIRMED") {
      actualCarrierProcedure = "CONFIRMED_INFORMAL";
      procedureCertainty = "CONFIRMED";
      postalEntryProcedure = "INFORMAL_MAIL";
      isMandatoryFormalResult = false;
      postalEntryProcedureNotice =
        "Eligible for standard informal postal entry under 19 C.F.R. Part 145 (customs value <= $2,500 and not subject to Chapter 98/99 trade remedies).";
    } else {
      actualCarrierProcedure = "UNCONFIRMED";
      procedureCertainty = "UNCONFIRMED_CARRIER_HANDLING";
      postalEntryProcedure = "UNRESOLVED";
      isMandatoryFormalResult = false;
      if (isPostComplianceDate && hasChapter99Duties) {
        missingOperationalFacts.push(
          "Postal entry pathway (Formal entry on CBP Form 7501 vs. qualifying Entry Type 13 test) has not been confirmed with the carrier or filer."
        );
        postalEntryProcedureNotice =
          "Postal clearance procedure is unresolved: On or after January 20, 2027, qualifying Chapter 99 postal shipments may be entered via formal entry (19 C.F.R. § 145.12(a)(2)(v) & (vi)) or qualifying Entry Type 13 test (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707). Actual procedure and filer eligibility have not been established.";
      } else {
        missingOperationalFacts.push(
          "Actual postal carrier/operator clearance procedure during the extension period has not been confirmed with India Post / USPS."
        );
        postalEntryProcedureNotice =
          "Postal clearance procedure is unresolved: Carrier handling during the CBP Doc. 2026-21600 extension period is unconfirmed. Formal entry or informal clearance has not been affirmatively established with the carrier.";
      }
    }

    if (postalServiceType === "UNKNOWN" || !postalServiceType) {
      missingOperationalFacts.push(
        "Postal service classification (Ordinary Mail vs Inbound EMS) is unconfirmed under 19 C.F.R. § 24.23(c)(1)(v)."
      );
    }

    const postalDetails: PostalComplianceDetails = {
      legallyAvailableProcedure,
      legallyAvailablePathways,
      actualCarrierProcedure,
      isShipmentEligible,
      ineligibilityReason,
      voluntaryComplianceElection: complianceMode,
      procedureCertainty,
      missingOperationalFacts,
      filerEligibility: {
        hasRightToMakeEntry: Boolean(entryType13Eligibility?.hasRightToMakeEntry),
        isImporterOfRecordOrBroker: Boolean(entryType13Eligibility?.hasRightToMakeEntry),
        details: Boolean(entryType13Eligibility?.hasRightToMakeEntry)
          ? "Filer is verified U.S. Importer of Record or licensed customs broker acting as IOR (19 U.S.C. § 1484)."
          : "Filer right to make entry under 19 U.S.C. § 1484 is unconfirmed.",
      },
      testParticipation: {
        isTestParticipant:
          entryType13Eligibility?.isTestParticipant !== false &&
          entryType13Eligibility?.isCbpTestParticipant !== false,
        hasAceFilingCapability: Boolean(entryType13Eligibility?.hasAceFilingCapability),
        details: Boolean(entryType13Eligibility?.hasAceFilingCapability)
          ? "Electronic ACE/ABI filing capability established under CBP test notice (91 FR 66707)."
          : "Electronic ACE/ABI filing capability unverified.",
      },
      dataCompleteness: {
        hasRequiredEntryType13Data: Boolean(entryType13Eligibility?.hasRequiredDataElements),
        hasChapter99Data:
          !hasChapter99Duties ||
          (entryType13Eligibility?.hasChapter99Data !== false &&
            (entryType13Eligibility?.hasChapter99Data === true ||
              entryType13Eligibility?.hasRequiredDataElements === true)),
        isPgaDataComplete: Boolean(entryType13Eligibility?.isPgaDataComplete),
        isPgaTemporaryAcceptanceActive:
          entryType13Eligibility?.isPgaTemporaryAcceptanceActive !== false,
        pgaWarning,
        details: "ACE transmission data elements evaluation.",
      },
      entryType13PrerequisitesVerified: isEntryType13Selected
        ? entryType13PrerequisitesVerified
        : undefined,
      entryType13MissingPrerequisites:
        entryType13MissingPrerequisites.length > 0 ? entryType13MissingPrerequisites : undefined,
      pgaTemporaryAcceptanceNotice: pgaWarning,
    };

    const isFormalFiling =
      postalEntryProcedure === "FORMAL_MAIL_REQUIRED" ||
      postalEntryProcedure === "FORMAL_ENTRY" ||
      postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY";
      postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY";

    const isProcedureUnresolved =
      postalEntryProcedure === "UNRESOLVED" ||
      procedureCertainty === "UNCONFIRMED_CARRIER_HANDLING" ||
      postalServiceType === "UNKNOWN" ||
      !postalServiceType;

    if (isProcedureUnresolved) {
      const isFormalPostal = isFormalFiling;
      if (isFormalPostal) {
        appliedMin = formalMin;
        appliedMax = formalMax;
        const clamped = Math.min(Math.max(unclampedAmountUSD, formalMin), formalMax);
        finalMpfAmountUSD = roundCurrency(clamped);
        appliedEntryType = "FORMAL_ELECTRONIC";
        mpfStatus = "UNRESOLVED";
        statutoryNotes =
          "Postal classification or carrier election is UNRESOLVED under 19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), and CBP Doc. 2026-21600. Conservative formal MPF and EMS fee modeled.";
        carrierFacilityFeeNote =
          "Postal clearance procedure unresolved. Conservative formal MPF and EMS fee modeled pending confirmation.";
      } else {
        appliedEntryType = "EXEMPT_POSTAL";
        finalMpfAmountUSD = 0.0;
        mpfStatus = "UNRESOLVED";
        statutoryNotes =
          "Postal classification or carrier election is UNRESOLVED under 19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), and CBP Doc. 2026-21600. Provisional informal postal exemption modeled.";
        carrierFacilityFeeNote =
          "Postal service category or carrier clearance election unspecified. Operational clearance procedure unresolved.";
      }
      return {
        fiscalYear: "FY2027",
        federalRegisterCitation: "91 FR 48398 (Doc. 2026-15530, effective Oct 1, 2026)",
        appliedEntryType,
        isInformalEligible,
        isMandatoryFormal: isMandatoryFormalResult,
        postalEntryProcedure,
        postalEntryProcedureNotice,
        postalRuleEffectiveDate: POSTAL_RULE_EFFECTIVE_DATE,
        postalMandatoryComplianceDate: POSTAL_MANDATORY_COMPLIANCE_DATE,
        postalRuleExtensionNotice: POSTAL_RULE_EXTENSION_NOTICE,
        voluntaryPostalCompliance: complianceMode,
        carrierPostalProcedure: actualCarrierProcedure,
        postalDetails,
        adValoremRate,
        unclampedAmountUSD,
        appliedMinimumUSD: isFormalPostal ? appliedMin : undefined,
        appliedMaximumUSD: isFormalPostal ? appliedMax : undefined,
        manualSurchargeUSD: undefined,
        finalMpfAmountUSD,
        mpfStatus,
        postalServiceType: postalServiceType || "UNKNOWN",
        inboundEmsFeeUSD: postalServiceType === "INBOUND_EMS" ? 1.00 : isFormalPostal ? 1.00 : undefined,
        inboundEmsFeeNote:
          postalServiceType === "INBOUND_EMS"
            ? "Separate Inbound EMS item fee assessed under 19 C.F.R. § 24.22(l)(1)(i) ($1.00 per item; statutory amount unadjusted in FY2027 schedule 91 FR 48398). Pursuant to 19 C.F.R. § 24.22(l)(2), USPS retains 50% ($0.50) to cover postal customs clearance processing and remits 50% ($0.50) quarterly to CBP. Formal Inbound EMS entries also incur formal ad valorem MPF (§ 24.22(l)(1)(ii)). Distinct from private ECCF waybill fees (§ 24.23(b)(4))."
            : undefined,
        isQualifyingEccfOrHub: false,
        statutoryNotes,
        carrierFacilityFeeNote,
      };
    } else if (postalServiceType === "ORDINARY_MAIL") {
      // Ordinary International Mail
      // Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v) under ALL procedures (informal and formal).
      // Does NOT incur the § 24.22(l) $1 EMS fee.
      appliedEntryType = "EXEMPT_POSTAL";
      finalMpfAmountUSD = 0.0;
      mpfStatus = "VERIFIED_EXEMPT";
      statutoryNotes = isFormalFiling
        ? "Formal entry procedure utilized (CBP Form 7501), but ordinary mail remains statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v)."
        : postalEntryProcedure === "INFORMAL_MAIL_EXTENDED"
        ? "Informal postal clearance during extension period (CBP Doc. 2026-21600). Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v)."
        : postalEntryProcedure === "VOLUNTARY_TEST_ENTRY_TYPE_13" || postalEntryProcedure === "ENTRY_TYPE_13"
        ? "Entry Type 13 informal entry test (91 FR 66707). Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v)."
        : "Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v) (importations through international mail).";
      carrierFacilityFeeNote =
        "Ordinary international mail is statutorily exempt from Merchandise Processing Fee under 19 C.F.R. § 24.23(c)(1)(v). Inbound EMS fee (§ 24.22(l)) does not apply.";

      return {
        fiscalYear: "FY2027",
        federalRegisterCitation: "91 FR 48398 (Doc. 2026-15530, effective Oct 1, 2026)",
        appliedEntryType,
        isInformalEligible,
        isMandatoryFormal: isMandatoryFormalResult,
        postalEntryProcedure,
        postalEntryProcedureNotice,
        postalRuleEffectiveDate: POSTAL_RULE_EFFECTIVE_DATE,
        postalMandatoryComplianceDate: POSTAL_MANDATORY_COMPLIANCE_DATE,
        postalRuleExtensionNotice: POSTAL_RULE_EXTENSION_NOTICE,
        voluntaryPostalCompliance: complianceMode,
        carrierPostalProcedure: actualCarrierProcedure,
        postalDetails,
        adValoremRate,
        unclampedAmountUSD,
        finalMpfAmountUSD,
        mpfStatus,
        postalServiceType,
        inboundEmsFeeUSD: undefined, // Ordinary mail has NO EMS fee!
        isQualifyingEccfOrHub: false,
        statutoryNotes,
        carrierFacilityFeeNote,
      };
    } else if (postalServiceType === "INBOUND_EMS") {
      // Inbound Express Mail Service (EMS)
      // 1. Separate EMS Item Fee: $1.00 under 19 C.F.R. § 24.22(l)(1)(i) (unadjusted in FY2027 notice 91 FR 48398).
      // Under § 24.22(l)(2), USPS retains 50% ($0.50) for its postal services and remits 50% ($0.50) quarterly to CBP.
      const inboundEmsFeeUSD = 1.00;
      const inboundEmsFeeNote =
        "Separate Inbound EMS item fee assessed under 19 C.F.R. § 24.22(l)(1)(i) ($1.00 per item; statutory amount unadjusted in FY2027 schedule 91 FR 48398). Pursuant to 19 C.F.R. § 24.22(l)(2), USPS retains 50% ($0.50) to cover postal customs clearance processing and remits 50% ($0.50) quarterly to CBP. Formal Inbound EMS entries also incur formal ad valorem MPF (§ 24.22(l)(1)(ii)). Distinct from private ECCF waybill fees (§ 24.23(b)(4)).";

      if (isFormalFiling) {
        // Formal Inbound EMS (Mandatory formal or voluntary early formal):
        // Under 85 FR 47018 exception to § 24.23(c)(1)(v) and § 24.22(l)(1)(ii),
        // formal ad valorem MPF applies in addition to the $1.00 EMS fee!
        appliedMin = formalMin;
        appliedMax = formalMax;
        if (entryType === "FORMAL_MANUAL") {
          appliedEntryType = "FORMAL_MANUAL";
          manualSurcharge = formalManualSurcharge;
          const clamped = Math.min(Math.max(unclampedAmountUSD, formalMin), formalMax);
          finalMpfAmountUSD = roundCurrency(clamped + formalManualSurcharge);
        } else {
          appliedEntryType = "FORMAL_ELECTRONIC";
          const clamped = Math.min(Math.max(unclampedAmountUSD, formalMin), formalMax);
          finalMpfAmountUSD = roundCurrency(clamped);
        }
        mpfStatus = "VERIFIED_ASSESSED";
        statutoryNotes =
          postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY"
            ? "Inbound EMS voluntary early formal entry: Subject to formal ad valorem MPF under 85 FR 47018 (exception to 19 C.F.R. § 24.23(c)(1)(v)) and separate $1.00 EMS item fee under § 24.22(l)(1)(i)."
            : "Inbound EMS formal entry: Subject to formal ad valorem MPF under 85 FR 47018 (exception to 19 C.F.R. § 24.23(c)(1)(v)) and separate $1.00 EMS item fee under § 24.22(l)(1)(i). Formal entry mandated under CBP rule 91 FR 37801 (compliance date Jan 20, 2027 per CBP Doc. 2026-21600).";
        carrierFacilityFeeNote =
          "Inbound Express Mail Service (EMS) formally entered is subject to formal ad valorem MPF ($34.58 minimum) under 85 FR 47018, plus separate $1.00 EMS item fee under 19 C.F.R. § 24.22(l)(1)(i).";
      } else {
        // Informal Inbound EMS (value <= $2,500 during extension, regular informal, or Entry Type 13 test):
        // Informal EMS is exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v) (85 FR 47018 exception is strictly for formal entries),
        // but incurs the separate $1.00 EMS item fee under 19 C.F.R. § 24.22(l)(1)(i).
        appliedEntryType = "EXEMPT_POSTAL";
        finalMpfAmountUSD = 0.0;
        mpfStatus = "VERIFIED_EXEMPT";
        statutoryNotes =
          postalEntryProcedure === "INFORMAL_MAIL_EXTENDED"
            ? "Inbound EMS informal clearance during extension period (CBP Doc. 2026-21600): Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v). Incurs separate $1.00 EMS item fee under 19 C.F.R. § 24.22(l)(1)(i)."
            : postalEntryProcedure === "VOLUNTARY_TEST_ENTRY_TYPE_13" || postalEntryProcedure === "ENTRY_TYPE_13"
            ? "Inbound EMS Entry Type 13 informal entry test (91 FR 66707): Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v). Incurs separate $1.00 EMS item fee under 19 C.F.R. § 24.22(l)(1)(i)."
            : "Inbound EMS informal entry: Statutorily exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v). Incurs separate $1.00 EMS item fee under 19 C.F.R. § 24.22(l)(1)(i).";
        carrierFacilityFeeNote =
          "Inbound EMS entering under informal procedures is exempt from MPF under 19 C.F.R. § 24.23(c)(1)(v). Separate $1.00 EMS item fee applies under § 24.22(l)(1)(i).";
      }

      return {
        fiscalYear: "FY2027",
        federalRegisterCitation: "91 FR 48398 (Doc. 2026-15530, effective Oct 1, 2026)",
        appliedEntryType,
        isInformalEligible,
        isMandatoryFormal: isMandatoryFormalResult,
        postalEntryProcedure,
        postalEntryProcedureNotice,
        postalRuleEffectiveDate: POSTAL_RULE_EFFECTIVE_DATE,
        postalMandatoryComplianceDate: POSTAL_MANDATORY_COMPLIANCE_DATE,
        postalRuleExtensionNotice: POSTAL_RULE_EXTENSION_NOTICE,
        voluntaryPostalCompliance: complianceMode,
        carrierPostalProcedure: actualCarrierProcedure,
        postalDetails,
        adValoremRate,
        unclampedAmountUSD,
        appliedMinimumUSD: appliedMin,
        appliedMaximumUSD: appliedMax,
        manualSurchargeUSD: manualSurcharge,
        finalMpfAmountUSD,
        mpfStatus,
        postalServiceType,
        inboundEmsFeeUSD,
        inboundEmsFeeNote,
        isQualifyingEccfOrHub: false,
        statutoryNotes,
        carrierFacilityFeeNote,
      };
    } else {
      // Fallback for unspecified postal service type
      return {
        fiscalYear: "FY2027",
        federalRegisterCitation: "91 FR 48398 (Doc. 2026-15530, effective Oct 1, 2026)",
        appliedEntryType: "EXEMPT_POSTAL",
        isInformalEligible,
        isMandatoryFormal: isMandatoryFormalResult,
        postalEntryProcedure: "UNRESOLVED",
        postalEntryProcedureNotice: "Postal service classification unspecified under CBP Doc. 2026-21600.",
        postalRuleEffectiveDate: POSTAL_RULE_EFFECTIVE_DATE,
        postalMandatoryComplianceDate: POSTAL_MANDATORY_COMPLIANCE_DATE,
        postalRuleExtensionNotice: POSTAL_RULE_EXTENSION_NOTICE,
        voluntaryPostalCompliance: complianceMode,
        carrierPostalProcedure: actualCarrierProcedure,
        postalDetails,
        adValoremRate,
        unclampedAmountUSD,
        finalMpfAmountUSD: 0.0,
        mpfStatus: "UNRESOLVED",
        postalServiceType: "UNKNOWN",
        isQualifyingEccfOrHub: false,
        statutoryNotes: "Postal classification or carrier election unspecified under CBP Doc. 2026-21600.",
        carrierFacilityFeeNote: "Postal classification unspecified.",
      };
    }
  }

  // 2. COMMERCIAL / EXPRESS CARRIER MODES
  if (isInformalEligible && entryType !== "FORMAL_ELECTRONIC" && entryType !== "FORMAL_MANUAL") {
    // Informal Entry Mode (<= $2,500)
    if (isQualifyingEccfOrHub) {
      // Under 19 C.F.R. § 24.23(b)(2)(i), informal MPF does NOT apply to express consignment/centralized hub shipments
      // where the carrier/operator pays the $1.38 reimbursable waybill fee under § 24.23(b)(4).
      appliedEntryType = "INFORMAL_AUTOMATED";
      finalMpfAmountUSD = 0.0;
      mpfStatus = "VERIFIED_EXEMPT";
      carrierFacilityFeeNote =
        "Informal entry cleared under 19 C.F.R. § 24.23(b)(4) express consignment procedures. The $1.38 individual waybill fee is paid directly by the facility operator/carrier to CBP; informal MPF ($2.77) is exempt under § 24.23(b)(2)(i).";
    } else {
      if (entryType === "INFORMAL_MANUAL") {
        appliedEntryType = "INFORMAL_MANUAL";
        finalMpfAmountUSD = informalManualNotCbp;
      } else if (entryType === "INFORMAL_CBP_PREP") {
        appliedEntryType = "INFORMAL_CBP_PREP";
        finalMpfAmountUSD = informalManualCbp;
      } else {
        appliedEntryType = "INFORMAL_AUTOMATED";
        finalMpfAmountUSD = informalAutoFee;
      }
      mpfStatus = "VERIFIED_ASSESSED";
      carrierFacilityFeeNote = `Standard informal entry clearance. Statutory user fee of $${finalMpfAmountUSD.toFixed(2)} applies.`;
    }
  } else {
    // Formal Entry Mode (> $2,500 OR mandatory formal entry <= $2,500)
    appliedMin = formalMin;
    appliedMax = formalMax;

    if (entryType === "FORMAL_MANUAL") {
      appliedEntryType = "FORMAL_MANUAL";
      manualSurcharge = formalManualSurcharge;
      const clamped = Math.min(Math.max(unclampedAmountUSD, formalMin), formalMax);
      finalMpfAmountUSD = roundCurrency(clamped + formalManualSurcharge);
    } else {
      appliedEntryType = "FORMAL_ELECTRONIC";
      const clamped = Math.min(Math.max(unclampedAmountUSD, formalMin), formalMax);
      finalMpfAmountUSD = roundCurrency(clamped);
    }
    mpfStatus = "VERIFIED_ASSESSED";

    if (isMandatoryFormal && dutiableCustomsValueUSD <= 2500.0) {
      carrierFacilityFeeNote =
        "Shipment valued at $2,500 or less requires formal entry due to Partner Government Agency (PGA) or quota/AD/CVD restrictions. Formal ad valorem MPF applies with statutory $34.58 minimum.";
    } else if (isQualifyingEccfOrHub) {
      carrierFacilityFeeNote =
        "Formal entry processed at an Express Consignment Carrier Facility or Centralized Hub Facility. The importer owes formal ad valorem MPF ($34.58 minimum) on entry summary (CBP Form 7501); carrier facility fee of $1.38 is tracked separately.";
    }
  }

  return {
    fiscalYear: "FY2027",
    federalRegisterCitation: "91 FR 48398 (Doc. 2026-15530, effective Oct 1, 2026)",
    appliedEntryType,
    isInformalEligible,
    isMandatoryFormal,
    adValoremRate,
    unclampedAmountUSD,
    appliedMinimumUSD: appliedMin,
    appliedMaximumUSD: appliedMax,
    manualSurchargeUSD: manualSurcharge,
    finalMpfAmountUSD,
    mpfStatus,
    postalServiceType,
    isQualifyingEccfOrHub,
    eccfWaybillFeeUSD: isQualifyingEccfOrHub ? 1.38 : undefined,
    statutoryNotes: `Assessed under 19 U.S.C. § 58c and 19 C.F.R. § 24.23. FY2027 statutory schedule.`,
    carrierFacilityFeeNote,
  };
}

/**
 * 5. Harbor Maintenance Fee (HMF) Engine (19 C.F.R. § 24.24)
 * 
 * Implements 0.125% fee on waterborne commercial cargo and
 * statutory informal-entry exemption under 19 C.F.R. § 24.24(d)(3)(i).
 */
export function calculateHmf(
  dutiableCustomsValueUSD: number,
  transportationMode: TransportationMode,
  isInformalEntryEntitled = true
): HmfComponentBreakdown {
  const isWaterborneCargo = transportationMode === "OCEAN_LCL" || transportationMode === "OCEAN_FCL";
  const adValoremRate = 0.00125; // 0.125%

  if (!isWaterborneCargo) {
    return {
      statutoryBasis: "26 U.S.C. § 4461 / 19 C.F.R. § 24.24",
      transportationMode,
      isWaterborneCargo: false,
      isInformalEntryEntitled,
      isMandatoryFormalOcean: false,
      isExempt: true,
      exemptionReason: "Air and postal transportation are exempt from waterborne Harbor Maintenance Fee.",
      adValoremRate,
      hmfAmountUSD: 0.0,
      hmfStatus: "VERIFIED_EXEMPT",
    };
  }

  // Waterborne Cargo (Ocean)
  if (isInformalEntryEntitled && dutiableCustomsValueUSD <= 2500.0) {
    return {
      statutoryBasis: "26 U.S.C. § 4461 / 19 C.F.R. § 24.24",
      transportationMode,
      isWaterborneCargo: true,
      isInformalEntryEntitled: true,
      isMandatoryFormalOcean: false,
      isExempt: true,
      exemptionReason:
        "Statutorily exempt under 19 C.F.R. § 24.24(d)(3)(i) — Commercial cargo entering under informal entry procedures of 19 C.F.R. Part 143.",
      adValoremRate,
      hmfAmountUSD: 0.0,
      hmfStatus: "VERIFIED_EXEMPT",
    };
  }

  // Formal Ocean Cargo (> $2,500 or mandatory formal)
  const hmfAmount = roundCurrency(dutiableCustomsValueUSD * adValoremRate);
  return {
    statutoryBasis: "26 U.S.C. § 4461 / 19 C.F.R. § 24.24",
    transportationMode,
    isWaterborneCargo: true,
    isInformalEntryEntitled: false,
    isMandatoryFormalOcean: !isInformalEntryEntitled && dutiableCustomsValueUSD <= 2500.0,
    isExempt: false,
    adValoremRate,
    hmfAmountUSD: hmfAmount,
    hmfStatus: "VERIFIED_ASSESSED",
  };
}

/**
 * 6. Master Landed-Cost Calculator Dispatcher
 * 
 * Orchestrates deterministic valuation, duty calculation, MPF, HMF, and DAP partitioning.
 * Enforces the strict 4-state status contract (VERIFIED, PARTIALLY_VERIFIED, ESTIMATED, BLOCKED).
 */
export function calculateLandedCost(
  request: LandedCostCalculationRequest
): LandedCostCalculationResult {
  const assumptions: string[] = [];
  const missingInformation: string[] = [];
  const advisoryWarnings: string[] = [];
  const unresolvedFactors: string[] = [];
  let conditionalScenarios: LandedCostCalculationResult["conditionalScenarios"];

  // 1. Validation & Input Integrity
  if (request.originCountry.toUpperCase() !== "IN" || request.destinationCountry.toUpperCase() !== "US") {
    throw new LandedCostCalculationError(
      `Unsupported trade corridor "${request.originCountry} -> ${request.destinationCountry}". BorderBrief AI currently supports the India -> United States trade corridor only.`,
      "UNSUPPORTED_CORRIDOR",
      400
    );
  }

  if (request.quantity <= 0 || !Number.isInteger(request.quantity)) {
    throw new LandedCostCalculationError(
      "Merchandise quantity must be a positive whole integer.",
      "INVALID_QUANTITY",
      400
    );
  }

  if (request.unitPriceUSD <= 0) {
    throw new LandedCostCalculationError(
      "Unit selling price must be a strictly positive number.",
      "INVALID_PRICE",
      400
    );
  }

  // 2. Strict Ambiguity Contract Check
  // An unresolved classification (e.g. Sheesham coasters or generic ceramic mug) MUST produce BLOCKED.
  if (request.classificationStatus === "UNRESOLVED_AMBIGUITY") {
    throw new LandedCostCalculationError(
      `Classification ambiguity for "${request.productTitle}" is unresolved. An authoritative landed-cost calculation cannot be generated when the tariff classification is ambiguous.`,
      "CLASSIFICATION_AMBIGUITY_UNRESOLVED",
      422,
      { productTitle: request.productTitle, status: "BLOCKED" }
    );
  }

  // 3. Customs Valuation
  const valuation = calculateCustomsValuation(request.valuation);
  advisoryWarnings.push(...valuation.warnings);

  if (valuation.valuationStatus === "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION") {
    unresolvedFactors.push("Freight deduction documentation missing (carrier receipt/waybill not provided).");
  }

  // 4. Customs Duty Components
  const { dutyBreakdown, record } = calculateDutyComponents(
    request.hts10,
    valuation.dutiableCustomsValueUSD,
    request.originCountry
  );

  // 5. User Fees
  const hasChapter99Duties =
    Boolean(dutyBreakdown.section301.isApplicable && dutyBreakdown.section301.additionalDutyAmountUSD > 0) ||
    Boolean(dutyBreakdown.otherChapter99DutyAmountUSD && dutyBreakdown.otherChapter99DutyAmountUSD > 0);

  // Server-side clock & date evaluation (Strictly decoupled from silent 2026-11-07 default)
  const clock = request.clock || defaultSystemClock;
  const now = clock();
  const calculationDate = request.calculationDate || now.toISOString().slice(0, 10);
  const calculatedAt = now.toISOString();

  // Validate and resolve import / entry date (Governs statutory HTS & postal compliance)
  const declaredImportDate =
    request.importDate ||
    request.asOfDate ||
    request.valuation.importDate ||
    request.valuation.asOfDate;

  let importDate: string;
  let isSimulation = false;
  let simulationNotice: string | undefined;

  if (declaredImportDate) {
    const dateVal = validateIsoDate(declaredImportDate, "importDate");
    if (!dateVal.isValid) {
      throw new LandedCostCalculationError(
        dateVal.error || `Invalid import date "${declaredImportDate}". Expected strict YYYY-MM-DD format.`,
        "INVALID_VALUATION",
        400
      );
    }
    importDate = dateVal.normalized!;
    if (request.isDemoMode || request.valuation.isDemoMode) {
      isSimulation = true;
      simulationNotice = `Simulation mode: Date ${importDate} evaluated in demonstration sandbox.`;
    }
  } else if (request.isDemoMode || request.valuation.isDemoMode) {
    importDate = "2026-11-07";
    isSimulation = true;
    simulationNotice =
      "Simulation baseline date 2026-11-07 applied for demonstration purposes. This is an illustrative simulation; actual import compliance depends on the genuine commercial entry date.";
  } else {
    importDate = calculationDate;
    isSimulation = false;
  }

  const voluntaryPostalCompliance =
    request.voluntaryPostalCompliance || request.valuation.voluntaryPostalCompliance;
  const carrierPostalProcedure =
    request.carrierPostalProcedure || request.valuation.carrierPostalProcedure;
  const isPostalProcedureConfirmed = Boolean(
    request.isPostalProcedureConfirmed || request.valuation.isPostalProcedureConfirmed
  );
  const entryType13Eligibility =
    request.entryType13Eligibility || request.valuation.entryType13Eligibility;

  const isInformalEntitled = !request.isMandatoryFormal && valuation.dutiableCustomsValueUSD <= 2500.0;
  const mpfBreakdown = calculateMpf(
    valuation.dutiableCustomsValueUSD,
    request.entryType,
    Boolean(request.isQualifyingEccfOrHub),
    Boolean(request.isMandatoryFormal),
    request.transportationMode,
    request.postalServiceType || request.valuation.postalServiceType,
    hasChapter99Duties,
    importDate,
    voluntaryPostalCompliance,
    carrierPostalProcedure,
    isPostalProcedureConfirmed,
    entryType13Eligibility
  );
  const hmfBreakdown = calculateHmf(
    valuation.dutiableCustomsValueUSD,
    request.transportationMode,
    isInformalEntitled
  );

  // 6. Total Aggregations
  const baseCustomsDutyUSD = dutyBreakdown.baseDutyAmountUSD;
  const section301DutyUSD = dutyBreakdown.section301.additionalDutyAmountUSD;
  const otherChapter99DutyUSD = dutyBreakdown.otherChapter99DutyAmountUSD || 0;
  const totalCustomsDutyUSD = dutyBreakdown.totalDutyAmountUSD;
  const inboundEmsFeeUSD = mpfBreakdown.inboundEmsFeeUSD;
  const totalCustomsFeesUSD = roundCurrency(
    mpfBreakdown.finalMpfAmountUSD + hmfBreakdown.hmfAmountUSD + (inboundEmsFeeUSD || 0)
  );
  const eccfWaybillFeeUSD = mpfBreakdown.eccfWaybillFeeUSD;
  const internationalShippingUSD = roundCurrency(request.valuation.internationalShippingDeductionUSD || 0);
  const insuranceUSD = roundCurrency(request.valuation.insuranceDeductionUSD || 0);
  const estimatedBrokerageUSD = roundCurrency(request.estimatedBrokerageFeeUSD || 0);

  // DAP Allocation
  const sellerCollectedViaPaypalUSD = roundCurrency(request.valuation.grossInvoicePriceUSD);
  const buyerPayableUponArrivalUSD = roundCurrency(
    totalCustomsDutyUSD + totalCustomsFeesUSD + estimatedBrokerageUSD
  );
  const totalLandedCostUSD = roundCurrency(sellerCollectedViaPaypalUSD + buyerPayableUponArrivalUSD);

  const dapAllocation: DapResponsibilityAllocation = {
    sellerCollectedViaPaypalUSD,
    buyerPayableUponArrivalUSD,
    totalDeliveredLandedCostUSD: totalLandedCostUSD,
  };

  // 7. Reconcile 4-State Overall Calculation Status
  let status: LandedCostStatus = "VERIFIED";

  // Check Darjeeling Tea / Section 301 Unresolved condition
  if (dutyBreakdown.section301.exemptionStatus === "UNRESOLVED") {
    status = "PARTIALLY_VERIFIED";
    unresolvedFactors.push(
      "Section 301 Annex II Part A exemption applicability is unverified in official publication."
    );
    conditionalScenarios = [
      {
        scenarioName: "Scenario A: Confirmed Annex II Agricultural Exemption",
        applicableDutyRate: roundCurrency(dutyBreakdown.baseAdValoremRate),
        estimatedLandedCostUSD: roundCurrency(
          sellerCollectedViaPaypalUSD + baseCustomsDutyUSD + totalCustomsFeesUSD + estimatedBrokerageUSD
        ),
        conditionRequired: "Official confirmation that HTS 0902.30.00 is excluded under USTR Doc. 2026-15181 Annex II Part A.",
      },
      {
        scenarioName: "Scenario B: Covered under Section 301 Heading 9903.05.44 (10%)",
        applicableDutyRate: roundCurrency(dutyBreakdown.baseAdValoremRate + 10.0),
        estimatedLandedCostUSD: totalLandedCostUSD,
        conditionRequired: "Absence of official Annex II Part A exclusion attaches 10% additional duty.",
      },
    ];
  }

  // Check Undocumented Valuation / Conservative Illustrative Scenario
  if (valuation.valuationScenarioType === "CONSERVATIVE_ILLUSTRATIVE_GROSS") {
    if (status === "VERIFIED") {
      status = "PARTIALLY_VERIFIED";
    }
    missingInformation.push(...valuation.missingDocumentation);
  }

  // Check Unresolved MPF Condition (e.g. Unresolved Postal Treatment or unconfirmed carrier election)
  if (
    mpfBreakdown.mpfStatus === "UNRESOLVED" ||
    mpfBreakdown.postalEntryProcedure === "UNRESOLVED" ||
    mpfBreakdown.postalDetails?.procedureCertainty === "UNCONFIRMED_CARRIER_HANDLING"
  ) {
    if (status === "VERIFIED") {
      status = "PARTIALLY_VERIFIED";
    }
    if (
      mpfBreakdown.postalDetails?.missingOperationalFacts &&
      mpfBreakdown.postalDetails.missingOperationalFacts.length > 0
    ) {
      for (const fact of mpfBreakdown.postalDetails.missingOperationalFacts) {
        if (!unresolvedFactors.includes(fact)) {
          unresolvedFactors.push(fact);
        }
      }
    } else {
      unresolvedFactors.push(
        mpfBreakdown.postalEntryProcedureNotice ||
          "Postal service classification or carrier clearance election is unconfirmed under CBP Document 2026-21600."
      );
    }
  }

  // Check User-Confirmed Flag
  if (request.isConfirmedByUser === false) {
    if (status === "VERIFIED") {
      status = "ESTIMATED";
    }
    assumptions.push("Classification candidate selected by user but not formally locked.");
  }

  // Document Core Assumptions
  assumptions.push(`Import corridor: India to United States under ${request.incoterm || "DAP"} commercial terms.`);
  assumptions.push(`Customs valuation evaluated under 19 U.S.C. § 1401a Transaction Value.`);
  assumptions.push(`Tariff rates evaluated against USITC 2026 HTS Revision 22 statutory baseline.`);
  assumptions.push(`User fees evaluated under official FY2027 schedule (effective Oct 1, 2026).`);
  
  if (isSimulation) {
    assumptions.push("Simulation Mode: Compliance evaluated against demo baseline date 2026-11-07.");
  } else if (declaredImportDate) {
    assumptions.push(`Regulations and postal compliance evaluated as of declared import date (${importDate}).`);
  } else {
    assumptions.push(
      `Merchandise import date not explicitly specified; evaluated using server-side calculation date (${calculationDate}).`
    );
  }

  if (
    mpfBreakdown.postalEntryProcedure === "FORMAL_MAIL_REQUIRED" ||
    mpfBreakdown.postalEntryProcedure === "FORMAL_ENTRY"
  ) {
    assumptions.push(
      "Postal formal entry procedure required on CBP Form 7501 under 19 C.F.R. Part 145 and CBP final rule 91 FR 37801 (Doc. 2026-12669, compliance date Jan 20, 2027 per CBP Doc. 2026-21600) due to Chapter 99 Section 301 duties or merchandise value exceeding $2,500."
    );
  } else if (mpfBreakdown.postalEntryProcedure === "INFORMAL_MAIL_EXTENDED") {
    assumptions.push(
      "Postal informal clearance applied under 19 C.F.R. Part 145 during the compliance extension period established by CBP Doc. 2026-21600 (mandatory compliance date Jan 20, 2027)."
    );
  } else if (mpfBreakdown.postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY") {
    assumptions.push(
      "Voluntary early formal entry on CBP Form 7501 elected prior to the January 20, 2027 compliance date under CBP Doc. 2026-21600."
    );
  } else if (
    mpfBreakdown.postalEntryProcedure === "VOLUNTARY_TEST_ENTRY_TYPE_13" ||
    mpfBreakdown.postalEntryProcedure === "ENTRY_TYPE_13"
  ) {
    assumptions.push(
      "Entry Type 13 informal entry test procedure modeled under CBP mail clearance test (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707)."
    );
  }

  const calculationId = `calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    calculationId,
    calculatedAt,
    calculationDate,
    importDate,
    isSimulation,
    simulationNotice,
    status,
    datasetCoverageStatus: "SUPPORTED_CURATED_STORE",
    productId: request.productId,
    productTitle: request.productTitle,
    originCountry: request.originCountry,
    destinationCountry: request.destinationCountry,
    quantity: request.quantity,
    unitPriceUSD: request.unitPriceUSD,
    dutiableCustomsValueUSD: valuation.dutiableCustomsValueUSD,
    customsValuationMethod: valuation.customsValuationMethod,
    valuationScenarioType: valuation.valuationScenarioType,
    postalServiceType: request.postalServiceType || request.valuation.postalServiceType,
    carrierPostalProcedure: mpfBreakdown.carrierPostalProcedure,
    postalComplianceDetails: mpfBreakdown.postalDetails,
    baseCustomsDutyUSD,
    section301DutyUSD,
    otherChapter99DutyUSD,
    totalCustomsDutyUSD,
    totalCustomsFeesUSD,
    eccfWaybillFeeUSD,
    inboundEmsFeeUSD,
    postalEntryProcedure: mpfBreakdown.postalEntryProcedure,
    postalEntryProcedureNotice: mpfBreakdown.postalEntryProcedureNotice,
    postalRuleEffectiveDate: mpfBreakdown.postalRuleEffectiveDate,
    postalMandatoryComplianceDate: mpfBreakdown.postalMandatoryComplianceDate,
    postalRuleExtensionNotice: mpfBreakdown.postalRuleExtensionNotice,
    voluntaryPostalCompliance: mpfBreakdown.voluntaryPostalCompliance,
    internationalShippingUSD,
    insuranceUSD,
    estimatedBrokerageUSD,
    totalLandedCostUSD,
    dapAllocation,
    dutyBreakdown,
    mpfBreakdown,
    hmfBreakdown,
    statutoryRevision: record.statutoryRevision,
    section301Authority: dutyBreakdown.section301.legalAuthority,
    mpfScheduleAuthority: mpfBreakdown.federalRegisterCitation,
    effectiveDate: record.effectiveDate,
    disclaimer:
      "Statutory Notice (19 U.S.C. § 1484): The legal responsibility for exercising reasonable care to properly declare merchandise classification, customs value, and duty payment upon commercial entry into the United States rests with the U.S. Importer of Record. This calculation is a deterministic compliance estimate provided for Indian exporters.",
    assumptions,
    missingInformation,
    advisoryWarnings,
    unresolvedFactors: unresolvedFactors.length > 0 ? unresolvedFactors : undefined,
    conditionalScenarios,
  };
}
