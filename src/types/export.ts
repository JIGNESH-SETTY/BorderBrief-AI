/**
 * BorderBrief AI — Core Type Definitions (Sprint 1 & Sprint 2)
 * Clean, minimal, strongly-typed domain interfaces for the export preparation workflow.
 */

export interface TradeCorridor {
  id: string;
  originCountry: string;
  originName: string;
  originFlag: string;
  destinationCountry: string;
  destinationName: string;
  destinationFlag: string;
  valuationLaw: string; // "19 U.S.C. § 1401a (Tariff Act of 1930)"
  valuationBasis: "TRANSACTION_VALUE" | "FOB" | "CIF";
  deMinimisStatus: "SUSPENDED" | "LIMITED_EXCEPTIONS_ONLY" | "ACTIVE";
  formerDeMinimisThresholdUSD?: number; // Historical $800 threshold prior to August 29, 2025 suspension
  htsRevisionBaseline: string; // e.g. "USITC 2026 HTS Rev 22 (Oct 30, 2026)"
  status: "ACTIVE_CORRIDOR" | "PLANNED_CORRIDOR";
}

export type ModuleStatus = "FOUNDATION_READY" | "PLANNED_SPRINT" | "PLACEHOLDER" | "COMPLETED" | "ACTIVE";

export interface ArchitecturalModule {
  key: string;
  stageNumber: number;
  title: string;
  shortDescription: string;
  technicalRole: string;
  sprintPhase: string;
  status: ModuleStatus;
  primaryBenefit: string;
}

export interface WorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
  iconName: "FileText" | "ShieldCheck" | "Calculator" | "Receipt" | "Sparkles";
}

/**
 * Product Intake Form Values (Sprint 2)
 */
export interface ProductInformationDraft {
  productTitle: string;
  productDescription: string;
  declaredMaterials: string; // Optional if unknown
  intendedUse: string; // Intended function / use case
  originCountry: string; // Default: 'IN' (India)
  destinationCountry: string; // Default: 'US' (United States)
  itemPriceUSD: number | ""; // Seller product selling price (USD)
  currency: string; // Default: 'USD'
  shippingCostUSD: number | ""; // Optional estimated international transit & insurance
  quantity: number;
  imageFile?: File | null;
  imagePreviewUrl?: string | null;
}

/**
 * Structured Cloud AI Product Analysis Output (Sprint 2)
 * Strictly focused on product understanding and attribute extraction.
 * Does NOT claim verified legal HS codes or calculate tariff duties.
 */
export interface ProductAttributeItem {
  attributeName: string;
  value: string;
  source: "EXPLICIT_SELLER" | "INFERRED_ANALYSIS" | "PRE_CALIBRATED_BASELINE" | "UNKNOWN";
  notes?: string;
}

export interface ClarifyingQuestionItem {
  id: string;
  question: string;
  context: string;
  suggestedOptions?: string[];
}

export interface ProductAnalysisResult {
  product_summary: string;
  identified_attributes: ProductAttributeItem[];
  explicitly_provided: Record<string, string>;
  inferred_attributes: Record<string, string>;
  unknown_attributes: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  clarifying_questions: ClarifyingQuestionItem[];
  analysis_warnings: string[];
  is_demo_mode: boolean;
  demo_reason?: "NO_API_KEY" | "USER_OPTED_OUT_OF_CLOUD" | "UNMATCHED_BASELINE";
  model_used: string;
  analyzed_at: string;
}

/**
 * Seller Confirmation State (Sprint 2 Stage 2)
 */
export interface SellerConfirmedProductReview {
  confirmedTitle: string;
  confirmedDescription: string;
  confirmedMaterials: string;
  confirmedIntendedUse: string;
  clarificationAnswers: Record<string, string>;
  sellerNotes?: string;
  isConfirmedByUser: boolean;
  confirmedAt?: string;
}

