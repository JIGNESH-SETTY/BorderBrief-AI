# 01 — Project Feasibility Study: BorderBrief AI

**Document ID:** BB-RES-001  
**Project:** BorderBrief AI (*Know the Rules. Know the Cost. Ship with Confidence.*)  
**Target Corridor:** India (IN) → United States (US)  
**Target User Persona:** Indian Artisans, Handicraft Exporters, MSMEs, Sole Proprietors  
**Scope:** Hackathon Engineering Feasibility, Risk Analysis, and Technical Viability  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Executive Summary & Feasibility Verdict

**Overall Feasibility Assessment:** **HIGHLY FEASIBLE (with strict architectural guardrails)**

BorderBrief AI solves a high-friction problem in international cross-border e-commerce: micro and small exporters in emerging markets (starting with India) struggle to navigate complex Harmonized System (HS) classifications, opaque foreign import tariff schedules (US HTS), landed-cost estimation, export invoice generation, and secure international cross-border payment collection.

Building an end-to-end, high-reliability platform within a zero-cost budget (₹0) and hackathon constraints is achievable provided the architecture respects a core design philosophy:
> **AI is used for semantic extraction, classification assistance, and user explanation; deterministic rule engines and official government APIs are strictly used for statutory tariff lookups, tax computations, and financial ledger transactions.**

Under no circumstances will an LLM generate tariff rates or perform financial math.

---

## 2. Technical Feasibility Analysis Across the 7 Core Stages

| Stage | Functional Scope | Technical Complexity | Feasibility | Key Dependency / Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1: Product Information** | Metadata input (title, materials, price, shipping, photograph) | Low | **100% Feasible** | Web form, drag-and-drop file upload, client-side image resizing |
| **Stage 2: AI Product Understanding** | Image + text analysis, material identification, feature extraction | Medium | **100% Feasible** | Cloud Multimodal AI: Google AI Studio (`gemini-3.8-flash`) + Optional Groq Cloud (`qwen/qwen3.8-27b`) |
| **Stage 3: HS Code Recommendation** | Explainable 6-digit HS / 10-digit HTS suggestion, reasoning, clarifying questions | High | **90% Feasible** | Hierarchical classification pipeline grounded in official USITC HTS data |
| **Stage 4: Customs & Tariff Intelligence** | Dutiable rates, Column 1 General MFN rates, Section 301/232, MPF, de minimis | High | **95% Feasible** | USITC HTS REST API (`https://hts.usitc.gov/reststop`) + static normalized offline fallback |
| **Stage 5: Landed-Cost Calculator** | Deterministic FOB-based valuation, duties, MPF, shipping, landed breakdown | Medium | **100% Feasible** | Pure TypeScript calculation engine adhering to 19 U.S.C. § 1401a valuation rules |
| **Stage 6: Export Documentation** | Commercial invoice PDF draft with Indian DGFT/CBIC LUT declarations | Medium | **100% Feasible** | `@react-pdf/renderer` or `pdfmake` (MIT license, client/server rendering) |
| **Stage 7: PayPal Integration** | Sandbox checkout, order capture, webhook listener, status persistence | Medium | **100% Feasible** | PayPal Orders API v2, `@paypal/react-paypal-js`, Sandbox test accounts |

---

## 3. Deep Inspection of Each Workflow Stage

### Stage 1: Product Information Ingestion
- **Challenge:** Unstructured, vague user input (e.g., "handmade cotton bag" without mentioning lining, zippers, closure type, or weave).
- **Feasibility:** Client-side form with immediate client-side validation. Uploaded photos are converted to base64 or temporary blobs and compressed before sending to the backend or AI model to maintain low latency and respect payload limits (< 4.5 MB on serverless).

