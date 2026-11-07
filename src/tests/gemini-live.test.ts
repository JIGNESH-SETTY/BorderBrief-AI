import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeProductWithGemini } from "../lib/services/gemini-service.ts";

describe("Live Google AI Studio Integration (Opt-in)", () => {
  const shouldRunLive = process.env.RUN_LIVE_GEMINI_TEST === "true";
  const apiKey = process.env.GEMINI_API_KEY;

  it("executes real Gemini Developer API call when RUN_LIVE_GEMINI_TEST=true", async (t) => {
    if (!shouldRunLive) {
      t.skip("Skipped: Set RUN_LIVE_GEMINI_TEST=true to execute live Google AI Studio integration test.");
      return;
    }

    if (!apiKey || apiKey.trim() === "") {
      t.skip("Skipped: No GEMINI_API_KEY available in local environment.");
      return;
    }

    const start = Date.now();
    try {
      const result = await analyzeProductWithGemini({
        title: "Handcrafted Sheesham Wood Coasters",
        description: "Set of 6 square drink coasters carved from solid sheesham Indian rosewood with brass inlay motif.",
        materials: "Sheesham Wood, Brass",
        intendedUse: "Tabletop drink protection",
        userConsentGiven: true,
        forceDemoMode: false,
      });

      const elapsed = Date.now() - start;
      console.log(`[Live Gemini Test] SUCCESS in ${elapsed}ms using model: ${result.model_used}`);

      assert.equal(result.is_demo_mode, false, "Live request must NOT be in demo mode");
      assert.ok(result.product_summary.length > 0);
      assert.ok(result.identified_attributes.length > 0);
      assert.ok(result.confidence === "HIGH" || result.confidence === "MEDIUM" || result.confidence === "LOW");
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Live Gemini Test] FAILED in ${elapsed}ms: ${msg}`);
      // Re-throw to accurately report test status
      throw err;
    }
  });
});

