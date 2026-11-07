# BorderBrief AI — Sprint 4 Implementation Report
## Deterministic Landed-Cost Calculator (India → United States Trade Corridor)

**Date:** November 7, 2026  
**Status:** COMPLETE, AUDITED & REMEDIATED (CONDITIONAL PASS — STATUTORY ENGINE VERIFIED WITH DOCUMENTED UNRESOLVED ITEMS)  
**Corridor:** India (IN) → United States (US)  
**Valuation Statutory Basis:** 19 U.S.C. § 1401a (Tariff Act of 1930)  
**Tariff Schedule Baseline:** USITC 2026 HTS Revision 22 (October 30, 2026)  
**Trade Remedy Baseline:** USTR Federal Register Doc. 2026-15181 (July 2026 Section 301, Heading 9903.05.44)  
**User Fee Schedules:** FY2027 Merchandise Processing Fee (91 FR 48398; 19 C.F.R. § 24.23) & Harbor Maintenance Fee (19 C.F.R. § 24.24)  
**Postal Regulatory Authority:** 19 C.F.R. Part 145, 19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), 85 FR 47018, & CBP Final Rule 91 FR 37801 (Doc. 2026-12669)  

---

## 1. Executive Summary

Sprint 4 of BorderBrief AI implements a fully deterministic, explainable, and authoritative landed-cost calculator for small Indian exporters shipping merchandise to the United States. 

