# BorderBrief AI — Sprint 7: Full Application Integration Audit Report
**Comprehensive End-to-End System Integration, Workflow Trace & Architecture Audit**

---

## 1. Executive Summary

This report delivers the **Sprint 7 Full Application Integration Audit** for **BorderBrief AI** (*"Know the Rules. Know the Cost. Ship with Confidence."*).

As instructed, this audit was conducted strictly as an **INSPECTION-ONLY** review without altering source code, tests, database records, tariff datasets, or user interfaces.

### Integration Verdict
The application exhibits **high architectural coherence and end-to-end functional integrity** across all six completed milestones:
1. **Sprint 1 (Foundation):** Next.js App Router shell, primary trade corridor definition (India → USA), and basic product intake form.
2. **Sprint 2 (AI Understanding):** Multimodal physical attribute extraction via cloud Google Gemini (`gemini-3.8-flash`) with strict privacy consent and zero-cost deterministic demo fallback.
3. **Sprint 3 (Customs Intelligence):** USITC 2026 HTS Revision 22 authoritative store, WCO General Rules of Interpretation (GRI) logic, official CBP rulings, Section 301 trade remedy matching, and strict anti-hallucination guardrails (blocking CITES Appendix II Sheesham wood; flagging FDA Darjeeling tea).
4. **Sprint 4 (Landed-Cost Calculator):** Deterministic customs valuation under 19 U.S.C. § 1401a transaction value principles (excluding international freight/insurance under § 1401a(b)(4)(A)), MPF (19 CFR § 24.23), Inbound EMS fee (§ 24.22(l)), HMF (0.125%), and updated postal compliance dates (January 20, 2027 per CBP Doc. 2026-21600 & Entry Type 13 per 91 FR 66707).
5. **Sprint 5 (Commercial Invoice & PDF):** Export invoice drafting under Incoterms® 2020 DAP, strict financial separation of U.S. customs duties from seller receivables, Indian GST LUT zero-rated export declarations, and pure zero-dependency standards-compliant binary PDF 1.4 generation.
6. **Sprint 6 (PayPal Sandbox Payment):** Server-side Orders API v2 integration, zero-trust amount and currency validation based on saved SQLite invoices, integer minor-unit arithmetic, self-healing capture recovery, and cryptographic webhook signature verification with event deduplication.

### Current Test Suite & Build Health
- **Automated Tests:** **209 passed**, 0 failed, 2 skipped (1 opt-in live Gemini test, 1 opt-in live PayPal test) across 24 test suites.
- **TypeScript:** Exit code 0 (`npx tsc --noEmit`), 0 errors.
- **ESLint:** Exit code 0 (`npm run lint`), 0 errors, 0 warnings.
- **Production Build:** Exit code 0 (`npm run build`), all 14 pages and API routes cleanly compiled and statically optimized.
- **Budget & Third-Party Footprint:** ₹0 development budget; zero paid dependencies; zero local AI or Ollama dependencies; strictly Sandbox payment mode.

---

## 2. Repository Architecture Map