/**
 * Authoritative USITC Tariff Schedule Record (Sprint 3)
 * Grounded strictly in official USITC Harmonized Tariff Schedule of the United States.
 */
export interface AuthoritativeTariffRecord {
  hts10: string; // Formatted 10-digit statistical code (e.g. "4202.92.15.00")
  hts8: string; // 8-digit legal rate line (e.g. "4202.92.15")
  hs6: string; // 6-digit WCO international heading (e.g. "4202.92")
  heading: string; // 4-digit heading (e.g. "4202")
  chapter: string; // 2-digit chapter (e.g. "42")
  chapterTitle: string; // Official chapter name
  description: string; // Official USITC full hierarchical description
  generalDutyRate: number; // Column 1 General MFN percentage (e.g. 6.3 means 6.3%)
  generalRateStr: string; // e.g. "6.3%" or "Free"
  specialRates: string; // Special trade program text (e.g. "Free (AU, BH, CL...)")
  indiaEligibleSpecial: boolean; // false for India (GSP expired/terminated)
  column2Rate: string; // Column 2 statutory rate for non-NTR countries
  units: string[]; // Reporting units of quantity (e.g. ["No.", "kg"])
  statutoryRevision: string; // e.g. "USITC 2026 HTS Revision 22 (Oct 30, 2026)"
  effectiveDate: string; // Statutory effective date (e.g. "2019-06-05" or "Unverified")
  effectiveDateSource?: string; // Verified legal source establishing effective date, or unverified notice
  relevantGris: string[]; // Applicable WCO General Rules of Interpretation (e.g. ["GRI 1", "GRI 6"])
  legalNotes: string[]; // Relevant Section/Chapter legal notes
  crossRulingReference?: string; // CBP Customs Rulings Online Search System (CROSS) reference
  chapter99Notice?: string; // Applicable Chapter 99 trade remedy notes (Section 301/232)
}

/**
 * Proposed Classification Candidate with Evidence and Explainability (Sprint 3)
 */
export interface ClassificationCandidate {
  candidateId: string;
  hts10: string; // Validated 10-digit code
  hs6: string; // 6-digit international code
  officialDescription: string; // Exact official USITC schedule text
  generalDutyRate: number; // Ad valorem percentage
  generalRateStr: string;
  specialRateText: string;
  unitOfQuantity: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  isPrimaryRecommendation: boolean;
  griLegalBasis: string; // GRI legal analysis
  supportingProductAttributes: string[]; // Physical attributes matching this candidate
  plainLanguageExplanation: string; // Clear explanation for small business
  sourceReference: string; // Exact schedule reference
  crossRulingReference?: string; // CBP CROSS ruling if applicable
  chapter99Notice?: string;
}

/**
 * Structured Grounded Classification Result (Sprint 3)
 */
export interface ClassificationResult {
  id: string;
  productSummary: string;
  status: "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY";
  primaryCandidate: ClassificationCandidate | null;
  alternativeCandidates: ClassificationCandidate[];
  missingInformation?: string[];
  clarifyingQuestions?: ClarifyingQuestionItem[];
  confidenceExplanation: string;
  statutoryRevision: string; // "USITC 2026 HTS Revision 22 (Oct 30, 2026)"
  retrievalDate: string;
  disclaimer: string;
  isAiAssisted: boolean;
  modelUsed?: string;
  isConfirmedByUser: boolean;
  confirmedAt?: string;
}

/**
 * Classification API Request Input
 */
export interface ClassificationRequestInput {
  title: string;
  description: string;
  materials?: string;
  intendedUse?: string;
  clarificationAnswers?: Record<string, string>;
  forceDemoMode?: boolean;
  userConsentGiven?: boolean;
}

/**
 * Mode of international freight transportation.
 * Directly dictates HMF applicability (26 U.S.C. § 4461 / 19 C.F.R. § 24.24).
 */
