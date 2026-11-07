# BorderBrief AI — Sprint 4 Final Postal Compliance Date Correction Report
## Regulatory Grounding: CBP Document 2026-21600 (October 22, 2026 Extension to January 20, 2027)

**Evaluation Baseline:** November 7, 2026  
**Corridor:** India (IN) → United States (US)  
**Status:** COMPLETE & FULLY VERIFIED (146 tests passing, 0 errors)  
**Hardening Report:** See [SPRINT4_POSTAL_RUNTIME_HARDENING_REPORT.md](file:///d:/BorderBrief%20AI/SPRINT4_POSTAL_RUNTIME_HARDENING_REPORT.md)

---

## 1. Executive Summary & Legal Background

This report documents the targeted regulatory correction executed on the BorderBrief AI deterministic landed-cost calculation engine to reconcile postal entry procedures with the **October 22, 2026 U.S. Customs and Border Protection (CBP) Final Rule (Document 2026-21600)**.

### 1.1 The Preceding Rule (July 24, 2026)
- **Authority:** CBP Interim Final Rule published at `91 FR 37801`, Document `2026-12669`, effective **July 24, 2026**.
- **Action:** Amended 19 C.F.R. § 145.12(a)(2) by adding paragraphs (v) and (vi), requiring formal entry on CBP Form 7501 for international mail consignments covered by Chapter 98 or Chapter 99 of the Harmonized Tariff Schedule of the United States (HTSUS).
- **Scope:** Directly touched goods subject to Chapter 99 Section 301 additional trade remedy duties (such as Heading 9903.05.44 assessing 10.0% ad valorem on non-exempt Indian origin goods).

### 1.2 The Subsequent Extension Rule (October 22, 2026)
- **Authority:** CBP Final Rule, Document `2026-21600`, published **October 22, 2026**.
- **Action:** Extended the mandatory compliance date for 19 C.F.R. § 145.12(a)(2)(v) and (vi) to **January 20, 2027**.
- **Regulatory Impact as of November 7, 2026:**
  - Trade community operates in the **extended compliance transition period** (July 24, 2026 through January 19, 2027).
  - Formal entry on CBP Form 7501 is **NOT universally mandatory** for mail consignments valued at or below $2,500 merely because they are subject to Chapter 99 trade remedies.
  - Importers, carriers, and small exporters retain eligibility for the **existing postal informal-entry clearance process** under 19 C.F.R. Part 145 during this extension period.
  - Formal entry becomes universally mandatory for Chapter 99 postal consignments only **on or after January 20, 2027** (unless further extended by CBP).

---

## 2. Regulatory Matrix: Transition Period vs. Mandatory Compliance

The engine explicitly partitions postal treatment into distinct statutory states:

| Dimension | Transition Period (`evaluationDate < "2027-01-20"`) | Post-Compliance Date (`evaluationDate >= "2027-01-20"`) |
| :--- | :--- | :--- |
| **Rule Effective Date** | July 24, 2026 (`91 FR 37801`, Doc. `2026-12669`) | July 24, 2026 (`91 FR 37801`, Doc. `2026-12669`) |
| **Mandatory Compliance Date** | January 20, 2027 (CBP Doc. `2026-21600`) | In effect as of January 20, 2027 |
| **Standard Default ($\le \$2,500$)** | `INFORMAL_MAIL_EXTENDED` (Existing postal informal clearance under 19 C.F.R. Part 145) | `FORMAL_MAIL_REQUIRED` (Mandatory formal entry on CBP Form 7501 under § 145.12(a)(2)(v) & (vi)) |
| **Ordinary Mail MPF** | **$0.00** (Statutorily exempt under 19 C.F.R. § 24.23(c)(1)(v)) | **$0.00** (Statutorily exempt under § 24.23(c)(1)(v) even when formal entry is filed) |
| **Inbound EMS Item Fee** | **$1.00** per item (19 C.F.R. § 24.22(l)(1)(i); $0.50 USPS / $0.50 CBP) | **$1.00** per item (19 C.F.R. § 24.22(l)(1)(i); $0.50 USPS / $0.50 CBP) |
| **Inbound EMS MPF** | **$0.00** (Exempt under § 24.23(c)(1)(v); 85 FR 47018 exception applies only to formal entry) | **0.3464% ad valorem** (Min $34.58, Max $670.86 under 85 FR 47018 exception to § 24.23(c)(1)(v)) |
| **Voluntary Early Compliance** | `VOLUNTARY_FORMAL_EARLY` (CBP Form 7501 elected early; EMS incurs $34.58 formal MPF + $1.00 EMS fee; Ordinary mail remains $0.00 MPF) | N/A (Formal entry is already mandatory) |
| **Voluntary Entry Type 13 Pilot** | `VOLUNTARY_TEST_ENTRY_TYPE_13` (Informal test procedure; $0.00 MPF; $1.00 EMS fee if EMS) | N/A (Standard mandatory formal entry governs) |
| **Unresolved Carrier Handling** | `UNRESOLVED` (Status downgraded to `PARTIALLY_VERIFIED`) | `UNRESOLVED` if postal category is unconfirmed |
| **Value $> \$2,500$** | `FORMAL_MAIL_REQUIRED` (General statutory ceiling under 19 C.F.R. § 145.12(a)(1)) | `FORMAL_MAIL_REQUIRED` (General statutory ceiling under 19 C.F.R. § 145.12(a)(1)) |

---

## 3. Implementation Details

### 3.1 Type Definitions (`src/types/export.ts`)
- Added strongly typed union `PostalEntryProcedure`:
  ```ts
  export type PostalEntryProcedure =
    | "INFORMAL_MAIL"
    | "INFORMAL_MAIL_EXTENDED"
    | "VOLUNTARY_FORMAL_EARLY"
    | "VOLUNTARY_TEST_ENTRY_TYPE_13"
    | "FORMAL_MAIL_REQUIRED"
    | "UNRESOLVED";
  ```
- Added strongly typed union `VoluntaryPostalCompliance`:
  ```ts
  export type VoluntaryPostalCompliance =
    | "NONE"
    | "FORMAL_EARLY"
    | "ENTRY_TYPE_13_TEST"
    | "UNKNOWN";
  ```
- Extended `MpfComponentBreakdown` and `LandedCostCalculationResult` with:
  - `postalEntryProcedure?: PostalEntryProcedure;`
  - `postalEntryProcedureNotice?: string;`
  - `postalRuleEffectiveDate?: string;` (`"2026-07-24"`)
  - `postalMandatoryComplianceDate?: string;` (`"2027-01-20"`)
  - `postalRuleExtensionNotice?: string;` (Citing Doc. 2026-21600)
  - `voluntaryPostalCompliance?: VoluntaryPostalCompliance;`
- Enabled controllable evaluation date parameters (`importDate?: string` and `asOfDate?: string`) across request models and valuation declarations.

### 3.2 Calculation Engine (`src/lib/tariff/landed-cost-engine.ts`)
- Added exported regulatory constants:
  - `POSTAL_RULE_EFFECTIVE_DATE = "2026-07-24"`
  - `POSTAL_MANDATORY_COMPLIANCE_DATE = "2027-01-20"`
  - `POSTAL_RULE_EXTENSION_NOTICE` citing CBP Final Rule Doc. 2026-21600.
- Updated `calculateMpf()` signature and logic:
  - Accepts `importDate?: string` and `voluntaryPostalCompliance?: VoluntaryPostalCompliance`.
  - Compares ISO date strings: `const isPostComplianceDate = evaluationDate >= POSTAL_MANDATORY_COMPLIANCE_DATE;`.
  - When evaluated before January 20, 2027 without voluntary formal election, defaults to `INFORMAL_MAIL_EXTENDED` with full statutory citations.
  - When evaluated on or after January 20, 2027, escalates Chapter 99 postal shipments to `FORMAL_MAIL_REQUIRED`.
  - Preserves statutory MPF exemption ($0.00) for Ordinary International Mail under 19 C.F.R. § 24.23(c)(1)(v) across all entry modes.
  - Preserves $1.00 separate Inbound EMS item fee (19 C.F.R. § 24.22(l)(1)(i)) with 50/50 USPS/CBP allocation (§ 24.22(l)(2)).
  - Assesses formal ad valorem MPF ($34.58 minimum) on Inbound EMS strictly when formally entered (`FORMAL_MAIL_REQUIRED` or `VOLUNTARY_FORMAL_EARLY`) under 85 FR 47018.

### 3.3 API Route & UI Verification
- `src/app/api/tariffs/calculate/route.ts`: Extracts `importDate`, `asOfDate`, and `voluntaryPostalCompliance` from incoming JSON payloads and forwards them into the deterministic calculator.
- `src/app/export/new/page.tsx`:
  - Added postal compliance transition radio buttons allowing exporters to model standard informal clearance, voluntary early formal entry, Entry Type 13 test pilot, or unresolved carrier handling.
  - Renders visual badges and legal notices distinguishing informal clearance under the extension from mandatory formal entry.

---

## 4. Verification & Test Suite Results

The comprehensive test suite in `src/tests/landed-cost-calculator.test.ts` was expanded with dedicated test cases covering the entire regulatory spectrum:

1. **Transition Extension Informal Clearance (`2026-11-07`):**
   - Ordinary mail subject to Section 301 cleared under `INFORMAL_MAIL_EXTENDED` with $0.00 MPF, $0.00 EMS fee, total fees = $0.00.
   - Inbound EMS subject to Section 301 cleared under `INFORMAL_MAIL_EXTENDED` with $0.00 MPF, $1.00 EMS fee, total fees = $1.00.
2. **Voluntary Early Formal Compliance:**
   - Inbound EMS elected early on CBP Form 7501 incurs $34.58 formal ad valorem MPF + $1.00 EMS fee = $35.58 total customs fees.
   - Ordinary mail elected early on CBP Form 7501 remains statutorily exempt from MPF ($0.00) under § 24.23(c)(1)(v).
3. **Voluntary Entry Type 13 Test Pilot:**
   - Modeled under `VOLUNTARY_TEST_ENTRY_TYPE_13` with $0.00 MPF.
4. **Mandatory Formal Entry Post-Compliance Date (`2027-01-20`):**
   - Verifies that shipments evaluated on or after January 20, 2027 mandatorily require CBP Form 7501 under 19 C.F.R. § 145.12(a)(2)(v) & (vi).
5. **Unresolved Carrier Handling:**
   - Returns `UNRESOLVED` and correctly downgrades overall landed cost status to `PARTIALLY_VERIFIED`.
6. **Controllable Date Injection:**
   - Verifies calculations remain 100% deterministic and independent of the host system's wall-clock date.

### Command Execution Summary
- `npm test`: **146 tests passing, 0 failing, 1 skipped** (18 test suites).
- `npx tsc --noEmit`: **0 errors**.
- `npm run lint`: **0 warnings, 0 errors**.
- `npm run build`: **Compiled successfully in Next.js production mode**.

---

## 5. Scope Boundary Compliance

In accordance with strict instructions:
- **Zero Scope Creep:** Sprint 5 features (commercial invoice generation, PayPal payments) were NOT started.
- **Product Reconciled:** The seven core seed products from `src/data/seed-products.ts` remain unaltered.
- **Zero Hallucination:** Sheesham wood coasters remain `BLOCKED`; Darjeeling tea remains `PARTIALLY_VERIFIED`.
- **Database Honesty:** External persistence adapter requirements remain accurately reported.

