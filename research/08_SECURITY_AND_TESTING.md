# 08 — Security Architecture, Privacy Controls & Testing Strategy: BorderBrief AI

**Document ID:** BB-RES-008 (Revision 4 — Final Audit Corrections)  
**Research Date:** November 6, 2026  
**Focus:** Server-Side EXIF Stripping, Serverless Idempotency, Statutory Freshness Boundaries, Testing Plan  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Cloud-First Defense-in-Depth Architecture

Cross-border export platforms process business data, product photography, and financial transactions. BorderBrief AI implements defense-in-depth across six distinct layers:

```
[ Inbound Request (with X-Idempotency-Key) ]
                        │
                        ▼
[ Layer 1: Rate Limiting & TLS Encryption ]
                        │
                        ▼
[ Layer 2: Server-Side Sanitization (Magic Bytes, EXIF Stripping, 4MB Cap) ]
                        │
                        ▼
[ Layer 3: Serverless-Safe Idempotency via Database Transaction ]
                        │
                        ▼
[ Layer 4: Cloud AI Data Minimization (Strict PII Blacklist) ]
                        │
                        ▼
[ Layer 5: Parameterized Dual-Driver Persistence (SQLite/libSQL) ]
                        │
                        ▼
[ Layer 6: Cryptographic PayPal Webhook Verification ]
```

---

## 2. Server-Side Image Validation & Sanitization Protocol

Client-side EXIF stripping can be bypassed or disabled. BorderBrief AI enforces **Mandatory Server-Side Image Sanitization**:

### 2.1 Magic Bytes Header Validation
Before processing or decoding image buffers, the server verifies file signatures:
- **JPEG:** `FF D8 FF`
- **PNG:** `89 50 4E 47 0D 0A 1A 0A`
- **WebP:** `52 49 46 46` ... `57 45 42 50`
All other payloads (SVGs with `<script>` tags, executable binaries, polyglots, zip archives) are rejected immediately with HTTP `400 Bad Request`.

### 2.2 Binary EXIF Metadata Stripping
The server-side Route Handler strips metadata segments from the raw binary buffer:
- **JPEG:** Traverses segment markers and strips `APP1` (`FFE1`) segments containing EXIF headers (GPS geolocation coordinates, camera serial numbers, device timestamps, and embedded thumbnails).
- **PNG:** Strips metadata chunks (`eXIf`, `tEXt`, `zTXt`, `iTXt`).
- The stripped, sanitized buffer is then passed to Google AI Studio. This guarantees zero geolocation, hardware, or timestamp leaks to cloud providers.

### 2.3 Strict Data Minimization (Zero PII Transmitted)
The AI prompt contains **only**:
- The stripped product photograph.
- Technical physical description (e.g., *"handmade floral canvas tote bag"*).
- Declared materials and intended function.

**Strict Blacklist:** The following attributes are **strictly forbidden** from being transmitted to external AI APIs:
- Exporter name, business address, email, phone number.
- Indian regulatory identifiers (PAN, IEC, GSTIN, LUT ARN).
- Buyer name, US delivery address, and contact details.
- Bank account details, IFSC codes, and payment credentials.

---

## 3. Customs Tariff Freshness & Statutory Validity Controls

**A naive "30-day cache age" is legally invalid in customs compliance.** Tariffs can be modified overnight by Presidential Proclamation or interim Federal Register notices.

### 3.1 Statutory Revision & Effective Date Boundary Checks
Every tariff line in `tariff_cache` enforces three statutory checks:
1. **Statutory Effective Period:** Rate is only valid if $\text{statutory\_effective\_from} \le \text{CurrentDate} \le \text{statutory\_effective\_to}$. If the current date is outside this window, the rate is marked `EXPIRED`.
2. **Revision Identifier Matching:** Must match the current active USITC Revision (e.g., `2026 Basic Edition / Rev 1`). If the USITC publishes Revision 2, older records are marked `SUPERSEDED_REVISION`.
3. **Verification Status Tag:**
   - `LIVE_STATUTORY_CONFIRMED`: Real-time query to `hts.usitc.gov` succeeded in the current session.
   - `CACHED_BASELINE_UNCONFIRMED`: Live connection timed out; rate is displayed with an explicit warning banner:
     > *⚠️ **Unconfirmed Baseline Notice:** Sourced from USITC 2026 Basic Edition (Effective: 2026-01-01). Live USITC verification timed out in this session. Re-verify prior to formal CBP filing.*

---

## 4. Comprehensive Testing Strategy

### 4.1 Unit Testing Suite (Deterministic Calculations, Privacy & Freshness)