export type TransportationMode = "AIR_EXPRESS" | "AIR_CARGO" | "OCEAN_LCL" | "OCEAN_FCL" | "POSTAL";

/**
 * Postal service classification for international mail consignments under 19 C.F.R. § 24.23(c)(1)(v).
 * Distinguishes general international mail exemption from the formal Inbound EMS regulatory exception (85 FR 47018).
 */
export type PostalServiceType = "ORDINARY_MAIL" | "INBOUND_EMS" | "UNKNOWN";

/**
 * Postal entry procedure under 19 C.F.R. Part 145, CBP Interim Final Rule 91 FR 37801 (Doc. 2026-12669),
 * and CBP Final Rule Document 2026-21600 (published October 22, 2026, extending compliance date to January 20, 2027).
 */
export type PostalEntryProcedure =
  | "INFORMAL_MAIL"              // Standard informal postal clearance under 19 C.F.R. Part 145 (no Chapter 99 duties, value <= $2,500)
  | "INFORMAL_MAIL_EXTENDED"     // Informal postal clearance during extension period (July 24, 2026 - Jan 19, 2027 per CBP Doc. 2026-21600)
  | "VOLUNTARY_FORMAL_EARLY"     // Voluntary early formal entry (CBP Form 7501) elected prior to Jan 20, 2027
  | "VOLUNTARY_TEST_ENTRY_TYPE_13" // Voluntary CBP Entry Type 13 postal informal pilot/test procedure (91 FR 56936 & 91 FR 66707)
  | "ENTRY_TYPE_13"              // Qualifying Entry Type 13 informal entry test procedure (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707)
  | "FORMAL_MAIL_REQUIRED"       // Mandatory formal entry (value > $2,500, restricted, or post-Jan 20, 2027 Ch 99 when ET 13 is not used)
  | "FORMAL_ENTRY"               // Formal entry on CBP Form 7501 under 19 C.F.R. § 145.12(a)(2)(v) & (vi)
  | "UNRESOLVED";                // Unresolved carrier/operator clearance election or missing postal classification

/**
 * Voluntary postal compliance election during the transition extension period (July 24, 2026 – January 19, 2027)
 * under CBP Document 2026-21600 and ongoing Entry Type 13 test options (CBP Doc. 2026-21570).
 */
export type VoluntaryPostalCompliance =
  | "NONE"               // Standard default: use existing informal clearance during extension
  | "FORMAL_EARLY"       // Importer/shipper elects early formal entry on CBP Form 7501
  | "FORMAL_ENTRY"       // Filer elects formal entry on CBP Form 7501
  | "ENTRY_TYPE_13_TEST" // Voluntary participation in Entry Type 13 informal electronic test
  | "ENTRY_TYPE_13"      // Participation in Entry Type 13 informal electronic test
  | "UNKNOWN";           // Clearance election or operator handling unconfirmed

/**
 * Actual carrier or operator postal clearance procedure selected/confirmed.
 * Prevents assuming informal clearance without verified carrier handling.
 */
export type CarrierPostalProcedure =
  | "CONFIRMED_INFORMAL"     // Shipper/carrier has affirmatively confirmed informal clearance under Part 145
  | "VOLUNTARY_FORMAL_EARLY" // Filer/carrier has elected early formal entry on CBP Form 7501
  | "VOLUNTARY_ENTRY_TYPE_13"// Confirmed participation and completed prerequisites for Entry Type 13 test
  | "ENTRY_TYPE_13"          // Confirmed participation and completed prerequisites for Entry Type 13 test
  | "FORMAL_ENTRY"           // Confirmed formal entry on CBP Form 7501
  | "MANDATORY_FORMAL"       // Formal entry mandated by statute (> $2,500, post-Jan 20, 2027 Ch 99 without ET 13, or restricted)
  | "UNCONFIRMED";           // Carrier handling or operator clearance channel not yet verified

/**
 * Procedural certainty of postal compliance determination.
 */
