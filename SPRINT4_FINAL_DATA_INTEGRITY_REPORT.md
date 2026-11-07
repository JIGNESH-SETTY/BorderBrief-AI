# BorderBrief AI — Sprint 4 Final Data Integrity & Closure Patch Report

**Date:** November 7, 2026  
**Status:** **CONDITIONAL PASS — ALL DATA INTEGRITY DEFECTS RECONCILED WITH EXPLICIT UNRESOLVED ITEMS PRESERVED**  
**Corridor:** India (IN) → United States (US)  
**Valuation Statutory Basis:** 19 U.S.C. § 1401a (Tariff Act of 1930)  
**Tariff Schedule Baseline:** USITC 2026 HTS Revision 22 (Published October 30, 2026)  
**Trade Remedy Baseline:** USTR Federal Register Doc. 2026-15181 (Section 24, Annex I, Annex II Part A; Heading 9903.05.44)  
**Customs User Fee Baseline:** FY2027 Schedule (91 FR 48398; effective Oct 1, 2026; 19 C.F.R. §§ 24.22 & 24.23)  
**Postal Entry Authority:** 19 C.F.R. Part 145, 19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), 85 FR 47018, & CBP Final Rule 91 FR 37801 (Doc. 2026-12669, effective July 24, 2026)  

---

## 1. Executive Summary

This Final Data Integrity Report resolves all omissions, misattributions, and data discrepancies identified in the Sprint 4 Regulatory Closure review. In strict accordance with the execution boundaries:
- Zero application UI redesigns or architectural overhauls were introduced.
- No new product profiles or synthetic tariff assumptions were created.
- Sprint 5 functionality (commercial invoice PDF generation, PayPal payment processing) was strictly excluded.
- The status of Sprint 4 is formally recorded as **CONDITIONAL PASS**: all mathematical calculations, statutory rate Lookups, user fee structures, and database persistence safety guardrails are verified; remaining merchandise ambiguities (Sheesham wood botanical classification), unconfirmed administrative exemption scopes (Darjeeling tea Annex II Part A agricultural provisions), and production database connections (Turso/libSQL cloud deployment) are preserved as explicitly unresolved.

---

## 2. Exact Files Inspected, Modified, and Tested

| File Path | Action | Description of Modification |
| :--- | :--- | :--- |
| `src/lib/tariff/landed-cost-engine.ts` | Modified | Updated postal rule citations to attribute 91 FR 37801 (Doc. 2026-12669) to CBP final rule; corrected Inbound EMS fee explanation under 19 C.F.R. § 24.22(l)(2) (USPS retains 50%, remits 50% quarterly to CBP). |
| `src/types/export.ts` | Modified | Updated comments for postal entry procedure to cite CBP Final Rule 91 FR 37801 (Doc. 2026-12669). |
| `src/app/export/new/page.tsx` | Modified | Updated user-facing Inbound EMS fee description to clarify that USPS retains 50% for postal handling and remits 50% quarterly to CBP. |
| `src/tests/landed-cost-calculator.test.ts` | Modified | Updated test comments for silk scarf; added dedicated Silk Shawl landed-cost test (1.2% base + 10.0% Sec 301 = 11.2% total); updated Ganesha Figurine test title; added test reconciling all 7 seed IDs and titles from `seed-products.ts`; added test verifying EMS 50/50 revenue allocation note. |
| `src/data/seed-products.ts` | Inspected (Source of Truth) | Confirmed exact ground-truth seed titles, materials, descriptions, and duty rates (including 1.2% for `prod-silk-scarf`). |
| `src/lib/tariff/authoritative-store.ts` | Inspected | Verified line `6214.10.10.00` Column 1 General rate of 1.2% under USITC 2026 Revision 22 (retrieved Oct 30, 2026). |
| `src/lib/db/database.ts` | Inspected | Verified production database guardrail (`DatabaseConfigurationError`), serverless prohibition, and volume mount requirements. |
| `SPRINT4_REGULATORY_CLOSURE_REPORT.md` | Overwritten | Completely corrected with reconciled seed inventory, 1.2% silk rate, CBP rule attribution, EMS fee explanation, and conditional pass sign-off. |
| `SPRINT4_FINAL_REMEDIATION_REPORT.md` | Modified | Corrected seed profile table, silk rate (11.2% total), CBP postal rule citation, and conditional pass status. |
| `SPRINT4_IMPLEMENTATION_REPORT.md` | Modified | Updated status to conditional pass, updated postal citation, and reflected final test metrics (135 passing tests). |
| `SPRINT4_FINAL_DATA_INTEGRITY_REPORT.md` | Created | Comprehensive final deliverable documenting all inspections, changes, and verification evidence. |