### Stage 2: Multimodal AI Product Understanding
- **Challenge:** Running visual analysis without incurring API charges or overwhelming low-spec developer hardware.
- **Feasibility:** 
  1. *Primary Route (Google AI Studio Gemini Developer API):* Employs `gemini-3.8-flash` (current baseline model). The free tier allows native multimodal inputs (image + text) with project-governed quotas at ₹0 cost, requiring no credit card.
  2. *Optional Secondary Failover (Groq Cloud API):* Groq Cloud free tier provides high-throughput LPU inference using `qwen/qwen3.8-27b` at ₹0 cost, configurable as a secondary backup if the primary endpoint experiences rate limits or timeouts. Zero local model installation or GPU maintenance required.

### Stage 3: Explainable HS Code Recommendation
- **Challenge:** HS codes are legally rigid (WCO General Rules of Interpretation - GRI 1 to 6). LLMs frequently hallucinate nonexistent 6-digit or 10-digit codes if prompted without a grounded reference database.
- **Feasibility:** Feasible via a **two-tier Retrieval-Augmented Generation (RAG) / Grounded Search pattern**:
  - The AI extracts material composition, product function, and construction attributes.
  - The system performs a search against official USITC HTS nomenclature or a curated local index of frequent export chapters (Chapters 42, 52, 61, 62, 63, 69, 73, 74, 94).
  - The AI presents top candidates (e.g., `4202.92.15.00` vs `4202.12.21.00`), highlights distinguishing questions ("Does it have an outer surface of textile or plastic?"), and displays human-readable rationales.
  - **Mandatory UX Rule:** Human confirmation is explicitly required before finalizing the code.

### Stage 4: Customs and Tariff Intelligence
- **Challenge:** Web scraping government portals is fragile, violates terms of service, and breaks frequently.
- **Feasibility:** The US International Trade Commission (USITC) operates an open, public REST API:
  - Base: `https://hts.usitc.gov/reststop`
  - Search Endpoint: `https://hts.usitc.gov/reststop/search?keyword={query}`
  - Verified live in research: querying `4202.92` returns structured JSON with exact statutory rates:
    - General rate: `6.3%`
    - Special rates: `Free (A,AU,BH,CL,CO,D,IL,JO,KR,MA,NP,OM,P,PA,PE,S,SG) 4.9% (E)`
    - Units of quantity: `["No.", "kg"]`
  - *India Specific Note:* India's Generalized System of Preferences (GSP / indicator `A`) designation was terminated by Presidential Proclamation 9902 effective June 5, 2019, and the US GSP program's statutory authorization expired on December 31, 2020. Indian exports are therefore assessed at standard **Column 1 General (MFN) rates**. BorderBrief AI embeds this critical regulatory intelligence directly into its rule engine.

### Stage 5: Deterministic Landed-Cost Engine
- **Challenge:** Applying incorrect valuation formulas or unverified thresholds. Many naive tools apply duties to CIF or simply label US valuation as "FOB". Under US law (19 U.S.C. § 1401a), customs value is based on **Transaction Value** — the price actually paid or payable plus specified statutory additions. Under 19 U.S.C. § 1401a(b)(4)(A), the price actually paid or payable excludes costs, charges, and expenses incurred for transportation, insurance, and related services incident to international shipment from the country of exportation to the place of importation in the United States. (This is legally distinct from transportation occurring after importation under 19 U.S.C. § 1401a(b)(4)(B)). Furthermore, actual customs valuation requires examination of the transaction and supporting commercial documentation, rather than assuming unverified bundled shipping figures.
- **Feasibility:** High. A deterministic TypeScript engine models statutory rules without hallucination:
  - **Customs Valuation:** Transaction Value principles under 19 U.S.C. § 1401a, with separate tracking of international transit costs incident to international shipment under § 1401a(b)(4)(A).
  - **Duty Calculation:** Applied to dutiable transaction value using official USITC Column 1 General tariff rates.
  - **Merchandise Processing Fee (MPF):** Modeled under the statutory FY2027 fee schedule (effective October 1, 2026, 91 FR 48398: formal entry 0.3464%, min \$34.58, max \$670.86; informal automated entry \$2.77; informal manual \$8.30 / \$12.45). Applicability depends on entry classification and CBP regulations; zero duty or zero MPF is never automatically assumed.
  - **Total Landed Cost:** Itemized breakdown of merchandise price, international shipping, customs duties, MPF, and any applicable surcharges.
  Because calculation logic is executed in deterministic backend code rather than generative AI, accuracy is mathematically verifiable with zero LLM hallucination.