export type PostalProcedureCertainty =
  | "CONFIRMED"                      // Confirmed by carrier agreement or affirmative filer election
  | "UNCONFIRMED_CARRIER_HANDLING"   // Legally eligible, but actual operator procedure unverified
  | "MANDATORY_STATUTORY";           // Enforced by statute; does not depend on carrier election

/**
 * CBP Entry Type 13 Test Eligibility & Prerequisite Declaration.
 * Grounded in:
 * - 19 U.S.C. § 1484 (Right to make entry)
 * - CBP Original Test Notice (91 FR 56936)
 * - CBP Modification Notice (Doc. 2026-21570, 91 FR 66707, Oct 22, 2026)
 * - CBP Final Rule (Doc. 2026-21600, Oct 22, 2026)
 */
export interface EntryType13TestEligibility {
  /**
   * Whether the filer has the legal right to make entry under 19 U.S.C. § 1484
   * (e.g. U.S. Importer of Record or licensed U.S. customs broker acting as IOR).
   */
  hasRightToMakeEntry?: boolean;

  /**
   * Whether test participation is established under CBP Entry Type 13 notices
   * (91 FR 56936 & Doc. 2026-21570, 91 FR 66707).
   */
  isTestParticipant?: boolean;

  /**
   * Alias for backwards compatibility.
   */
  isCbpTestParticipant?: boolean;

  /**
   * Whether the filer has active electronic Automated Commercial Environment (ACE) / ABI filing capability.
   */
  hasAceFilingCapability?: boolean;

  /**
   * Whether core Entry Type 13 electronic data elements are confirmed in ACE:
   * - Importer of Record identification (EIN/SSN/CBP-assigned number)
   * - Postal carrier code and UPU tracking number
   * - Specific 10-digit HTSUS classification
   * - Declared transaction value and estimated duty
   */
  hasRequiredDataElements?: boolean;

  /**
   * Whether additional Chapter 98/99 data elements are supplied electronically where applicable
   * (e.g. Heading 9903.05.44 trade remedy declarations).
   */
  hasChapter99Data?: boolean;

  /**
   * Whether electronic Partner Government Agency (PGA) data is complete.
   * Under CBP Doc. 2026-21570 (91 FR 66707, Oct 22, 2026), CBP temporarily accepts
   * Entry Type 13 filings in ACE with or without complete electronic PGA data.
   */
  isPgaDataComplete?: boolean;

  /**
   * Whether CBP's temporary acceptance period for entries without complete PGA data is active.
   * Defaults to true unless explicitly configured as ended or date exceeds CBP expiration.
   */
  isPgaTemporaryAcceptanceActive?: boolean;

  /**
   * Electronic tracking number (UPU S10 barcode, e.g. "IN123456789US") if available.
   */
  trackingNumber?: string;

  /**
   * CBP Filer code or ABI participant ID if available.
   */
  filerCode?: string;
}

/**
 * Detailed representation of postal compliance, eligibility, and carrier handling.
 * Keeps legal availability, actual procedure selected, filer eligibility,
 * test participation, and data completeness as separate fields.
 */
export interface PostalComplianceDetails {
  /**
   * Primary legally available entry procedure category.
   */
  legallyAvailableProcedure: PostalEntryProcedure;

  /**
   * Specific legally available entry pathways under governing CBP rules.
   * For Chapter 99 postal shipments on or after Jan 20, 2027, includes BOTH:
   * - Formal entry under 19 CFR 145.12(a)(2)(v) and (vi)
   * - Qualifying Entry Type 13 informal-entry test under CBP Docs. 2026-21600 & 2026-21570
   */
  legallyAvailablePathways?: string[];

  /**
   * Actual carrier/operator procedure selected or confirmed by the shipper/carrier.
   */
  actualCarrierProcedure: CarrierPostalProcedure;

  /**
   * Shipment eligibility for informal mail clearance (value <= $2,500, no absolute import restrictions).
   */
  isShipmentEligible: boolean;