### Core Architectural Guarantees:
1. **Zero AI in the Math Loop:** Artificial intelligence is strictly prohibited from inventing tariff rates, guessing percentages, or computing arithmetic. All duty rates, user fee clamps, and valuation adjustments are derived through pure TypeScript functions referencing authoritative statutory stores and Federal Register schedules.
2. **Statutory Transaction Valuation (19 U.S.C. § 1401a):** Dutiable customs value is determined pursuant to 19 U.S.C. § 1401a(a)(1) (Transaction Value / Price Actually Paid or Payable). Under § 1401a(b)(4)(A), international freight and transit insurance deductions are strictly excluded from dutiable value **only when supported by actual carrier documentation**. If freight is undocumented, deductions are refused, customs duties are assessed on the unadjusted gross price, and the calculation status transitions to `PARTIALLY_VERIFIED` with visible advisory warnings.
3. **Itemized Tariff Breakdown (No Hardcoded Combined Rates):** Column 1 General MFN base duties (USITC 2026 Revision 22) and Section 301 duties (USTR Doc. 2026-15181, Heading `9903.05.44` at 10.0%) are computed and displayed as separate, itemized line items with their respective statutory citations. Combined percentages are strictly prohibited in calculation logic.
4. **Strict 4-State Status State Machine:** The calculator implements a strict 4-state status contract (`VERIFIED`, `PARTIALLY_VERIFIED`, `ESTIMATED`, `BLOCKED`). Ambiguous products (such as Sheesham wood coasters without botanical/tropical classification resolution, or generic ceramic mugs with unverified body composition) return HTTP 422 `BLOCKED` (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`). Products with unverified agricultural exemptions (e.g., Darjeeling tea Chapter 09 review) return `PARTIALLY_VERIFIED` with explicit bounding scenarios (0.0% if exempt vs. 10.0% if subject).
5. **Commercial DAP Allocation (Incoterms® 2020):** The system partitions financial responsibilities under DAP terms:
   - **Seller Collected via PayPal / Invoice:** Merchandise Price + Agreed International Shipping.
   - **US Buyer Payable Upon Arrival to CBP:** Customs Duties (Base + Sec 301) + Customs User Fees (MPF + HMF).
6. **Production Persistence & Idempotency:** Full SQLite persistence via Node.js native `node:sqlite` (`borderbrief.db`), supporting request deduplication via `x-idempotency-key` and persistence across all 8 tables defined in `src/lib/db/schema.ts`.
7. **Statutory Reasonable Care Notice:** Prominently attributes legal compliance and payment obligations under 19 U.S.C. § 1484 to the U.S. Importer of Record.

---

## 2. Statutory & Regulatory Sources Grounding

| Statutory Domain | Primary Authority | Operational Implementation in Engine |
| :--- | :--- | :--- |
| **Customs Valuation** | 19 U.S.C. § 1401a | `calculateCustomsValuation()` computes Price Actually Paid or Payable (PAPP), adds statutory additions (§ 1401a(b)(1)), and applies § 1401a(b)(4)(A) documented freight exclusions. |
| **Freight Deductions** | 19 U.S.C. § 1401a(b)(4)(A) | Documented freight is deducted. Undocumented freight is refused (`shippingDeducted = 0`), assessed on gross value, and flagged as `TRANSACTION_VALUE_UNDOCUMENTED_DEDUCTION`. |
| **Base Customs Duties** | USITC 2026 HTS Rev. 22 | `calculateDutyComponents()` fetches Column 1 General MFN rates from `src/lib/tariff/authoritative-store.ts`. Throws `DATASET_COVERAGE_UNSUPPORTED` for uncataloged lines. |
| **Section 301 Duties** | USTR Doc. 2026-15181 / CSMS #69326983 | `evaluateSection301Duty()` applies 10.0% additional duty under Heading `9903.05.44` for verified Indian goods. Checks Annex I & Annex II Part A exemption schedules. |
| **Merchandise Processing Fee** | 19 C.F.R. § 24.23 / 91 FR 48398 | FY2027 Schedule: Informal automated flat fee ($2.77), manual ($8.30), CBP prep ($12.45). Formal ad valorem (0.3464%) clamped between statutory min ($34.58) and max ($670.86). |
| **Express Hub / ECCF Fee** | 19 C.F.R. § 24.23(b)(4) | $1.38 reimbursable courier fee per individual waybill; exempts qualifying informal entries from standard informal MPF under § 24.23(b)(2)(i). |
| **Harbor Maintenance Fee** | 26 U.S.C. § 4461 / 19 C.F.R. § 24.24 | 0.125% ad valorem assessed on waterborne cargo (`OCEAN_FCL`, `OCEAN_LCL`). Statutorily exempt for `AIR_CARGO`, `AIR_EXPRESS`, `POSTAL`, and informal ocean entries under § 24.24(d)(3)(i). |
| **Reasonable Care** | 19 U.S.C. § 1484 | Mandatory advisory notice informing Indian exporters that legal liability for declaration and duty payment rests with the U.S. Importer of Record. |

---

## 3. Core Engine Architecture (`src/lib/tariff/landed-cost-engine.ts`)

The landed-cost engine is structured into five pure functional components and a master dispatcher:

```
                          [LandedCostCalculationRequest]
                                        │
                                        ▼
                   ┌───────────────────────────────────────────┐
                   │        1. Input & Corridor Guard          │
                   │  - IN -> US corridor enforcement          │
                   │  - Quantity > 0, Price > 0                │
                   │  - Ambiguity Guard (throws if UNRESOLVED) │
                   └───────────────────────────────────────────┘
                                        │
                                        ▼
                   ┌───────────────────────────────────────────┐
                   │    2. Customs Valuation (19 USC § 1401a)  │
                   │  - Gross invoice price (goods + shipping) │
                   │  - § 1401a(b)(4)(A) documented freight    │
                   │  - Refusal of undocumented freight        │
                   └───────────────────────────────────────────┘
                                        │
                                        ▼
                   ┌───────────────────────────────────────────┐
                   │  3. Duty Engine (USITC Rev 22 + Sec 301)  │
                   │  - Base Duty: Column 1 General            │
                   │  - Sec 301: 10.0% (Heading 9903.05.44)    │
                   │  - Annex I & Annex II Part A check        │
                   └───────────────────────────────────────────┘
                                        │
                                        ▼
                   ┌───────────────────────────────────────────┐
                   │    4. User Fees Engine (19 CFR § 24)      │
                   │  - MPF: Informal ($2.77) vs Formal Clamp  │
                   │  - ECCF Hub: $1.38 fee & MPF exemption    │
                   │  - HMF: 0.125% ocean / § 24.24(d)(3)(i)   │
                   └───────────────────────────────────────────┘
                                        │
                                        ▼
                   ┌───────────────────────────────────────────┐
                   │    5. DAP Partitioning & State Machine    │
                   │  - Seller PayPal vs Buyer Port payable    │
                   │  - Status: VERIFIED / PARTIALLY_VERIFIED  │
                   │  - Scenario bounds generation             │
                   └───────────────────────────────────────────┘
                                        │
                                        ▼
                          [LandedCostCalculationResult]
```

### Ambiguity & Edge Case Treatment:
1. **Hand-Carved Sheesham Wood Coasters:** Coasters possess competing subheadings `4419.20.90.00` (tropical wood, 3.2%) and `4419.90.91.00` (other wood, 3.2%). Because Dalbergia sissoo classification under Chapter 44 definitions remains disputed, passing `classificationStatus: "UNRESOLVED_AMBIGUITY"` strictly throws a `LandedCostCalculationError` with code `CLASSIFICATION_AMBIGUITY_UNRESOLVED` and HTTP 422 status.
2. **Generic Ceramic Mug:** Generic ceramic tableware without verified water absorption tests (stoneware `6912.00.44.00` at 10.0% vs porcelain `6911.10.45.00` at 14.0%) produces `CLASSIFICATION_AMBIGUITY_UNRESOLVED` and blocks calculation.
3. **Darjeeling Black Tea (0902.30.00.90):** Base duty is 0.0% (Free). Because Annex II Part A agricultural exclusion status is unverified in primary legal publications, the engine marks Section 301 exemption status as `UNRESOLVED`, transitions calculation status to `PARTIALLY_VERIFIED`, and generates explicit scenario bounds:
   - *Scenario A:* Confirmed Annex II exclusion: Total duty rate 0.0%.
   - *Scenario B:* Covered under Heading 9903.05.44: Total duty rate 10.0%.
4. **Undocumented Freight:** If `isShippingDocumented` is `false`, the freight deduction is refused. Dutiable customs value equals the full gross price, status becomes `PARTIALLY_VERIFIED`, and advisory warnings are attached.

---

## 4. DAP Commercial Allocation (Incoterms® 2020)

To resolve confusion among small Indian exporters selling to US retail customers, the engine partitions costs under Incoterms® 2020 DAP (Delivered at Place):

$$ \text{Total Delivered Landed Cost} = \text{Seller Collected (PayPal)} + \text{Buyer Payable (CBP)} $$

Where:
- $\text{Seller Collected} = \text{Merchandise Value} + \text{Agreed International Carriage}$
- $\text{Buyer Payable} = \text{Base Customs Duty} + \text{Section 301 Duty} + \text{MPF} + \text{HMF} + \text{Courier Disbursement Fee}$

This prevents disputes where US buyers reject deliveries upon being billed unexpected customs user fees and Section 301 trade remedies.

---

## 5. Persistence & Idempotency Architecture (`src/lib/db/database.ts`)

- **Built-in Engine:** Node.js native `node:sqlite` (`DatabaseSync`), requiring zero external npm dependencies or native compilation toolchains.
- **Auto-Initialization:** The database initializes and maintains all 8 relational tables defined in `src/lib/db/schema.ts` (`idempotency_keys`, `products`, `classifications`, `tariff_cache`, `landed_cost_calculations`, `invoices`, `paypal_orders`, `webhook_logs`).
- **Serverless-Safe Idempotency:** The `x-idempotency-key` HTTP header deduplicates duplicate requests atomically in SQLite with configurable TTLs, caching responses and returning `X-Idempotency-Cached: true` for duplicate submissions.
- **Relational Integrity:** Landed cost records auto-link to parent product records in the `products` table, ensuring foreign key consistency.

---

## 6. API Route Specification (`POST /api/tariffs/calculate`)

### Endpoint:
`POST /api/tariffs/calculate`

### Request Headers:
- `Content-Type: application/json`
- `x-idempotency-key: string` *(Optional, recommended for network resilience)*

### Request Payload (`LandedCostCalculationRequest`):
```json
{
  "productTitle": "Handcrafted Cotton Canvas Tote Bag",
  "hts10": "4202.92.15.00",
  "quantity": 50,
  "unitPriceUSD": 20.00,
  "shippingCostUSD": 100.00,
  "isShippingDocumented": true,
  "transportationMode": "AIR_CARGO",
  "isQualifyingEccfOrHub": false,
  "originCountry": "IN",
  "destinationCountry": "US"
}
```

### Response Status Codes:
- `200 OK`: Successful calculation with complete itemized breakdown and DAP allocation.
- `400 Bad Request`: Missing title, invalid quantity/price, negative shipping, or unsupported trade corridor.
- `409 Conflict`: Concurrent request with the same idempotency key in progress.
- `422 Unprocessable Entity`: Classification ambiguity unresolved (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`) or HTS code outside curated dataset (`DATASET_COVERAGE_UNSUPPORTED`).
- `500 Internal Server Error`: Unexpected runtime failure.

