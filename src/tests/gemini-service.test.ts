import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDemoAnalysis,
  analyzeProductWithGemini,
  GeminiApiError,
  MIN_DEMO_MATCH_THRESHOLD,
} from "../lib/services/gemini-service.ts";

describe("Cloud AI Service & Grounded Fallback Integrity", () => {
  it("generates a structured demo analysis when API key is not configured", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await analyzeProductWithGemini({
        title: "Handmade Cotton Bag",
        description: "Woven tote bag for grocery shopping made of natural cotton.",
        materials: "100% Cotton Canvas",
        intendedUse: "Shopping and personal carry",
        userConsentGiven: true,
      });

      assert.equal(result.is_demo_mode, true);
      assert.equal(result.model_used, "demo-grounded-analyzer");
      assert.ok(result.product_summary.length > 0);
      assert.ok(result.identified_attributes.length > 0);
      assert.ok(result.clarifying_questions.length > 0);

      // Verify boundary warning exists
      const hasBoundaryWarning = result.analysis_warnings.some((w) =>
        w.includes("Not an authoritative customs ruling") || w.includes("PRE-CALIBRATED DEMO BASELINE")
      );
      assert.equal(hasBoundaryWarning, true);
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("handles explicit user opt-out to demo mode (forceDemoMode)", async () => {
    const result = await analyzeProductWithGemini({
      title: "Handmade Mulberry Silk Scarf",
      description: "100% pure mulberry silk handwoven luxury shawl.",
      materials: "100% Silk",
      intendedUse: "Fashion accessory",
      forceDemoMode: true,
      userConsentGiven: false, // User declined cloud AI
    });

    assert.equal(result.is_demo_mode, true);
    assert.equal(result.demo_reason, "USER_OPTED_OUT_OF_CLOUD");
    assert.ok(result.analysis_warnings.some((w) => w.includes("Cloud AI processing was declined")));
  });

  it("CRITICAL: Unrelated products do NOT default to cotton tote profile (enforces threshold)", () => {
    // Completely unrelated product not in the 7 artisan profiles
    const analysis = getDemoAnalysis({
      title: "Stainless Steel Kitchen Knife",
      description: "Serrated chef cutting blade with ergonomic polymer handle.",
      materials: "Stainless Steel, Polymer",
      intendedUse: "Culinary food preparation",
    });

    // Should return unclassified generic fallback, NOT the cotton bag!
    assert.equal(analysis.is_demo_mode, true);
    assert.equal(analysis.model_used, "demo-unclassified-fallback");
    assert.equal(analysis.confidence, "LOW");
    assert.equal(analysis.inferred_attributes.profile_match, "NONE_BELOW_RELEVANCE_THRESHOLD");

    // Must NOT contain bag-specific questions or attributes
    const hasBagQuestion = analysis.clarifying_questions.some((q) =>
      q.question.toLowerCase().includes("waterproof lining") || q.question.toLowerCase().includes("bag")
    );
    assert.equal(hasBagQuestion, false, "Should not ask bag questions for a kitchen knife");
  });

  it("matching products receive pre-calibrated profile baseline with honest labels", () => {
    const analysis = getDemoAnalysis({
      title: "Handloom Cotton Tote Bag",
      description: "Eco-friendly natural woven cotton canvas carry tote.",
      materials: "100% Cotton Canvas",
      intendedUse: "Shopping carry",
    });

    assert.equal(analysis.is_demo_mode, true);
    assert.equal(analysis.model_used, "demo-grounded-analyzer");

    // Inferred attributes must be labeled PRE_CALIBRATED_BASELINE in demo mode (not AI Inferred)
    const baselineAttrs = analysis.identified_attributes.filter(
      (a) => a.source === "PRE_CALIBRATED_BASELINE"
    );
    assert.ok(baselineAttrs.length > 0, "Should use PRE_CALIBRATED_BASELINE source label");
  });

  it("throws explicit GeminiApiError when consent is missing for live cloud AI", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "dummy-active-key-for-test";

    try {
      await assert.rejects(
        async () => {
          await analyzeProductWithGemini({
            title: "Test Item",
            description: "Test Description",
            userConsentGiven: false, // Consent missing
            forceDemoMode: false,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof GeminiApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, "CONSENT_REQUIRED");
          return true;
        }
      );
    } finally {
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});