```
d:\BorderBrief AI\
├── .env.example                               # Environment template (Gemini API key, PayPal Sandbox keys)
├── package.json                               # Next.js 16.4.5, React 19, sharp, lucide-react, clsx (₹0 dependencies)
├── next.config.js                             # Turbopack, React Strict Mode, 6MB Server Actions payload
├── src/
│   ├── app/
│   │   ├── layout.tsx                         # Global layout, typography, navigation header & footer
│   │   ├── globals.css                        # Tailwind CSS styling, print media rules, watermarks
│   │   ├── page.tsx                           # Landing page, value proposition, corridor summary
│   │   ├── corridor/india-usa/page.tsx        # 4 Regulatory Pillars: Valuation, Sec 321, GSP, Indian LUT
│   │   ├── export/new/page.tsx                # Unified 5-Step Export Assessment Workflow
│   │   └── api/
│   │       ├── products/analyze/route.ts      # Cloud Gemini multimodal extraction & sanitization
│   │       ├── tariffs/classify/route.ts      # USITC Revision 22 rule-based classification
│   │       ├── tariffs/calculate/route.ts     # 19 U.S.C. § 1401a Landed-Cost Engine
│   │       ├── invoices/route.ts              # Commercial invoice persistence & listing
│   │       ├── invoices/[id]/route.ts         # Commercial invoice lookup & deletion
│   │       ├── invoices/[id]/pdf/route.ts     # Binary streaming PDF download endpoint
│   │       ├── invoices/generate-pdf/route.ts # Direct on-the-fly PDF generator
│   │       ├── payments/paypal/config/route.ts# Safe public PayPal client configuration
│   │       ├── payments/paypal/create-order/route.ts # Orders API v2 order generation
│   │       ├── payments/paypal/capture-order/route.ts # Server-side capture & reconciliation
│   │       ├── payments/paypal/webhook/route.ts      # Cryptographic signature & event dispatcher
│   │       └── payments/[id]/route.ts         # Sanitized payment status lookup
│   ├── components/
│   │   ├── features/                          # Corridor badges, workflow overviews, module cards
│   │   ├── invoice/
│   │   │   └── commercial-invoice-preview.tsx # Interactive invoice preview, print & PDF controls
│   │   ├── payment/
│   │   │   └── paypal-sandbox-checkout.tsx    # Official PayPal JS SDK buttons & receipt panel
│   │   └── ui/                                # Stepper, cards, buttons, badges (Tailwind CSS)
│   ├── config/
│   │   ├── corridor.ts                        # India → USA corridor metadata & compliance notes
│   │   └── modules.ts                         # System modules and architectural roadmap
│   ├── data/
│   │   └── seed-products.ts                   # 7 authentic Indian artisan seed export profiles
│   ├── lib/
│   │   ├── db/
│   │   │   ├── database.ts                    # SQLite adapter (node:sqlite DatabaseSync), WAL mode
│   │   │   └── schema.ts                      # 9 Relational tables DDL (products, invoices, payments, etc.)
│   │   ├── invoice/
│   │   │   ├── invoice-engine.ts              # Arithmetic, Incoterms DAP rules, disclaimers
│   │   │   └── pdf-generator.ts               # Pure zero-dependency binary PDF 1.4 generator
│   │   ├── paypal/
│   │   │   └── paypal-client.ts               # Zero-dependency Orders API v2 client & token cache
│   │   ├── security/
│   │   │   └── image-sanitizer.ts             # Sharp image validation, re-encoding & EXIF stripping
│   │   ├── services/
│   │   │   ├── gemini-service.ts              # Google AI Studio Gemini API integration & schema
│   │   │   └── idempotency.ts                 # In-memory & SQLite request deduplication
│   │   └── tariff/
│   │       ├── authoritative-store.ts         # USITC 2026 Rev 22 tariff records & CBP rulings
│   │       ├── classification-engine.ts       # GRI rule matcher & ambiguity detector
│   │       └── landed-cost-engine.ts          # Customs valuation, Section 301, MPF, HMF, EMS
│   ├── tests/                                 # 14 automated test suites (211 tests total)
│   └── types/
│       ├── export.ts                          # Core export domain interfaces & corridor types
│       ├── invoice.ts                         # Commercial invoice contracts & draft states
│       └── payment.ts                         # PayPal Sandbox orders, captures, webhook types
```

---

## 3. End-to-End Workflow Trace

The 13 target workflow steps were audited sequentially across the codebase:

```
[1. User Enters Details] ──> [2. Cloud AI Extraction] ──> [3. Seller Review & Confirm]
                                                                     │
[6. Landed Cost Engine]  <── [5. Confirm / Warning]   <── [4. HS/HTS Candidate Matching]
        │
        ▼
[7. Cost Breakdown]      ──> [8. Invoice Drafted]     ──> [9. Download Binary PDF]
                                     │
                                     ▼
[12. Status Updated]     <── [11. Buyer Approves]     <── [10. PayPal Sandbox Order]
        │
        ▼
[13. Retrieval by ID]
```

### Detailed Stage Transition Matrix

