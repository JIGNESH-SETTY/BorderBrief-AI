/**
 * BorderBrief AI — Deterministic Landed-Cost Calculator Test Suite (Sprint 4)
 *
 * Verifies:
 * 1. 19 U.S.C. § 1401a Transaction Valuation & Freight Deductions
 * 2. USITC 2026 HTS Revision 22 Column 1 General Base Duties
 * 3. USTR Document 2026-15181 Section 301 Duties & Agricultural Exemptions
 * 4. 19 C.F.R. § 24.23 FY2027 Merchandise Processing Fees (MPF clamps & Hub fees)
 * 5. 19 C.F.R. § 24.24 Harbor Maintenance Fees (HMF) & Informal exemptions
 * 6. DAP Commercial Term Responsibility Allocation (Seller vs Buyer)
 * 7. 4-State Status Contract (VERIFIED, PARTIALLY_VERIFIED, ESTIMATED, BLOCKED)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCustomsValuation,
  evaluateSection301Duty,
  calculateDutyComponents,
  calculateMpf,
  calculateHmf,
  calculateLandedCost,
  LandedCostCalculationError,
} from "../lib/tariff/landed-cost-engine.ts";
import type { LandedCostCalculationRequest, CustomsValuationDeclaration } from "../types/export.ts";
import { SEED_EXPORT_PROFILES } from "../data/seed-products.ts";

describe("Customs Valuation Engine (19 U.S.C. § 1401a)", () => {
  it("computes transaction value without freight deduction when shipping is zero", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 250.0,
      internationalShippingDeductionUSD: 0,
      isShippingDocumented: true,
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    const val = calculateCustomsValuation(declaration);
    assert.equal(val.dutiableCustomsValueUSD, 250.0);
    assert.equal(val.shippingDeductedUSD, 0);
  });

  it("deducts international freight under § 1401a(b)(4)(A) ONLY when documented", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 250.0,
      internationalShippingDeductionUSD: 45.0,
      isShippingDocumented: true,
      shippingDocumentationEvidence: "Air Waybill #618-98234120",
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    const val = calculateCustomsValuation(declaration);
    assert.equal(val.shippingDeductedUSD, 45.0);
    assert.equal(val.dutiableCustomsValueUSD, 205.0); // 250 - 45
    assert.equal(val.valuationStatus, "TRANSACTION_VALUE_DOCUMENTED");
  });

  it("REFUSES freight deduction when shipping is undocumented, flagging PARTIALLY_VERIFIED", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 250.0,
      internationalShippingDeductionUSD: 45.0,
      isShippingDocumented: false, // Undocumented freight
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION",
    };

    const val = calculateCustomsValuation(declaration);
    assert.equal(val.shippingDeductedUSD, 0.0); // Deduction refused
    assert.equal(val.dutiableCustomsValueUSD, 250.0); // Full invoice value remains dutiable
    assert.equal(val.valuationStatus, "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION");
    assert.equal(val.valuationScenarioType, "CONSERVATIVE_ILLUSTRATIVE_GROSS");
    assert.ok(val.missingDocumentation.length > 0);
    assert.ok(
      val.warnings.some((w) =>
        w.includes("carrier documentation") && w.includes("19 U.S.C. § 1401a(b)(4)(A)")
      )
    );
  });

  it("handles separate freight and transit insurance deductions with proper documentation", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 300.0,
      merchandisePriceUSD: 250.0,
      internationalShippingDeductionUSD: 40.0,
      isShippingDocumented: true,
      shippingDocumentationEvidence: "Air Waybill #618-98234120",
      insuranceDeductionUSD: 10.0,
      isInsuranceDocumented: true,
      insuranceDocumentationEvidence: "Transit Insurance Policy #TIC-8821",
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    const val = calculateCustomsValuation(declaration);
    // Dutiable = 300 (gross) - 40 (freight) - 10 (insurance) = 250.00
    assert.equal(val.dutiableCustomsValueUSD, 250.0);
    assert.equal(val.shippingDeductedUSD, 40.0);
    assert.equal(val.insuranceDeductedUSD, 10.0);
    assert.equal(val.valuationScenarioType, "TRANSACTION_VALUE_DOCUMENTED");
    assert.equal(val.missingDocumentation.length, 0);
  });

  it("labels as CONSERVATIVE_ILLUSTRATIVE_GROSS when freight is documented but insurance is undocumented", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 300.0,
      internationalShippingDeductionUSD: 40.0,
      isShippingDocumented: true,
      shippingDocumentationEvidence: "Air Waybill #618-98234120",
      insuranceDeductionUSD: 10.0,
      isInsuranceDocumented: false, // Undocumented insurance
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    const val = calculateCustomsValuation(declaration);
    // Freight is deducted (40), but insurance (10) is not deducted -> dutiable = 260.00
    assert.equal(val.shippingDeductedUSD, 40.0);
    assert.equal(val.insuranceDeductedUSD, 0.0);
    assert.equal(val.undocumentedInsuranceUSD, 10.0);
    assert.equal(val.dutiableCustomsValueUSD, 260.0);
    assert.equal(val.valuationScenarioType, "CONSERVATIVE_ILLUSTRATIVE_GROSS");
    assert.ok(val.missingDocumentation.some((d) => d.includes("insurance policy")));
  });

  it("adds statutory additions (assists and packing) to transaction value", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 200.0,
      internationalShippingDeductionUSD: 30.0,
      isShippingDocumented: true,
      areRelatedParties: false,
      hasAssistsOrRoyalties: true,
      packingCostsUSD: 15.0,
      statutoryAdditionsUSD: 35.0, // Assists + Royalties
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    const val = calculateCustomsValuation(declaration);
    // dutiable = 200 (gross) - 30 (freight) + 15 (packing) + 35 (assists) = 220.00
    assert.equal(val.shippingDeductedUSD, 30.0);
    assert.equal(val.statutoryAdditionsAppliedUSD, 50.0); // 15 + 35
    assert.equal(val.dutiableCustomsValueUSD, 220.0);
  });

  it("throws LandedCostCalculationError when freight deduction equals or exceeds gross invoice", () => {
    const declaration: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 20.0,
      internationalShippingDeductionUSD: 50.0, // exceeds gross invoice
      isShippingDocumented: true,
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    assert.throws(
      () => calculateCustomsValuation(declaration),
      (err: Error) => {
        assert.ok(err instanceof LandedCostCalculationError);
        assert.equal(err.code, "INVALID_SHIPPING_DEDUCTION");
        return true;
      }
    );
  });

  it("throws LandedCostCalculationError on negative shipping or non-positive invoice price", () => {
    const badPrice: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: -10.0,
      internationalShippingDeductionUSD: 10.0,
      isShippingDocumented: true,
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    assert.throws(
      () => calculateCustomsValuation(badPrice),
      (err: any) => err instanceof LandedCostCalculationError && err.code === "INVALID_PRICE"
    );

    const badShipping: CustomsValuationDeclaration = {
      grossInvoicePriceUSD: 100.0,
      internationalShippingDeductionUSD: -5.0,
      isShippingDocumented: true,
      areRelatedParties: false,
      hasAssistsOrRoyalties: false,
      valuationBasis: "TRANSACTION_VALUE",
      valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
    };

    assert.throws(
      () => calculateCustomsValuation(badShipping),
      (err: any) => err instanceof LandedCostCalculationError && err.code === "INVALID_SHIPPING_DEDUCTION"
    );
  });
});

describe("USITC 2026 Revision 22 Tariff Store & Duty Breakdowns", () => {
  it("accurately computes Column 1 General Base Duties across seed products", () => {
    // Cotton tote bag: 4202.92.15.00 -> 6.3%
    const { dutyBreakdown: tote } = calculateDutyComponents("4202.92.15.00", 1000.0, "IN");
    assert.equal(tote.baseAdValoremRate, 6.3);
    assert.equal(tote.baseDutyAmountUSD, 63.0);

    // Brass statue: 8306.29.00.00 -> 0.0% (Free)
    const { dutyBreakdown: statue } = calculateDutyComponents("8306.29.00.00", 500.0, "IN");
    assert.equal(tote.baseAdValoremRate > 0, true);
    assert.equal(statue.baseAdValoremRate, 0.0);
    assert.equal(statue.baseDutyAmountUSD, 0.0);

    // Glazed ceramic mug: 6912.00.44.00 -> 10.0%
    const { dutyBreakdown: mug } = calculateDutyComponents("6912.00.44.00", 200.0, "IN");
    assert.equal(mug.baseAdValoremRate, 10.0);
    assert.equal(mug.baseDutyAmountUSD, 20.0);

    // Leather wallet: 4202.31.60.00 -> 8.0%
    const { dutyBreakdown: wallet } = calculateDutyComponents("4202.31.60.00", 400.0, "IN");
    assert.equal(wallet.baseAdValoremRate, 8.0);
    assert.equal(wallet.baseDutyAmountUSD, 32.0);

    // Hand-Woven Mulberry Silk Shawl / Scarf: 6214.10.10.00 -> 1.2% (Column 1 General)
    const { dutyBreakdown: scarf } = calculateDutyComponents("6214.10.10.00", 300.0, "IN");
    assert.equal(scarf.baseAdValoremRate, 1.2);
    assert.equal(scarf.baseDutyAmountUSD, 3.6);

    // Loose Darjeeling black tea: 0902.30.00.90 -> 0.0% (Free)
    const { dutyBreakdown: tea } = calculateDutyComponents("0902.30.00.90", 250.0, "IN");
    assert.equal(tea.baseAdValoremRate, 0.0);
    assert.equal(tea.baseDutyAmountUSD, 0.0);
  });

  it("throws DATASET_COVERAGE_UNSUPPORTED when HTS code is not in verified dataset", () => {
    assert.throws(
      () => calculateDutyComponents("9999.99.99.99", 500.0, "IN"),
      (err: Error) => {
        assert.ok(err instanceof LandedCostCalculationError);
        assert.equal(err.code, "DATASET_COVERAGE_UNSUPPORTED");
        return true;
      }
    );
  });
});

describe("Section 301 Duties & Exemption Engine (USTR 2026-15181)", () => {
  it("assesses 10.0% Section 301 duty on VERIFIED_SUBJECT goods from India", () => {
    // Cotton tote bag
    const sec301 = evaluateSection301Duty("4202.92.15.00", 1000.0, "IN");
    assert.equal(sec301.exemptionStatus, "VERIFIED_SUBJECT");
    assert.equal(sec301.isApplicable, true);
    assert.equal(sec301.additionalAdValoremRate, 10.0);
    assert.equal(sec301.additionalDutyAmountUSD, 100.0);
    assert.equal(sec301.chapter99Heading, "9903.05.44");
    assert.equal(sec301.annexIChecked, true);
    assert.equal(sec301.annexIIChecked, true);
  });

  it("flags Darjeeling tea as UNRESOLVED with advisory exemption notes", () => {
    const sec301 = evaluateSection301Duty("0902.30.00.90", 500.0, "IN");
    assert.equal(sec301.exemptionStatus, "UNRESOLVED");
    assert.equal(sec301.isApplicable, true); // conservatively modeled
    assert.equal(sec301.additionalAdValoremRate, 10.0);
    assert.equal(sec301.additionalDutyAmountUSD, 50.0);
    assert.ok(
      sec301.exemptionNotes?.includes("loose-leaf black tea") &&
      sec301.exemptionNotes?.includes("Annex II Part A agricultural exclusions")
    );
  });

  it("does not apply Section 301 duties to non-Indian origin goods", () => {
    const sec301 = evaluateSection301Duty("4202.92.15.00", 1000.0, "FR");
    assert.equal(sec301.isApplicable, false);
    assert.equal(sec301.additionalAdValoremRate, 0.0);
    assert.equal(sec301.additionalDutyAmountUSD, 0.0);
  });
});

describe("Merchandise Processing Fee (19 C.F.R. § 24.23 & FY2027 Schedule 91 FR 48398)", () => {
  it("applies statutory minimum clamp ($34.58) for low dutiable value formal entries", () => {
    // 0.3464% of $3,000 = $10.39 -> clamped to $34.58 minimum
    const mpf = calculateMpf(3000.0, "FORMAL_ELECTRONIC", false, false);
    assert.equal(mpf.adValoremRate, 0.003464);
    assert.equal(mpf.finalMpfAmountUSD, 34.58);
    assert.equal(mpf.appliedMinimumUSD, 34.58);
  });

  it("applies ad valorem rate without clamp in intermediate value range", () => {
    // 0.3464% of $50,000 = $173.20 -> between $34.58 and $670.86
    const mpf = calculateMpf(50000.0, "FORMAL_ELECTRONIC", false, false);
    assert.equal(mpf.finalMpfAmountUSD, 173.2);
  });

  it("applies statutory maximum clamp ($670.86) for high dutiable value formal entries", () => {
    // 0.3464% of $300,000 = $1,039.20 -> clamped to $670.86 maximum
    const mpf = calculateMpf(300000.0, "FORMAL_ELECTRONIC", false, false);
    assert.equal(mpf.finalMpfAmountUSD, 670.86);
    assert.equal(mpf.appliedMaximumUSD, 670.86);
  });

  it("applies standard informal automated MPF ($2.77) for eligible informal entries", () => {
    const mpf = calculateMpf(500.0, "AUTO_DETECT", false, false);
    assert.equal(mpf.finalMpfAmountUSD, 2.77);
    assert.equal(mpf.isInformalEligible, true);
    assert.equal(mpf.appliedEntryType, "INFORMAL_AUTOMATED");
  });

  it("applies manual informal entry MPF tiers ($8.30 not CBP prep and $12.45 CBP prep)", () => {
    // 19 C.F.R. § 24.23(b)(2)(i)(B) - not prepared by CBP: $8.30
    const mpfNotCbp = calculateMpf(500.0, "INFORMAL_MANUAL", false, false);
    assert.equal(mpfNotCbp.finalMpfAmountUSD, 8.30);
    assert.equal(mpfNotCbp.appliedEntryType, "INFORMAL_MANUAL");

    // 19 C.F.R. § 24.23(b)(2)(i)(C) - prepared by CBP: $12.45
    const mpfCbp = calculateMpf(500.0, "INFORMAL_CBP_PREP", false, false);
    assert.equal(mpfCbp.finalMpfAmountUSD, 12.45);
    assert.equal(mpfCbp.appliedEntryType, "INFORMAL_CBP_PREP");
  });

  it("applies manual formal entry MPF surcharge ($4.15) added to formal rate/clamps", () => {
    // $3,000 dutiable: 0.3464% = $10.39 -> clamped to $34.58 min + $4.15 manual surcharge = $38.73
    const mpfManualMin = calculateMpf(3000.0, "FORMAL_MANUAL", false, false);
    assert.equal(mpfManualMin.appliedMinimumUSD, 34.58);
    assert.equal(mpfManualMin.manualSurchargeUSD, 4.15);
    assert.equal(mpfManualMin.finalMpfAmountUSD, 38.73);
    assert.equal(mpfManualMin.appliedEntryType, "FORMAL_MANUAL");

    // $50,000 dutiable: 0.3464% = $173.20 + $4.15 = $177.35
    const mpfManualMid = calculateMpf(50000.0, "FORMAL_MANUAL", false, false);
    assert.equal(mpfManualMid.manualSurchargeUSD, 4.15);
    assert.equal(mpfManualMid.finalMpfAmountUSD, 177.35);
  });

  it("statutorily exempts ordinary international mail from MPF ($0.00) under 19 C.F.R. § 24.23(c)(1)(v)", () => {
    const postalOrdinary = calculateMpf(1000.0, "AUTO_DETECT", false, false, "POSTAL", "ORDINARY_MAIL");
    assert.equal(postalOrdinary.finalMpfAmountUSD, 0.0);
    assert.equal(postalOrdinary.mpfStatus, "VERIFIED_EXEMPT");
    assert.equal(postalOrdinary.appliedEntryType, "EXEMPT_POSTAL");
    assert.ok(postalOrdinary.statutoryNotes.includes("19 C.F.R. § 24.23(c)(1)(v)"));
  });

  it("assesses formal ad valorem MPF on formally entered Inbound EMS under 85 FR 47018 exception", () => {
    // $3,500 dutiable value exceeds informal threshold (> $2,500) -> formal entry
    const emsFormal = calculateMpf(3500.0, "AUTO_DETECT", false, false, "POSTAL", "INBOUND_EMS");
    assert.equal(emsFormal.mpfStatus, "VERIFIED_ASSESSED");
    assert.equal(emsFormal.finalMpfAmountUSD, 34.58); // clamped to formal minimum $34.58
    assert.equal(emsFormal.inboundEmsFeeUSD, 1.00); // Separate $1.00 EMS fee under § 24.22(l)(1)(i)
    assert.equal(emsFormal.eccfWaybillFeeUSD, undefined); // NOT an ECCF fee!
    assert.equal(emsFormal.postalEntryProcedure, "FORMAL_MAIL_REQUIRED");
    assert.ok(emsFormal.carrierFacilityFeeNote?.includes("85 FR 47018"));
    assert.ok(emsFormal.statutoryNotes.includes("85 FR 47018"));
    assert.ok(emsFormal.inboundEmsFeeNote?.includes("19 C.F.R. § 24.22(l)(1)(i)"));
  });

  it("exempts informal Inbound EMS from MPF under 19 C.F.R. § 24.23(c)(1)(v) but assesses separate $1.00 EMS fee", () => {
    // $800 dutiable value is informal (<= $2,500) and no Chapter 99 duties
    const emsInformal = calculateMpf(800.0, "AUTO_DETECT", false, false, "POSTAL", "INBOUND_EMS", false);
    assert.equal(emsInformal.finalMpfAmountUSD, 0.0);
    assert.equal(emsInformal.mpfStatus, "VERIFIED_EXEMPT");
    assert.equal(emsInformal.appliedEntryType, "EXEMPT_POSTAL");
    assert.equal(emsInformal.inboundEmsFeeUSD, 1.00); // Separate $1.00 EMS fee under § 24.22(l)(1)(i)
    assert.equal(emsInformal.eccfWaybillFeeUSD, undefined); // Postal is NOT private ECCF!
    assert.equal(emsInformal.postalEntryProcedure, "INFORMAL_MAIL");
  });

  it("applies existing informal postal clearance during transition extension period (CBP Doc. 2026-21600)", () => {
    // $500 dutiable value: has Chapter 99 duties (Section 301), evaluated during extension period (as of 2026-11-07)
    // 1. Ordinary international mail (confirmed informal clearance):
    const ordinaryPostal = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "ORDINARY_MAIL",
      true,
      "2026-11-07",
      "NONE",
      "CONFIRMED_INFORMAL",
      true
    );
    assert.equal(ordinaryPostal.isMandatoryFormal, false);
    assert.equal(ordinaryPostal.postalEntryProcedure, "INFORMAL_MAIL_EXTENDED");
    assert.equal(ordinaryPostal.finalMpfAmountUSD, 0.0); // Statutorily exempt under § 24.23(c)(1)(v)
    assert.equal(ordinaryPostal.inboundEmsFeeUSD, undefined); // Ordinary mail has NO EMS fee
    assert.equal(ordinaryPostal.postalDetails?.procedureCertainty, "CONFIRMED");
    assert.ok(ordinaryPostal.postalEntryProcedureNotice?.includes("Doc. 2026-21600"));
    assert.equal(ordinaryPostal.postalMandatoryComplianceDate, "2027-01-20");

    // 2. Inbound EMS (confirmed informal clearance):
    const emsPostal = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2026-11-07",
      "NONE",
      "CONFIRMED_INFORMAL",
      true
    );
    assert.equal(emsPostal.isMandatoryFormal, false);
    assert.equal(emsPostal.postalEntryProcedure, "INFORMAL_MAIL_EXTENDED");
    assert.equal(emsPostal.finalMpfAmountUSD, 0.0); // Informal EMS exempt from MPF under § 24.23(c)(1)(v)
    assert.equal(emsPostal.inboundEmsFeeUSD, 1.00); // Separate $1.00 EMS fee under § 24.22(l)(1)(i)
    assert.equal(emsPostal.eccfWaybillFeeUSD, undefined);
    assert.equal(emsPostal.postalDetails?.procedureCertainty, "CONFIRMED");
  });

  it("models voluntary early formal compliance and Entry Type 13 test prior to Jan 20, 2027", () => {
    // 1. Voluntary early formal entry:
    const earlyFormalEms = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2026-11-07",
      "FORMAL_EARLY"
    );
    assert.equal(earlyFormalEms.postalEntryProcedure, "VOLUNTARY_FORMAL_EARLY");
    assert.equal(earlyFormalEms.finalMpfAmountUSD, 34.58); // Formal MPF applies when early formal is elected
    assert.equal(earlyFormalEms.inboundEmsFeeUSD, 1.00);
    assert.equal(earlyFormalEms.postalDetails?.procedureCertainty, "CONFIRMED");
    assert.ok(earlyFormalEms.postalEntryProcedureNotice?.includes("Voluntary early formal compliance"));

    const earlyFormalOrdinary = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "ORDINARY_MAIL",
      true,
      "2026-11-07",
      "FORMAL_EARLY"
    );
    assert.equal(earlyFormalOrdinary.postalEntryProcedure, "VOLUNTARY_FORMAL_EARLY");
    assert.equal(earlyFormalOrdinary.finalMpfAmountUSD, 0.0); // Ordinary mail remains statutorily exempt even when formal
    assert.equal(earlyFormalOrdinary.postalDetails?.procedureCertainty, "CONFIRMED");

    // 2. Voluntary Entry Type 13 pilot with confirmed participation & complete data:
    const testPilotEmsConfirmed = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2026-11-07",
      "ENTRY_TYPE_13_TEST",
      "VOLUNTARY_ENTRY_TYPE_13",
      true,
      {
        hasRightToMakeEntry: true,
        isCbpTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
      }
    );
    assert.equal(testPilotEmsConfirmed.postalEntryProcedure, "VOLUNTARY_TEST_ENTRY_TYPE_13");
    assert.equal(testPilotEmsConfirmed.finalMpfAmountUSD, 0.0);
    assert.equal(testPilotEmsConfirmed.inboundEmsFeeUSD, 1.00);
    assert.equal(testPilotEmsConfirmed.postalDetails?.entryType13PrerequisitesVerified, true);
    assert.equal(testPilotEmsConfirmed.postalDetails?.procedureCertainty, "CONFIRMED");

    // 3. Voluntary Entry Type 13 WITHOUT confirmed test participation:
    const testPilotUnconfirmed = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2026-11-07",
      "ENTRY_TYPE_13_TEST",
      "VOLUNTARY_ENTRY_TYPE_13",
      true,
      {
        hasRightToMakeEntry: false,
        isCbpTestParticipant: false,
        hasAceFilingCapability: false,
        hasRequiredDataElements: false,
      }
    );
    assert.equal(testPilotUnconfirmed.postalEntryProcedure, "UNRESOLVED");
    assert.equal(testPilotUnconfirmed.mpfStatus, "UNRESOLVED");
    assert.equal(testPilotUnconfirmed.postalDetails?.procedureCertainty, "UNCONFIRMED_CARRIER_HANDLING");
    assert.equal(testPilotUnconfirmed.postalDetails?.entryType13PrerequisitesVerified, false);
    assert.ok((testPilotUnconfirmed.postalDetails?.entryType13MissingPrerequisites?.length ?? 0) > 0);

    // 4. Unresolved carrier handling:
    const unresolvedCompliance = calculateMpf(
      500.0,
      "AUTO_DETECT",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2026-11-07",
      "UNKNOWN"
    );
    assert.equal(unresolvedCompliance.postalEntryProcedure, "UNRESOLVED");
    assert.equal(unresolvedCompliance.mpfStatus, "UNRESOLVED");
    assert.equal(unresolvedCompliance.postalDetails?.procedureCertainty, "UNCONFIRMED_CARRIER_HANDLING");
  });

  it("models formal entry for postal shipments with Chapter 99 duties on or after January 20, 2027", () => {
    // Post-compliance date (2027-01-20 or later): Formal entry filed under 91 FR 37801 & Doc. 2026-21600
    // 1. Ordinary international mail:
    const ordinaryPostal = calculateMpf(
      500.0,
      "FORMAL_ELECTRONIC",
      false,
      false,
      "POSTAL",
      "ORDINARY_MAIL",
      true,
      "2027-01-20",
      "FORMAL_ENTRY",
      "FORMAL_ENTRY",
      true
    );
    assert.equal(ordinaryPostal.isMandatoryFormal, true);
    assert.equal(ordinaryPostal.postalEntryProcedure, "FORMAL_ENTRY");
    assert.equal(ordinaryPostal.finalMpfAmountUSD, 0.0); // Ordinary mail remains exempt from MPF even when formal
    assert.equal(ordinaryPostal.inboundEmsFeeUSD, undefined); // Ordinary mail has NO EMS fee
    assert.ok(ordinaryPostal.postalEntryProcedureNotice?.includes("91 FR 37801"));
    assert.ok(ordinaryPostal.postalEntryProcedureNotice?.includes("Doc. 2026-21600"));

    // 2. Inbound EMS:
    const emsPostal = calculateMpf(
      500.0,
      "FORMAL_ELECTRONIC",
      false,
      false,
      "POSTAL",
      "INBOUND_EMS",
      true,
      "2027-01-20",
      "FORMAL_ENTRY",
      "FORMAL_ENTRY",
      true
    );
    assert.equal(emsPostal.isMandatoryFormal, true);
    assert.equal(emsPostal.postalEntryProcedure, "FORMAL_ENTRY");
    assert.equal(emsPostal.finalMpfAmountUSD, 34.58); // Formal Inbound EMS incurs formal MPF under 85 FR 47018
    assert.equal(emsPostal.inboundEmsFeeUSD, 1.00); // Separate $1.00 EMS fee
    assert.equal(emsPostal.eccfWaybillFeeUSD, undefined); // Never conflate with $1.38 ECCF fee
  });

  it("flags MPF as UNRESOLVED when postal service type is unknown or unspecified", () => {
    const postalUnknown = calculateMpf(3000.0, "AUTO_DETECT", false, false, "POSTAL", "UNKNOWN");
    assert.equal(postalUnknown.mpfStatus, "UNRESOLVED");
    assert.ok(postalUnknown.statutoryNotes.includes("UNRESOLVED"));
  });

  it("applies Express Centralized Hub fee ($1.38) and exempts informal MPF under § 24.23(b)(4)", () => {
    const mpf = calculateMpf(500.0, "AUTO_DETECT", true, false);
    assert.equal(mpf.finalMpfAmountUSD, 0.0);
    assert.equal(mpf.eccfWaybillFeeUSD, 1.38);
    assert.ok(mpf.carrierFacilityFeeNote?.includes("19 C.F.R. § 24.23(b)(4)"));
  });

  it("escalates commercial shipment <= $2,500 to formal entry fee when mandatory", () => {
    const mpf = calculateMpf(1500.0, "AUTO_DETECT", false, true);
    assert.equal(mpf.finalMpfAmountUSD, 34.58);
    assert.equal(mpf.isMandatoryFormal, true);
  });
});

describe("Harbor Maintenance Fee (19 C.F.R. § 24.24)", () => {
  it("applies 0.125% ad valorem on commercial ocean cargo formal entry", () => {
    // 0.125% of $10,000 = $12.50
    const hmf = calculateHmf(10000.0, "OCEAN_FCL", false);
    assert.equal(hmf.hmfAmountUSD, 12.5);
    assert.equal(hmf.isExempt, false);
    assert.equal(hmf.adValoremRate, 0.00125);
  });

  it("exempts air, postal, and express courier shipments ($0.00)", () => {
    const airHmf = calculateHmf(5000.0, "AIR_CARGO", false);
    assert.equal(airHmf.hmfAmountUSD, 0.0);
    assert.equal(airHmf.isExempt, true);
    assert.ok(airHmf.exemptionReason?.includes("Air and postal transportation are exempt"));

    const postalHmf = calculateHmf(500.0, "POSTAL", false);
    assert.equal(postalHmf.hmfAmountUSD, 0.0);
    assert.equal(postalHmf.isExempt, true);
  });

  it("exempts informal ocean entries under 19 C.F.R. § 24.24(d)(3)(i)", () => {
    const oceanInformalHmf = calculateHmf(1200.0, "OCEAN_LCL", true);
    assert.equal(oceanInformalHmf.hmfAmountUSD, 0.0);
    assert.equal(oceanInformalHmf.isExempt, true);
    assert.ok(oceanInformalHmf.exemptionReason?.includes("19 C.F.R. § 24.24(d)(3)(i)"));
  });
});

describe("Master Landed-Cost Engine & State Machine Contract", () => {
  it("computes complete VERIFIED landed cost for cotton tote bag with documented freight", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 50,
      unitPriceUSD: 20.0, // Entered: $1,000.00
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 1100.0, // 1000 (goods) + 100 (shipping)
        internationalShippingDeductionUSD: 100.0, // Documented freight
        isShippingDocumented: true,
        shippingDocumentationEvidence: "Air Waybill #618-98234120",
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);

    // Customs valuation: 1,100 gross - 100 freight = 1,000.00 dutiable
    assert.equal(res.dutiableCustomsValueUSD, 1000.0);
    assert.equal(res.internationalShippingUSD, 100.0);

    // Duties on $1,000.00:
    // Base duty: 6.3% of $1,000 = $63.00
    // Section 301 duty: 10.0% of $1,000 = $100.00
    // Total duty: 63.00 + 100.00 = $163.00
    assert.equal(res.baseCustomsDutyUSD, 63.0);
    assert.equal(res.section301DutyUSD, 100.0);
    assert.equal(res.totalCustomsDutyUSD, 163.0);

    // User fees:
    // Air cargo: HMF = $0.00
    // Informal air entry (<= $2,500): automated MPF = $2.77
    assert.equal(res.hmfBreakdown.hmfAmountUSD, 0.0);
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 2.77);
    assert.equal(res.totalCustomsFeesUSD, 2.77);

    // DAP Responsibility:
    // Seller collected via PayPal: $1,100.00
    // Buyer payable upon arrival (CBP duties + fees): 163.00 + 2.77 = $165.77
    // Total delivered landed cost: 1,100 + 165.77 = $1,265.77
    assert.equal(res.dapAllocation.sellerCollectedViaPaypalUSD, 1100.0);
    assert.equal(res.dapAllocation.buyerPayableUponArrivalUSD, 165.77);
    assert.equal(res.totalLandedCostUSD, 1265.77);

    // Status must be VERIFIED
    assert.equal(res.status, "VERIFIED");
    assert.ok(res.disclaimer.includes("19 U.S.C. § 1484"));
  });

  it("sets status to PARTIALLY_VERIFIED when freight is undocumented", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cast Brass Ganesha Figurine",
      hts10: "8306.29.00.00",
      quantity: 1,
      unitPriceUSD: 85.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 110.0, // 85 goods + 25 shipping
        internationalShippingDeductionUSD: 25.0,
        isShippingDocumented: false, // Undocumented freight
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.valuationScenarioType, "CONSERVATIVE_ILLUSTRATIVE_GROSS");
    assert.equal(res.dutiableCustomsValueUSD, 110.0); // Full gross price remains dutiable
    assert.ok(res.missingInformation.length > 0);
    assert.ok(
      res.advisoryWarnings.some((w) =>
        w.includes("carrier documentation") && w.includes("19 U.S.C. § 1401a(b)(4)(A)")
      )
    );
  });

  it("calculates landed cost with postal ordinary mail confirmed informal clearance during extension period (CBP Doc. 2026-21600)", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "CONFIRMED_INFORMAL",
      isPostalProcedureConfirmed: true,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0);
    assert.equal(res.mpfBreakdown.mpfStatus, "VERIFIED_EXEMPT");
    assert.equal(res.totalCustomsFeesUSD, 0.0); // No MPF, no HMF, no EMS fee
    assert.equal(res.inboundEmsFeeUSD, undefined);
    assert.equal(res.postalEntryProcedure, "INFORMAL_MAIL_EXTENDED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    assert.ok(res.assumptions.some((a) => a.includes("Doc. 2026-21600")));
    assert.equal(res.postalMandatoryComplianceDate, "2027-01-20");
    // DAP buyer payable = $32.60 duty + $0 fees = $32.60
    assert.equal(res.totalCustomsDutyUSD, 32.60);
    assert.equal(res.dapAllocation.buyerPayableUponArrivalUSD, 32.60);
    assert.equal(res.totalLandedCostUSD, 262.60);
  });

  it("calculates landed cost for Inbound EMS confirmed informal clearance during extension period", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      carrierPostalProcedure: "CONFIRMED_INFORMAL",
      isPostalProcedureConfirmed: true,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.inboundEmsFeeUSD, 1.00); // 19 C.F.R. § 24.22(l)(1)(i)
    assert.equal(res.eccfWaybillFeeUSD, undefined); // Postal is NOT private ECCF
    assert.equal(res.postalEntryProcedure, "INFORMAL_MAIL_EXTENDED"); // In transition extension period
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0); // Informal EMS is exempt from MPF
    assert.equal(res.totalCustomsFeesUSD, 1.00); // $0.00 MPF + $1.00 EMS fee
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    // DAP buyer payable = $32.60 total duty + $1.00 EMS fee = $33.60
    assert.equal(res.totalCustomsDutyUSD, 32.60);
    assert.equal(res.dapAllocation.buyerPayableUponArrivalUSD, 33.60);
    assert.equal(res.totalLandedCostUSD, 263.60); // 230 seller + 33.60 buyer
  });

  it("downgrades landed cost to PARTIALLY_VERIFIED when carrier procedure is unknown/unconfirmed during extension", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      // carrier procedure NOT confirmed
      isPostalProcedureConfirmed: false,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "UNCONFIRMED_CARRIER_HANDLING");
    assert.ok(
      res.unresolvedFactors?.some((f) => f.includes("carrier/operator clearance procedure"))
    );
  });

  it("calculates landed cost with voluntary early formal entry on CBP Form 7501 during extension", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      voluntaryPostalCompliance: "FORMAL_EARLY",
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "VOLUNTARY_FORMAL_EARLY");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 34.58); // Formal ad valorem MPF min clamp
    assert.equal(res.inboundEmsFeeUSD, 1.00);
    assert.equal(res.totalCustomsFeesUSD, 35.58);
    assert.equal(res.dapAllocation.buyerPayableUponArrivalUSD, 68.18);
  });

  it("models formal entry for postal shipments with Chapter 99 duties on or after January 20, 2027", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2027-01-20",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      carrierPostalProcedure: "FORMAL_ENTRY",
      isPostalProcedureConfirmed: true,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "FORMAL_ENTRY");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 34.58);
    assert.equal(res.inboundEmsFeeUSD, 1.00);
    assert.equal(res.totalCustomsFeesUSD, 35.58);
    assert.ok(res.assumptions.some((a) => a.includes("91 FR 37801") && a.includes("Jan 20, 2027")));
  });

  it("models voluntary Entry Type 13 with confirmed participation and complete required data", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-12-15",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      voluntaryPostalCompliance: "ENTRY_TYPE_13_TEST",
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isCbpTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        trackingNumber: "IN987654321US",
      },
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "VOLUNTARY_TEST_ENTRY_TYPE_13");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0);
    assert.equal(res.inboundEmsFeeUSD, 1.00);
    assert.equal(res.totalCustomsFeesUSD, 1.00);
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, true);
  });

  it("downgrades Entry Type 13 to PARTIALLY_VERIFIED when test participation/prerequisites are unconfirmed", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-12-15",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      voluntaryPostalCompliance: "ENTRY_TYPE_13_TEST",
      // Missing test participant status & ABI capability
      entryType13Eligibility: {
        hasRightToMakeEntry: false,
        isCbpTestParticipant: false,
        hasAceFilingCapability: false,
        hasRequiredDataElements: false,
      },
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, false);
    assert.ok(
      res.unresolvedFactors?.some((f) => f.includes("Entry Type 13"))
    );
  });

  it("evaluates production date with injectable clock after Jan 20, 2027 when formal entry is elected", () => {
    // Injected server clock returns 2027-02-15; no importDate passed by client
    const customClock = () => new Date("2027-02-15T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock: customClock,
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      carrierPostalProcedure: "FORMAL_ENTRY",
      isPostalProcedureConfirmed: true,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.calculationDate, "2027-02-15");
    assert.equal(res.importDate, "2027-02-15");
    assert.equal(res.isSimulation, false);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "FORMAL_ENTRY");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 34.58);
  });

  it("identifies explicit simulation mode and returns visible simulation notice", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      isDemoMode: true,
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "CONFIRMED_INFORMAL",
      isPostalProcedureConfirmed: true,
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.importDate, "2026-11-07");
    assert.equal(res.isSimulation, true);
    assert.ok(res.simulationNotice?.includes("Simulation baseline date 2026-11-07"));
    assert.ok(res.assumptions.some((a) => a.includes("Simulation Mode")));
  });

  it("validates client-provided import date and rejects invalid date strings", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      importDate: "2026-02-31", // Invalid calendar day
      transportationMode: "POSTAL",
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    assert.throws(
      () => calculateLandedCost(req),
      (err: unknown) => {
        return (
          err instanceof Error &&
          err.message.includes("day (31) is invalid for month 2")
        );
      }
    );
  });

  it("downgrades landed cost status to PARTIALLY_VERIFIED when postal type is unconfirmed", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "POSTAL",
      postalServiceType: "UNKNOWN",
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.mpfBreakdown.mpfStatus, "UNRESOLVED");
    assert.ok(
      res.unresolvedFactors?.some((f) => f.includes("Postal service classification"))
    );
  });

  it("sets status to PARTIALLY_VERIFIED with scenario bounds for Darjeeling tea", () => {
    const req: LandedCostCalculationRequest = {
      productTitle: "Loose Leaf Darjeeling Tea",
      hts10: "0902.30.00.90",
      quantity: 10,
      unitPriceUSD: 18.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 195.0, // 180 goods + 15 shipping
        internationalShippingDeductionUSD: 15.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.ok(res.conditionalScenarios && res.conditionalScenarios.length === 2);
    assert.equal(res.conditionalScenarios[0].scenarioName.includes("Scenario A"), true);
    assert.equal(res.conditionalScenarios[1].scenarioName.includes("Scenario B"), true);
  });

  it("strictly BLOCKS calculation when classification ambiguity is unresolved", () => {
    const reqSheesham: LandedCostCalculationRequest = {
      productTitle: "Hand-Carved Sheesham Wood Coasters",
      hts10: "4419.20.90.00",
      quantity: 4,
      unitPriceUSD: 14.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      classificationStatus: "UNRESOLVED_AMBIGUITY", // Sheesham coaster ambiguous
      valuation: {
        grossInvoicePriceUSD: 68.0,
        internationalShippingDeductionUSD: 12.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    assert.throws(
      () => calculateLandedCost(reqSheesham),
      (err: Error) => {
        assert.ok(err instanceof LandedCostCalculationError);
        assert.equal(err.code, "CLASSIFICATION_AMBIGUITY_UNRESOLVED");
        assert.equal(err.statusCode, 422);
        return true;
      }
    );
  });

  it("computes complete landed cost for Hand-Woven Mulberry Silk Shawl with 1.2% base rate + 10.0% Section 301 (total 11.2%)", () => {
    const req: LandedCostCalculationRequest = {
      productId: "prod-silk-scarf",
      productTitle: "Hand-Woven Mulberry Silk Shawl / Scarf",
      hts10: "6214.10.10.00",
      quantity: 5,
      unitPriceUSD: 48.0, // $240.00 merchandise value
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_EXPRESS",
      valuation: {
        grossInvoicePriceUSD: 256.0, // $240 goods + $16 shipping
        internationalShippingDeductionUSD: 16.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.dutiableCustomsValueUSD, 240.0);
    assert.equal(res.dutyBreakdown.baseAdValoremRate, 1.2);
    assert.equal(res.baseCustomsDutyUSD, 2.88); // 1.2% of 240 = 2.88
    assert.equal(res.section301DutyUSD, 24.0); // 10.0% of 240 = 24.00
    assert.equal(res.totalCustomsDutyUSD, 26.88); // 11.2% total duty = $26.88 (NOT 18.5%)
    assert.equal(res.dutyBreakdown.totalDutyRate, 11.2);
  });

  it("reconciles all 7 authentic Indian seed profiles with exact IDs, titles, and rates from seed-products.ts", () => {
    assert.equal(SEED_EXPORT_PROFILES.length, 7);

    const expectedSeedInventory = [
      {
        id: "prod-cotton-bag",
        title: "Handmade Hand-Printed Cotton Tote Bag",
        candidateHTS10: "4202.92.15.00",
        generalDutyRate: 6.3,
      },
      {
        id: "prod-brass-statue",
        title: "Handcrafted Cast Brass Ganesha Figurine",
        candidateHTS10: "8306.29.00.00",
        generalDutyRate: 0.0,
      },
      {
        id: "prod-silk-scarf",
        title: "Hand-Woven Mulberry Silk Shawl / Scarf",
        candidateHTS10: "6214.10.10.00",
        generalDutyRate: 1.2,
      },
      {
        id: "prod-ceramic-mug",
        title: "Studio Pottery Hand-Thrown Glazed Stoneware Ceramic Mug",
        candidateHTS10: "6912.00.44.00",
        generalDutyRate: 10.0,
      },
      {
        id: "prod-wooden-coasters",
        title: "Hand-Carved Sheesham Wood Coasters Set of 6",
        candidateHTS10: "4419.90.91.00",
        generalDutyRate: 3.2,
      },
      {
        id: "prod-leather-wallet",
        title: "Handmade Vegetable-Tanned Leather Bi-fold Wallet",
        candidateHTS10: "4202.31.60.00",
        generalDutyRate: 8.0,
      },
      {
        id: "prod-darjeeling-tea",
        title: "Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g)",
        candidateHTS10: "0902.30.00.90",
        generalDutyRate: 0.0,
      },
    ];

    expectedSeedInventory.forEach((expected, idx) => {
      const actual = SEED_EXPORT_PROFILES[idx];
      assert.equal(actual.id, expected.id, `Seed profile ${idx} ID mismatch`);
      assert.equal(actual.title, expected.title, `Seed profile ${idx} title mismatch`);
      assert.equal(actual.candidateHTS10, expected.candidateHTS10, `Seed profile ${idx} HTS mismatch`);
      assert.equal(actual.generalDutyRate, expected.generalDutyRate, `Seed profile ${idx} duty rate mismatch`);
    });
  });

  it("verifies Inbound EMS fee presentation explains 50% USPS retention and 50% CBP remittance under 19 CFR §24.22(l)(2)", () => {
    const emsMpf = calculateMpf(500.0, "AUTO_DETECT", false, false, "POSTAL", "INBOUND_EMS", false);
    assert.equal(emsMpf.inboundEmsFeeUSD, 1.00);
    assert.ok(emsMpf.inboundEmsFeeNote?.includes("retains 50% ($0.50)"));
    assert.ok(emsMpf.inboundEmsFeeNote?.includes("remits 50% ($0.50) quarterly to CBP"));
  });
});

describe("Sprint 4 Final Entry Type 13 Regulatory Alignment (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707)", () => {
  const baseToteValuation = {
    grossInvoicePriceUSD: 230.0,
    internationalShippingDeductionUSD: 30.0,
    isShippingDocumented: true,
    areRelatedParties: false,
    hasAssistsOrRoyalties: false,
    valuationBasis: "TRANSACTION_VALUE" as const,
    valuationStatus: "TRANSACTION_VALUE_DOCUMENTED" as const,
  };

  // 1. Chapter 99 postal shipment before January 20, 2027
  it("Regression Test 1: calculates Chapter 99 postal shipment before January 20, 2027 under extended informal clearance", () => {
    const clock = () => new Date("2026-11-07T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "CONFIRMED_INFORMAL",
      isPostalProcedureConfirmed: true,
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "INFORMAL_MAIL_EXTENDED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0);
    assert.equal(res.inboundEmsFeeUSD, undefined);
    assert.equal(res.totalCustomsFeesUSD, 0.0);
    assert.ok(res.postalComplianceDetails?.legallyAvailablePathways?.some((p) => p.includes("2026-21600")));
  });

  // 2. Eligible Entry Type 13 shipment before January 20, 2027
  it("Regression Test 2: models eligible Entry Type 13 shipment before January 20, 2027", () => {
    const clock = () => new Date("2026-11-07T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2026-11-07",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      carrierPostalProcedure: "VOLUNTARY_ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        hasChapter99Data: true,
        isPgaDataComplete: true,
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "VOLUNTARY_TEST_ENTRY_TYPE_13");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0);
    assert.equal(res.inboundEmsFeeUSD, 1.00);
    assert.equal(res.totalCustomsFeesUSD, 1.00);
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, true);
  });

  // 3. Chapter 99 shipment on or after January 20, 2027 using Entry Type 13
  it("Regression Test 3: models Chapter 99 shipment on or after January 20, 2027 using qualifying Entry Type 13", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        hasChapter99Data: true,
        isPgaTemporaryAcceptanceActive: true,
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    // Crucial: Must NOT automatically assign FORMAL_MAIL_REQUIRED!
    assert.notEqual(res.postalEntryProcedure, "FORMAL_MAIL_REQUIRED");
    assert.equal(res.postalEntryProcedure, "ENTRY_TYPE_13");
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 0.0);
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, true);
    // Represents both pathways under CBP Doc. 2026-21600 & 2026-21570
    assert.equal(res.postalComplianceDetails?.legallyAvailablePathways?.length, 2);
    assert.ok(res.postalComplianceDetails?.legallyAvailablePathways?.some((p) => p.includes("Formal entry")));
    assert.ok(res.postalComplianceDetails?.legallyAvailablePathways?.some((p) => p.includes("Entry Type 13")));
  });

  // 4. Chapter 99 shipment on or after January 20, 2027 using formal entry
  it("Regression Test 4: models Chapter 99 shipment on or after January 20, 2027 using formal entry", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "INBOUND_EMS",
      carrierPostalProcedure: "FORMAL_ENTRY",
      isPostalProcedureConfirmed: true,
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "FORMAL_ENTRY");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "CONFIRMED");
    assert.equal(res.mpfBreakdown.finalMpfAmountUSD, 34.58);
    assert.equal(res.inboundEmsFeeUSD, 1.00);
    assert.equal(res.totalCustomsFeesUSD, 35.58);
    assert.equal(res.postalComplianceDetails?.legallyAvailablePathways?.length, 2);
  });

  // 5. Ineligible Entry Type 13 filer
  it("Regression Test 5: rejects ineligible Entry Type 13 filer lacking Section 1484 right to make entry", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: false, // Ineligible filer
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "UNCONFIRMED_CARRIER_HANDLING");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, false);
    assert.ok(
      res.postalComplianceDetails?.entryType13MissingPrerequisites?.some((p) => p.includes("19 U.S.C. § 1484"))
    );
  });

  // 6. Missing ACE filing capability
  it("Regression Test 6: rejects Entry Type 13 when electronic ACE filing capability is unverified", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: false, // Missing ACE
        hasRequiredDataElements: true,
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, false);
    assert.ok(
      res.postalComplianceDetails?.entryType13MissingPrerequisites?.some((p) => p.includes("ACE"))
    );
  });

  // 7. Missing required Chapter 99 data
  it("Regression Test 7: rejects Entry Type 13 when required Chapter 98/99 trade remedy data is missing", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        hasChapter99Data: false, // Explicitly missing Chapter 99 data
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, false);
    assert.ok(
      res.postalComplianceDetails?.entryType13MissingPrerequisites?.some((p) => p.includes("Chapter 98/99"))
    );
  });

  // 8. Incomplete PGA data during CBP's temporary acceptance period
  it("Regression Test 8: accepts Entry Type 13 with incomplete PGA data during temporary acceptance period (91 FR 66707)", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        hasChapter99Data: true,
        isPgaDataComplete: false, // Incomplete PGA data
        isPgaTemporaryAcceptanceActive: true, // During temporary acceptance period
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "VERIFIED");
    assert.equal(res.postalEntryProcedure, "ENTRY_TYPE_13");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, true);
    // Cites CBP Document 2026-21570 (91 FR 66707, page 66707)
    assert.ok(res.postalComplianceDetails?.pgaTemporaryAcceptanceNotice?.includes("91 FR 66707"));
    assert.ok(res.postalComplianceDetails?.pgaTemporaryAcceptanceNotice?.includes("Doc. 2026-21570") || res.postalComplianceDetails?.pgaTemporaryAcceptanceNotice?.includes("Document 2026-21570"));
  });

  // 9. Incomplete PGA data after that temporary acceptance period ends
  it("Regression Test 9: rejects Entry Type 13 when PGA data is incomplete after temporary acceptance period ends", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "ENTRY_TYPE_13",
      isPostalProcedureConfirmed: true,
      entryType13Eligibility: {
        hasRightToMakeEntry: true,
        isTestParticipant: true,
        hasAceFilingCapability: true,
        hasRequiredDataElements: true,
        hasChapter99Data: true,
        isPgaDataComplete: false, // Incomplete PGA data
        isPgaTemporaryAcceptanceActive: false, // Temporary acceptance period ENDED
      },
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.entryType13PrerequisitesVerified, false);
    assert.ok(
      res.postalComplianceDetails?.entryType13MissingPrerequisites?.some((p) => p.includes("Partner Government Agency"))
    );
  });

  // 10. Unknown actual procedure
  it("Regression Test 10: returns UNRESOLVED / PARTIALLY_VERIFIED when actual postal procedure is unknown/unconfirmed", () => {
    const clock = () => new Date("2027-02-01T12:00:00Z");
    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      clock,
      importDate: "2027-02-01",
      transportationMode: "POSTAL",
      postalServiceType: "ORDINARY_MAIL",
      carrierPostalProcedure: "UNCONFIRMED",
      isPostalProcedureConfirmed: false,
      valuation: baseToteValuation,
    };

    const res = calculateLandedCost(req);
    // Crucial: Must NOT default to FORMAL_MAIL_REQUIRED without confirmed handling
    assert.notEqual(res.status, "VERIFIED");
    assert.equal(res.status, "PARTIALLY_VERIFIED");
    assert.equal(res.postalEntryProcedure, "UNRESOLVED");
    assert.equal(res.postalComplianceDetails?.procedureCertainty, "UNCONFIRMED_CARRIER_HANDLING");
    assert.ok(res.unresolvedFactors?.some((f) => f.includes("Postal entry pathway")));
  });
});
