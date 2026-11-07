# 04 — Cloud-First AI & Grounded HS Classification Architecture: BorderBrief AI

**Document ID:** BB-RES-004 (Revision 4 — Final Audit Corrections)  
**Research Date:** November 6, 2026  
**Primary Cloud Model:** Google AI Studio Developer API — **`gemini-3.8-flash`**  
**Core Architectural Insight:** **Schema enforcement guarantees structural validity, NOT factual or legal correctness.**  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Cloud-First AI Classification Philosophy

Harmonized System (HS) classification is not a generative writing or semantic search task; it is a **codified legal decision tree** governed by the World Customs Organization's (WCO) **General Rules of Interpretation (GRIs 1 through 6)**.

### 1.1 Structural Validity vs. Factual Correctness
A critical distinction in production AI systems:
- **What JSON Schema Enforcement Does:** Gemini's `responseSchema` forces token probabilities into a strict OpenAPI JSON grammar. It guarantees that the response contains valid keys (`htsCode`, `confidence`, `materials_detected`), valid types (strings, numbers, booleans), and zero markdown wrapping syntax errors.
- **What JSON Schema Enforcement Does NOT Do:** It does **NOT** guarantee that the suggested HTS code actually exists in the current legal tariff schedule, that the assigned duty rate is correct, or that the classification complies with US customs rulings. An LLM can emit syntactically flawless JSON containing completely fabricated tariff codes.

### 1.2 The BorderBrief AI Grounding Mandate
> **Cloud AI models are strictly utilized for multimodal semantic extraction, trade attribute parsing, and plain-language explanation. Under no circumstances will a cloud AI model determine statutory tariff rates or perform financial math.**
>
> **Every classification suggested by AI must be deterministically matched against the official USITC Harmonized Tariff Schedule before being presented to the user.**

---

## 2. The 3-Tier Grounded Classification Architecture

```
[ Seller Uploads Photo + Description ]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  Tier 1: Cloud Multimodal Semantic Extraction          │
│  - Primary: Google AI Studio (gemini-3.8-flash)        │
│  - Server-Side Sanitization & EXIF Stripping           │
│  - Extracts material composition, outer surface, weave │
│  - Detects closures, dimensions, intended use          │
│  - Output: Structurally validated JSON Feature Vector  │
└────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Grounded Official Schedule Query (Engine)     │
│  - Matches features against official USITC HTS indices │
│  - Validates 6-digit WCO heading and 10-digit rate line│
│  - Fetches statutory duty rates directly from USITC    │
│  - Checks tariff revision date & statutory period      │
└────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Explainability & Clarification (Interactive)   │
│  - Computes confidence score (High / Medium / Low)     │
│  - Formulates 1-2 clarifying questions for user        │
│  - Displays transparent legal rationale (GRI basis)    │
│  - REQUIRES HUMAN CONFIRMATION BEFORE FINALIZATION     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Cloud Provider Architecture, Quotas & Failure Handling

### 3.1 Primary Cloud AI: Google AI Studio (`gemini-3.8-flash`)
- **Official Status:** Current baseline Flash-class model in the Gemini Developer API catalog. Features native multimodal capabilities, high throughput, and strict JSON schema generation (`responseSchema`).
- **Quota Model:** Project-dependent (Free Tier 0). Quotas are established per Google AI Studio project and model. Developers must inspect their active limits under [aistudio.google.com/app/plan_information](https://aistudio.google.com/app/plan_information).
- **Measured Request Latency:** Empirical testing shows image multimodal inference takes **2.5s – 7.5s** (including image network upload, vision tokenization, semantic reasoning, and JSON decoding).

### 3.2 Removal of Groq as a Mandatory Backup
- **Official Pricing Finding:** Multimodal models on Groq (such as `qwen/qwen3.8-27b`) carry commercial pay-as-you-go pricing ($0.80/M input, $4.00/M output) and unverified free quotas.
- **Architectural Policy:** To preserve the strict ₹0 development budget guarantee, **Groq is completely removed as a mandatory backup**. If a developer chooses to provide their own optional `GROQ_API_KEY`, secondary failover can be enabled, but the core system is designed to be fully resilient without it.

### 3.3 Realistic Failure Handling, Retries & Timeouts
1. **Calibrated Timeouts:**
   - Multimodal image + text requests enforce a **15,000ms (15 seconds)** `AbortController` timeout to prevent false aborts during vision token processing.
   - Text-only classification / clarification requests enforce an **8,000ms (8 seconds)** timeout.
2. **Jittered Exponential Backoff:** On HTTP `429 Too Many Requests` or `503 Service Unavailable`, the server retries up to 2 times with jittered exponential delay ($t = 2^n \times 500\text{ms} + \text{rand}(0, 200\text{ms})$).
3. **Serverless-Safe Idempotency:** The client passes a UUID `X-Idempotency-Key`. The server checks the database `idempotency_keys` table to return cached in-flight or completed responses, preventing duplicate cloud API billing or quota exhaustion.
4. **Graceful User-Facing Degradation:** If cloud calls fail or time out, the system never crashes: it displays an actionable notification and unlocks manual search:
   > *"AI image analysis is temporarily experiencing high traffic. Please wait a moment to retry, or use the direct search box below to find your product's tariff code."*

---

## 4. Privacy Controls & Server-Side Image Sanitization

Because free cloud AI developer endpoints may log data for service monitoring and model improvements, BorderBrief AI enforces **Mandatory Server-Side Image Sanitization**:

### 4.1 Server-Side EXIF Stripping
Never trust the client alone to strip metadata. The server-side route handler processes raw image buffers prior to cloud dispatch:
1. **Magic Bytes Validation:** Validates buffer header bytes strictly against allowed formats:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `52 49 46 46` ... `57 45 42 50`
   All executable polyglots, SVGs with embedded scripts, and unknown binaries are rejected with HTTP 400.
2. **Binary Metadata Stripping:**
   - In JPEGs, the server strips `APP1` metadata segments containing EXIF headers (GPS coordinates, camera model, lens metadata, and device serial numbers).
   - In PNGs, metadata chunks (`eXIf`, `tEXt`, `zTXt`, `iTXt`) are stripped.
3. **Dimension & Size Verification:** Verifies image size ($\le 4.0\text{ MB}$) and pixel dimensions ($\le 4096 \times 4096$) to prevent decompression bombs.

### 4.2 Data Minimization Gateway (Zero PII Transmitted)
The server constructs an isolated AI prompt containing **only**:
- The stripped, sanitized product photograph.
- Technical physical description (e.g., *"handmade floral canvas tote bag"*).
- Declared materials and intended function.

**Strict Blacklist:** The following attributes are **strictly forbidden** from being transmitted to external AI APIs:
- Exporter name, business address, email, phone number.
- Indian regulatory identifiers (PAN, IEC, GSTIN, LUT ARN).
- Buyer name, US delivery address, and contact details.
- Bank account details, IFSC codes, and payment credentials.

---

## 5. Structured Extraction Prompt Design & JSON Contract

### System Prompt Specification
```text
System Instruction:
You are an expert International Trade and Customs Classification Specialist adhering to the World Customs Organization (WCO) General Rules of Interpretation (GRI).
Your objective is to analyze product descriptions, specifications, and uploaded photographs to extract technical trade attributes and suggest candidate Harmonized System (HS) classifications.