| Step | User Action / Stage | Source Component | Input Data Contract | Output Data Contract | Database Operation | Validation & Guardrails | Next Stage Handoff |
|---|---|---|---|---|---|---|---|
| **1** | Enter export product details | `src/app/export/new/page.tsx` (Step 1) | Form state (title, description, price, shipping, materials, photo) | FormData payload | None (client-side form) | Client rejects empty titles, negative prices, non-image files, >4MB images. | Submitted to `/api/products/analyze`. |
| **2** | Cloud AI understands product | `POST /api/products/analyze` | FormData multipart | `ProductAnalysisResult` | EXIF stripped via `sharp`; request cached | Enforces explicit user consent for cloud AI. Validates price > 0. Fallback to demo mode if no API key. | Sets `analysisResult` in state; advances to Step 2. |
| **3** | Review & confirm attributes | `src/app/export/new/page.tsx` (Step 2) | `ProductAnalysisResult` + seller edits | `SellerConfirmedProductReview` | None | Seller can edit materials and intended use; confirms truth declaration. | Passed to `handleRunClassification()`; advances to Step 3. |
| **4** | HS/HTS classification | `POST /api/tariffs/classify` | Confirmed title, description, materials | `ClassificationResult` | None (in-memory lookup against USITC store) | Matches against USITC Revision 22 store. Evaluates GRI hierarchy. Detects regulatory blockers. | Primary candidate pre-selected; alternatives displayed. |
| **5** | Confirm classification | `src/app/export/new/page.tsx` (Step 3) | Selected candidate HTS-10 | Confirmed HTS code | None | If Sheesham wood: displays CITES blocker (`BLOCKED`). If Darjeeling tea: flags FDA requirement (`PARTIALLY_VERIFIED`). | Advances to Step 4 with confirmed candidate. |
| **6** | Landed-cost calculation | `POST /api/tariffs/calculate` | HTS-10, price, shipping, quantity, mode, postal rules | `LandedCostCalculationResult` | Saves record in `landed_cost_calculations` table | Validates 19 U.S.C. § 1401a valuation (excludes freight/insurance). Evaluates postal formal compliance dates (Jan 20, 2027). | Returns itemized duties, MPF, HMF, EMS fee. |
| **7** | Review landed cost breakdown | `src/app/export/new/page.tsx` (Step 4) | `LandedCostCalculationResult` | Landed-cost UI cards | Display only | Disclaimers clarify that U.S. import charges are assessed upon arrival by CBP. | Exporter clicks "Generate Export Documents" -> Step 5. |
| **8** | Generate & save invoice | `buildCommercialInvoice()` & `POST /api/invoices` | Landed-cost result + seller/buyer details | `CommercialInvoiceDraft` | Atomic transaction in `invoices` table (`borderbrief.db`) | Strictly excludes U.S. import duties from invoice total. Enforces Incoterms DAP rules. Optional cargo insurance. | Renders invoice preview & PayPal checkout card. |
| **9** | Download invoice PDF | `GET /api/invoices/[id]/pdf` or `POST /api/invoices/generate-pdf` | `CommercialInvoiceDraft` | Binary `application/pdf` (PDF 1.4) | None (rendered on the fly) | Zero-dependency binary PDF stream. Diagonal draft watermark ("DRAFT — FOR REVIEW ONLY"). | Direct browser download to exporter's machine. |
| **10** | Create PayPal Sandbox order | `POST /api/payments/paypal/create-order` | `{ invoiceId }` | `{ orderId, paymentId, amount, approveUrl }` | Stores payment in `payments` (`status = 'CREATED'`) | Amount derived exclusively from SQLite invoice. Excludes customs duties. Checks supported currency. | Renders interactive PayPal Smart Buttons via JS SDK. |
| **11** | Buyer approves payment | PayPal Sandbox popup modal | Buyer PayPal account | PayPal Order Approval (`orderID`) | Logged in client event handler | User authenticates inside secure PayPal popup; BorderBrief AI never handles card numbers. | Calls server `onApprove` callback. |
| **12** | Server verifies capture | `POST /api/payments/paypal/capture-order` | `{ orderId }` | `CaptureOrderResponse` | Atomic update: `payments.status='COMPLETED'`, `invoices.status='PAID'` | Server calls Orders API v2 capture. Cross-verifies amount in integer minor units. Checks currency match. | UI renders verified receipt; invoice badge turns PAID. |
| **13** | Retrieve saved invoice / payment | `GET /api/invoices/[id]` & `GET /api/payments/[id]` | `id` (invoice ID or payment ID) | Sanitized JSON record | SQLite SELECT by ID or Order ID | PII email masked (`b***@example.com`). Audit disclaimers attached. | Programmatic retrieval verified across tests. |

