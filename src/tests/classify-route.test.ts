import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { POST } from "../app/api/tariffs/classify/route.ts";

describe("API Route: /api/tariffs/classify Handler (Sprint 3)", () => {
  it("successfully classifies valid JSON product input in demo mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Handcrafted Cotton Canvas Tote Bag",
        description: "Heavy woven 100% cotton canvas tote bag with reinforced handles for daily shopping.",
        materials: "100% natural cotton canvas",
        intendedUse: "Reusable shopping bag",
        forceDemoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(json.id);
    assert.equal(json.primaryCandidate?.hts10, "4202.92.15.00");
    assert.equal(json.primaryCandidate?.generalDutyRate, 6.3);
    assert.ok(json.statutoryRevision.includes("2026 HTS Revision 22"));
    assert.ok(json.disclaimer.includes("19 U.S.C. § 1484"));
    assert.equal(json.isConfirmedByUser, false);
  });

  it("provides contrasting alternative candidates with duty rates", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Glazed Stoneware Coffee Mug",
        description: "Hand-thrown ceramic tableware stoneware mug.",
        materials: "Glazed stoneware clay",
        intendedUse: "Drinkware",
        forceDemoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.primaryCandidate?.hts10, "6912.00.44.00");
    assert.equal(json.primaryCandidate?.generalDutyRate, 10.0);
    assert.ok(json.alternativeCandidates.length > 0);
    const altCodes = json.alternativeCandidates.map((c: { hts10: string }) => c.hts10);
    assert.ok(altCodes.includes("6912.00.48.10")); // Other tableware alternative (9.8%)
    assert.ok(altCodes.includes("6911.10.45.00")); // Porcelain mug alternative (14.0%)
  });

  it("rejects requests missing product title with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Only description provided without title.",
        materials: "Cotton",
        forceDemoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_TITLE");
    assert.ok(json.error.includes("title is required"));
  });

  it("rejects requests missing product description with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Brass Decorative Bell",
        forceDemoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_DESCRIPTION");
    assert.ok(json.error.includes("description is required"));
  });

  it("rejects malformed JSON payloads with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-a-valid-json{",
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "INVALID_JSON");
  });

  it("supports request deduplication via idempotency key", async () => {
    const idempotencyKey = `test-idem-class-${Date.now()}`;
    const payload = JSON.stringify({
      title: "Handmade Silver Filigree Earrings",
      description: "Sterling silver handcrafted traditional filigree earrings.",
      materials: "925 Sterling Silver",
      forceDemoMode: true,
    });

    const req1 = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: payload,
    });

    const res1 = await POST(req1);
    assert.equal(res1.status, 200);
    const json1 = await res1.json();

    // Second request with same idempotency key
    const req2 = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: payload,
    });

    const res2 = await POST(req2);
    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get("X-Idempotency-Cached"), "true");
    const json2 = await res2.json();
    assert.equal(json2.id, json1.id);
    assert.equal(json2.primaryCandidate?.hts10, json1.primaryCandidate?.hts10);
  });

  it("returns UNRESOLVED_AMBIGUITY with null primary candidate when product description is vague", async () => {
    const req = new NextRequest("http://localhost:3000/api/tariffs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Artisan Gift",
        description: "Small decorative piece.",
        materials: "",
        forceDemoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, "UNRESOLVED_AMBIGUITY");
    assert.equal(json.primaryCandidate, null);
    assert.ok(json.clarifyingQuestions && json.clarifyingQuestions.length > 0);
  });
});
