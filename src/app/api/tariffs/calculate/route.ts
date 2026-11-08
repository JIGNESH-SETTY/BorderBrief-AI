/**
 * BorderBrief AI — Landed-Cost Calculation API Route (Sprint 4)
 * POST /api/tariffs/calculate
 *
 * Deterministic landed-cost calculation endpoint for the India -> United States export corridor.
 * Strictly adheres to:
 * - 19 U.S.C. § 1401a transaction valuation (shipping deduction only when documented)
 * - USITC 2026 HTS Revision 22 Column 1 General Rates
 * - USTR Document 2026-15181 (Section 24, Annex I & Annex II Part A)
 * - 19 C.F.R. § 24.23 (FY2027 MPF Schedule, 91 FR 48398 & § 24.23(b)(4) ECCF fee)
 * - 19 C.F.R. § 24.24 (HMF 0.125% & § 24.24(d)(3)(i) informal entry exemption)
 * - SQLite persistence & Serverless-safe Idempotency
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  calculateLandedCost,
  roundCurrency,
  validateIsoDate,
  LandedCostCalculationError,
} from "../../../../lib/tariff/landed-cost-engine.ts";
import { saveLandedCostCalculation } from "../../../../lib/db/database.ts";
import {
  getIdempotencyRecord,
  startIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from "../../../../lib/services/idempotency.ts";
import type {
  LandedCostCalculationRequest,
  LandedCostErrorResponse,
  TransportationMode,
  PostalServiceType,
  VoluntaryPostalCompliance,
  CarrierPostalProcedure,
  EntryType13TestEligibility,
  CustomsEntryType,
} from "../../../../types/export.ts";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("x-idempotency-key") || "";

  // 1. Check idempotency cache / persistence
  if (idempotencyKey) {
    const existing = await getIdempotencyRecord(idempotencyKey);
    if (existing && existing.status === "COMPLETED" && existing.responseJson) {
      try {
        const cachedResponse = JSON.parse(existing.responseJson);
        return NextResponse.json(cachedResponse, {
          headers: { "X-Idempotency-Cached": "true" },
        });
      } catch {
        // Fallback to recalculation if cached JSON is invalid
      }
    }
  }

  try {
    let json: Record<string, unknown> = {};
    try {
      json = await req.json();
    } catch {
      const errorResponse: LandedCostErrorResponse = {
        error: "The request body could not be parsed as valid JSON.",
        code: "INVALID_JSON",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 2. Validate mandatory input fields
    const productTitle = (
      (json.productTitle as string) ||
      (json.title as string) ||
      ""
    ).trim();
    if (!productTitle) {
      const errorResponse: LandedCostErrorResponse = {
        error: "Product title is required to identify the merchandise for landed cost calculation.",
        code: "MISSING_MANDATORY_FIELDS",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const hts10 = ((json.hts10 as string) || (json.suggestedHts10 as string) || "").trim();
    if (!hts10) {
      const errorResponse: LandedCostErrorResponse = {
        error: "A valid 10-digit HTS code is required to compute statutory import duties.",
        code: "MISSING_MANDATORY_FIELDS",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const quantity = Number(json.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const errorResponse: LandedCostErrorResponse = {
        error: "Quantity must be a positive number greater than 0.",
        code: "INVALID_QUANTITY",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const unitPriceUSD = Number(json.unitPriceUSD ?? json.itemPrice ?? json.price ?? 0);
    if (!Number.isFinite(unitPriceUSD) || unitPriceUSD <= 0) {
      const errorResponse: LandedCostErrorResponse = {
        error: "Unit price (USD) must be a positive number greater than 0.",
        code: "INVALID_PRICE",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const shippingCostUSD = Number(json.shippingCostUSD ?? json.shippingCost ?? 0);
    if (!Number.isFinite(shippingCostUSD) || shippingCostUSD < 0) {
      const errorResponse: LandedCostErrorResponse = {
        error: "Shipping cost (USD) cannot be negative.",
        code: "INVALID_SHIPPING_DEDUCTION",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const originCountry = ((json.originCountry as string) || "IN").toUpperCase();
    if (originCountry !== "IN") {
      const errorResponse: LandedCostErrorResponse = {
        error: `The origin country '${originCountry}' is not supported. Sprint 4 covers the India (IN) -> United States (US) corridor exclusively.`,
        code: "UNSUPPORTED_CORRIDOR",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const destinationCountry = ((json.destinationCountry as string) || "US").toUpperCase();
    if (destinationCountry !== "US") {
      const errorResponse: LandedCostErrorResponse = {
        error: `The destination country '${destinationCountry}' is not supported. Sprint 4 covers the India (IN) -> United States (US) corridor exclusively.`,
        code: "UNSUPPORTED_CORRIDOR",
        statusCode: 400,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 3. Mark idempotency in-progress if key provided
    if (idempotencyKey) {
      const started = await startIdempotentRequest(idempotencyKey, "/api/tariffs/calculate");
      if (!started) {
        return NextResponse.json(
          {
            error: "A calculation request with this idempotency key is already being processed.",
            code: "MISSING_MANDATORY_FIELDS",
            statusCode: 409,
          },
          { status: 409 }
        );
      }
    }

    const isShippingDocumented = json.isShippingDocumented !== false;
    const packingCostUSD = Number(json.packingCostUSD || 0);
    const assistsCostUSD = Number(json.assistsCostUSD || 0);
    const royaltiesCostUSD = Number(json.royaltiesCostUSD || 0);
    const insuranceCostUSD = Number(json.insuranceCostUSD || 0);

    const grossInvoicePriceUSD = roundCurrency(unitPriceUSD * quantity + shippingCostUSD);

    const rawMode = ((json.transportationMode as string) || "AIR_CARGO").toUpperCase();
    const transportationMode: TransportationMode =
      rawMode === "AIR" || rawMode === "AIR_CARGO"
        ? "AIR_CARGO"
        : rawMode === "AIR_EXPRESS" || rawMode === "EXPRESS"
        ? "AIR_EXPRESS"
        : rawMode === "OCEAN" || rawMode === "OCEAN_FCL"
        ? "OCEAN_FCL"
        : rawMode === "OCEAN_LCL"
        ? "OCEAN_LCL"
        : rawMode === "POSTAL"
        ? "POSTAL"
        : "AIR_CARGO";

    const rawPostalType = ((json.postalServiceType as string) || "").toUpperCase();
    const postalServiceType: PostalServiceType | undefined =
      rawPostalType === "ORDINARY_MAIL"
        ? "ORDINARY_MAIL"
        : rawPostalType === "INBOUND_EMS"
        ? "INBOUND_EMS"
        : rawPostalType === "UNKNOWN"
        ? "UNKNOWN"
        : undefined;

    const importDate =
      ((json.importDate as string) || (json.asOfDate as string) || "").trim() || undefined;
    const asOfDate =
      ((json.asOfDate as string) || (json.importDate as string) || "").trim() || undefined;

    // Validate client-provided date string
    if (importDate) {
      const dateCheck = validateIsoDate(importDate, "importDate");
      if (!dateCheck.isValid) {
        const errorResponse: LandedCostErrorResponse = {
          error: dateCheck.error || `Invalid import date "${importDate}". Strict YYYY-MM-DD required.`,
          code: "INVALID_VALUATION",
          statusCode: 400,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    const rawVoluntary = ((json.voluntaryPostalCompliance as string) || "").toUpperCase();
    const voluntaryPostalCompliance: VoluntaryPostalCompliance | undefined =
      rawVoluntary === "FORMAL_EARLY"
        ? "FORMAL_EARLY"
        : rawVoluntary === "FORMAL_ENTRY"
        ? "FORMAL_ENTRY"
        : rawVoluntary === "ENTRY_TYPE_13_TEST" || rawVoluntary === "ENTRY_TYPE_13"
        ? "ENTRY_TYPE_13_TEST"
        : rawVoluntary === "UNKNOWN"
        ? "UNKNOWN"
        : rawVoluntary === "NONE"
        ? "NONE"
        : undefined;

    const rawCarrierProc = ((json.carrierPostalProcedure as string) || "").toUpperCase();
    const carrierPostalProcedure: CarrierPostalProcedure | undefined =
      rawCarrierProc === "CONFIRMED_INFORMAL"
        ? "CONFIRMED_INFORMAL"
        : rawCarrierProc === "VOLUNTARY_FORMAL_EARLY"
        ? "VOLUNTARY_FORMAL_EARLY"
        : rawCarrierProc === "FORMAL_ENTRY"
        ? "FORMAL_ENTRY"
        : rawCarrierProc === "VOLUNTARY_ENTRY_TYPE_13"
        ? "VOLUNTARY_ENTRY_TYPE_13"
        : rawCarrierProc === "ENTRY_TYPE_13"
        ? "ENTRY_TYPE_13"
        : rawCarrierProc === "MANDATORY_FORMAL"
        ? "MANDATORY_FORMAL"
        : rawCarrierProc === "UNCONFIRMED"
        ? "UNCONFIRMED"
        : undefined;

    const isPostalProcedureConfirmed = Boolean(json.isPostalProcedureConfirmed);
    const isDemoMode = Boolean(json.isDemoMode || json.demoMode || json.forceDemoMode);

    let entryType13Eligibility: EntryType13TestEligibility | undefined;
    if (json.entryType13Eligibility && typeof json.entryType13Eligibility === "object") {
      const rawObj = json.entryType13Eligibility as Record<string, unknown>;
      entryType13Eligibility = {
        hasRightToMakeEntry: Boolean(rawObj.hasRightToMakeEntry),
        isTestParticipant:
          rawObj.isTestParticipant !== undefined
            ? Boolean(rawObj.isTestParticipant)
            : rawObj.isCbpTestParticipant !== undefined
            ? Boolean(rawObj.isCbpTestParticipant)
            : undefined,
        isCbpTestParticipant:
          rawObj.isCbpTestParticipant !== undefined ? Boolean(rawObj.isCbpTestParticipant) : undefined,
        hasAceFilingCapability: Boolean(rawObj.hasAceFilingCapability),
        hasRequiredDataElements: Boolean(rawObj.hasRequiredDataElements),
        hasChapter99Data:
          rawObj.hasChapter99Data !== undefined ? Boolean(rawObj.hasChapter99Data) : undefined,
        isPgaDataComplete:
          rawObj.isPgaDataComplete !== undefined ? Boolean(rawObj.isPgaDataComplete) : undefined,
        isPgaTemporaryAcceptanceActive:
          rawObj.isPgaTemporaryAcceptanceActive !== undefined
            ? Boolean(rawObj.isPgaTemporaryAcceptanceActive)
            : undefined,
        trackingNumber: (rawObj.trackingNumber as string) || undefined,
        filerCode: (rawObj.filerCode as string) || undefined,
      };
    }

    const calculationRequest: LandedCostCalculationRequest = {
      productId: (json.productId as string) || undefined,
      productTitle,
      productDescription: (json.productDescription as string) || (json.description as string) || undefined,
      quantity,
      unitPriceUSD,
      originCountry: "IN",
      destinationCountry: "US",
      importDate,
      asOfDate,
      isDemoMode,
      transportationMode,
      postalServiceType,
      voluntaryPostalCompliance,
      carrierPostalProcedure,
      isPostalProcedureConfirmed,
      entryType13Eligibility,
      hts10,
      entryType: (json.entryType as CustomsEntryType) || "AUTO_DETECT",
      isQualifyingEccfOrHub: Boolean(json.isQualifyingEccfOrHub),
      isMandatoryFormal: Boolean(json.isMandatoryFormal),
      classificationStatus: (json.classificationStatus as "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY") || "CLASSIFIED",
      isConfirmedByUser: json.isConfirmedByUser !== false,
      valuation: {
        grossInvoicePriceUSD,
        merchandisePriceUSD: roundCurrency(unitPriceUSD * quantity),
        internationalShippingDeductionUSD: shippingCostUSD,
        isShippingDocumented,
        shippingDocumentationEvidence: (json.shippingDocumentationEvidence as string) || undefined,
        insuranceDeductionUSD: insuranceCostUSD,
        isInsuranceDocumented: Boolean(json.isInsuranceDocumented),
        postalServiceType,
        importDate,
        asOfDate,
        voluntaryPostalCompliance,
        carrierPostalProcedure,
        isPostalProcedureConfirmed,
        entryType13Eligibility,
        isDemoMode,
        areRelatedParties: false,
        hasAssistsOrRoyalties: Boolean(assistsCostUSD || royaltiesCostUSD),
        statutoryAdditionsUSD: roundCurrency(assistsCostUSD + royaltiesCostUSD),
        packingCostsUSD: packingCostUSD,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: isShippingDocumented
          ? "TRANSACTION_VALUE_DOCUMENTED"
          : "TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION",
      },
    };

    // 4. Execute deterministic calculation engine
    const calculationResult = calculateLandedCost(calculationRequest);

    // 5. Persist to SQLite / Turso
    try {
      await saveLandedCostCalculation(
        calculationResult,
        calculationRequest.productId,
        (json.classificationId as string) || undefined
      );
    } catch (dbErr) {
      console.warn("[LandedCostAPI] Warning: Failed to persist calculation to database:", dbErr);
    }

    // 6. Complete idempotency record
    if (idempotencyKey) {
      await completeIdempotentRequest(idempotencyKey, calculationResult);
    }

    return NextResponse.json(calculationResult, { status: 200 });
  } catch (err) {
    if (idempotencyKey) {
      await failIdempotentRequest(idempotencyKey);
    }

    if (err instanceof LandedCostCalculationError) {
      const validCode = (
        [
          "INVALID_JSON",
          "MISSING_MANDATORY_FIELDS",
          "INVALID_QUANTITY",
          "INVALID_PRICE",
          "INVALID_VALUATION",
          "INVALID_SHIPPING_DEDUCTION",
          "UNSUPPORTED_CORRIDOR",
          "CLASSIFICATION_AMBIGUITY_UNRESOLVED",
          "CANDIDATE_SELECTION_REQUIRED",
          "DATASET_COVERAGE_UNSUPPORTED",
          "UNKNOWN_HTS_CODE",
        ].includes(err.code)
          ? err.code
          : "INVALID_VALUATION"
      ) as LandedCostErrorResponse["code"];

      const errorResponse: LandedCostErrorResponse = {
        error: err.message,
        code: validCode,
        statusCode: err.statusCode,
        details: err.details,
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }

    console.error("[LandedCostAPI] Unexpected server error:", err);
    const errorResponse: LandedCostErrorResponse = {
      error: "An unexpected error occurred during deterministic calculation.",
      code: "INVALID_VALUATION",
      statusCode: 500,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