---

## 3. Before and After: Silk Shawl / Scarf Tariff Rate

### 3.1 Inspection of Official USITC 2026 HTS Revision 22
- **HTS-10 Code:** `6214.10.10.00`
- **Article Description:** *Shawls, scarves, mufflers, mantillas, veils and the like: Of silk or silk waste: Containing 70 percent or more by weight of silk or silk waste*
- **Source Provenance:** USITC 2026 HTS Revision 22 (published October 30, 2026), Chapter 62, page 62-24.
- **Official Statutory Rates:**
  - Column 1 General MFN Rate: **1.2%**
  - Column 1 Special Rates: Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG) — India is ineligible for special rates.
  - Column 2 Rate: 60%
  - Quantity Units: `doz.`, `kg`

### 3.2 Before vs. After Comparison Table

| Metric | Erroneous Report Figure (Before) | Authoritative Statutory Rate (After) | Statutory Authority & Notes |
| :--- | :--- | :--- | :--- |
| **Column 1 General Base Rate** | `8.5%` | **`1.2%`** | USITC 2026 HTS Revision 22, subheading `6214.10.10.00`. |
| **Section 301 Additional Duty** | `10.0%` | **`10.0%`** | Heading `9903.05.44` (USTR Doc. 2026-15181; CSMS #69326983). |
| **Total Customs Duty Rate** | `18.5%` | **`11.2%`** | $1.2\% + 10.0\% = 11.2\%$ (combined rate strictly banned in code; itemized in UI). |
| **Calculated Duty on \$240 Value** | \$44.40 (\$20.40 base + \$24.00 Sec 301) | **\$26.88** (\$2.88 base + \$24.00 Sec 301) | Deterministic pure TypeScript calculation in `landed-cost-engine.ts`. |

*Code Verification:* `src/lib/tariff/authoritative-store.ts` (line 648) and `src/data/seed-products.ts` (line 215) already had `1.2%` implemented; the error was an illustrative transcription defect in prior markdown reports citing 8.5% / 18.5%. All reports and test fixtures now reflect the verified **1.2%** base and **11.2%** total rate.

---

## 4. Reconciled Seven Seed Export Profiles Against Source File

The following table reproduces the exact identifiers, product titles, declared materials, candidate HTS-10 codes, and descriptions from `src/data/seed-products.ts`:

| Source ID | Exact Product Title | Declared Materials | Candidate HTS-10 | Base Duty Rate | Verified Ground-Truth Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `prod-cotton-bag` | **Handmade Hand-Printed Cotton Tote Bag** | 100% Woven Cotton Canvas, Natural Vegetable Dye | `4202.92.15.00` | 6.3% | Eco-friendly shopping tote bag made from 100% natural unbleached cotton canvas with traditional Indian block print and cotton webbing handles. Open top, no zipper. |
| `prod-brass-statue` | **Handcrafted Cast Brass Ganesha Figurine** | Brass (Copper-Zinc Alloy), Lacquer Sealant | `8306.29.00.00` | 0.0% (Free) | Lost-wax cast brass figurine of Lord Ganesha, decorative home sculpture with antique bronze polish, solid metal construction without precious plating. *(Clarified: Ganesha figurine, NOT Nataraja sculpture).* |
| `prod-silk-scarf` | **Hand-Woven Mulberry Silk Shawl / Scarf** | 100% Pure Mulberry Silk, Metallic Zari Thread | `6214.10.10.00` | 1.2% | Handloom scarf crafted from 100% pure Mulberry silk with zari thread border, measuring 70 cm x 180 cm, hand-rolled edges. Contains >=70% silk by weight. *(Clarified: 1.2% General duty rate).* |
| `prod-ceramic-mug` | **Studio Pottery Hand-Thrown Glazed Stoneware Ceramic Mug** | 100% Opaque Stoneware Clay (Non-Porcelain), Food-Safe Ceramic Glaze | `6912.00.44.00` | 10.0% | Wheel-thrown ceramic mug made from 100% opaque stoneware clay (verified non-porcelain, water absorption <= 3% under Chapter 69 Additional U.S. Note 5(a)), food-safe colored glaze. *(Generic mugs without stoneware evidence return `BLOCKED`).* |
| `prod-wooden-coasters` | **Hand-Carved Sheesham Wood Coasters Set of 6** | Solid Sheesham Wood (Dalbergia sissoo), Brass Inlay | `4419.90.91.00` / `4419.20.90.00` | 3.2% | Set of 6 circular drink coasters carved from Indian rosewood (Sheesham) with brass inlay and holder box. *(Preserved as strictly `BLOCKED` with HTTP 422 due to unresolved botanical tropical wood classification under Chapter 44).* |
| `prod-leather-wallet` | **Handmade Vegetable-Tanned Leather Bi-fold Wallet** | Full-Grain Bovine/Buffalo Leather, Waxed Thread | `4202.31.60.00` | 8.0% | Slim men's bi-fold pocket wallet made from genuine full-grain vegetable-tanned buffalo leather with hand-waxed linen thread stitching, 6 card slots, and currency compartment. |
| `prod-darjeeling-tea` | **Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g)** | 100% Camellia sinensis (Black Tea Leaves), Tinplate Canister | `0902.30.00.90` | 0.0% (Free) | Single-origin premium loose whole-leaf Darjeeling black tea, non-organic conventional harvest, in an airtight sealed tin can. *(Preserved as `PARTIALLY_VERIFIED` with dual bounding scenarios: 0.0% if exempt vs 10.0% if covered under Sec 301).* |

