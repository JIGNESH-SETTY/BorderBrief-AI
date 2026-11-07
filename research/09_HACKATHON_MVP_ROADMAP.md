# 09 — Hackathon Strategy, Prioritization & MVP Implementation Roadmap: BorderBrief AI

**Document ID:** BB-RES-009 (Revision 4 — Final Audit Corrections)  
**Research Date:** November 6, 2026  
**Target Event:** Competitive PayPal Global / Regional Hackathon  
**Architecture Policy:** 100% Cloud-First AI (`gemini-3.8-flash`), Next.js 16, Turso Free Starter (5 GB / 100 DBs), ₹0 Budget  
**Operational Connectivity Notice:** Offline local development does **NOT** mean offline application functionality. The application executes locally without local AI servers, but requires internet connectivity to query Google AI Studio, the USITC API, and PayPal Sandbox.  
**Judging Criteria Alignment:** Technical Depth, PayPal Integration Sophistication, Design & Usability, Real-World Commercial Impact  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Hackathon Judge Evaluation Matrix

To win a competitive PayPal hackathon, BorderBrief AI must be evaluated through the lens of a senior fintech and product judge:

| Hackathon Criterion | Weight | How BorderBrief AI Wins | Common Pitfall Avoided |
| :--- | :--- | :--- | :--- |
| **PayPal Integration Depth** | 30% | Deep, legitimate server-side implementation of **PayPal Orders API v2** (Order creation with itemized breakdown, sandbox checkout, server-side capture verification, and webhook signature verification). | Avoids naive frontend-only client redirects or static mock buttons. |
| **Technical Execution** | 25% | Three-tier grounded AI architecture (zero-hallucination HTS matching), live USITC tariff API queries with revision dates, deterministic 19 U.S.C. § 1401a landed-cost engine, and vector PDF generation. | Avoids ungrounded LLMs hallucinating fake tax rates or broken API scrapers. |
| **UI/UX & Product Design** | 20% | Polished fintech/SaaS interface (shadcn/ui + Tailwind) specifically crafted for non-technical artisans. Clear stepper progression, tooltips, transparent ledger receipts. | Avoids cluttered enterprise ERP screens and walls of legal jargon. |
| **Real-World Impact** | 15% | Solves a real multi-billion-dollar friction: enabling millions of Indian artisans and MSMEs to sell directly to American consumers with full landed-cost certainty. | Avoids generic toy projects or superficial novelty wrappers. |
| **Cloud-First Scalability** | 10% | 100% Cloud-First on Next.js 16: requires zero model downloads, zero GPU hardware, zero local setup. Runs on Turso 5GB free starter tier with serverless-safe persistent idempotency. | Avoids heavy local VRAM overhead, in-memory state bugs, and multi-gigabyte downloads. |

---

## 2. Feature Prioritization: The MoSCoW Framework

### Category A: MUST HAVE (The Essential MVP Demo)
*Features required for the complete end-to-end narrative:*
1. **Product Ingestion:** Photo drag-and-drop upload, server-side binary EXIF stripping, and basic description form (title, material, FOB price in USD, shipping cost).
2. **Cloud AI Semantic Extraction:** Cloud multimodal extraction of materials, category, and construction using Google AI Studio Developer API (`gemini-3.8-flash`) with calibrated 15s timeout and native schema validation.
3. **Grounded HTS Classification:** Matching extracted product features to USITC HTS codes with plain-language explanation and explicit **"Confirm HS Code"** button.
4. **Deterministic Landed-Cost Engine:** Accurate calculation of US duty, Section 321 de minimis exemption check, Merchandise Processing Fee (MPF), and itemized total landed cost.
5. **Commercial Invoice PDF Generator:** One-click generation and download of an export-ready commercial invoice draft featuring Indian GST LUT reference and CBP item descriptions.
6. **PayPal Sandbox Checkout:** Server-side order creation (`/v2/checkout/orders`), smart button approval, server capture (`/v2/checkout/orders/{id}/capture`), and instant database status update to `PAID`.
7. **Curated Seed Dataset:** 7 authentic Indian export profiles (cotton bags, brass statues, silk scarves, ceramic mugs) with pre-verified USITC 2026 tariff lines and statutory effective dates.
8. **Serverless-Safe Idempotency:** Database-backed `idempotency_keys` table to prevent duplicate transaction and API processing across concurrent requests.

### Category B: SHOULD HAVE (High-Impact Polish)
*Features that elevate the submission from great to exceptional:*
1. **Interactive Clarifier Dialog:** Pops up when a product attribute is ambiguous (e.g., asking whether a bag has textile or plastic outer surface).
2. **Live USITC API Query with Freshness Tracking:** Real-time query to `https://hts.usitc.gov/reststop/search` with statutory revision metadata and unconfirmed baseline warnings.
3. **Assessment Hub (Dashboard):** Table of past export assessments with status badges (`DRAFT`, `PENDING_PAYMENT`, `PAID`).
4. **Shareable Buyer Payment Link:** Dedicated URL (`/pay/[exportId]`) allowing the seller to simulate sending a link to an overseas customer.

