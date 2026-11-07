# BorderBrief AI — Master Research, Deep Inspection & Cloud-First Strategy

**Project Name:** BorderBrief AI  
**Tagline:** *Know the Rules. Know the Cost. Ship with Confidence.*  
**Target Corridor:** India (IN) → United States (US)  
**Budgetary Constraint:** Strict ₹0 (Zero Paid Subscriptions, Zero Credit Cards, Zero Mandatory Paid APIs)  
**Architecture Policy:** **100% Cloud-First AI.** Next.js 16, Google AI Studio (`gemini-3.8-flash`), Dual-Driver Persistence (Turso 5 GB / 100 DBs), Zero Local Model Dependencies.  
**Operational Connectivity Notice:** Offline local development does **NOT** mean offline application functionality. The application executes locally without local AI servers, but requires internet connectivity to query Google AI Studio, the USITC API, and PayPal Sandbox.  
**Research Date:** November 6, 2026  
**Project Phase:** Research & Deep Inspection (Phase Complete — Awaiting Final Implementation Approval)

---

## 1. Executive Master Summary

BorderBrief AI is an AI-powered international export-preparation and compliance intelligence platform designed specifically for small businesses, independent exporters, handicraft artisans, and small manufacturers in emerging corridors—starting with **India to the United States**.

The platform solves five critical friction points for micro-exporters:
1. **Product Understanding:** Overcoming vague descriptions through cloud multimodal AI analysis of product photographs (with mandatory server-side EXIF stripping) and plain-language descriptions.
2. **Explainable HS Classification:** Suggesting authentic Harmonized Tariff Schedule (HTS) codes with human-in-the-loop verification and transparent legal rationale (WCO General Rules of Interpretation).
3. **Statutory Tariff Intelligence:** Grounding duty rates in official US International Trade Commission (USITC) schedules with revision dates and statutory effective date checks rather than ungrounded LLM hallucinations.
4. **Deterministic Landed-Cost Calculation:** Accurately applying US customs valuation law (19 U.S.C. § 1401a transaction value principles), accounting for the suspension of general Section 321 duty-free de minimis, and computing applicable duties, taxes, and Merchandise Processing Fees (MPF).
5. **Export Documentation & Payments:** Instantly drafting export commercial invoices with Indian GST LUT declarations and enabling cross-border USD payment collection through **PayPal Orders API v2**.

---

## 2. Master Research Reports Index

