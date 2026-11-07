import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEED_EXPORT_PROFILES } from "../data/seed-products.ts";

function validateProductFormInput(data: {
  title?: string;
  description?: string;
  itemPriceUSD?: number | string;
  shippingCostUSD?: number | string;
}): { isValid: boolean; error?: string } {
  if (!data.title || data.title.trim().length === 0) {
    return { isValid: false, error: "Product name is required." };
  }
  if (!data.description || data.description.trim().length === 0) {
    return { isValid: false, error: "Product description is required." };
  }
  const price = typeof data.itemPriceUSD === "number" ? data.itemPriceUSD : parseFloat(data.itemPriceUSD || "");
  if (isNaN(price) || price < 0) {
    return { isValid: false, error: "Selling price must be a valid non-negative number." };
  }
  if (data.shippingCostUSD !== undefined && data.shippingCostUSD !== "") {
    const shipping = typeof data.shippingCostUSD === "number" ? data.shippingCostUSD : parseFloat(data.shippingCostUSD);
    if (isNaN(shipping) || shipping < 0) {
      return { isValid: false, error: "Shipping cost, if provided, must be non-negative." };
    }
  }
  return { isValid: true };
}

describe("Product Intake Form Validation", () => {
  it("rejects empty product title", () => {
    const res = validateProductFormInput({
      title: "",
      description: "Valid description",
      itemPriceUSD: 25.0,
    });
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /Product name is required/i);
  });

  it("rejects empty product description", () => {
    const res = validateProductFormInput({
      title: "Handmade Bag",
      description: "   ",
      itemPriceUSD: 25.0,
    });
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /Product description is required/i);
  });

  it("rejects negative selling prices", () => {
    const res = validateProductFormInput({
      title: "Handmade Bag",
      description: "Valid description",
      itemPriceUSD: -15.5,
    });
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /non-negative/i);
  });

  it("rejects negative shipping costs", () => {
    const res = validateProductFormInput({
      title: "Handmade Bag",
      description: "Valid description",
      itemPriceUSD: 25.0,
      shippingCostUSD: -5.0,
    });
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /Shipping cost.*non-negative/i);
  });

  it("accepts valid inputs with zero or positive numbers", () => {
    const res = validateProductFormInput({
      title: "Hand-Carved Wooden Coaster",
      description: "Set of 6 Sheesham wood coasters.",
      itemPriceUSD: 22.0,
      shippingCostUSD: 0,
    });
    assert.equal(res.isValid, true);
  });

  it("verifies the integrity of all 7 authentic Indian seed profiles", () => {
    assert.equal(SEED_EXPORT_PROFILES.length, 7);

    for (const profile of SEED_EXPORT_PROFILES) {
      assert.ok(profile.id.startsWith("prod-"));
      assert.ok(profile.title.length > 5);
      assert.ok(profile.description.length > 20);
      assert.ok(profile.itemPriceUSD > 0);
      assert.ok(profile.shippingCostUSD >= 0);
      assert.ok(profile.suggestedHS6.length === 6 || profile.suggestedHS6.length === 7);
      assert.ok(profile.candidateHTS10.length >= 10);
      assert.ok(profile.wcoGriRationale.includes("GRI"));
      assert.equal(profile.mockAnalysis.is_demo_mode, true);
    }
  });
});