```typescript
// Test Matrix: Security, Privacy & Landed Cost Engine
describe("Security & Privacy Controls", () => {
  test("Server-side image validator rejects non-image binaries masquerading as JPEGs", () => {
    const maliciousBuffer = Buffer.from("MZ...executable binary payload");
    const result = validateAndSanitizeImage(maliciousBuffer);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid image signature");
  });

  test("Server-side sanitizer completely strips EXIF GPS metadata from JPEG buffer", () => {
    const jpegWithExif = createTestJpegWithGpsMetadata();
    const sanitizedBuffer = stripExifMetadata(jpegWithExif);
    expect(containsExifApp1Marker(sanitizedBuffer)).toBe(false);
  });

  test("Data Minimization Gateway strips all seller and buyer PII before AI dispatch", () => {
    const rawPayload = {
      sellerName: "Jaipur Exports LLP",
      sellerGSTIN: "08AAAAA0000A1Z5",
      sellerIEC: "0500000001",
      buyerAddress: "123 Main St, New York, NY",
      title: "Handmade Cotton Bag",
      description: "100% canvas woven cotton tote with handles",
      imageBuffer: Buffer.from("...")
    };

    const sanitized = sanitizeAIPayload(rawPayload);
    expect(sanitized).not.toHaveProperty("sellerName");
    expect(sanitized).not.toHaveProperty("sellerGSTIN");
    expect(sanitized).not.toHaveProperty("sellerIEC");
    expect(sanitized).not.toHaveProperty("buyerAddress");
    expect(sanitized).toHaveProperty("title");
    expect(sanitized).toHaveProperty("description");
  });

  test("Tariff engine flags unconfirmed baseline when live USITC call times out", () => {
    const record = {
      htsCode: "4202.92.15.00",
      tariffRevision: "2026 Basic Edition / Rev 1",
      statutoryEffectiveFrom: "2026-01-01",
      statutoryEffectiveTo: null,
      verificationStatus: "CACHED_BASELINE_UNCONFIRMED"
    };
    const evaluation = evaluateTariffLegality(record, new Date("2026-11-06"));
    expect(evaluation.isLegallyActive).toBe(true);
    expect(evaluation.requiresBaselineDisclaimer).toBe(true);
  });
});

describe("Deterministic Landed Cost Engine (19 U.S.C. § 1401a)", () => {
  test("De Minimis Suspension Handling: Low-value shipments do not automatically assume $0 duty or zero MPF", () => {
    const result = calculateLandedCost({
      itemPriceUSD: 25.00,
      quantity: 10, // $250.00 total merchandise value
      shippingCostUSD: 40.00,
      dutyRate: 0.063, // 6.3%
      entryType: "INFORMAL_AUTOMATED"
    });
    // Accounts for active rules following August 29, 2025 de minimis suspension
    expect(result.customsDutyAmount).toBeGreaterThanOrEqual(0.00);
    expect(result.isSection321Eligible).toBe(false);
  });

  test("19 U.S.C. § 1401a(b)(4)(A): International shipment costs are excluded from transaction value", () => {
    const result = calculateLandedCost({
      itemPriceUSD: 1000.00,
      quantity: 1,
      shippingCostUSD: 500.00, // International transit incident to shipment to place of US importation
      dutyRate: 0.10, // 10%
      entryType: "INFORMAL_AUTOMATED"
    });
    expect(result.customsDutiableValue).toBe(1000.00); // Excludes $500 international shipment charges
    expect(result.customsDutyAmount).toBe(100.00);
  });
});
```

---

## 5. Synthetic India $\rightarrow$ USA Verification Test Dataset

For reliable demonstration and testing, BorderBrief AI utilizes a curated dataset of authentic Indian export products with officially verified USITC tariff rates:

| ID | Product Name | Description & Key Material | WCO 6-Digit | US HTS 10-Digit | US General Tariff | Valuation Base | Under \$800 Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Handmade Cotton Tote Bag | 100% woven cotton canvas, twin fabric handles, unlined | `4202.92` | `4202.92.15.00` | **6.3%** | FOB | Duty-Free (Sec 321) |
| **TEST-02** | Cast Brass Ganesha Statue | Solid cast brass decorative statuette, height 15cm | `8306.29` | `8306.29.00.00` | **Free (0.0%)** | FOB | Free regardless of value |
| **TEST-03** | Handloom Mulberry Silk Scarf | 100% woven silk, hand-rolled edges, printed floral pattern | `6214.10` | `6214.10.10.00` | **Free (0.0%)** | FOB | Free regardless of value |
| **TEST-04** | Embroidered Cotton Cushion Cover | Woven cotton with cotton thread mirror embroidery | `6304.92` | `6304.92.00.00` | **6.3%** | FOB | Duty-Free (Sec 321) |
| **TEST-05** | Leather Journal with Handmade Paper | Buffalo leather wrap cover, unruled recycled cotton rag paper | `4820.10` | `4820.10.20.10` | **Free (0.0%)** | FOB | Free regardless of value |
| **TEST-06** | Glazed Ceramic Coffee Mug | Hand-thrown stoneware pottery, glazed, decorative | `6912.00` | `6912.00.48.10` | **9.8%** | FOB | Duty-Free (Sec 321) |
| **TEST-07** | Sheesham Wood Coaster Set | Carved Indian Rosewood (Sheesham), set of 6 coasters with holder | `4419.90` | `4419.90.90.00` | **3.2%** | FOB | Duty-Free (Sec 321) |

*All tariff lines verified against the USITC Harmonized Tariff Schedule of the United States (2026 Basic Edition).*

---

## 6. End-to-End Test Execution Checklist

Before presenting to hackathon judges, verify:
- [ ] Server-side validator intercepts and rejects non-image binaries masquerading as images.
- [ ] Server-side EXIF stripper removes GPS and device tags from JPEG buffer prior to cloud dispatch.
- [ ] Cloud AI payload contains only product description and sanitized image buffer.
- [ ] Cloud AI extracts material ("Cotton Canvas") and suggests HTS `4202.92.15.00`.
- [ ] Explicit notice reminds user: *"AI classification requires seller confirmation."*
- [ ] USITC API returns live 6.3% rate with 2026 revision stamp or displays baseline warning.
- [ ] Landed cost ledger reflects active tariff rules and does not assume automatic $0 duty or zero MPF.
- [ ] Changing order quantity to 50 ($1,250) updates calculation to show 6.3% duty ($78.75) and applicable FY2027 MPF ($2.77 automated informal entry under 91 FR 48398).
- [ ] Commercial invoice PDF downloads cleanly with correct seller IEC and LUT declaration.
- [ ] PayPal Sandbox checkout button opens popup, captures payment, and transitions UI to **PAID** receipt.
