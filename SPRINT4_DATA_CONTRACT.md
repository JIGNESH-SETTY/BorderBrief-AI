# BorderBrief AI — Sprint 4 Data Contract & Interface Specification

**Document ID:** SPRINT4_DATA_CONTRACT.md  
**Audit Date:** November 7, 2026 (Final Section 301 Legal Interpretation Correction)  
**Status:** Architecture Blueprint (Drafted for Sprint 4 Implementation; Non-Executing)  
**Corridor:** India (`IN`) $\rightarrow$ United States of America (`US`)  
**Regulatory Baseline:** 
- USITC 2026 HTS Revision 22 (Oct 30, 2026), Chapter 99 & U.S. Note 52
- USTR Section 301 Actions (91 FR Doc. 2026-15181; Heading `9903.05.44` @ 10%; CSMS #69326983; effective July 24, 2026; Section 24 Determination, Annex I & Annex II Part A Exemption Schedules)
- 19 U.S.C. § 1401a (Customs Valuation / Transaction Value)
- 19 C.F.R. § 24.23 (FY2027 MPF Schedule 91 FR 48398; Express Consignment Carrier Facility & Centralized Hub Facility $1.38 Waybill Fee § 24.23(b)(4))
- 19 C.F.R. § 24.24 (HMF & § 24.24(d)(3)(i) Informal Entry Exemption)

---

## 1. Overview & Architectural Principles

This document defines the TypeScript contracts, schemas, validation rules, and error envelopes for the **Deterministic Landed-Cost Calculator** in Sprint 4.

### Guiding Principles:
1. **Zero AI In The Math Loop:** All arithmetic is 100% deterministic, rounded to 2 decimal places using standard financial round-half-up math. No generative model will ever compute or estimate duties.
2. **Strict Source Traceability:** Every calculated duty and fee must reference its governing statute, USITC schedule line, CSMS notice, or Federal Register citation.
3. **Ambiguity Guardrails:** A classification with `UNRESOLVED_AMBIGUITY` and `primaryCandidate === null` must **never silently produce a definitive landed-cost amount**. It must produce a `BLOCKED` state.
4. **Never Default Unresolved Duties to Zero:** If Chapter 99 Section 301 exemption applicability cannot be established with documentary proof, the result must be flagged as `PARTIALLY_VERIFIED` or `BLOCKED` with explicit scenario bounds. The system will never fabricate exemptions.
5. **Separate Duty Components Mandate:** Base customs duty, Section 301 duty, user fees, and freight exclusions must be stored, evaluated, and presented as separate statutory lines, never collapsed into hardcoded blended rates in calculation logic.
6. **Curated Dataset Boundary Protection:** The calculator operates strictly on the 30 curated records in `authoritative-store.ts`. If an uncataloged HTS code is submitted, it returns `DATASET_COVERAGE_UNSUPPORTED` (HTTP 422).
7. **DAP Cost Assignment:** Calculations must cleanly divide amounts between:
   - **Seller-Billed Amount (Collected via PayPal):** Merchandise Price + International Shipping.
   - **Buyer-Payable Amount (Assessed at US Port of Entry):** Base Duty + Section 301 Duty + MPF + HMF + Estimated Carrier Fees.

---

## 2. Proposed TypeScript Data Contracts

The following interfaces are proposed for addition to `src/types/export.ts` in Sprint 4:

```typescript
/**
 * Mode of international freight transportation.
 * Directly dictates HMF applicability (26 U.S.C. § 4461 / 19 C.F.R. § 24.24).
 */
export type TransportationMode = "AIR_EXPRESS" | "AIR_CARGO" | "OCEAN_LCL" | "OCEAN_FCL" | "POSTAL";

/**
 * U.S. Customs entry category under 19 C.F.R. Part 143.
 * Determines MPF structure (Informal flat vs. Formal ad valorem).
 */
export type CustomsEntryType = 
  | "AUTO_DETECT"        // Engine selects informal (<= $2500) or formal (> $2500)
  | "INFORMAL_AUTOMATED" // Flat $2.77 (ABI filed, commercial <= $2500)
  | "INFORMAL_MANUAL"    // Flat $8.30 (Paper filed, not CBP prepared)
  | "INFORMAL_CBP_PREP"  // Flat $12.45 (Paper filed, prepared by CBP)
  | "FORMAL_ELECTRONIC"  // 0.3464% (Min $34.58, Max $670.86)
  | "FORMAL_MANUAL";     // 0.3464% + $4.15 manual surcharge

/**
 * High-Level Calculation Status State Machine (Strict 4-State Enum).
 * Component-level statuses (such as Section 301 status) are kept separate.
 */
export type LandedCostStatus = 
  | "VERIFIED"            // Resolved classification, supported valuation, verified base duty, verified Section 301 & Ch 99 status, resolved entry/fee treatment
  | "PARTIALLY_VERIFIED"  // Base rate verified, but Section 301 exemption, informal HMF, or valuation documentation is conditional/unconfirmed
  | "ESTIMATED"           // Preliminary advisory estimation based on user-declared provisional figures; does NOT assume unsupported deductions or exemptions
  | "BLOCKED";            // Unresolved classification ambiguity, unsupported HTS code outside curated store, or invalid valuation

/**
 * Customs Valuation Declarations under 19 U.S.C. § 1401a.
 */
export interface CustomsValuationDeclaration {
  /**
   * Gross commercial invoice price agreed between buyer and seller.
   */
  grossInvoicePriceUSD: number;

  /**
   * Separately itemized international carriage costs incident to international shipment.
   * Excluded from Transaction Value pursuant to 19 U.S.C. § 1401a(b)(4)(A) only if supported by actual documentation.
   */
  internationalShippingDeductionUSD: number;

  /**
   * Evidentiary proof flag: Are actual carrier receipts, airway bills, or freight invoices available?
   * Freight deductions are NEVER assumed without sufficient documentation.
   */
  isShippingDocumented: boolean;

  /**
   * Evidentiary documentation reference (e.g. "Air Waybill #123456789").
   */
  shippingDocumentationEvidence?: string;

  /**
   * Separately itemized international transit insurance.
   * Excluded from Transaction Value pursuant to 19 U.S.C. § 1401a(b)(4)(A) only if supported by actual documentation.
   */
  insuranceDeductionUSD?: number;

  /**
   * Evidentiary proof flag for transit insurance.
   */
  isInsuranceDocumented?: boolean;

  /**
   * Evidentiary documentation reference for insurance policy/receipt.
   */
  insuranceDocumentationEvidence?: string;

  /**
   * Are the buyer and seller related parties under 19 U.S.C. § 1401a(g)?
   * False by default for small-business exports.
   */
  areRelatedParties: boolean;

  /**
   * Confirmation whether any buyer-provided assists (tooling, molds, materials),
   * selling commissions, or royalties are attached to the transaction.
   */
  hasAssistsOrRoyalties: boolean;

  /**
   * If assists or royalties exist, their quantified monetary value to add under § 1401a(b)(1).
   */
  statutoryAdditionsUSD?: number;

  /**
   * Packing costs incurred by the buyer with respect to the merchandise (§ 1401a(b)(1)(A)).
   */
  packingCostsUSD?: number;

  /**
   * Primary valuation basis.
   */
  valuationBasis: "TRANSACTION_VALUE" | "UNRESOLVED_SECONDARY_VALUATION";

  /**
   * Valuation evidentiary status.
   */
  valuationStatus: "TRANSACTION_VALUE_DOCUMENTED" | "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION" | "UNRESOLVED";
}

/**
 * Chapter 99 Section 301 Additional Duty Breakdown.
 * Grounded in USITC 2026 Rev 22 Chapter 99, USTR Doc 2026-15181 (Section 24, Annex I & Annex II Part A).
 */
export interface Section301DutyBreakdown {
  isApplicable: boolean;
  chapter99Heading: string;         // e.g. "9903.05.44"
  additionalAdValoremRate: number;  // 10.0 for 10%
  additionalDutyAmountUSD: number;
  effectiveDate: string;            // "2026-07-24"
  legalAuthority: string;           // "USTR Doc. 2026-15181 / CSMS #69326983"
  exemptionSubheading?: string;     // e.g. "9903.05.85" through "9903.05.92"
  annexIChecked: boolean;           // true if checked against Annex I exemptions
  annexIExemptionApplied: boolean;  // true if confirmed exempt on Annex I
  annexIIChecked: boolean;          // true if checked against Annex II Part A exemptions (pp. 42–60)
  annexIIExclusionApplied: boolean; // true if confirmed exempt on Annex II Part A
  annexIIRef?: string;              // Specific Annex II category reference
  annexIIPageRef?: string;          // Page number in USTR Doc 2026-15181
  exemptionStatus: "VERIFIED_SUBJECT" | "VERIFIED_EXEMPT" | "UNRESOLVED";
  exemptionNotes?: string;
}

/**
 * Itemized Duty Component Breakdown.
 * Preserves separate statutory lines; prohibits hardcoded combined percentages.
 */
export interface DutyComponentBreakdown {
  dutiableCustomsValueUSD: number; // Valuation under 19 U.S.C. § 1401a
  valuationLegalBasis: string;     // "19 U.S.C. § 1401a(b) Transaction Value"
  hts10: string;
  baseAdValoremRate: number;       // e.g. 6.3 (Column 1 General)
  baseAdValoremRateStr: string;    // "6.3%"
  specificRateAmountUSD?: number;  // For specific rate lines (cents/kg)
  baseDutyAmountUSD: number;       // Calculated base duty
  section301: Section301DutyBreakdown;
  otherChapter99DutyAmountUSD?: number; // Other trade remedies if applicable
  totalDutyRate: number;           // baseRate + (section301.isApplicable ? 10.0 : 0.0)
  totalDutyAmountUSD: number;      // baseDutyAmountUSD + section301.additionalDutyAmountUSD
  statutoryReference: string;      // USITC 2026 Revision 22 citation
}

/**
 * Merchandise Processing Fee (MPF) Breakdown under 19 C.F.R. § 24.23.
 */
export interface MpfComponentBreakdown {
  fiscalYear: string;              // "FY2027"
  federalRegisterCitation: string; // "91 FR 48398 (Doc. 2026-15530)"
  appliedEntryType: "INFORMAL_AUTOMATED" | "INFORMAL_MANUAL" | "INFORMAL_CBP_PREP" | "FORMAL_ELECTRONIC" | "FORMAL_MANUAL";
  isInformalEligible: boolean;     // true if customs value <= $2,500 and not restricted
  isMandatoryFormal: boolean;      // true if PGA/quota/AD/CVD requires formal entry regardless of value
  adValoremRate: number;           // 0.3464% (0.003464)
  unclampedAmountUSD: number;      // raw value * rate
  appliedMinimumUSD?: number;      // $34.58 (formal)
  appliedMaximumUSD?: number;      // $670.86 (formal)
  manualSurchargeUSD?: number;     // $4.15 if manual formal
  finalMpfAmountUSD: number;
  
  // Express Consignment Carrier Facility / Centralized Hub Facility User Fee Model (19 C.F.R. § 24.23(b)(4))
  isQualifyingEccfOrHub: boolean;  // true ONLY if processed through qualifying ECCF or Centralized Hub Facility
  eccfWaybillFeeUSD?: number;      // $1.38 per 19 C.F.R. § 24.23(b)(4) (FY2027 schedule, paid by carrier/operator)
  statutoryNotes: string;
  carrierFacilityFeeNote?: string; // 19 C.F.R. § 24.23(b)(4) express facility fee notice
  estimatedCarrierDisbursementUSD?: number; // $10–$15 private courier fee (advisory commercial charge)
}

/**
 * Harbor Maintenance Fee (HMF) Breakdown under 19 C.F.R. § 24.24.
 */
export interface HmfComponentBreakdown {
  statutoryBasis: string;          // "26 U.S.C. § 4461 / 19 C.F.R. § 24.24"
  transportationMode: TransportationMode;
  isWaterborneCargo: boolean;      // true only for OCEAN_LCL, OCEAN_FCL
  isInformalEntryEntitled: boolean;// true under 19 C.F.R. § 24.24(d)(3)(i) & § 143.21 if value <= $2,500
  isMandatoryFormalOcean: boolean; // true if ocean cargo <= $2,500 requires formal entry
  isExempt: boolean;               // true for AIR, POSTAL, and informal ocean
  exemptionReason?: string;        // e.g. "Exempt under 19 C.F.R. § 24.24(d)(3)(i) — Informal entry procedure"
  adValoremRate: number;           // 0.125% (0.00125)
  hmfAmountUSD: number;
  hmfStatus: "VERIFIED_ASSESSED" | "VERIFIED_EXEMPT" | "UNRESOLVED";
}

/**
 * Commercial DAP Responsibility Allocation.
 */
export interface DapResponsibilityAllocation {
  /**
   * Amount billed to US buyer by seller and settled via PayPal.
   * Product Price + Agreed International Shipping.
   */
  sellerCollectedViaPaypalUSD: number;

  /**
   * Customs duties and border fees billed to US buyer by carrier/CBP upon arrival.
   * Total Duty (Base + Sec 301) + MPF + HMF + Estimated Brokerage.
   */
  buyerPayableUponArrivalUSD: number;

  /**
   * Complete all-inclusive delivered cost.
   */
  totalDeliveredLandedCostUSD: number;
}

/**
 * Landed Cost Calculation Request Input (Sprint 4)
 */
export interface LandedCostCalculationRequest {
  /**
   * Unique client request key for idempotent calculation deduplication.
   */
  idempotencyKey?: string;

  /**
   * Target transaction merchandise identifier or title.
   */
  productTitle: string;

  /**
   * Quantity of merchandise units being exported.
   */
  quantity: number;

  /**
   * Primary Country of Origin (2-letter ISO 3166-1 alpha-2, e.g. "IN").
   */
  originCountry: string;

  /**
   * Primary Country of Destination (e.g. "US").
   */
  destinationCountry: string;

  /**
   * Anticipated date of commercial entry / importation (YYYY-MM-DD).
   * Governs applicable MPF fiscal year and active statutory HTS revision.
   */
  importDate?: string;

  /**
   * Mode of transport incident to international shipment.
   */
  transportationMode: TransportationMode;

  /**
   * Explicit customs valuation parameters under 19 U.S.C. § 1401a.
   */
  valuation: CustomsValuationDeclaration;

  /**
   * Confirmed 10-digit HTS code from Sprint 3 (e.g. "4202.92.15.00").
   */
  hts10: string;

  /**
   * Verified Column 1 General duty rate percentage (e.g. 6.3 for 6.3%).
   */
  generalDutyRate: number;

  /**
   * Verified unit of quantity from tariff store (e.g. "kg", "No.", "dz.pcs.").
   */
  unitOfQuantity?: string;

  /**
   * Target customs entry category (defaults to "AUTO_DETECT").
   */
  entryType?: CustomsEntryType;

  /**
   * Flag indicating whether consignment clears through a qualifying ECCF or Centralized Hub Facility.
   */
  isQualifyingEccfOrHub?: boolean;

  /**
   * Estimated third-party carrier disbursement or customs broker entry filing fee.
   * Optional advisory figure for buyer completeness.
   */
  estimatedBrokerageFeeUSD?: number;

  /**
   * Classification status from Sprint 3.
   * "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY"
   */
  classificationStatus: "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY";

  /**
   * Flag indicating whether the seller/user has formally confirmed this candidate.
   */
  isConfirmedByUser: boolean;
}

/**
 * Complete Landed Cost Calculation Output (Sprint 4)
 */
export interface LandedCostCalculationResult {
  calculationId: string;
  calculatedAt: string;
  status: LandedCostStatus;
  datasetCoverageStatus: "SUPPORTED_CURATED_STORE" | "UNSUPPORTED_CODE";
  
  // High-Level Summary
  productTitle: string;
  quantity: number;
  dutiableCustomsValueUSD: number;
  baseCustomsDutyUSD: number;
  section301DutyUSD: number;
  totalCustomsDutyUSD: number;
  totalCustomsFeesUSD: number;     // MPF + HMF
  eccfWaybillFeeUSD?: number;      // $1.38 if qualifying ECCF or Centralized Hub Facility
  internationalShippingUSD: number;
  estimatedBrokerageUSD: number;
  totalLandedCostUSD: number;

  // Commercial DAP Partitioning
  dapAllocation: DapResponsibilityAllocation;

  // Itemized Breakdowns
  dutyBreakdown: DutyComponentBreakdown;
  mpfBreakdown: MpfComponentBreakdown;
  hmfBreakdown: HmfComponentBreakdown;

  // Statutory Metadata & Disclaimers
  statutoryRevision: string;       // "USITC 2026 HTS Revision 22 (Oct 30, 2026)"
  section301Authority: string;     // "USTR 91 FR Doc. 2026-15181 / CSMS #69326983"
  mpfScheduleAuthority: string;    // "Federal Register 91 FR 48398 (Effective Oct 1, 2026)"
  disclaimer: string;              // 19 U.S.C. § 1484 Importer of Record notice
  
  // Warnings & Advisory Notes
  advisoryWarnings: string[];
  unresolvedFactors?: string[];
  conditionalScenarios?: Array<{
    scenarioName: string;
    applicableDutyRate: number;
    estimatedLandedCostUSD: number;
    conditionRequired: string;
  }>;
}
```

---

## 3. Calculation Logic & Validation Rules

### 3.1 Valuation Validation Rules (19 U.S.C. § 1401a)
1. `grossInvoicePriceUSD` must be a strictly positive number ($> 0$).
2. `internationalShippingDeductionUSD` must be non-negative ($\ge 0$).
3. `internationalShippingDeductionUSD` must be strictly less than `grossInvoicePriceUSD`. If shipping equals or exceeds price, the request must fail with validation code `INVALID_SHIPPING_DEDUCTION`.
4. **Freight Evidentiary Rule:**
   - A freight deduction is permitted **only if supported by actual transaction facts and sufficient documentation** (e.g. carrier bill of lading, air waybill, or actual freight invoice).
   - If `isShippingDocumented === false`, the calculator **cannot assume a freight deduction**. It must flag the valuation as `PARTIALLY_VERIFIED` or `BLOCKED`, and emit an advisory warning that CBP assesses duty on the full unadjusted gross price if freight documentation is absent.
5. `dutiableCustomsValueUSD` calculation:
   $$\text{Dutiable Value} = \text{Gross Invoice Price} - \text{Documented Shipping} - \text{Documented Insurance} + \text{Statutory Additions}$$
6. If `valuationBasis === "UNRESOLVED_SECONDARY_VALUATION"`, the calculator emits `status: "BLOCKED"` with error `INVALID_VALUATION`.

### 3.2 Duty Calculation Rules (Base + Section 301)
1. **Base Duty Calculation:**
   $$\text{Base Duty} = \text{Dutiable Customs Value} \times \left(\frac{\text{generalDutyRate}}{100}\right)$$
2. **India Special Rates Ineligibility:**
   Trade program indicators (`A`, `AU`, `CA`, etc.) are ignored. Special rates are strictly disregarded for India.
3. **Section 301 Additional Duty Calculation (`9903.05.44`):**
   - Applies to goods originating in India (`originCountry === "IN"`).
   - Rate: **10.0% ad valorem** (0.10).
   - **Exemption Verification Hierarchy:**
     1. Evaluate Chapter 99 subheadings `9903.05.85` through `9903.05.92`. *(Note: `9903.05.85` is in-transit only; `9903.05.88` is civil aircraft; `9903.05.90` is coordinated Section 232 wood lines; `9903.05.91` is humanitarian).*
     2. Evaluate Annex I exemption schedule (India specific).
     3. Evaluate Annex II Part A exemption schedule (pp. 42–60).
     4. **Never default unconfirmed duties to zero:** If exemption is verified, `section301DutyUSD = 0.00`. If covered (absent from exemption lists), `section301DutyUSD = Dutiable Value * 0.10`. If uncertain, flag `exemptionStatus = "UNRESOLVED"` and emit conditional scenarios.
4. **Component Separation Mandate:** Base duty and Section 301 duty must remain separate calculation steps and line items. The calculation engine must never use a hardcoded blended percentage.

### 3.3 MPF Calculation Rules (FY2027 Schedule & Facility Model)
1. **Threshold & Entry Category Selection:**
   - If `dutiableCustomsValueUSD <= 2500.00` and not subject to mandatory formal entry:
     - Apply **Informal Automated** flat fee: **$2.77** (under 19 C.F.R. § 24.23(b)(2)(i)).
   - If `dutiableCustomsValueUSD > 2500.00` or mandatory formal entry applies:
     - Calculate raw formal ad valorem:
       $$\text{Raw MPF} = \text{Dutiable Customs Value} \times 0.003464$$
     - Enforce statutory clamps:
       $$\text{Formal MPF} = \min(\max(\text{Raw MPF}, 34.58), 670.86)$$
2. **Manual Entry Surcharges:**
   - If `entryType === 'FORMAL_MANUAL'`: Add **$4.15** surcharge.
   - If `entryType === 'INFORMAL_MANUAL'`: Fee is flat **$8.30**.
   - If `entryType === 'INFORMAL_CBP_PREP'`: Fee is flat **$12.45**.
3. **Express Consignment Carrier Facility (ECCF) & Centralized Hub Facility Fee Treatment:**
   - Applies **ONLY** if `isQualifyingEccfOrHub === true` (merchandise processed through a qualifying ECCF or Centralized Hub Facility under 19 C.F.R. § 24.23(b)(4)).
   - Amount: **$1.38 per waybill** (FY2027 rate paid by carrier/operator to CBP).
   - It is **NOT** automatically charged on every FedEx or DHL shipment.
   - Do **NOT** charge both informal MPF and ECCF fee merely because a shipment is low value (pursuant to § 24.23(b)(2)(i) exception).
   - If a shipment $\le \$2,500$ undergoes **mandatory formal entry** at an ECCF or Centralized Hub Facility, the importer owes the **formal MPF ($34.58 minimum)**.

### 3.4 HMF Calculation Rules & Informal Entry Exemption (19 C.F.R. § 24.24)
1. If `transportationMode` is `"AIR_EXPRESS"`, `"AIR_CARGO"`, or `"POSTAL"`:
   - `hmfAmountUSD = 0.00`, `isExempt = true`, `hmfStatus = "VERIFIED_EXEMPT"`.
   - Reason: Non-waterborne cargo.
2. If `transportationMode` is `"OCEAN_LCL"` or `"OCEAN_FCL"`:
   - If `isInformalEntryEntitled === true` (cargo $\le \$2,500$ entitled to informal entry under 19 C.F.R. § 143.21):
     - `hmfAmountUSD = 0.00`, `isExempt = true`, `hmfStatus = "VERIFIED_EXEMPT"`.
     - Reason: Statutorily exempt under 19 C.F.R. § 24.24(d)(3)(i).
   - If cargo $> \$2,500$ or subject to mandatory formal entry:
     - `hmfAmountUSD = round(dutiableCustomsValueUSD * 0.00125, 2)`, `isExempt = false`, `hmfStatus = "VERIFIED_ASSESSED"`.
   - If eligibility cannot be confirmed (e.g. unknown PGA restrictions):
     - `hmfStatus = "UNRESOLVED"`.

---

## 4. Classification Eligibility & State Handling

The calculator enforces strict contract boundaries according to the Sprint 3 `ClassificationResult` and dataset coverage:

| Classification Status | Dataset Status | Section 301 Component Status | Landed Cost Status (4-State Enum) | HTTP Response & Behavior |
| :--- | :---: | :---: | :---: | :--- |
| **`CLASSIFIED`** | `SUPPORTED` | `VERIFIED_SUBJECT` (10%) or `VERIFIED_EXEMPT` (0%) | **`VERIFIED`** | **HTTP 200** — Full definitive calculation with itemized statutory lines. |
| **`CLASSIFIED`** | `SUPPORTED` | `UNRESOLVED` (e.g. tea Annex II unconfirmed) | **`PARTIALLY_VERIFIED`** | **HTTP 200** — Emits baseline calculation with conditional scenario bounds and advisory warnings. |
| **`ALTERNATIVE_CANDIDATES`** | `SUPPORTED` | Candidate Selected by User | **`VERIFIED`** / **`PARTIALLY_VERIFIED`** | **HTTP 200** — Calculates based on user-selected candidate. |
| **`ALTERNATIVE_CANDIDATES`** | `SUPPORTED` | No Candidate Selected | **`BLOCKED`** | **HTTP 422** (`CANDIDATE_SELECTION_REQUIRED`) — Rejects single total. Emits scenario array for all alternatives. |
| **`UNRESOLVED_AMBIGUITY`** | `SUPPORTED` | Any (e.g. wooden coasters between `4419.20.90` vs `4419.90.91`) | **`BLOCKED`** | **HTTP 422** (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`) — Rejects definitive calculation. Emits missing facts. Scenarios in research only. |
| **Any** | `UNSUPPORTED` | Any | **`BLOCKED`** | **HTTP 422** (`DATASET_COVERAGE_UNSUPPORTED`) — Refuses calculation for uncataloged HTS lines outside the 30 curated records. |

---

## 5. Standard Error Contract

When a calculation request fails validation or hits an unresolved classification block, the API route must respond with a structured RFC 7807 error envelope:

```typescript
export interface LandedCostErrorResponse {
  error: string;
  code: 
    | "INVALID_JSON"
    | "MISSING_MANDATORY_FIELDS"
    | "INVALID_VALUATION"
    | "INVALID_SHIPPING_DEDUCTION"
    | "UNSUPPORTED_CORRIDOR"
    | "CLASSIFICATION_AMBIGUITY_UNRESOLVED"
    | "CANDIDATE_SELECTION_REQUIRED"
    | "DATASET_COVERAGE_UNSUPPORTED"
    | "UNKNOWN_HTS_CODE";
  statusCode: number;
  details?: Record<string, unknown>;
  missingClarifications?: string[];
  suggestedAlternatives?: Array<{
    hts10: string;
    description: string;
    baseDutyRate: number;
    section301Rate: number;
    scenarioLandedCostUSD?: number;
  }>;
}
```

---

## 6. Audit Trail & Traceability Requirement

Every generated calculation must return a cryptographic or time-stamped `calculationId` (e.g. `calc_1731057600_a8f9d`) allowing the exact combination of inputs, rates, fee schedules, and disclaimers to be re-evaluated for invoice generation in Sprint 5.

---

## 7. FINAL SECTION 301 LEGAL INTERPRETATION & CONSISTENCY GATE — NOVEMBER 7, 2026

This section documents the final consistency and regulatory reconciliation executed across the data contract:

1. **Reconciliation of Core Seed Profiles:**
   - Fully aligned with the actual seven core seed export profiles in `src/data/seed-products.ts`: `prod-cotton-bag`, `prod-brass-statue`, `prod-silk-scarf`, `prod-ceramic-mug`, `prod-wooden-coasters`, `prod-leather-wallet`, and `prod-darjeeling-tea`.
   - Reconfirmed that "Decorative Brass Bell" and "Silver Filigree Earrings" are supplementary catalogue records in `authoritative-store.ts`, not core seed profiles.
2. **Corrected Annex I & Annex II Legal Mechanism:**
   - Pursuant to Section 24 of USTR Doc 2026-15181, the Section 301 10% action on India applies **except as provided in Annex I and Annex II, Part A**.
   - Both Annex I and Annex II Part A are **exemption** schedules. Products absent from both exemption lists (and not covered by subheadings `9903.05.85`–`92`) are subject to 10% duty under `9903.05.44` (`VERIFIED_SUBJECT`).
3. **Wooden Coasters Calculation Status is BLOCKED:**
   - Because Sheesham wood coasters have unresolved classification ambiguity between `4419.20.90.00` and `4419.90.91.00`, the overall calculation status is **`BLOCKED`**. Scenario bounds remain in research documentation only, not as an active calculated result.
4. **Elimination of Assumed Freight Deductions:**
   - Removed all phrasing regarding "reasonable documented freight deduction assumed" from the `ESTIMATED` status definition. Deductions strictly require actual transaction facts and sufficient documentation under 19 U.S.C. § 1401a(b)(4)(A). Missing evidence marks valuation as `PARTIALLY_VERIFIED` or `BLOCKED`.
5. **Rigorous Overall Verification Criteria:**
   - Overall `VERIFIED` status requires: resolved classification, supported valuation, verified base duty, verified Section 301/Ch 99 status, resolved entry/fee treatment, and effective dates/citations. Component verification does not imply overall calculation verification.
6. **ECCF & Centralized Hub Facility User Fee Treatment (19 C.F.R. § 24.23(b)(4)):**
   - Strictly codified terms: **Express Consignment Carrier Facility (ECCF)** and **Centralized Hub Facility**. Removed all references to Centralized Examination Stations.
   - Replaced automatic express courier tagging with `isQualifyingEccfOrHub`.
   - Reaffirmed that formal entry at $\le \$2,500$ triggers formal MPF ($34.58 minimum).
