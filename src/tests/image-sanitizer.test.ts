import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  detectImageFormat,
  sanitizeImageBuffer,
  minimizeProductText,
  MAX_IMAGE_BYTES,
  MAX_DIMENSION,
} from "../lib/security/image-sanitizer.ts";

describe("Image Sanitizer & Trusted Sharp Pipeline", () => {
  it("correctly identifies valid JPEG magic bytes", async () => {
    const jpegBuffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    assert.equal(detectImageFormat(jpegBuffer), "image/jpeg");
  });

  it("correctly identifies valid PNG magic bytes", async () => {
    const pngBuffer = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 0.5 } },
    })
      .png()
      .toBuffer();

    assert.equal(detectImageFormat(pngBuffer), "image/png");
  });

  it("correctly identifies valid WebP magic bytes", async () => {
    const webpBuffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .webp()
      .toBuffer();

    assert.equal(detectImageFormat(webpBuffer), "image/webp");
  });

  it("rejects non-image binaries masquerading as images (e.g. polyglots/scripts)", async () => {
    const fakeBuffer = Buffer.from("<?php echo 'malicious payload'; ?>".repeat(100));
    const result = await sanitizeImageBuffer(fakeBuffer);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes("Invalid file format"));
  });

  it("rejects empty image buffers", async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await sanitizeImageBuffer(emptyBuffer);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes("empty"));
  });

  it("rejects image buffers exceeding the 4.0 MB limit", async () => {
    const hugeBuffer = Buffer.alloc(MAX_IMAGE_BYTES + 1024, 0xff);
    hugeBuffer[0] = 0xff;
    hugeBuffer[1] = 0xd8;
    hugeBuffer[2] = 0xff;
    const result = await sanitizeImageBuffer(hugeBuffer);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes("exceeds maximum allowed size"));
  });

  it("decodes and re-encodes authentic JPEG, stripping metadata", async () => {
    const originalJpeg = await sharp({
      create: { width: 120, height: 80, channels: 3, background: { r: 220, g: 80, b: 40 } },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Make: "ArtisanCamera",
            Model: "HandicraftLens",
          },
        },
      })
      .jpeg()
      .toBuffer();

    const result = await sanitizeImageBuffer(originalJpeg);
    assert.equal(result.isValid, true);
    assert.equal(result.width, 120);
    assert.equal(result.height, 80);
    assert.equal(result.mimeType, "image/jpeg");
    assert.ok(result.sanitizedBuffer);

    // Verify metadata was stripped from output buffer
    const inspectSanitized = await sharp(result.sanitizedBuffer).metadata();
    assert.equal(inspectSanitized.exif, undefined);
  });

  it("decodes authentic PNG with alpha and re-encodes to clean WebP preserving transparency", async () => {
    const transparentPng = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 0.4 } },
    })
      .png()
      .toBuffer();

    const result = await sanitizeImageBuffer(transparentPng);
    assert.equal(result.isValid, true);
    assert.equal(result.width, 100);
    assert.equal(result.height, 100);
    assert.equal(result.mimeType, "image/webp");
    assert.equal(result.hasAlpha, true);
    assert.ok(result.sanitizedBuffer);

    const inspectOutput = await sharp(result.sanitizedBuffer).metadata();
    assert.equal(inspectOutput.format, "webp");
    assert.equal(inspectOutput.hasAlpha, true);
  });

  it("decodes authentic WebP and re-encodes cleanly", async () => {
    const originalWebp = await sharp({
      create: { width: 90, height: 90, channels: 3, background: { r: 50, g: 200, b: 150 } },
    })
      .webp()
      .toBuffer();

    const result = await sanitizeImageBuffer(originalWebp);
    assert.equal(result.isValid, true);
    assert.equal(result.width, 90);
    assert.equal(result.height, 90);
    assert.equal(result.mimeType, "image/webp");
  });

  it("rejects malformed image scan data that starts with valid magic bytes", async () => {
    // Starts with JPEG magic bytes, but subsequent bytes are garbage
    const malformed = Buffer.alloc(500);
    malformed[0] = 0xff;
    malformed[1] = 0xd8;
    malformed[2] = 0xff;
    malformed[3] = 0xe0;
    malformed.write("GARBAGE_PAYLOAD_NOT_A_REAL_IMAGE", 10);

    const result = await sanitizeImageBuffer(malformed);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes("Malformed") || result.error?.includes("unreadable"));
  });
});

describe("Contextual Data Minimization & PII Scrubbing", () => {
  it("scrubs email addresses from product descriptions", () => {
    const raw = "Contact artisan directly at craftsman.kumar@example.com for bulk orders.";
    const cleaned = minimizeProductText(raw);
    assert.equal(cleaned.includes("craftsman.kumar@example.com"), false);
    assert.ok(cleaned.includes("[EMAIL_MASKED]"));
  });

  it("scrubs credit card number patterns", () => {
    const raw = "Account reference 4111-2222-3333-4444 should not be submitted.";
    const cleaned = minimizeProductText(raw);
    assert.equal(cleaned.includes("4111-2222-3333-4444"), false);
    assert.ok(cleaned.includes("[CARD_MASKED]"));
  });

  it("scrubs phone numbers with international prefix", () => {
    const raw = "Artisan workshop direct line: +91-98765-43210 for shipping status.";
    const cleaned = minimizeProductText(raw);
    assert.equal(cleaned.includes("+91-98765-43210"), false);
    assert.ok(cleaned.includes("[PHONE_MASKED]"));
  });

  it("scrubs phone numbers labeled with contact keywords", () => {
    const raw = "For wholesale inquiries, call: 9876543210 or WhatsApp: 919876543210.";
    const cleaned = minimizeProductText(raw);
    assert.ok(cleaned.includes("[PHONE_MASKED]"));
  });

  it("scrubs North American format phone numbers with area codes in parentheses", () => {
    const raw = "US representative office: (555) 123-4567 available 9am to 5pm.";
    const cleaned = minimizeProductText(raw);
    assert.equal(cleaned.includes("(555) 123-4567"), false);
    assert.ok(cleaned.includes("[PHONE_MASKED]"));
  });

  it("CRITICAL: PRESERVES legitimate commercial trade identifiers (SKUs, GTINs, barcodes, IECs)", () => {
    const tradeText =
      "Item Specifications: SKU: 12345-67890, Barcode: 8901234567, GTIN-10: 0123456789, IEC: 0588012345, Part # 9876543210, Dimensions: 1200 x 800 mm.";

    const cleaned = minimizeProductText(tradeText);

    // Assert that trade identifiers are NOT masked
    assert.ok(cleaned.includes("12345-67890"), "SKU should be preserved");
    assert.ok(cleaned.includes("8901234567"), "Barcode should be preserved");
    assert.ok(cleaned.includes("0123456789"), "GTIN should be preserved");
    assert.ok(cleaned.includes("0588012345"), "IEC reference should be preserved");
    assert.ok(cleaned.includes("9876543210"), "Part number should be preserved");
    assert.ok(cleaned.includes("1200 x 800 mm"), "Dimensions should be preserved");
    assert.equal(cleaned.includes("[PHONE_MASKED]"), false, "No false positive phone mask should be applied to trade identifiers");
  });
});
