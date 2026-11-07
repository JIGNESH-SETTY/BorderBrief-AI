/**
 * BorderBrief AI — Server-Side Image Sanitization & Privacy Shield (Sprint 2 Remediation)
 *
 * Implements strict security controls using trusted open-source image engine (Sharp):
 * 1. Decodes image buffer to uncompressed pixel representation.
 * 2. Enforces file size and decoded pixel-dimension limits (max 4.0 MB, max 4096x4096px).
 * 3. Protects against decompression bombs (limits input pixels to 16 megapixels).
 * 4. Auto-orients image based on EXIF before metadata removal.
 * 5. Re-encodes into fresh, clean output buffer (JPEG or WebP), stripping ALL metadata.
 * 6. Preserves transparency when alpha channel is present (re-encoding to clean WebP).
 * 7. Contextual PII scrubbing protecting legitimate commercial identifiers (SKUs, GTINs, IECs).
 */

import sharp from "sharp";

export interface ImageSanitizationResult {
  isValid: boolean;
  sanitizedBuffer?: Buffer;
  mimeType?: "image/jpeg" | "image/webp";
  width?: number;
  height?: number;
  error?: string;
  originalBytes?: number;
  sanitizedBytes?: number;
  hasAlpha?: boolean;
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4.0 MB
export const MAX_DIMENSION = 4096; // 4096 px width/height max to prevent decompression bombs

/**
 * Validates file magic bytes against supported image formats.
 */
export function detectImageFormat(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Decodes, validates, auto-orients, strips metadata, and re-encodes an image buffer.
 * Rejects malformed images, unsupported formats, and decompression bombs.
 */
export async function sanitizeImageBuffer(rawBuffer: Buffer): Promise<ImageSanitizationResult> {
  if (!rawBuffer || rawBuffer.length === 0) {
    return { isValid: false, error: "Image file is empty." };
  }

  if (rawBuffer.length > MAX_IMAGE_BYTES) {
    return {
      isValid: false,
      error: `Image exceeds maximum allowed size of 4.0 MB (received ${(rawBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Quick magic bytes check
  const magicFormat = detectImageFormat(rawBuffer);
  if (!magicFormat) {
    return {
      isValid: false,
      error: "Invalid file format. Only authentic JPEG, PNG, and WebP images are permitted.",
    };
  }

  try {
    // 1. Initialize sharp with strict decompression bomb pixel limit
    const image = sharp(rawBuffer, {
      failOn: "error",
      limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
    });

    // 2. Decode and inspect actual image metadata
    const metadata = await image.metadata();

    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      return {
        isValid: false,
        error: `Unsupported image format (${metadata.format || "unknown"}). Only authentic JPEG, PNG, and WebP images are permitted.`,
      };
    }

    if (!metadata.width || !metadata.height) {
      return {
        isValid: false,
        error: "Unable to determine decoded image dimensions.",
      };
    }

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return {
        isValid: false,
        error: `Decoded image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed limit of ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`,
      };
    }

    // 3. Auto-orient based on EXIF before stripping metadata
    image.rotate();

    // 4. Re-encode into clean output, stripping all EXIF, XMP, IPTC, ICC, and comments
    // (Sharp strips all metadata by default unless .withMetadata() is explicitly called)
    let sanitizedBuffer: Buffer;
    let outputMimeType: "image/jpeg" | "image/webp";

    if (metadata.hasAlpha || metadata.format === "png" || metadata.format === "webp") {
      outputMimeType = "image/webp";
      sanitizedBuffer = await image
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
    } else {
      outputMimeType = "image/jpeg";
      sanitizedBuffer = await image
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }

    return {
      isValid: true,
      sanitizedBuffer,
      mimeType: outputMimeType,
      width: metadata.width,
      height: metadata.height,
      originalBytes: rawBuffer.length,
      sanitizedBytes: sanitizedBuffer.length,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Input image exceeds pixel limit") || message.includes("VipsForeignLoad")) {
      return {
        isValid: false,
        error: "Image exceeds maximum decompression pixel limits or is malformed.",
      };
    }
    return {
      isValid: false,
      error: `Malformed or unreadable image: ${message}`,
    };
  }
}

/**
 * Contextual PII scrubber for export product descriptions.
 * Scrubs emails, credit card numbers, and telephone numbers with contact context
 * while strictly PRESERVING commercial trade identifiers (SKUs, GTINs, barcodes, IECs, part numbers).
 */
export function minimizeProductText(input: string): string {
  if (!input) return "";

  let result = input;

  // 1. Mask email addresses
  result = result.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[EMAIL_MASKED]");

  // 2. Mask 16-digit credit card patterns (4 groups of 4 digits, separated by hyphens or spaces)
  result = result.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[CARD_MASKED]");

  // 3. Contextual Phone Number Scrubbing:
  // Match explicit contact prefixes (phone, tel, mobile, cell, call, whatsapp, contact, ph) followed by numbers
  result = result.replace(
    /\b(?:phone|tel|mobile|mob|cell|call|whatsapp|contact|ph)[\s.:#-]+(?:\+?\d{1,3}[-.\s]*)?(?:\(?\d{2,5}\)?[-.\s]*)?\d{3,5}[-.\s]*\d{3,5}\b/gi,
    "[PHONE_MASKED]"
  );

  // Match international phone numbers with explicit '+' country code (e.g. +91-98765-43210, +1 555-123-4567)
  result = result.replace(
    /\+\d{1,3}[-.\s]?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}\b/g,
    "[PHONE_MASKED]"
  );

  // Match US format phone numbers with area codes in parentheses (e.g. (555) 123-4567)
  result = result.replace(
    /\(\d{3}\)[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[PHONE_MASKED]"
  );

  return result.trim();
}