---

## 4. Integration Compatibility Matrix

| Milestone | Key Output Contract | Consumed By | Compatibility Status | Audit Evidence & Analysis |
|---|---|---|---|---|
| **Sprint 1** (Foundation) | `PRIMARY_CORRIDOR`, `ProductIntakeFormData` | Sprint 2, 3, 4 | **COMPATIBLE** | Origin "IN" and destination "US" consistently passed across all APIs. |
| **Sprint 2** (AI Extraction) | `ProductAnalysisResult` (`inferred_attributes`) | Sprint 3 (Classification) | **COMPATIBLE** | `confirmedMaterials` and `confirmedIntendedUse` seamlessly bridge into `/api/tariffs/classify`. |
| **Sprint 3** (Classification) | `ClassificationResult` (`primaryCandidate.hts10`) | Sprint 4 (Landed Cost) | **COMPATIBLE** | HTS-10 candidate string correctly passed to `/api/tariffs/calculate`; ambiguity flags preserved. |
| **Sprint 4** (Landed Cost) | `LandedCostCalculationResult` | Sprint 5 (Invoice) | **COMPATIBLE** | Duties/fees ($40.75 in sample) correctly segregated into `estimatedImportCosts` without polluting seller invoice total. |
| **Sprint 5** (Invoice & PDF) | `CommercialInvoiceDraft` (`invoiceTotalUSD`) | Sprint 6 (PayPal) | **COMPATIBLE** | `/api/payments/paypal/create-order` retrieves saved invoice from SQLite and derives exact order total ($271.00). |
| **Sprint 6** (PayPal Payments) | `PaymentRecord` (`status: 'COMPLETED'`) | Sprint 5 (Invoice Status) | **COMPATIBLE** | Capture completion atomically transitions invoice status to `'PAID'` in SQLite column and embedded JSON. |

---

## 5. Financial and Regulatory Consistency Findings

The application was audited against official U.S. and Indian trade statutes:

### 1. Customs Valuation under 19 U.S.C. § 1401a
- **Statutory Requirement:** Transaction value equals price paid or payable plus statutory additions (§ 1401a(b)(1)), strictly excluding international transportation, insurance, and related services incident to international shipment (§ 1401a(b)(4)(A)).
- **Application Audit:**
  - Dutiable customs value is calculated as:
    $$\text{Dutiable Value} = (\text{Item Price} \times \text{Quantity}) + \text{Packing} + \text{Assists}$$
  - International shipping ($15.00) and cargo insurance are strictly excluded from dutiable value.
  - In the cotton tote bag sample ($25.00 × 10 = $250.00 FOB value, $15.00 freight, $6.00 optional insurance):
    - Dutiable Value = $250.00
    - Base Customs Duty (6.3%) = $15.75
    - Section 301 Duty (25.0%) = $25.00
    - Total Estimated Customs Duty = $40.75
    - Total Customs Fees (Postal MPF exempt) = $0.00
    - Total U.S. Landed Cost = $250.00 (goods) + $15.00 (freight) + $6.00 (insurance) + $40.75 (duties) = $311.75.
  - **Verdict:** 100% Consistent.

### 2. Commercial Invoice Total vs. PayPal Receivable under Incoterms® 2020 DAP
- **Statutory Requirement:** Under DAP, the seller delivers goods to the named destination. The U.S. buyer/importer is legally responsible for customs clearance and paying import duties to CBP. Duties must never be collected on the seller's commercial invoice or charged through seller payments.
- **Application Audit:**
  - Seller Commercial Invoice Total = $250.00 (merchandise) + $15.00 (freight) + $6.00 (insurance) = **$271.00**.
  - PayPal Order creation charges exactly **$271.00**.
  - The $40.75 in U.S. customs duties is displayed exclusively in a separate blue advisory card labeled: *"Estimated U.S. Import Costs (For Buyer Reference Only)"*.
  - **Verdict:** 100% Consistent. Prohibits double-billing and valuation distortion.

### 3. Monetary Precision & Currency Integrity
- **Statutory Requirement:** Floating-point comparison drift must not cause false payment rejection. Currency-specific decimal conventions must be respected.
- **Application Audit:**
  - `toMinorUnits()` converts amounts to integer minor units ($271.00 → 27100 cents; ¥42,500 → 42500 yen).
  - `areAmountsEqual()` verifies exact integer equality, eliminating IEEE 754 float drift.
  - `formatPayPalAmount()` formats standard currencies to 2 decimals and zero-decimal currencies (`JPY`, `HUF`, `TWD`) to integers.
  - **Verdict:** 100% Consistent.