---

## 7. User Interface Implementation (`src/app/export/new/page.tsx`)

Step 4 ("Landed Cost & Duties") has been implemented in the export workflow stepper:
1. **Interactive Controls:**
   - Real-time adjustment of export quantity, unit price, and shipping cost.
   - Freight documentation evidentiary checkbox with statutory 19 U.S.C. § 1401a(b)(4)(A) notice.
   - Transportation mode selector (`AIR_CARGO`, `AIR_EXPRESS`, `OCEAN_FCL`, `OCEAN_LCL`, `POSTAL`).
   - Qualifying ECCF Hub facility checkbox (19 C.F.R. § 24.23(b)(4)).
   - Recalculate button triggering `/api/tariffs/calculate`.
2. **Visual Presentation:**
   - 4-State Status Badge (`VERIFIED`, `PARTIALLY_VERIFIED`, `ESTIMATED`, `BLOCKED`).
   - High-level metric cards: Dutiable Value, Total Duties, User Fees, Total Landed Cost.
   - DAP Commercial Split: Two-column visual card comparing Exporter PayPal collection vs US Buyer Port payable.
   - Itemized Duty Breakdown (Base Duty + Section 301 Duty with Chapter 99 headings and exemption audit notes).
   - Itemized User Fees Breakdown (MPF with statutory minimum/maximum clamps + HMF with ocean/air exemptions).
   - Scenario Bounds (for Darjeeling tea or unverified agricultural lines).
   - Actionable block alerts with navigation back to Step 3 for ambiguous classifications.
   - Statutory 19 U.S.C. § 1484 Importer of Record notice.