---

## 5. Correct Postal Rule Attribution

### 5.1 Promulgation & Regulatory Authority
- **Federal Register Citation:** `91 FR 37801`
- **Federal Register Document Number:** `Doc. 2026-12669`
- **Effective Date:** July 24, 2026
- **Issuing Agency:** **U.S. Customs and Border Protection (CBP)**, Department of Homeland Security / Department of the Treasury.
- **Correction:** Prior documentation inadvertently conflated this entry procedure update with USTR Document 2026-15181 (the July 2026 Section 301 determination). The postal entry rule was promulgated by **CBP**, not USTR.

### 5.2 Regulatory Substance & Distinction Enforced in Code
Under 19 C.F.R. Part 145 and CBP Final Rule 91 FR 37801:
1. **Mandatory Formal Entry:** International mail importations subject to Chapter 99 trade remedy duties (such as Section 301 Heading `9903.05.44` at 10.0%) are ineligible for informal entry procedures (CBP Form 3419Alt) and **must be formally entered on CBP Form 7501**, regardless of value.
2. **Ordinary International Mail Exemption:** Ordinary international mail required to enter formally remains statutorily exempt from the Merchandise Processing Fee under 19 C.F.R. § 24.23(c)(1)(v) (**$0.00 MPF**).
3. **Inbound EMS Formal Exception:** Inbound EMS required to enter formally incurs the formal ad valorem MPF (0.3464%, $34.58 minimum clamp) under the 85 FR 47018 exception to § 24.23(c)(1)(v), plus the separate $1.00 EMS item fee.