### 4. Tariff Grounding & Seed Profiles
- **Statutory Requirement:** Tariff rates must derive exclusively from USITC 2026 Revision 22. Seed profiles must preserve genuine trade remedy and classification statuses.
- **Application Audit:**
  - All 7 authentic Indian seed profiles in `src/data/seed-products.ts` remain intact:
    1. Cotton Tote Bags (`4202.92.31.31`): 6.3% MFN + 25% Section 301.
    2. Brass Incense Burner (`7418.10.21.00`): 3.0% MFN + 25% Section 301.
    3. Sheesham Wood Coasters (`4421.99.98.80`): CITES Appendix II / 19 U.S.C. § 1484 blocker (`UNRESOLVED_AMBIGUITY`).
    4. Mulberry Silk Shawl (`6214.10.10.00`): 1.2% MFN USITC Rev 22 + 25% Section 301.
    5. Embroidered Leather Jutti (`6403.99.90.65`): 8.5% MFN + 25% Section 301.
    6. Blue Art Pottery Vase (`6912.00.44.00`): 10.0% MFN + 25% Section 301.
    7. Darjeeling Black Tea (`0902.30.00.40`): 0.0% MFN + 25% Section 301 + FDA warning (`PARTIALLY_VERIFIED`).
  - **Verdict:** 100% Consistent.

---

## 6. Database and Persistence Audit

### Persistence Architecture
- **Adapter:** Native Node.js `node:sqlite` (`DatabaseSync`) located in [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts).
- **Physical File:** `borderbrief.db` at workspace root.
- **Concurrency Mode:** WAL mode (`PRAGMA journal_mode = WAL;`) and busy timeout (`PRAGMA busy_timeout = 10000;`).
- **Data Integrity:** Foreign keys enabled (`PRAGMA foreign_keys = ON;`); atomic writes wrapped in `BEGIN IMMEDIATE;` ... `COMMIT;` blocks with automatic rollback on error.

### Lifecycle & Persistence Evaluation

| Scenario | Tested Behavior | Persistence Result | Evaluation |
|---|---|---|---|
| **Page Navigation (Internal)** | User navigates from `/export/new` to `/corridor/india-usa` and back | React state resets to Step 1 | **UI Limitation:** In-progress form state is held in client `useState`. Navigating away resets form unless already saved as draft invoice in database. |
| **Browser Refresh (`F5`)** | User hits refresh while on Step 4 or Step 5 | Form state resets to Step 1 | **UI Limitation:** Unsaved form state does not survive hard refresh. However, any invoice saved via `POST /api/invoices` remains intact in SQLite `borderbrief.db`. |
| **Application Restart** | Node process killed and restarted (`npm start`) | Database records persist | **PASS:** All persisted products, calculations, invoices, payments, and webhook logs survive process restarts on disk. |
| **Concurrent Requests** | Multiple simultaneous API calls to calculate, invoice, and payment routes | SQLite busy timeout & WAL mode | **PASS:** Handled without SQLITE_BUSY locking errors across 209 automated tests. |
| **Serverless Deployment** | Deploying application to stateless serverless platform (e.g. Vercel) | SQLite file is ephemeral | **Architectural Boundary:** SQLite is embedded. Serverless platforms require a managed database adapter (PostgreSQL / Cloud SQL). |

---

## 7. UI and User Experience Audit