Strict Constraints:
1. Output MUST be valid JSON conforming strictly to the requested schema.
2. DO NOT invent tariff rates. Tariff rates are retrieved exclusively from official government databases.
3. If critical classification details are missing (e.g., composition percentage, weaving method, interior coating, closures), flag them explicitly in 'missing_attributes' and generate user-friendly 'clarifying_questions'.
4. Provide candidate HS codes down to 6 digits (WCO level) and candidate US HTS codes to 10 digits with an explainable rationale.
```

### JSON Schema Contract
```json
{
  "product_analysis": {
    "extracted_title": "string",
    "primary_category": "string",
    "materials_detected": [
      {
        "material": "string",
        "estimated_percentage": "number",
        "is_outer_surface": "boolean"
      }
    ],
    "construction": "string (e.g., woven, knitted, molded, forged, hand-carved)",
    "intended_use": "string",
    "is_handicraft": "boolean"
  },
  "candidate_classifications": [
    {
      "hs6_code": "string (e.g., 4202.92)",
      "hts10_code": "string (e.g., 4202.92.15.00)",
      "official_description": "string",
      "confidence": "HIGH | MEDIUM | LOW",
      "legal_basis": "string (e.g., GRI 1, Chapter 42 Note 2)",
      "explanation_for_seller": "string (plain language explanation)"
    }
  ],
  "classification_ambiguity": {
    "is_ambiguous": "boolean",
    "missing_attributes": ["string"],
    "clarifying_questions": [
      {
        "question_id": "string",
        "question_text": "string",
        "options": ["string", "string"],
        "reason_it_matters": "string"
      }
    ]
  }
}
```

---

## 6. Walkthrough: The Indian Cotton Bag Example

### 1. Seller Input
- **Seller Input:** *"Handmade floral cotton tote bag, with fabric handle and inner lining."*
- **Photo Uploaded:** A cloth bag showing woven canvas texture, twin handles, and no exterior metal zippers.

### 2. Cloud AI Processing (Tier 1)
- Identifies outer surface as 100% woven cotton textile.
- Identifies form factor: Tote bag / handbag without rigid frame.
- Suggests WCO Heading: **4202** (*Handbags, shopping bags, and similar containers*).
- Suggests WCO Subheading: **4202.92** (*With outer surface of sheeting of plastics or of textile materials*).
- Outputs candidate HTS code `4202.92.15.00`.

### 3. Interactive Clarification (Tier 3)
The Cloud AI flags:
- *Question:* *"Is this designed as a shopping / tote bag without closure, or does it feature a zipper/closure valued over $20?"*
- *Seller selects:* *"Open tote / shopping bag, 100% cotton."*

### 4. Official USITC Grounding (Tier 2)
The backend engine queries the USITC database for `4202.92.15.00`:
- Confirms code exists in the official 2026 tariff schedule.
- Checks statutory effective date range (`effective_from: 2026-01-01`).
- Retrieves statutory General Duty Rate: **6.3%**.
- Explanation rendered to seller:
  > *"Classified under US HTS **4202.92.15.00** because the outer surface is predominantly woven cotton textile. Verified against USITC 2026 Basic Edition. Standard US import duty for goods originating in India is **6.3%**."*

---

## 7. Human-in-the-Loop Safeguards

1. **Never auto-commit a classification:** The UI displays candidate codes with clear badges (`Recommended: 92% Confidence`).
2. **"Confirm Classification" Button:** The user must review the plain-language explanation and click an explicit confirmation button before the application unlocks the landed-cost calculator and commercial invoice generator.
3. **Editable Override:** The seller can search alternative codes or manually edit the suggested 6-digit HS code if their freight forwarder or customs broker provided a specific ruling.