All in-depth research reports are located in the [`research/`](file:///d:/BorderBrief%20AI/research) directory:

| Document | Title | Core Focus & Major Findings |
| :--- | :--- | :--- |
| [**`01_PROJECT_FEASIBILITY.md`**](file:///d:/BorderBrief%20AI/research/01_PROJECT_FEASIBILITY.md) | **Project Feasibility Study** | Stage-by-stage evaluation of the 7 core workflows; risk analysis; confirms 100% technical feasibility under a cloud-first AI + deterministic calculation model. |
| [**`02_FREE_TECH_STACK.md`**](file:///d:/BorderBrief%20AI/research/02_FREE_TECH_STACK.md) | **Cloud-First Zero-Cost Stack & Provider Audit** | Audits cloud AI providers; documents Gemini 3.8 Flash baseline; clarifies Turso Free Starter limits (5 GB storage, 100 databases); removes Groq as mandatory backup; dual-mode persistence architecture. |
| [**`03_CUSTOMS_AND_TARIFF_RESEARCH.md`**](file:///d:/BorderBrief%20AI/research/03_CUSTOMS_AND_TARIFF_RESEARCH.md) | **Customs, Tariff & Regulatory Intelligence** | Live verification of USITC HTS REST API; official USITC 2026 HTS Rev 22 baseline (Oct 30, 2026); documents India GSP termination (Proclamation 9902) & GSP statutory expiration (Dec 31, 2020); documents 19 U.S.C. § 1401a transaction value principles, suspension of general Section 321 de minimis, and FY2027 MPF schedule (91 FR 48398). |
| [**`04_AI_AND_HS_CLASSIFICATION.md`**](file:///d:/BorderBrief%20AI/research/04_AI_AND_HS_CLASSIFICATION.md) | **Cloud-First AI & Grounded HS Classification** | Design of the 3-tier grounded pipeline; cloud multimodal extraction with `gemini-3.8-flash`; clarification that schema enforcement guarantees structure, not factual truth; calibrated 15s timeouts; mandatory human verification. |
| [**`05_SYSTEM_ARCHITECTURE.md`**](file:///d:/BorderBrief%20AI/research/05_SYSTEM_ARCHITECTURE.md) | **Technical System Architecture** | Unified Next.js 16 App Router monolith with Turbopack; serverless-safe persistent idempotency via database table; statutory boundary freshness rules; Mermaid diagrams and SQL DDL. |
| [**`06_UI_UX_BLUEPRINT.md`**](file:///d:/BorderBrief%20AI/research/06_UI_UX_BLUEPRINT.md) | **UI/UX Blueprint & Design System** | Detailed screen-by-screen specification tailored for non-technical artisans; 5-step guided stepper; transparent financial ledger; accessible shadcn/ui and Tailwind components. |
| [**`07_PAYPAL_INTEGRATION.md`**](file:///d:/BorderBrief%20AI/research/07_PAYPAL_INTEGRATION.md) | **PayPal Orders API v2 Integration** | Complete lifecycle for international USD payment collection in Sandbox; server-side order creation, `@paypal/react-paypal-js` button integration, capture verification, and webhook signature verification (`v1/notifications/verify-webhook-signature`). |
| [**`08_SECURITY_AND_TESTING.md`**](file:///d:/BorderBrief%20AI/research/08_SECURITY_AND_TESTING.md) | **Security, Privacy & Freshness Controls** | 6-layer defense-in-depth model; server-side magic bytes validation & binary EXIF stripping; PII blacklist; statutory tariff revision boundary checks; unit testing matrix; 7-item synthetic dataset. |
| [**`09_HACKATHON_MVP_ROADMAP.md`**](file:///d:/BorderBrief%20AI/research/09_HACKATHON_MVP_ROADMAP.md) | **Hackathon MVP Roadmap & Strategy** | MoSCoW prioritization (Must-Have vs Should-Have vs Future Scope); 5-sprint engineering breakdown; 3-minute live pitch script designed for PayPal hackathon judges. |
| [**`10_FINAL_ARCHITECT_RECOMMENDATION.md`**](file:///d:/BorderBrief%20AI/research/10_FINAL_ARCHITECT_RECOMMENDATION.md) | **Final Architect Recommendation** | Synthesis of final Next.js 16 Cloud-First stack; justification of selected technologies; detailed breakdown of rejected alternatives; ₹0 cost audit; concise final architecture approval checklist. |

---

## 3. Top Breakthrough Findings of the Final Audit Phase

1. **Active Baseline Realignment (`gemini-3.8-flash`):** Uses Google's active Flash-class model in the Gemini Developer API catalog. Free tier quotas are project-specific (verified in the developer console), operating at **₹0 cost without a credit card**.
2. **Groq Removed as Mandatory Backup:** Multimodal models on Groq carry commercial pay-as-you-go pricing ($0.80/M input, $4.00/M output) and unverified free quotas. To strictly preserve the ₹0 development cost guarantee, Groq is treated strictly as an optional user-provided extension rather than a required dependency.
3. **Calibrated 15-Second Multimodal Timeout:** Discards premature 5-second abort timeouts. Based on empirical vision token ingestion and network transport profiles, the system enforces a 15-second timeout with visual UI progress updates.
4. **Serverless-Safe Persistent Idempotency:** Replaces in-memory caches (which fail across ephemeral serverless microVMs) with an atomic database `idempotency_keys` table.
5. **Server-Side Binary EXIF Stripping:** Validates magic bytes and strips `APP1` EXIF segments on the server, guaranteeing that GPS coordinates, device serial numbers, and metadata are never leaked to cloud AI APIs.
6. **Statutory Tariff Freshness Boundaries:** Abandons arbitrary "30-day freshness" rules. Customs data is bound to official USITC revision identifiers (2026 Basic Edition) and statutory effective date ranges, displaying prominent unconfirmed baseline warnings whenever live API calls time out.
7. **Accurate Turso Free Starter Figures:** Aligned persistence documentation to official limits: **5 GB storage, 100 databases**, 500M row reads/mo, and 10M row writes/mo at ₹0 cost without a credit card.
8. **Operational Connectivity Clarity:** Clarifies that offline local development refers to zero local AI server requirements; the application requires internet connectivity to reach Google AI Studio, USITC, and PayPal Sandbox.

---

## 4. Current State & Decision Rule Compliance

- **Current State:** Final audit corrections, model lifecycle auditing, statutory analysis, and architecture specifications are complete.
- **Rules Compliance:**
  - No application code has been written.
  - No npm packages have been installed.
  - No build frameworks have been initialized.
  - No project configurations have been modified.
- **Next Phase:** Awaiting explicit user approval of the final architecture checklist.
