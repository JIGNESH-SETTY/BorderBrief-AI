import { NextRequest, NextResponse } from "next/server.js";
import { sanitizeImageBuffer } from "../../../../lib/security/image-sanitizer.ts";
import { analyzeProductWithGemini, GeminiApiError } from "../../../../lib/services/gemini-service.ts";
import {
  getIdempotencyRecord,
  startIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from "../../../../lib/services/idempotency.ts";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("x-idempotency-key") || "";

  // 1. Check idempotency cache (local single-process deduplication)
  if (idempotencyKey) {
    const existing = getIdempotencyRecord(idempotencyKey);
    if (existing && existing.status === "COMPLETED" && existing.responseJson) {
      try {
        const cachedResponse = JSON.parse(existing.responseJson);
        return NextResponse.json(cachedResponse, {
          headers: { "X-Idempotency-Cached": "true" },
        });
      } catch {
        // Fallback to recalculation if cached JSON parse fails
      }
    }
  }

  try {
    let title = "";
    let description = "";
    let materials = "";
    let intendedUse = "";
    let itemPrice = 0;
    let forceDemoMode = false;
    let userConsentGiven = false;
    let imageBuffer: Buffer | undefined;
    let imageMimeType: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      title = (formData.get("productTitle") as string) || (formData.get("title") as string) || "";
      description = (formData.get("productDescription") as string) || (formData.get("description") as string) || "";
      materials = (formData.get("declaredMaterials") as string) || (formData.get("materials") as string) || "";
      intendedUse = (formData.get("intendedUse") as string) || "";
      const priceVal = formData.get("itemPriceUSD") || formData.get("itemPrice");
      itemPrice = priceVal ? parseFloat(priceVal as string) : 0;

      const demoVal = formData.get("demoMode") || formData.get("forceDemoMode");
      forceDemoMode = demoVal === "true" || demoVal === "1";

      const consentVal = formData.get("consent") || formData.get("userConsentGiven");
      userConsentGiven = consentVal === "true" || consentVal === "1";

      const file = formData.get("image") as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const rawBuffer = Buffer.from(arrayBuffer);

        const sanitization = await sanitizeImageBuffer(rawBuffer);
        if (!sanitization.isValid) {
          return NextResponse.json(
            {
              error: sanitization.error || "Invalid image upload.",
              code: "INVALID_IMAGE",
            },
            { status: 400 }
          );
        }

        imageBuffer = sanitization.sanitizedBuffer;
        imageMimeType = sanitization.mimeType;
      }
    } else {
      let json: Record<string, unknown> = {};
      try {
        json = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON request body.", code: "INVALID_JSON" },
          { status: 400 }
        );
      }

      title = (json.productTitle as string) || (json.title as string) || "";
      description = (json.productDescription as string) || (json.description as string) || "";
      materials = (json.declaredMaterials as string) || (json.materials as string) || "";
      intendedUse = (json.intendedUse as string) || "";
      const rawPrice = json.itemPriceUSD !== undefined ? json.itemPriceUSD : json.itemPrice;
      itemPrice = rawPrice !== undefined ? (typeof rawPrice === "number" ? rawPrice : parseFloat((rawPrice as string) || "0")) : 0;
      forceDemoMode = Boolean(json.demoMode || json.forceDemoMode);
      userConsentGiven = Boolean(json.consent || json.userConsentGiven);
    }

    // 2. Validate mandatory product intake fields
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Product name is required.", code: "MISSING_TITLE" },
        { status: 400 }
      );
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Product description is required.", code: "MISSING_DESCRIPTION" },
        { status: 400 }
      );
    }

    if (isNaN(itemPrice) || itemPrice < 0) {
      return NextResponse.json(
        { error: "Selling price must be a valid non-negative number.", code: "INVALID_PRICE" },
        { status: 400 }
      );
    }

    if (idempotencyKey) {
      startIdempotentRequest(idempotencyKey, "/api/products/analyze");
    }

    // 3. Dispatch to Gemini Analysis (or pre-calibrated demo baseline)
    const analysis = await analyzeProductWithGemini({
      title: title.trim(),
      description: description.trim(),
      materials: materials.trim(),
      intendedUse: intendedUse.trim(),
      imageBuffer,
      imageMimeType,
      forceDemoMode,
      userConsentGiven,
    });

    // 4. Save to idempotency store
    if (idempotencyKey) {
      completeIdempotentRequest(idempotencyKey, analysis);
    }

    return NextResponse.json(analysis, { status: 200 });
  } catch (err: unknown) {
    if (idempotencyKey) {
      failIdempotentRequest(idempotencyKey);
    }

    if (err instanceof GeminiApiError) {
      return NextResponse.json(
        { error: err.message, code: err.errorCode },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Internal server error during product analysis.";
    return NextResponse.json(
      { error: message, code: "ANALYSIS_FAILED" },
      { status: 500 }
    );
  }
}