---

## 6. Correct Inbound EMS Fee Statutory Explanation

Under 19 C.F.R. § 24.22(l) and 19 U.S.C. § 58c(a)(11):
- **Statutory Fee Amount:** $1.00 per Inbound Express Mail Service (EMS) item.
- **FAST Act Exemption:** In the FY2027 user fee notice (91 FR 48398), indexation applies only to fees under 19 U.S.C. § 58c(a)(1)–(8) and (b)(9)(A)(i). The Inbound EMS fee under subsection (a)(11) remains unadjusted at **$1.00 per item**.
- **Revenue Allocation under 19 C.F.R. § 24.22(l)(2):**
  > The United States Postal Service (USPS) collects the fee, **retains 50 percent ($0.50)** of the fee to cover its internal costs of handling and processing inbound international mail for customs clearance, and **remits 50 percent ($0.50)** of the payments to CBP on a quarterly basis.
- **Clarification:** UI descriptions and documentation have been updated so they do not imply that the full $1.00 is remitted to CBP.
- **Formal MPF Co-Existence:** Formally entered Inbound EMS incurs both the $1.00 EMS item fee and the formal ad valorem MPF under § 24.22(l)(1)(ii) and 85 FR 47018 ($35.58 minimum total fees).
- **Separation from Private ECCF Fee:** Distinct from the $1.38 reimbursable waybill fee under 19 C.F.R. § 24.23(b)(4), which applies strictly to private express carrier facilities (DHL, FedEx, UPS).
- **Ordinary Mail Exemption:** Ordinary international mail is exempt from both MPF ($0.00) and the EMS item fee ($0.00).

---

## 7. Product-by-Product Final Status Summary

| Product ID | Product Title | Base Rate | Section 301 Rate | Total Duty Rate | Final Engine Status | Reason for Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `prod-cotton-bag` | Handmade Hand-Printed Cotton Tote Bag | 6.3% | 10.0% | 16.3% | **`VERIFIED`** | Classification verified under 4202.92.15; verified absent from Annex I & Annex II Part A; documented freight. |
| `prod-brass-statue` | Handcrafted Cast Brass Ganesha Figurine | 0.0% (Free) | 10.0% | 10.0% | **`VERIFIED`** | Base duty Free under 8306.29; 10.0% Section 301 applies under Heading 9903.05.44; documented freight. |
| `prod-silk-scarf` | Hand-Woven Mulberry Silk Shawl / Scarf | 1.2% | 10.0% | 11.2% | **`VERIFIED`** | Reconciled 1.2% Col 1 General rate under 6214.10.10.00; 10.0% Section 301 applies; documented freight. |
| `prod-ceramic-mug` | Studio Pottery Hand-Thrown Glazed Stoneware Ceramic Mug | 10.0% | 10.0% | 20.0% | **`VERIFIED`** | Classified under 6912.00.44 based on documented opaque stoneware clay (non-porcelain); documented freight. |
| `prod-wooden-coasters` | Hand-Carved Sheesham Wood Coasters Set of 6 | 3.2% | Conditional 10.0% | N/A | **`BLOCKED`** | **Strictly BLOCKED (HTTP 422).** Botanical ambiguity between tropical wood (`4419.20.90`) and other wood (`4419.90.91`) under Chapter 44 notes. System refuses arithmetic. |
| `prod-leather-wallet` | Handmade Vegetable-Tanned Leather Bi-fold Wallet | 8.0% | 10.0% | 18.0% | **`VERIFIED`** | Bovine pocket wallet classified under 4202.31.60; 8.0% base + 10.0% Section 301; documented freight. |
| `prod-darjeeling-tea` | Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g) | 0.0% (Free) | 0.0% or 10.0% | 0.0% or 10.0% | **`PARTIALLY_VERIFIED`** | Base duty Free; Annex II Part A agricultural exclusion scope unverified in official publications; modeled with Scenario A (0% Sec 301) and Scenario B (10% Sec 301). |