---

## 8. Verification & Test Suite Results

The automated test suite verifies all valuation, duty, fee, status, route, and database operations including DEF-01 to DEF-05 remediations.

```
Total Test Suites: 18
Total Tests:       136
Passing:           135
Failing:           0
Skipped:           1 (Live Gemini Studio Opt-In)
Duration:          1.36s
```

### Test Suites Summary:
- `src/tests/landed-cost-calculator.test.ts` (31 tests):
  - Customs valuation PAPP, documented freight deduction, undocumented freight refusal.
  - Valuation conservative scenario labeling (`CONSERVATIVE_ILLUSTRATIVE_GROSS`) and missing documentation tracking.
  - Documented vs undocumented transit insurance handling.
  - Base duties on cotton tote (6.3%), brass statue (0.0%), ceramic mug (10.0%), leather wallet (8.0%), silk scarf (1.2%), loose tea (0.0%).
  - Unsupported HTS code rejection (`DATASET_COVERAGE_UNSUPPORTED`).
  - Section 301 10.0% duty, Darjeeling tea scenario bounds, non-Indian origin exemption.
  - MPF statutory minimum ($34.58) and maximum ($670.86) clamps, informal automated fee ($2.77), ECCF hub fee ($1.38) and MPF exemption.
  - Manual MPF tiers ($8.30 informal manual not CBP, $12.45 informal manual CBP prep, $4.15 formal manual surcharge).
  - Inbound EMS fee under 19 C.F.R. § 24.22(l)(1)(i) ($1.00 separate item fee, USPS 50% retention / 50% CBP remittance) and formal MPF exception under 85 FR 47018.
  - Postal entry rules under 19 C.F.R. Part 145 and CBP final rule 91 FR 37801 (mandatory formal entry for Section 301 goods).
  - Complete landed cost for Hand-Woven Mulberry Silk Shawl / Scarf at 1.2% base rate + 10.0% Section 301 (total 11.2%).
  - Seed inventory reconciliation for all 7 authentic Indian seed profiles with exact IDs and titles from `seed-products.ts`.
  - Postal MPF: Ordinary mail exemption ($0.00 MPF) under 19 C.F.R. § 24.23(c)(1)(v), Inbound EMS formal entry exception (85 FR 47018), Inbound EMS informal exemption, and unconfirmed postal treatment (`UNRESOLVED`).
  - HMF ocean assessment (0.125%), air/postal exemption ($0.00), informal ocean exemption ($0.00).
  - DAP responsibility allocation and Sheesham coaster blocking.
