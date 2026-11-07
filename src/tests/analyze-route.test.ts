import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { POST } from "../app/api/products/analyze/route.ts";
import sharp from "sharp";

describe("API Route: /api/products/analyze Handler", () => {
  it("successfully analyzes valid JSON input in demo mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Handmade Hand-Printed Cotton Tote Bag",
        productDescription: "Woven shopping bag made of 100% natural cotton canvas with dual handles.",
        declaredMaterials: "100% Cotton Canvas",
        intendedUse: "Grocery shopping and personal carry",
        itemPriceUSD: 24.5,
        shippingCostUSD: 10.0,
        demoMode: true,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.is_demo_mode, true);
    assert.ok(json.product_summary.length > 0);
    assert.ok(json.identified_attributes.length > 0);
  });

  it("successfully analyzes valid multipart/form-data with genuine image", async () => {
    const testImageBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const formData = new FormData();
    formData.append("productTitle", "Indian Mulberry Silk Shawl");
    formData.append("productDescription", "Handwoven luxury silk wrap with traditional floral zari border.");
    formData.append("declaredMaterials", "100% Mulberry Silk");
    formData.append("intendedUse", "Formal wear");
    formData.append("itemPriceUSD", "75.00");
    formData.append("demoMode", "true");
    formData.append("image", new Blob([testImageBuffer], { type: "image/jpeg" }), "shawl.jpg");

    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.is_demo_mode, true);
    assert.ok(json.product_summary.includes("Mulberry Silk Shawl"));
  });

  it("rejects request missing mandatory product title (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "",
        productDescription: "A nice handicraft item",
        itemPriceUSD: 20.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_TITLE");
    assert.ok(json.error.includes("Product name is required"));
  });

  it("rejects request missing mandatory product description (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Handmade Wooden Figurine",
        productDescription: "",
        itemPriceUSD: 15.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "MISSING_DESCRIPTION");
  });

  it("rejects invalid or negative selling prices (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: "Handmade Toy",
        productDescription: "Painted wooden toy",
        itemPriceUSD: -5.0,
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "INVALID_PRICE");
  });

  it("rejects invalid/corrupt image uploads in multipart data (HTTP 400)", async () => {
    const fakeImage = Buffer.from("NOT_AN_IMAGE_FILE_DATA_CORRUPT");

    const formData = new FormData();
    formData.append("productTitle", "Ceramic Tea Mug");
    formData.append("productDescription", "Studio pottery handcrafted stoneware glazed tea mug.");
    formData.append("itemPriceUSD", "14.00");
    formData.append("demoMode", "true");
    formData.append("image", new Blob([fakeImage], { type: "image/jpeg" }), "corrupt.jpg");

    const req = new NextRequest("http://localhost:3000/api/products/analyze", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.code, "INVALID_IMAGE");
  });

  it("enforces explicit user consent when live cloud analysis is requested without consent (HTTP 400)", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-live-key";

    try {
      const req = new NextRequest("http://localhost:3000/api/products/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTitle: "Solid Brass Figurine",
          productDescription: "Lost wax cast solid brass statue.",
          itemPriceUSD: 50.0,
          demoMode: false,
          consent: false, // Consent declined
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);

      const json = await res.json();
      assert.equal(json.code, "CONSENT_REQUIRED");
      assert.ok(json.error.includes("consent is required"));
    } finally {
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });

  it("falls back cleanly to demo mode when no GEMINI_API_KEY is configured", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const req = new NextRequest("http://localhost:3000/api/products/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTitle: "Handmade Ceramic Mug",
          productDescription: "Stoneware pottery mug glazed with non-toxic minerals.",
          itemPriceUSD: 16.0,
          consent: true,
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.is_demo_mode, true);
      assert.equal(json.demo_reason, "NO_API_KEY");
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