  /**
   * Ineligibility reason if shipment is not eligible for informal clearance.
   */
  ineligibilityReason?: string;

  /**
   * Voluntary early compliance election under CBP Doc. 2026-21600.
   */
  voluntaryComplianceElection: VoluntaryPostalCompliance;

  /**
   * Procedure certainty / verification level.
   */
  procedureCertainty: PostalProcedureCertainty;

  /**
   * Missing or unverified operational facts regarding postal clearance.
   */
  missingOperationalFacts: string[];

  /**
   * Filer legal eligibility representation under 19 U.S.C. § 1484.
   */
  filerEligibility?: {
    hasRightToMakeEntry: boolean;
    isImporterOfRecordOrBroker: boolean;
    details?: string;
  };

  /**
   * Filer test participation and filing capability representation.
   */
  testParticipation?: {
    isTestParticipant: boolean;
    hasAceFilingCapability: boolean;
    details?: string;
  };

  /**
   * Data completeness representation for ACE transmission.
   */
  dataCompleteness?: {
    hasRequiredEntryType13Data: boolean;
    hasChapter99Data: boolean;
    isPgaDataComplete: boolean;
    isPgaTemporaryAcceptanceActive: boolean;
    pgaWarning?: string;
    details?: string;
  };

  /**
   * Flag indicating whether all Entry Type 13 test prerequisites were verified.
   */
  entryType13PrerequisitesVerified?: boolean;

  /**
   * Specific missing Entry Type 13 test prerequisites if unverified.
   */
  entryType13MissingPrerequisites?: string[];

  /**
   * Temporary PGA acceptance notice citing CBP Doc. 2026-21570 (91 FR 66707).
   */
  pgaTemporaryAcceptanceNotice?: string;
}

/**
 * Customs valuation scenario labeling under 19 U.S.C. § 1401a.
 * Distinguishes verified documented transaction value from a conservative illustrative assessment scenario.
 */