- `src/tests/calculate-route.test.ts` (8 tests):
  - HTTP 200 on valid calculation, DAP allocation verification.
  - HTTP 400 validation for missing title, missing HTS code, negative prices, unsupported corridor.
  - HTTP 422 for unresolved ambiguity (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`) and uncataloged HTS codes.
  - Idempotency deduplication with `X-Idempotency-Cached: true`.
- `src/tests/db-persistence.test.ts` (8 tests):
  - 8-table SQLite schema initialization in `:memory:`.
  - Idempotency lifecycle (save, duplicate rejection, complete, fail).
  - Product draft and classification persistence.
  - Landed cost calculation persistence and auto-linking to parent product.
  - DEF-03: Atomic SQLite transaction rollback on failure preventing orphan products/calculations.
  - DEF-03: Idempotent calculation updates on conflict without duplicate records.
  - DEF-02: `DatabaseConfigurationError` thrown in production when external DB is unconfigured, rejecting ephemeral SQLite without persistent volume mount, and blocking in serverless Vercel.
  - DEF-02: `NativeSqliteAdapter` implements `DatabaseAdapter` interface cleanly.
- `src/tests/authoritative-store.test.ts` (12 tests):
  - USITC 2026 Revision 22 store integrity, genuine CBP rulings, anti-fabrication guardrails.
- `src/tests/classification-engine.test.ts` (22 tests):
  - GRI classification rules, 7 seed profiles, ceramic schedule, tea reporting, ambiguity blocking.
- `src/tests/analyze-route.test.ts` (8 tests):
  - Product intake and analysis API handler.
- `src/tests/classify-route.test.ts` (6 tests):
  - Tariff classification API handler.
- `src/tests/image-sanitizer.test.ts` (16 tests):
  - Sharp image sanitization and PII scrubbing.
- `src/tests/idempotency.test.ts` (3 tests):
  - In-process deduplication.
- `src/tests/product-validation.test.ts` (6 tests):
  - Form validation rules.

### Static Analysis:
- `npx tsc --noEmit`: Clean (**0 errors**).
- `npm run lint`: Clean (**0 warnings, 0 errors**).
- `npm run build`: Production compilation passed (**8/8 routes compiled**).

---

## 9. Artifacts & Deliverables Summary

1. `src/types/export.ts`: Full domain contracts for landed-cost calculations, valuation declarations, user fees, DAP allocations, and RFC 7807 problem details.
2. `src/lib/tariff/landed-cost-engine.ts`: Pure TypeScript deterministic calculation engine.
3. `src/lib/db/database.ts`: SQLite persistence and idempotency service powered by Node.js native `node:sqlite`.
4. `src/app/api/tariffs/calculate/route.ts`: API endpoint with validation, persistence, and error handling.
5. `src/tests/landed-cost-calculator.test.ts`: Landed-cost engine unit tests.
6. `src/tests/calculate-route.test.ts`: API route tests.
7. `src/tests/db-persistence.test.ts`: SQLite database tests.
8. `src/app/export/new/page.tsx`: Step 4 UI implementation.
9. `SPRINT4_IMPLEMENTATION_REPORT.md`: This comprehensive implementation report.
10. `SPRINT4_REGULATORY_CLOSURE_REPORT.md`: Formal regulatory closure report reconciling Inbound EMS fees (19 C.F.R. § 24.22(l)), postal entry rules (91 FR 37801), Section 301 evidence across all 7 seed profiles, and database persistence safety.

