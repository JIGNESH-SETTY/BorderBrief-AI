/**
 * BorderBrief AI — Landed-Cost API Route Test Suite (Sprint 4)
 * Tests POST /api/tariffs/calculate
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { POST } from "../app/api/tariffs/calculate/route.ts";

describe("API Route: /api/tariffs/calculate Handler (Sprint 4)", () => {
  it("computes complete landed cost for valid product payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Handcrafted Cotton Canvas Tote Bag",
        hts10: "4202.92.15.00",
        quantity: 20,
        unitPriceUSD: 25.0,
        shippingCostUSD: 50.0,
        isShippingDocumented: true,
        transportationMode: "AIR",
        originCountry: "IN",
        destinationCountry: "US",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(json.calculationId);
    assert.equal(json.status, "VERIFIED");
    assert.equal(json.productTitle, "Handcrafted Cotton Canvas Tote Bag");

    // Customs valuation: 20 * 25 + 50 (gross = $550) - 50 freight = $500 dutiable
    assert.equal(json.dutiableCustomsValueUSD, 500.0);
    assert.equal(json.internationalShippingUSD, 50.0);

    // Duty: 6.3% ($31.50) + Sec 301 10.0% ($50.00) = $81.50
    assert.equal(json.baseCustomsDutyUSD, 31.5);
    assert.equal(json.section301DutyUSD, 50.0);
    assert.equal(json.totalCustomsDutyUSD, 81.5);

    // User fees: Air informal MPF = $2.77
    assert.equal(json.mpfBreakdown.finalMpfAmountUSD, 2.77);
    assert.equal(json.hmfBreakdown.hmfAmountUSD, 0.0);
    assert.equal(json.totalCustomsFeesUSD, 2.77);

    // DAP Allocation
    assert.equal(json.dapAllocation.sellerCollectedViaPaypalUSD, 550.0); // 500 + 50
    assert.equal(json.dapAllocation.buyerPayableUponArrivalUSD, 84.27); // 81.50 + 2.77
    assert.equal(json.dapAllocation.totalDeliveredLandedCostUSD, 634.27); // 550 + 84.27
    assert.equal(json.totalLandedCostUSD, 634.27);
  });

  it("rejects request missing mandatory product title (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hts10: "4202.92.15.00",
        quantity: 10,
        unitPriceUSD: 20.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_MANDATORY_FIELDS");
    assert.ok(json.error.includes("Product title"));
  });

  it("rejects request missing mandatory HTS code (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Test item",
        quantity: 10,
        unitPriceUSD: 20.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_MANDATORY_FIELDS");
    assert.ok(json.error.includes("HTS code"));
  });

  it("rejects invalid negative prices or quantities (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Test item",
        hts10: "4202.92.15.00",
        quantity: -2,
        unitPriceUSD: 20.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "INVALID_QUANTITY");
  });

  it("rejects unsupported trade corridor (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Test item",
        hts10: "4202.92.15.00",
        quantity: 1,
        unitPriceUSD: 20.0,
        originCountry: "DE", // Germany
        destinationCountry: "US",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "UNSUPPORTED_CORRIDOR");
  });

  it("strictly returns HTTP 422 when classification status is UNRESOLVED_AMBIGUITY", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Hand-Carved Sheesham Wood Coasters Set",
        hts10: "4419.20.90.00",
        quantity: 5,
        unitPriceUSD: 15.0,
        shippingCostUSD: 10.0,
        classificationStatus: "UNRESOLVED_AMBIGUITY", // Coaster ambiguous status
        originCountry: "IN",
        destinationCountry: "US",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 422);

    const json = await res.json();
    assert.equal(json.code, "CLASSIFICATION_AMBIGUITY_UNRESOLVED");
    assert.ok(json.error.includes("ambiguity for \"Hand-Carved Sheesham Wood Coasters Set\" is unresolved"));
  });

  it("returns HTTP 422 when HTS code is unsupported by curated store", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Uncataloged item",
        hts10: "9999.99.99.99",
        quantity: 1,
        unitPriceUSD: 50.0,
        originCountry: "IN",
        destinationCountry: "US",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 422);

    const json = await res.json();
    assert.equal(json.code, "DATASET_COVERAGE_UNSUPPORTED");
  });

  it("handles request deduplication via x-idempotency-key header", async () => {
    const testKey = `route-test-key-${Date.now()}`;
    const payload = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      shippingCostUSD: 30.0,
      isShippingDocumented: true,
      originCountry: "IN",
      destinationCountry: "US",
    };

    const req1 = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": testKey,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    assert.equal(res1.status, 200);
    const json1 = await res1.json();

    // Second call with same key must return cached result
    const req2 = new NextRequest("http://localhost:3000/api/tariffs/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": testKey,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get("X-Idempotency-Cached"), "true");
    const json2 = await res2.json();
    assert.equal(json2.calculationId, json1.calculationId);
  });
});

