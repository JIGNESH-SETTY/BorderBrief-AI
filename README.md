# BorderBrief AI

> **Know the Rules. Know the Cost. Ship with Confidence.**

BorderBrief AI is a cloud-first, AI-powered export preparation platform built specifically for small businesses, independent exporters, handicraft artisans, and micro-manufacturers in India shipping goods to the United States.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Target Trade Corridor (India → USA)](#target-trade-corridor-india--usa)
- [Key Features](#key-features)
- [Five-Step Export Workflow](#five-step-export-workflow)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Deterministic Demo Mode & Fallbacks](#deterministic-demo-mode--fallbacks)
- [Verification & Quality Gates](#verification--quality-gates)
- [Trade Compliance & Statutory Disclaimer](#trade-compliance--statutory-disclaimer)
- [Security & Deployment Limitations](#security--deployment-limitations)
- [Current Project Limitations](#current-project-limitations)
- [License](#license)

---

## Problem Statement

Small Indian businesses and handicraft artisans face immense barriers when selling directly to overseas buyers in the United States. Navigating cross-border trade involves:
- Complex Harmonized Tariff Schedule (HTS) classification codes.
- Opaque U.S. customs valuation statutes and import duty assessments.
- The sudden suspension of duty-free de minimis treatment under Section 321.
- Ineligibility for Generalized System of Preferences (GSP) duty-free benefits.
- Fear of unexpected landed costs, fines, or rejected shipments upon arrival.
- Difficulty drafting legally compliant commercial export invoices under Incoterms® 2020.

BorderBrief AI solves this by automating product attribute extraction via Cloud AI, performing deterministic statutory landed-cost math, generating draft commercial invoices, and providing verified PayPal Sandbox payment collection—**all with zero customs jargon required**.

---

## Target Trade Corridor (India → USA)

BorderBrief AI focuses on the **India (IN) to United States (US)** export trade corridor, strictly grounded in current statutory trade law:

1. **U.S. Customs Valuation (19 U.S.C. § 1401a):**  
   The primary valuation method is **Transaction Value** (the price actually paid or payable for the goods when sold for exportation to the U.S.). Under **19 U.S.C. § 1401a(b)(4)(A)**, international transportation, freight, and cargo insurance charges are legally deductible from the customs dutiable value when separately itemized.
2. **Suspension of General Section 321 De Minimis (August 29, 2025):**  
   General duty-free entry for commercial shipments valued under $800 was suspended effective August 29, 2025. BorderBrief AI does not assume zero duty or zero Merchandise Processing Fee (MPF) for low-value shipments.
3. **GSP Ineligibility & Column 1 General Rates:**  
   India's GSP beneficiary designation was terminated on June 5, 2019 (Presidential Proclamation 9902), and the entire U.S. GSP statutory authorization expired on December 31, 2020. Indian merchandise enters under standard Column 1 General (Most-Favored-Nation) tariff rates.
4. **Authoritative Schedule Baseline:**  
   Tariff classifications and rates are grounded in the official **USITC 2026 Harmonized Tariff Schedule (HTS) Revision 22** (published October 30, 2026).
5. **Indian Export Formalities:**  
   Invoices incorporate Indian GST Letter of Undertaking (LUT) zero-rated export declarations (Section 16, IGST Act 2017) and DGFT Importer-Exporter Code (IEC) references.

---

## Key Features

- **Multimodal Cloud AI Product Understanding:** Extracts physical composition, materials, and intended use from descriptions and photos using Google Gemini 3.8 Flash.
- **Deterministic Offline Demo Fallback:** Operates with 100% functionality without internet or API keys using authentic seed profiles.
- **Authoritative Tariff Grounding:** Maps products to 10-digit HTS codes using World Customs Organization (WCO) General Rules of Interpretation (GRI 1, 3, 6) and official CBP CROSS rulings.
- **Deterministic Landed-Cost Calculator:** Computes ad valorem customs duties, Section 301 tariffs, ad valorem Merchandise Processing Fees (MPF), Harbor Maintenance Fees (HMF), and postal Entry Type 13 compliance (CBP Documents 2026-21600 & 2026-21570).
- **Incoterms® 2020 DAP Financial Separation:** Strictly separates seller commercial receivables from buyer import obligations payable upon arrival to U.S. Customs.
- **Export Commercial Invoice Drafting:** Formats compliant draft invoices with statutory non-declaration disclaimers and LUT export notes.
- **Pure JavaScript Binary PDF Export:** Generates downloadable, print-ready PDF commercial invoices without third-party binary dependencies.
- **Saved Invoices & Payment Receipts Dashboard (`/invoices`):** Real-time text search, invoice preview modal, direct PDF downloads, and verified payment receipt inspection.
- **Official PayPal Orders API v2 Sandbox Checkout:** Complete buyer checkout flow with server-side capture verification, webhook signature validation, and terminal state preservation.
- **Session Continuity & Safe Draft Recovery:** Recovers in-progress form entries across accidental browser reloads (`F5`) via `sessionStorage` (`borderbrief_export_draft_v1`).

---

## Five-Step Export Workflow

```
[ Step 1: Intake ] ──> [ Step 2: AI Analysis ] ──> [ Step 3: Customs Grounding ] ──> [ Step 4: Landed Cost ] ──> [ Step 5: Invoice & Checkout ]
  - Product Details      - Gemini Attribute           - USITC Rev 22 Schedule          - 19 U.S.C. § 1401a Math      - Incoterms 2020 DAP Draft
  - Photo Upload           Extraction                 - WCO GRI 1/3/6 Rationale        - Section 301 & MPF Fees      - Binary PDF Generation
  - 7 Seed Quick-Fills   - Seller Confirmation        - CBP CROSS Rulings              - Postal Entry Type 13        - PayPal Sandbox Checkout
```

1. **Step 1 — Product Details:** Enter title, description, materials, use, selling price, and freight. Quick-fill buttons load authentic Indian artisan seed profiles.
2. **Step 2 — AI Product Analysis:** Gemini Cloud AI extracts physical attributes and intended use. The exporter reviews and confirms the findings.
3. **Step 3 — Customs Grounding:** Candidate HTS codes are evaluated against official USITC schedules. Ambiguities trigger targeted classification prompts.
4. **Step 4 — Landed Cost Math:** Transaction value is calculated. Duties, fees, and postal clearance procedures are computed with clear DAP responsibility separation.
5. **Step 5 — Export Documents & Payments:** A draft commercial invoice is generated with legal notices. Exporters can save the invoice, download a PDF, and launch PayPal Sandbox checkout.

---

## Technology Stack

- **Web Framework:** [Next.js](https://nextjs.org/) 16.4.5 (App Router, Turbopack)
- **Runtime Environment:** [Node.js](https://nodejs.org/) (v20+ / tested on v24.22.1)
- **Language:** [TypeScript](https://www.typescriptlang.org/) 5.7.3
- **Styling & UI Components:** [Tailwind CSS](https://tailwindcss.com/) 3.4.17, [Lucide React](https://lucide.dev/) 0.475.0, Radix UI primitive patterns
- **Database Layer:** SQLite via Node.js native `node:sqlite` driver with WAL mode and `PRAGMA busy_timeout = 10000`
- **Image Sanitization:** [Sharp](https://sharp.pixelplumbing.com/) 0.35.5 (EXIF metadata stripping and malicious payload rejection)
- **Cloud AI SDK:** `@google/genai` (Official Google Gen AI SDK for Gemini 3.8 Flash)
- **Payment API:** Official PayPal Orders API v2 (Sandbox mode)
- **Test Runner:** Native Node.js test runner (`node:test`, `node:assert/strict`)

---

## Architecture Overview

```
borderbrief-ai/
├── src/
│   ├── app/                                # Next.js App Router (17 Routes)
│   │   ├── page.tsx                        # Landing Page
│   │   ├── layout.tsx                      # Root Layout & Global Navigation
│   │   ├── corridor/india-usa/page.tsx     # Regulatory Corridor Guide
│   │   ├── export/new/page.tsx             # 5-Step Export Assessment Workflow
│   │   ├── invoices/page.tsx               # Saved Invoices & Receipts Dashboard
│   │   └── api/                            # 12 Backend API Route Handlers
│   │       ├── products/analyze/           # Gemini AI extraction & demo fallback
│   │       ├── tariffs/classify/           # HTS classification route
│   │       ├── tariffs/calculate/          # Landed-cost calculation route
│   │       ├── invoices/                   # Invoice list, item, and PDF download
│   │       └── payments/                   # PayPal orders, capture, and webhooks
│   ├── components/                         # Modular UI Components
│   │   ├── features/                       # Workflow stepper, module cards, corridor badge
│   │   ├── invoice/                        # Commercial invoice preview component
│   │   ├── payment/                        # PayPal Sandbox checkout component
│   │   └── ui/                             # Buttons, cards, badges, dialogs
│   ├── config/                             # Trade corridor and module configurations
│   ├── data/                               # 7 Authentic Indian seed export profiles
│   ├── lib/                                # Domain Engines & Business Logic
│   │   ├── db/database.ts                  # SQLite database persistence & migrations
│   │   ├── invoice/invoice-engine.ts       # Incoterms 2020 DAP invoice builder
│   │   ├── invoice/pdf-generator.ts        # Pure JS binary PDF generator
│   │   ├── paypal/paypal-client.ts         # PayPal Orders API v2 client & currency math
│   │   ├── security/image-sanitizer.ts     # Sharp-based image validation
│   │   ├── services/gemini-service.ts      # Google Gen AI Gemini 3.8 Flash service
│   │   ├── tariff/authoritative-store.ts   # USITC 2026 Revision 22 tariff store
│   │   ├── tariff/classification-engine.ts # WCO GRI classification engine
│   │   └── tariff/landed-cost-engine.ts    # 19 U.S.C. § 1401a valuation & duty engine
│   ├── tests/                              # 29 Automated Test Suites (224 tests)
│   └── types/                              # Domain TypeScript interfaces
├── .env.example                            # Example environment variables template
├── .gitignore                              # Git exclusion rules (includes *.db)
└── package.json                            # Scripts and dependencies
```

---

## Getting Started

### Prerequisites

- **Node.js:** v20.0.0 or higher (Node.js v24.22.1 recommended)
- **npm:** v10.0.0 or higher
- **Operating System:** Windows, macOS, or Linux

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd borderbrief-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Copy the `.env.example` template to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your environment variables in `.env.local`:

```env
# Google AI Studio Gemini API Key (Optional; demo mode engages automatically if absent)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash

# Environment Mode
NODE_ENV=development

# PayPal Sandbox Credentials (Optional; required only for interactive Sandbox buttons)
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=your_paypal_sandbox_webhook_id_here
```

> **Security Note:** `.env.local` is excluded by `.gitignore` and must **never** be committed to version control.

### Running the Application

1. **Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

2. **Production Build & Execution:**
   ```bash
   npm run build
   npm run start
   ```

---

## Deterministic Demo Mode & Fallbacks

BorderBrief AI guarantees ₹0 development cost and full presentation reliability through an automated **deterministic demo mode**:

- If `GEMINI_API_KEY` is not provided in `.env.local`, the server automatically falls back to deterministic extraction matching authentic Indian export merchandise:
  1. Brass Statuette (Moradabad brass craft)
  2. Silk Shawl (Kashmir silk weave)
  3. Darjeeling Tea (Single-estate black tea)
  4. Leather Messenger Bag (Kanpur full-grain leather)
  5. Cotton Canvas Tote Bag (Handcrafted textile)
  6. Ceramic Glazed Mug (Khurja studio pottery)
  7. Wooden Inlay Coasters (Saharanpur sheesham wood)
- If PayPal Sandbox credentials are absent, the application renders a setup guidance card explaining the free credential generation process while allowing full testing of commercial invoice generation and PDF exports.

---

## Verification & Quality Gates

The codebase enforces strict quality gates verified by independent test runners:

| Quality Gate | Shell Command | Verified Result |
| :--- | :--- | :--- |
| **Unit & Integration Tests** | `npm test` | **222 passed, 2 skipped, 0 failed** (224 tests across 29 suites) |
| **TypeScript Compilation** | `npx tsc --noEmit` | **0 diagnostic errors** (exit code 0) |
| **ESLint Static Analysis** | `npm run lint` | **0 errors, 0 warnings** (exit code 0) |
| **Next.js Production Build** | `npm run build` | **17 routes compiled cleanly** with Turbopack (exit code 0) |

*Note on Skipped Tests:* Exactly 2 tests are skipped by default (`src/tests/gemini-live.test.ts` and `src/tests/paypal-integration.test.ts`). These are opt-in live network tests requiring configured external API credentials (`RUN_LIVE_GEMINI_TEST=true` or `RUN_LIVE_PAYPAL_TEST=true`).

---

## Trade Compliance & Statutory Disclaimer

> **IMPORTANT STATUTORY NOTICE (19 U.S.C. § 1484):**  
> BorderBrief AI provides trade preparation decision-support information. Tariff classifications (HTS codes), duty rates, taxes, customs fees, and landed-cost calculations are deterministic compliance estimates based on official USITC and CBP data.
>
> Under United States customs law (**19 U.S.C. § 1484**), the legal obligation to exercise reasonable care in declaring merchandise classification, customs valuation, and duty payment upon commercial entry rests exclusively with the **U.S. Importer of Record**. BorderBrief AI does not act as a licensed customs broker, legal advisor, or freight forwarder. Exporters must independently verify all tariff classifications, valuation additions/deductions, and import requirements with U.S. Customs and Border Protection (CBP) or qualified customs legal counsel.

---

## Security & Deployment Limitations

- **Single-User Demonstration Prototype:** The current application is designed and configured as an unauthenticated single-user local prototype for hackathon evaluation and demonstration.
- **No Authentication Boundary:** The 12 API endpoints (`/api/invoices`, `/api/payments/[id]`, etc.) do not enforce session authentication or user authorization checks. The response header `X-BorderBrief-Auth-Mode: single-user-demo-unauthenticated` discloses this architecture.
- **Public Internet Deployment Gate:** **Do not deploy this application to a public, multi-tenant cloud environment without adding an authentication layer** (e.g. NextAuth, Auth0), row-level tenant isolation, and CSRF protection on mutation endpoints.

---

## Current Project Limitations

1. **Trade Corridor Scope:** Configured exclusively for exports from **India (IN)** to the **United States (US)**.
2. **Transaction Currency:** Financial transactions and invoice calculations are denominated in **USD ($)**.
3. **Session Draft Scope:** Form draft recovery is scoped to the active browser tab via `sessionStorage`. Uploaded photo binary streams cannot be serialized to browser storage and must be reselected upon a cold tab restart.
4. **Local SQLite Persistence:** Invoices and payment records are saved in local SQLite (`borderbrief.db`). Distributed clustering across serverless regions is not configured.

---

## License

No license has been specified yet. All rights reserved.

