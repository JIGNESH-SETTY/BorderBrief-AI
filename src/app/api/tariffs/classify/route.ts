import { NextRequest, NextResponse } from "next/server.js";
import { classifyProduct } from "../../../../lib/tariff/classification-engine.ts";
import { GeminiApiError } from "../../../../lib/services/gemini-service.ts";
import {
  getIdempotencyRecord,
  startIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
} from "../../../../lib/services/idempotency.ts";
import type { ClassificationRequestInput } from "../../../../types/export.ts";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("x-idempotency-key") || "";

  // 1. Check idempotency cache (single-process deduplication)
  if (idempotencyKey) {
    const existing = getIdempotencyRecord(idempotencyKey);
    if (existing && existing.status === "COMPLETED" && existing.responseJson) {
      try {
        const cachedResponse = JSON.parse(existing.responseJson);
        return NextResponse.json(cachedResponse, {
          headers: { "X-Idempotency-Cached": "true" },
        });
      } catch {
        // Fallback to fresh classification if cached JSON parse fails
      }
    }
  }

  try {
    let json: Record<string, unknown> = {};
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const title = ((json.productTitle as string) || (json.title as string) || "").trim();
    const description = ((json.productDescription as string) || (json.description as string) || "").trim();
    const materials = ((json.declaredMaterials as string) || (json.materials as string) || "").trim();
    const intendedUse = ((json.intendedUse as string) || "").trim();
    const clarificationAnswers = (json.clarificationAnswers as Record<string, string>) || {};
    const forceDemoMode = Boolean(json.demoMode || json.forceDemoMode);
    const userConsentGiven = Boolean(json.consent || json.userConsentGiven);

    // 2. Validate mandatory fields
    if (!title || title.length === 0) {
      return NextResponse.json(
        { error: "Product title is required for classification.", code: "MISSING_TITLE" },
        { status: 400 }
      );
    }

    if (!description || description.length === 0) {
      return NextResponse.json(
        { error: "Product description is required for classification.", code: "MISSING_DESCRIPTION" },
        { status: 400 }
      );
    }

    if (idempotencyKey) {
      startIdempotentRequest(idempotencyKey, "/api/tariffs/classify");
    }

    const classificationInput: ClassificationRequestInput = {
      title,
      description,
      materials,
      intendedUse,
      clarificationAnswers,
      forceDemoMode,
      userConsentGiven,
    };

    // 3. Dispatch to classification engine
    const result = await classifyProduct(classificationInput);

    // 4. Save to idempotency store
    if (idempotencyKey) {
      completeIdempotentRequest(idempotencyKey, result);
    }

    return NextResponse.json(result, { status: 200 });
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

    const message = err instanceof Error ? err.message : "Internal server error during tariff classification.";
    return NextResponse.json(
      { error: message, code: "CLASSIFICATION_FAILED" },
      { status: 500 }
    );
  }
}