### Stage 6: Export Documentation (Commercial Invoice Draft)
- **Challenge:** Small exporters don't know what mandatory declarations must appear on a commercial invoice for Indian export customs (CBIC/DGFT) and US customs clearance (CBP).
- **Feasibility:** High. Generating a clean, downloadable vector PDF via `@react-pdf/renderer` or `pdfmake`. The invoice automatically includes:
  - Exporter IEC (Importer Exporter Code) and GSTIN with LUT declaration ("Exported under Letter of Undertaking without payment of IGST").
  - Buyer name, US delivery address, and contact details.
  - Itemized descriptions, 6-digit HS / 10-digit HTS codes, quantity, unit price, total value.
  - Incoterms (e.g., DAP - Delivered at Place or DDP - Delivered Duty Paid).
  - Explicit legal disclaimer: *"Informational draft prepared via BorderBrief AI. Not an official customs entry filing."*

### Stage 7: PayPal Integration
- **Challenge:** Demonstrating realistic international e-commerce payment collection without incurring real money fees or relying on brittle frontend-only confirmations.
- **Feasibility:** High. PayPal Developer platform provides a complete REST Orders API v2 in Sandbox mode (`api-m.sandbox.paypal.com`):
  - Step 1: Server initiates order via `POST /v2/checkout/orders` with exact USD amounts and invoice metadata.
  - Step 2: Client renders official PayPal Smart Payment Buttons (`@paypal/react-paypal-js`).
  - Step 3: Server captures payment via `POST /v2/checkout/orders/{id}/capture` upon buyer approval.
  - Step 4: Webhook listener receives `PAYMENT.CAPTURE.COMPLETED` and validates signature via `POST /v1/notifications/verify-webhook-signature`.
  - Step 5: Database updates payment status from `PENDING` to `COMPLETED`.

---

## 4. Key Technical Risks and Mitigation Matrix

| # | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | **USITC API downtime or latency during live demo** | High | Medium | Implement an **in-memory / local SQLite cache** of common export tariff lines (seed dataset of ~50 popular Indian handicrafts and textiles). Fallback to cache if USITC endpoint times out (> 3000ms). |
| **R2** | **AI hallucinates incorrect HS codes** | High | Medium | Two-stage verification: Model proposes code $\rightarrow$ System validates code against USITC HTS database $\rightarrow$ User reviews and confirms code before proceeding to landed cost calculation. |
| **R3** | **Cloud AI rate limits during rapid testing bursts** | Medium | Low | Implement dynamic rate monitoring and jittered exponential backoff; if configured, attempt secondary call to Groq Cloud API (`qwen/qwen3.8-27b`) before gracefully showing an actionable retry state. |
| **R4** | **PayPal Sandbox webhook delivery failures during local dev** | Medium | High | For local development, use an ngrok / Cloudflare tunnel or support an explicit server-side capture verification fallback (`/api/paypal/orders/[id]/capture`) that directly checks transaction state. |
| **R5** | **Regulatory and legal liability claims** | High | Low | Embed unambiguous, prominent disclaimers on every UI screen, calculation breakdown, and PDF invoice: *"BorderBrief AI provides automated compliance estimates for planning purposes only and is not a licensed customs broker or legal advisor."* |

---

## 5. Feasibility Verdict

The project is **technically sound, legally well-scoped, and achievable within hackathon parameters at zero financial cost**. By isolating AI to extraction and semantic matching while driving calculations and tariffs through verified public data and deterministic formulas, BorderBrief AI balances cutting-edge AI capabilities with uncompromising fintech reliability.