---

## 8. Production Persistence Qualification & Limitations

### 8.1 Four-Tier Persistence Analysis
1. **Local Development (Active & Verified):** Uses Node.js native `node:sqlite` writing to local file `borderbrief.db` or in-memory (`:memory:`). Fully functional with atomic transaction rollbacks and idempotency caching.
2. **Stateful Container / VPS (Conditional Guardrail):** Permitted only when `BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD === "true"` **and** an explicit persistent directory path is supplied via `BORDERBRIEF_PERSISTENT_VOLUME_PATH`. An environment variable alone without a volume path is rejected with `DatabaseConfigurationError`.
3. **Stateless Serverless (Strictly Prohibited):** In platforms such as Vercel, AWS Lambda, or Netlify Functions, container filesystems are read-only (`EROFS`) and discard local file modifications upon container teardown. Local SQLite is **strictly blocked**, throwing `DatabaseConfigurationError`.
4. **External Production Database (Pending Implementation):** The abstract `DatabaseAdapter` interface is defined and verified in tests (`src/tests/db-persistence.test.ts`), but a production cloud adapter (such as Turso/libSQL at ₹0 budget) has not been provisioned or connected. **Production external persistence integration remains pending.**

---

## 9. Test, TypeScript, Lint, and Build Results

### 9.1 Automated Test Execution (`npm test`)
```
> borderbrief-ai@0.1.0 test
> node --test --experimental-strip-types src/tests/**/*.test.ts

Total Test Suites: 18
Total Tests:       136
Passing Tests:     135
Failing Tests:     0
Skipped Tests:     1 (Live Gemini Studio Opt-In)
Duration:          1.36s
```
*New Tests Added:*
1. Silk Shawl landed-cost calculation verifying 1.2% base duty + 10.0% Section 301 = 11.2% total duty ($26.88 on $240 dutiable value).
2. Seed inventory reconciliation verifying all 7 seed IDs, exact source titles, and duty rates against `src/data/seed-products.ts`.
3. Inbound EMS fee presentation verifying explanation of 50% USPS retention and 50% CBP remittance under 19 C.F.R. § 24.22(l)(2).

### 9.2 TypeScript Type Check (`npx tsc --noEmit`)
- **Status:** **PASS**
- **Exit Code:** 0
- **Output:** Clean compile with zero type errors.

### 9.3 ESLint Check (`npm run lint`)
- **Status:** **PASS**
- **Exit Code:** 0
- **Output:** Clean lint check with zero warnings and zero errors across all source files.

### 9.4 Next.js Production Build (`npm run build`)
- **Status:** **PASS**
- **Exit Code:** 0
- **Routes Compiled (8/8):**
  - `○ /` (Static)
  - `○ /_not-found` (Static)
  - `ƒ /api/products/analyze` (Dynamic API)
  - `ƒ /api/tariffs/calculate` (Dynamic API)
  - `ƒ /api/tariffs/classify` (Dynamic API)
  - `○ /corridor/india-usa` (Static)
  - `○ /export/new` (Static)

---

## 10. Remaining Unresolved Items

In accordance with strict compliance and verification integrity, the following three items remain explicitly open and unresolved:
1. **Sheesham Coaster Botanical Determination:** Without a formal CBP binding ruling under 19 C.F.R. Part 177 or laboratory wood anatomy certification, *Dalbergia sissoo* cannot be definitively assigned to `4419.20.90.00` (tropical wood) versus `4419.90.91.00` (other wood). It remains **BLOCKED** (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`).
2. **Darjeeling Tea Section 301 Annex II Scope:** The official exclusion scope for agricultural provisions under USTR Doc. 2026-15181 Annex II Part A remains administratively unverified in primary legal gazettes. It remains **PARTIALLY_VERIFIED** with dual bounding scenarios.
3. **Production Database Adapter Deployment:** A live cloud database adapter (e.g. Turso libSQL) has not been deployed or integrated into the production environment.