export type ValuationScenarioType = "TRANSACTION_VALUE_DOCUMENTED" | "CONSERVATIVE_ILLUSTRATIVE_GROSS";

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
   * Itemized merchandise selling price (ex-factory / goods amount prior to freight and insurance).
   */
  merchandisePriceUSD?: number;

  /**
   * Postal service classification for international mail consignments.
   * Dictates 19 C.F.R. § 24.23(c)(1)(v) postal exemption vs. 85 FR 47018 formal inbound EMS exception.
   */
  postalServiceType?: PostalServiceType;

  /**
   * Anticipated date of entry or importation (YYYY-MM-DD).
   */
  importDate?: string;

  /**
   * Calculation evaluation date / as-of date (alias for importDate, YYYY-MM-DD).
   */
  asOfDate?: string;

  /**
   * Voluntary postal compliance election under CBP Doc. 2026-21600.
   */
  voluntaryPostalCompliance?: VoluntaryPostalCompliance;

  /**
   * Confirmed carrier postal clearance procedure.
   */
  carrierPostalProcedure?: CarrierPostalProcedure;

  /**
   * Explicit confirmation whether carrier postal clearance handling is verified.
   */
  isPostalProcedureConfirmed?: boolean;

  /**
   * Voluntary CBP Entry Type 13 test eligibility prerequisites.
   */
  entryType13Eligibility?: EntryType13TestEligibility;

  /**
   * Demonstration/simulation flag.
   */
  isDemoMode?: boolean;

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
  appliedEntryType: "INFORMAL_AUTOMATED" | "INFORMAL_MANUAL" | "INFORMAL_CBP_PREP" | "FORMAL_ELECTRONIC" | "FORMAL_MANUAL" | "EXEMPT_POSTAL";
  isInformalEligible: boolean;     // true if customs value <= $2,500 and not restricted
  isMandatoryFormal: boolean;      // true if PGA/quota/AD/CVD requires formal entry regardless of value
  adValoremRate: number;           // 0.3464% (0.003464)
  unclampedAmountUSD: number;      // raw value * rate
  appliedMinimumUSD?: number;      // $34.58 (formal)
  appliedMaximumUSD?: number;      // $670.86 (formal)
  manualSurchargeUSD?: number;     // $4.15 if manual formal
  finalMpfAmountUSD: number;
  mpfStatus: "VERIFIED_ASSESSED" | "VERIFIED_EXEMPT" | "UNRESOLVED";
  postalServiceType?: PostalServiceType;
  
  // Postal Entry Procedure under 19 C.F.R. Part 145, CBP Interim Final Rule 91 FR 37801 (Doc. 2026-12669, July 24, 2026)
  // and CBP Final Rule Doc. 2026-21600 (published October 22, 2026, extending compliance date to January 20, 2027)
  postalEntryProcedure?: PostalEntryProcedure;
  postalEntryProcedureNotice?: string;
  postalRuleEffectiveDate?: string;       // "2026-07-24" (CBP 91 FR 37801, Doc. 2026-12669)
  postalMandatoryComplianceDate?: string; // "2027-01-20" (CBP Doc. 2026-21600)
  postalRuleExtensionNotice?: string;     // Citation of Doc. 2026-21600 extension
  voluntaryPostalCompliance?: VoluntaryPostalCompliance;
  carrierPostalProcedure?: CarrierPostalProcedure;
  postalDetails?: PostalComplianceDetails;
  postalComplianceDetails?: PostalComplianceDetails;

  // Inbound EMS Fee under 19 C.F.R. § 24.22(l)(1)(i) (unadjusted in FY2027 schedule 91 FR 48398)
  inboundEmsFeeUSD?: number;       // $1.00 per Inbound EMS item
  inboundEmsFeeNote?: string;
  
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
  productId?: string;
  productTitle: string;
  productDescription?: string;
  declaredMaterials?: string;
  intendedUse?: string;

  /**
   * Quantity of merchandise units being exported.
   */
  quantity: number;

  /**
   * Unit price per item in USD.
   */
  unitPriceUSD: number;

  /**
   * Currency code (defaults to "USD").
   */
  currency?: string;

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
   * Governs applicable MPF fiscal year, active statutory HTS revision, and postal compliance rules.
   */
  importDate?: string;

  /**
   * Calculation evaluation date / as-of date (alias for importDate, YYYY-MM-DD).
   */
  asOfDate?: string;

  /**
   * Date calculation is executed (YYYY-MM-DD). If omitted, derived from server-side clock.
   */
  calculationDate?: string;

  /**
   * Optional injectable server-side clock for deterministic date evaluation.
   */
  clock?: () => Date;

  /**
   * Mode of transport incident to international shipment.
   */
  transportationMode: TransportationMode;

  /**
   * Postal service classification for international mail consignments.
   * Dictates 19 C.F.R. § 24.23(c)(1)(v) postal exemption vs. 85 FR 47018 formal inbound EMS exception.
   */
  postalServiceType?: PostalServiceType;

  /**
   * Voluntary postal compliance election under CBP Doc. 2026-21600.
   */
  voluntaryPostalCompliance?: VoluntaryPostalCompliance;

  /**
   * Confirmed carrier postal clearance procedure.
   */
  carrierPostalProcedure?: CarrierPostalProcedure;

  /**
   * Explicit confirmation whether carrier postal clearance handling is verified.
   */
  isPostalProcedureConfirmed?: boolean;

  /**
   * Voluntary CBP Entry Type 13 test eligibility prerequisites.
   */
  entryType13Eligibility?: EntryType13TestEligibility;

  /**
   * Demonstration/simulation flag.
   */
  isDemoMode?: boolean;

  /**
   * Incoterm for the transaction (e.g. "DAP").
   */
  incoterm?: string;

  /**
   * Named destination place in the United States.
   */
  namedDestination?: string;

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
  generalDutyRate?: number;

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
   * Flag indicating whether shipment is subject to mandatory formal entry regardless of value.
   */
  isMandatoryFormal?: boolean;

  /**
   * Estimated third-party carrier disbursement or customs broker entry filing fee.
   * Optional advisory figure for buyer completeness.
   */
  estimatedBrokerageFeeUSD?: number;

  /**
   * Classification status from Sprint 3.
   * "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY"
   */
  classificationStatus?: "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY";

  /**
   * Flag indicating whether the seller/user has formally confirmed this candidate.
   */
  isConfirmedByUser?: boolean;
}