### Category C: FUTURE SCOPE (Post-Hackathon Roadmap)
*Valuable extensions that must not delay hackathon delivery:*
1. Direct integration with India Post Dak Niryat Kendra (DNK) for automated Postal Bill of Export (PBE-III) electronic filing.
2. Direct CBP Automated Commercial Environment (ACE) EDI filing.
3. Multi-corridor expansion: India $\rightarrow$ UK (HMRC tariff schedule) and India $\rightarrow$ EU (TARIC database).
4. Automated ocean freight container consolidation engine.
5. PayPal Payouts API for automated revenue splitting between artisan cooperatives.

---

## 3. Phased Implementation Schedule

A structured 5-sprint engineering plan for rapid development:

```
[ Sprint 1: Foundation & Persistence ] ────► [ Sprint 2: Cloud AI & HTS Grounding ]
                                                            │
                                                            ▼
[ Sprint 4: PayPal Checkout & Capture ] ◄──── [ Sprint 3: Landed Cost & PDF ]
                │
                ▼
[ Sprint 5: UI/UX Polish & Demo Rehearsal ]
```

### Sprint 1: Foundations, Dual Schema & Seed Data (Est: 2–3 Hours)
- Initialize Next.js 16 project with TypeScript, Tailwind CSS, Turbopack, and shadcn/ui.
- Configure SQLite/libSQL dual persistence with `@libsql/client` and Drizzle ORM (`idempotency_keys`, `products`, `classifications`, `tariff_cache`, `landed_cost_calculations`, `invoices`, `paypal_orders`).
- Seed database with the 7 verified Indian export profiles and USITC 2026 Basic Edition tariff records.

### Sprint 2: Cloud AI Ingestion & Classification Pipeline (Est: 3–4 Hours)
- Implement `/api/products/analyze` with server-side magic bytes validation, binary EXIF stripping, and data minimization.
- Connect Google AI Studio Gemini Developer API (`gemini-3.8-flash`) with native `responseSchema` enforcement and calibrated 15s timeout.
- Implement serverless-safe persistent idempotency and jittered exponential backoff.
- Connect live USITC search endpoint with statutory revision date boundary validation.

### Sprint 3: Landed-Cost Engine & Invoice Builder (Est: 3–4 Hours)
- Build pure TypeScript landed-cost engine adhering to 19 U.S.C. § 1401a transaction value principles, accounting for the de minimis suspension, and FY2027 MPF statutory schedule (91 FR 48398).
- Write unit tests verifying calculation accuracy across all valuation tiers.
- Build vector Commercial Invoice PDF template using `@react-pdf/renderer` with Indian LUT and CBP declarations.

### Sprint 4: PayPal Orders API v2 Integration (Est: 3–4 Hours)
- Configure PayPal Sandbox developer credentials in server `.env.local`.
- Build `/api/paypal/create-order` and `/api/paypal/capture-order` Route Handlers.
- Embed official `@paypal/react-paypal-js` Smart Payment Buttons in the checkout view.
- Implement server-side verification: check `status === "COMPLETED"`, update database order status, and transition UI to confirmed receipt state.
- Implement `/api/paypal/webhook` with signature verification.

### Sprint 5: UI/UX Polish & Live Demo Rehearsal (Est: 2–3 Hours)
- Construct the 5-step guided stepper workflow.
- Add tooltips explaining customs terminology (FOB, MPF, Section 321) and statutory revision badges.
- Perform end-to-end rehearsal using the handmade cotton bag test case.

---

## 4. Live Hackathon Pitch & Demonstration Script (3-Minute Flow)

| Time | Storyboard Beat | Live Screen Action | Speaker Narration |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:30** | **The Problem** | Slide / Dashboard showing Indian artisan profile | *"Millions of small artisans in India want to sell directly to US customers. But they face a wall of fear: What will customs charge? What is an HS code? Will my shipment get rejected? And how do I get paid?"* |
| **0:30 – 1:15** | **Cloud AI Understanding & Grounding** | Upload photo of cotton tote bag; click "Analyze" | *"Watch BorderBrief AI in action. The seller uploads a photo and writes: 'Handmade floral cotton tote bag'. Our server strips EXIF data for privacy, passes the image to Gemini 3.8 Flash, extracts the weave, and queries the official USITC 2026 tariff schedule—recommending HTS 4202.92.15.00 with a 6.3% duty rate."* |
| **1:15 – 1:50** | **Transparent Landed Cost & Invoice** | Stepper advances to Cost Ledger and PDF Preview | *"No black-box math. Our deterministic engine applies US customs valuation law (19 U.S.C. § 1401a). Because this order is \$250, it qualifies under Section 321 de minimis—meaning \$0 US duty for the buyer! With one click, BorderBrief generates an export-ready Commercial Invoice with Indian GST LUT declarations."* |
| **1:50 – 2:40** | **The PayPal Moment** | Click "Pay with PayPal"; sandbox popup opens; click "Pay Now" | *"Now the seller sends the payment link to their US customer. The buyer sees an all-inclusive, transparent landed cost in USD. Using the official PayPal Smart Payment Button, the buyer pays via PayPal Sandbox. Our server captures the payment via PayPal Orders API v2, verifies the transaction, and instantly updates the exporter's record to PAID."* |
| **2:40 – 3:00** | **Conclusion & Impact** | Dashboard showing completed order with capture ID | *"BorderBrief AI: Know the Rules. Know the Cost. Ship with Confidence. 100% cloud-first on Next.js 16 and Turso free tier, zero local dependencies, built on open-source and free technologies at ₹0 infrastructure cost, powered by PayPal."* |