### Desktop & Mobile Usability Evaluation
- **Workflow Order & Clarity:** The 5-step stepper clearly guides the user from basic product description to AI review, tariff classification, landed cost, and invoice drafting.
- **Terminology:** Customs jargon is systematically replaced or supplemented with plain-language explanations (e.g., explaining why U.S. import duties are excluded from the seller's DAP invoice).
- **Visual Separation of Duties:** The Step 5 UI places a distinct blue informational card for estimated U.S. import duties and an amber card for PayPal payment, preventing seller/buyer confusion.
- **Loading & Error States:** Clear spinners (`isAnalyzing`, `isClassifying`, `isCalculatingLandedCost`, `isProcessing`) and descriptive alert boxes for validation errors.
- **Responsive Layout:** Form inputs, summary cards, and invoice preview scale down cleanly to single-column layouts on mobile viewports.
- **Prominent Badges:** Prominent `"PAYPAL SANDBOX — TEST PAYMENT ONLY"` badges prevent accidental live payment expectations.

---

## 8. Test and Build Verification Results

Execution was conducted directly on the unmodified codebase:

```bash
# 1. Full Automated Test Suite
npm test
```
**Output:**
```
ℹ tests 211
ℹ suites 24
ℹ pass 209
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ duration_ms 1743.1ms
```
- **Skipped Test 1:** `src/tests/gemini-live.test.ts` (opt-in test when `GEMINI_API_KEY` is not present in environment).
- **Skipped Test 2:** `src/tests/paypal-integration.test.ts` (opt-in test when `RUN_LIVE_PAYPAL_TEST=true` is not set).

```bash
# 2. TypeScript Static Typing
npx tsc --noEmit
```
**Output:** Exit code 0 (0 errors across all 24 test suites and source files).

```bash
# 3. ESLint Code Quality
npm run lint
```
**Output:** Exit code 0 (0 errors, 0 warnings).

```bash
# 4. Next.js Production Build
npm run build
```
**Output:** Exit code 0. Generated all 14 routes:
- `○ /` (Static)
- `○ /_not-found` (Static)
- `○ /corridor/india-usa` (Static)
- `○ /export/new` (Static)
- `ƒ /api/invoices` (Dynamic)
- `ƒ /api/invoices/[id]` (Dynamic)
- `ƒ /api/invoices/[id]/pdf` (Dynamic)
- `ƒ /api/invoices/generate-pdf` (Dynamic)
- `ƒ /api/payments/[id]` (Dynamic)
- `ƒ /api/payments/paypal/capture-order` (Dynamic)
- `ƒ /api/payments/paypal/config` (Dynamic)
- `ƒ /api/payments/paypal/create-order` (Dynamic)
- `ƒ /api/payments/paypal/webhook` (Dynamic)
- `ƒ /api/products/analyze` (Dynamic)
- `ƒ /api/tariffs/calculate` (Dynamic)
- `ƒ /api/tariffs/classify` (Dynamic)

---

## 9. Risk Register with Severity

| Finding ID | Severity | Component & Function | Scenario | Expected Behavior | Actual Behavior | Recommended Sprint 7 Polish | Necessary for Hackathon? |
|---|---|---|---|---|---|---|---|
| **INT-01** | **MEDIUM** | `src/app/` (Navigation & Views) | User saves an invoice or completes a payment and wants to view/download it later | Frontend UI provides a list or tab of saved drafts and receipts | Backend APIs (`/api/invoices`, `/api/invoices/[id]`, `/api/invoices/[id]/pdf`) exist, but no frontend page lists saved invoices | Add a simple `/invoices` history page or "Saved Drafts" tab on `/export/new` | **Recommended** (High demo value) |
| **INT-02** | **LOW** | `src/config/modules.ts` & `src/app/page.tsx` | User reads landing page roadmap | Landing page reflects active 5-step workflow and completed Sprint 1–6 modules | Landing page roadmap still displays Sprint 1 placeholder text ("Upcoming", 4 steps) | Update `WORKFLOW_OVERVIEW_STEPS` to 5 steps and set module statuses to `ACTIVE_MODULE` | **Optional** (Copy polish) |
| **INT-03** | **LOW** | `src/app/export/new/page.tsx` | User refreshes page mid-workflow (`F5`) | Form state preserved in session or prompts before unload | React `useState` resets to Step 1 | Optionally save in-progress state to `sessionStorage` or prompt on reload | **Optional** (Minor UX convenience) |
| **INT-04** | **INFO** | `src/lib/db/database.ts` | Cloud deployment to serverless environment | Managed cloud database adapter used | Uses local SQLite file (`borderbrief.db`) | Document SQLite as the local hackathon demo persistence adapter | **No** (Local demo target) |
| **INT-05** | **INFO** | `src/lib/paypal/paypal-client.ts` | Real PayPal Sandbox transaction testing | Real Sandbox buyer account pays | Requires adding Sandbox credentials to `.env.local` | Document step-by-step Sandbox credential setup for evaluators | **No** (Mock suite covers all cases) |

---

## 10. Recommended Sprint 7 Implementation Sequence

If approved to proceed with Sprint 7, the recommended sequence of minimal, non-disruptive polish tasks is:

```
Task 1: Invoice History & Retrieval UI (/invoices)
   ├── Create lightweight page src/app/invoices/page.tsx
   ├── Fetch list from GET /api/invoices
   └── Provide direct links to view draft, download PDF, or view payment status
Task 2: Synchronize Landing Page Copy & Roadmap
   ├── Update WORKFLOW_OVERVIEW_STEPS in src/config/modules.ts to reflect 5 steps
   └── Update ARCHITECTURAL_MODULES status to COMPLETED / ACTIVE
Task 3: Client Form State Resilience (Optional)
   └── Cache active draft in sessionStorage on /export/new to survive accidental F5
Task 4: Evaluator Setup Documentation
   └── Provide a frictionless README guide with PayPal Sandbox demo instructions
```

---

## 11. Estimated Implementation Hours

| Sprint 7 Scope Item | Estimated Focused Hours |
|---|---|
| **1. Saved Invoices & Receipts UI (`/invoices`):** Lightweight table with PDF download and payment status pills | 2.5 hours |
| **2. Landing Page Copy Synchronization:** Updating `modules.ts` and `page.tsx` module badges | 0.5 hours |
| **3. Client-Side Session Storage Cache:** Caching in-progress form values on `/export/new` | 1.0 hours |
| **4. Final End-to-End Regression & Verification:** Running full test suite, lint, and build | 1.0 hours |
| **Total Estimated Sprint 7 Effort:** | **5.0 focused hours** |

---

## 12. Explicit List of Features That Must Remain Unchanged

The following core components have been thoroughly verified and **must NOT be modified** during any future sprint:

1. **Seven Authentic Indian Seed Products:** [`src/data/seed-products.ts`](file:///d:/BorderBrief%20AI/src/data/seed-products.ts) (Cotton Tote, Brass Burner, Sheesham Wood, Mulberry Silk Shawl, Leather Jutti, Blue Pottery Vase, Darjeeling Tea).
2. **Authoritative USITC Tariff Schedule Store:** [`src/lib/tariff/authoritative-store.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/authoritative-store.ts) (2026 Revision 22 grounding, official CBP rulings, Section 301 provisions).
3. **Customs Valuation Engine:** [`src/lib/tariff/landed-cost-engine.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/landed-cost-engine.ts) (19 U.S.C. § 1401a transaction value mathematics, MPF exemptions, Inbound EMS, HMF, October 22, 2026 compliance date extension to January 20, 2027, Entry Type 13 under 91 FR 66707).
4. **Classification Grounding Engine:** [`src/lib/tariff/classification-engine.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/classification-engine.ts) (GRI rule logic, Sheesham wood CITES blocker).
5. **Pure Zero-Dependency PDF 1.4 Generator:** [`src/lib/invoice/pdf-generator.ts`](file:///d:/BorderBrief%20AI/src/lib/invoice/pdf-generator.ts) (Binary PDF formatting, diagonal draft watermarks).
6. **Pure Zero-Dependency PayPal Sandbox Client:** [`src/lib/paypal/paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts) (Orders API v2, OAuth token caching, integer minor-unit arithmetic, self-healing recovery).
7. **Strict Incoterms® DAP Financial Separation:** Seller invoice total excludes U.S. import duties and fees.
8. **₹0 Budget Constraint:** No paid third-party dependencies, no paid services, no Ollama or local AI.

---

## 13. Final Readiness Assessment

- **End-to-End Workflow Status:** **FULLY OPERATIONAL**. A user can input product details, receive AI attribute extraction, verify customs classification, calculate landed cost, generate and download an export invoice PDF, and complete a verified PayPal Sandbox payment.
- **Architectural Coherence:** **EXCELLENT**. All data contracts align cleanly across all 6 sprints.
- **Remaining Material Deficiencies:** **NONE**. All critical and high-severity issues from prior audits have been completely resolved.
- **Deployment Category:** Single-user local hackathon demonstration application.

---

*Inspection complete. No source code has been altered. Sprint 7 implementation has not been started.*