/**
 * Complete Landed Cost Calculation Output (Sprint 4)
 */
export interface LandedCostCalculationResult {
  calculationId: string;
  calculatedAt: string;
  calculationDate: string;         // YYYY-MM-DD server calculation date
  importDate: string;              // YYYY-MM-DD evaluated date of commercial entry
  isSimulation: boolean;           // True if evaluated against simulation date baseline
  simulationNotice?: string;       // Visible notice if demo simulation mode applied
  status: LandedCostStatus;
  datasetCoverageStatus: "SUPPORTED_CURATED_STORE" | "UNSUPPORTED_CODE";
  
  // High-Level Summary
  productId?: string;
  productTitle: string;
  originCountry: string;
  destinationCountry: string;
  quantity: number;
  unitPriceUSD: number;
  dutiableCustomsValueUSD: number;
  customsValuationMethod: string;
  valuationScenarioType: ValuationScenarioType;
  postalServiceType?: PostalServiceType;
  baseCustomsDutyUSD: number;
  section301DutyUSD: number;
  otherChapter99DutyUSD: number;
  totalCustomsDutyUSD: number;
  totalCustomsFeesUSD: number;     // MPF + HMF + Inbound EMS fee
  eccfWaybillFeeUSD?: number;      // $1.38 if qualifying ECCF or Centralized Hub Facility (19 C.F.R. § 24.23(b)(4))
  inboundEmsFeeUSD?: number;       // $1.00 if Inbound EMS (19 C.F.R. § 24.22(l)(1)(i))
  postalEntryProcedure?: PostalEntryProcedure;
  postalEntryProcedureNotice?: string;
  postalRuleEffectiveDate?: string;       // "2026-07-24" (CBP 91 FR 37801, Doc. 2026-12669)
  postalMandatoryComplianceDate?: string; // "2027-01-20" (CBP Doc. 2026-21600)
  postalRuleExtensionNotice?: string;     // Citation of Doc. 2026-21600 extension
  voluntaryPostalCompliance?: VoluntaryPostalCompliance;
  carrierPostalProcedure?: CarrierPostalProcedure;
  postalDetails?: PostalComplianceDetails;
  postalComplianceDetails?: PostalComplianceDetails;
  internationalShippingUSD: number;
  insuranceUSD: number;
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
  effectiveDate: string;
  disclaimer: string;              // 19 U.S.C. § 1484 Importer of Record notice
  
  // Warnings, Assumptions & Advisory Notes
  assumptions: string[];
  missingInformation: string[];
  advisoryWarnings: string[];
  unresolvedFactors?: string[];
  conditionalScenarios?: Array<{
    scenarioName: string;
    applicableDutyRate: number;
    estimatedLandedCostUSD: number;
    conditionRequired: string;
  }>;
}

/**
 * Standard RFC 7807 Error Envelope for Landed Cost
 */
export interface LandedCostErrorResponse {
  error: string;
  code: 
    | "INVALID_JSON"
    | "MISSING_MANDATORY_FIELDS"
    | "INVALID_QUANTITY"
    | "INVALID_PRICE"
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

// Sprint 5: Commercial Invoice Types
export * from "./invoice.ts";

// Sprint 6: PayPal Sandbox Payment Types
export * from "./payment.ts";
