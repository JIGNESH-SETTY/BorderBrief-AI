# BorderBrief AI — Sprint 4 Regulatory Closure Report
## Inbound EMS, Postal Entry Rules, Section 301 Evidence & Database Persistence

**Date:** November 7, 2026  
**Status:** **CONDITIONAL PASS — STATUTORY ENGINE COMPLETED WITH DOCUMENTED UNRESOLVED ITEMS**  
**Corridor:** India (IN) → United States (US)  
**Valuation Statutory Basis:** 19 U.S.C. § 1401a (Tariff Act of 1930)  
**Tariff Schedule Baseline:** USITC 2026 HTS Revision 22 (Published October 30, 2026)  
**Trade Remedy Baseline:** USTR Federal Register Doc. 2026-15181 (Section 24, Annex I, Annex II Part A; Heading 9903.05.44)  
**Customs User Fee Baseline:** FY2027 Schedule (91 FR 48398; effective Oct 1, 2026; 19 C.F.R. §§ 24.22 & 24.23)  
**Postal Entry Authority:** 19 C.F.R. Part 145, 19 C.F.R. § 24.22(l), 19 C.F.R. § 24.23(c)(1)(v), 85 FR 47018, & CBP Final Rule 91 FR 37801 (Doc. 2026-12669, effective July 24, 2026)  

---

## 1. Executive Summary

This Regulatory Closure Report documents the statutory reconciliation and architectural qualification of BorderBrief AI for Sprint 4 (Deterministic Landed-Cost Calculator). 

Sprint 4 achieves **CONDITIONAL PASS**: the deterministic calculation engine, valuation logic, tariff store, and user fee structures are mathematically verified and statutorily grounded; however, specific merchandise ambiguities, administrative exemption scopes, and production database integrations remain explicitly pending and documented.

### Core Architectural Determinations:
1. **Inbound EMS Fee Engine (19 C.F.R. § 24.22(l)):** Implemented the statutory $1.00 per-item Inbound EMS fee (§ 24.22(l)(1)(i); unadjusted in FY2027 notice 91 FR 48398). In accordance with 19 C.F.R. § 24.22(l)(2), USPS retains 50% ($0.50) to cover postal customs clearance services and remits 50% ($0.50) quarterly to CBP. It is completely distinct from the $1.38 private courier ECCF fee (§ 24.23(b)(4)). Ordinary mail is strictly exempt from both MPF and EMS fees ($0.00).
2. **Postal Entry Rules (19 C.F.R. Part 145 & CBP 91 FR 37801):** Implemented the revised postal entry regulations issued by U.S. Customs and Border Protection (CBP Doc. 2026-12669, 91 FR 37801, effective July 24, 2026). International mail shipments containing merchandise subject to Chapter 99 trade remedies (including Section 301 Heading `9903.05.44` at 10.0%) are **ineligible for informal postal entry** and **require formal entry (CBP Form 7501)**, regardless of shipment value. Preserved the statutory postal MPF exemption ($0.00) for ordinary mail under 19 C.F.R. § 24.23(c)(1)(v) even when formally entered, while applying formal ad valorem MPF (0.3464% clamped $34.58–$670.86) to formally entered Inbound EMS under 85 FR 47018.
3. **Silk Shawl / Scarf Rate Reconciliation:** Reconciled HTS line `6214.10.10.00` to the official USITC 2026 HTS Revision 22 Column 1 General rate of **1.2%** (not 8.5%). With 10.0% Section 301 additional duty, the total duty rate is **11.2%** (not 18.5%).
4. **Seed Profile Ground Truth Reconciliation:** Verified all seven core seed export profiles directly against `src/data/seed-products.ts`. Preserved exact source titles, materials, and descriptions:
   - Handcrafted Cast Brass Ganesha Figurine (not Nataraja sculpture).
   - Hand-Woven Mulberry Silk Shawl / Scarf (1.2% base duty).
   - Single-Estate Darjeeling First Flush Whole Leaf Black Tea (non-organic conventional harvest; modeled with dual bounding scenarios due to unverified Annex II Part A agricultural exclusion status).
   - Hand-Carved Sheesham Wood Coasters (strictly BLOCKED with HTTP 422 due to unresolved botanical tropical wood classification under Chapter 44).
5. **Production Database Persistence Qualification:** Documented that while the codebase enforces strict production guardrails rejecting unverified SQLite usage, a live production external adapter (Turso/libSQL) has not yet been provisioned or connected. Full production persistence integration remains pending.
6. **Quality Gate Verification:** 135 automated unit tests passing (0 failing, 1 skipped) across 18 test suites; zero TypeScript compile errors (`npx tsc --noEmit`); zero ESLint errors (`npm run lint`); and a successful Next.js production build (`npm run build`).

---

## 2. Inbound EMS Fee Engine (19 C.F.R. § 24.22(l))

### 2.1 Statutory & Administrative Authority
- **19 U.S.C. § 58c(a)(11):** Imposes a specific customs user fee on express mail items generated through the international postal system.
- **19 C.F.R. § 24.22(l)(1)(i):** "An Inbound Express Mail Service (EMS) item is subject to a fee of $1 per item."
- **FY2027 Schedule (91 FR 48398, effective Oct 1, 2026):** Annual FAST Act indexation applies only to fees established under 19 U.S.C. § 58c(a)(1)–(8) and (b)(9)(A)(i). The Inbound EMS fee under subsection (a)(11) is unadjusted by inflation indexing and remains exactly **$1.00 per item**.
- **19 C.F.R. § 24.22(l)(2) Revenue Allocation:** 
  > The United States Postal Service (USPS) collects the fee, **retains 50 percent ($0.50)** of the fee to cover its internal costs of handling and processing inbound international mail for customs clearance, and **remits 50 percent ($0.50)** of the payments to CBP on a quarterly basis.
- **19 C.F.R. § 24.22(l)(1)(ii):** If an Inbound EMS item is formally entered, it is subject to the applicable formal Merchandise Processing Fee under 19 C.F.R. § 24.23 **in addition to** the $1 per-item EMS fee.

### 2.2 Critical Distinctions Enforced in Engine
1. **Separation from Formal MPF:** The $1.00 EMS item fee is tracked and presented separately from MPF. Formally entered Inbound EMS incurs both:
   $$\text{Customs Fees} = \text{Formal MPF (Min \$34.58)} + \text{Inbound EMS Item Fee (\$1.00)} = \$35.58$$
2. **Separation from Private ECCF Fee:** The $1.38 fee under 19 C.F.R. § 24.23(b)(4) applies strictly to private Express Consignment Carrier Facilities (ECCFs) and Centralized Hub Facilities operated by commercial couriers (e.g. FedEx, DHL, UPS). Postal consignments (USPS / India Post) **never** incur the $1.38 ECCF fee.
3. **Strict Exemption for Ordinary International Mail:** Ordinary postal mail (Letter Post, Air Parcel, Registered Post) is statutorily exempt from both MPF under 19 C.F.R. § 24.23(c)(1)(v) and the EMS item fee under § 24.22(l). Ordinary mail incurs **$0.00** in customs user fees.
4. **Handling of Missing Facts:** When postal service classification is unspecified or declared as `UNKNOWN`, the engine flags `mpfStatus = "UNRESOLVED"`, models provisional conservative fees, and downgrades calculation status to `PARTIALLY_VERIFIED`.

---

## 3. Postal Entry Rules (19 C.F.R. Part 145 & CBP 91 FR 37801)

### 3.1 Regulatory Framework
Prior to mid-2026, postal shipments valued at $2,500 or less generally entered under informal postal clearance procedures (CBP Form 3419Alt or electronic postal manifest).

Effective **July 24, 2026** under **U.S. Customs and Border Protection (CBP) Final Rule 91 FR 37801 (Doc. 2026-12669)**:
> Any international mail shipment containing merchandise subject to Chapter 99 trade remedy duties (including Section 301 additional duties under Heading 9903.05.44) is **ineligible for informal entry procedures** and **must enter under formal entry procedures (CBP Form 7501)**, regardless of transaction value.

*Attribution Note:* This regulation was promulgated by **CBP** (Department of Homeland Security / Department of the Treasury), not the Office of the United States Trade Representative (USTR). USTR determines Section 301 trade remedy actions (Doc. 2026-15181); CBP administers entry procedures, port-of-entry collections, and customs declarations.

### 3.2 Matrix of Postal Entry Treatments
The calculation engine (`src/lib/tariff/landed-cost-engine.ts`) implements the following matrix:

| Postal Service Type | Dutiable Value | Chapter 99 Section 301 Duty? | Entry Procedure Required | Final MPF (19 CFR § 24.23) | Inbound EMS Fee (19 CFR § 24.22(l)) | Total User Fees |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ordinary Mail** | $\le \$2,500$ | No (Exempt) | Informal Postal Entry | **\$0.00** (§ 24.23(c)(1)(v)) | **\$0.00** (Not EMS) | **\$0.00** |
| **Ordinary Mail** | $\le \$2,500$ | **Yes (10% 9903.05.44)** | **Formal Entry Required** (CBP 91 FR 37801) | **\$0.00** (§ 24.23(c)(1)(v) postal exemption applies) | **\$0.00** (Not EMS) | **\$0.00** |
| **Ordinary Mail** | $> \$2,500$ | Any | **Formal Entry Required** | **\$0.00** (§ 24.23(c)(1)(v) postal exemption applies) | **\$0.00** (Not EMS) | **\$0.00** |
| **Inbound EMS** | $\le \$2,500$ | No (Exempt) | Informal Postal Entry | **\$0.00** (§ 24.23(c)(1)(v) informal exemption) | **\$1.00** (§ 24.22(l)(1)(i)) | **\$1.00** |
| **Inbound EMS** | $\le \$2,500$ | **Yes (10% 9903.05.44)** | **Formal Entry Required** (CBP 91 FR 37801) | **\$34.58** min (85 FR 47018 exception) | **\$1.00** (§ 24.22(l)(1)(i)) | **\$35.58** |
| **Inbound EMS** | $> \$2,500$ | Any | **Formal Entry Required** | **0.3464%** (\$34.58–\$670.86) | **\$1.00** (§ 24.22(l)(1)(i)) | **MPF + \$1.00** |
| **Unknown Postal** | Any | Any | **UNRESOLVED** | Modeled provisionally; status downgraded to `PARTIALLY_VERIFIED` | Modeled provisionally if formal | Variable |

---

## 4. Reconciled Seed Inventory & Section 301 Exemption Status

Every profile is reproduced directly from the source of truth (`src/data/seed-products.ts`). No synthetic renaming or unproven material claims are permitted.

### Authoritative Seed Profile Audit Table

| Source ID | Exact Product Title | Verified HTS-10 Code | General Base Rate | Section 301 Status | Annex I | Annex II Part A | Final Engine Status | Regulatory Summary & Legal Authority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **prod-cotton-bag** | Handmade Hand-Printed Cotton Tote Bag | `4202.92.15.00` | 6.3% | `VERIFIED_SUBJECT` (10.0%) | Absent | Absent (p. 48 checked) | `VERIFIED` | Subject to Heading 9903.05.44. Cotton shopping bags are not listed in Annex II Part A. Total duty: 16.3%. |
| **prod-brass-statue** | Handcrafted Cast Brass Ganesha Figurine | `8306.29.00.00` | Free (0.0%) | `VERIFIED_SUBJECT` (10.0%) | Absent | Absent (p. 54 checked) | `VERIFIED` | Base duty Free; 10.0% Section 301 attaches under Heading 9903.05.44. Statuettes of base metal not exempt. Total duty: 10.0%. |
| **prod-silk-scarf** | Hand-Woven Mulberry Silk Shawl / Scarf | `6214.10.10.00` | **1.2%** | `VERIFIED_SUBJECT` (10.0%) | Absent | Absent (p. 51 checked) | `VERIFIED` | USITC Rev 22 Col 1 General rate is 1.2% (containing >=70% silk). 10.0% Section 301 attaches under Heading 9903.05.44. **Total duty: 11.2%** (not 18.5%). |
| **prod-ceramic-mug** | Studio Pottery Hand-Thrown Glazed Stoneware Ceramic Mug | `6912.00.44.00` | 10.0% | `VERIFIED_SUBJECT` (10.0%) | Absent | Absent (p. 52 checked) | `VERIFIED` | Classified under 6912.00.44 based on documented opaque stoneware clay (non-porcelain, Chapter 69 Additional U.S. Note 5(a)). Total duty: 20.0%. (Generic ceramic mugs without stoneware evidence return `BLOCKED`). |
| **prod-wooden-coasters** | Hand-Carved Sheesham Wood Coasters Set of 6 | `4419.90.91.00` / `4419.20.90.00` | 3.2% | Conditional 10.0% | Absent | Excluded if tropical; unresolved botanical | **`BLOCKED`** | **Strictly BLOCKED (HTTP 422).** Botanical classification of *Dalbergia sissoo* (Sheesham) between tropical wood (`4419.20.90.00`) and other wood (`4419.90.91.00`) is ambiguous under Chapter 44 notes. System refuses to fabricate rate. |
| **prod-leather-wallet** | Handmade Vegetable-Tanned Leather Bi-fold Wallet | `4202.31.60.00` | 8.0% | `VERIFIED_SUBJECT` (10.0%) | Absent | Absent (p. 48 checked) | `VERIFIED` | Bovine pocket wallet subject to 8.0% base + 10.0% Section 301 under Heading 9903.05.44. Total duty: 18.0%. |
| **prod-darjeeling-tea** | Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g) | `0902.30.00.90` | Free (0.0%) | `UNRESOLVED` | Absent | Agricultural review (pp. 43–44) | **`PARTIALLY_VERIFIED`** | **Dual Bounding Scenarios Modeled.** Non-organic conventional tea. Annex II Part A agricultural exclusion scope for specialty loose tea remains administratively unverified in primary publications. Modeled with dual bounding scenarios (Scenario A: 0% Sec 301 vs Scenario B: 10% Sec 301). |

---

## 5. Production Database Qualification & Limitations

### 5.1 Deployment Tiers Analysis
1. **Local Development (Active & Verified):** Uses Node.js native `node:sqlite` writing to local file `borderbrief.db` or in-memory (`:memory:`). Fully functional with atomic transaction rollbacks and idempotency caching.
2. **Stateful Container / VPS (Conditional Guardrail):** Permitted only when `BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD === "true"` **and** an explicit persistent directory path is supplied via `BORDERBRIEF_PERSISTENT_VOLUME_PATH`. An environment variable alone without a volume path is rejected with `DatabaseConfigurationError`.
3. **Stateless Serverless (Strictly Prohibited):** In platforms such as Vercel, AWS Lambda, or Netlify Functions, container filesystems are read-only (`EROFS`) and discard local file modifications upon container teardown. Local SQLite is **strictly blocked**, throwing `DatabaseConfigurationError`.
4. **External Production Database (Pending Implementation):** The abstract `DatabaseAdapter` interface is defined and verified in tests (`src/tests/db-persistence.test.ts`), but a production cloud adapter (such as Turso/libSQL at ₹0 budget) has not been provisioned or connected. **Production external persistence integration remains pending.**

---

## 6. Verification & Test Evidence

### 6.1 Test Suite Execution (`npm test`)
```
ℹ tests 136
ℹ suites 18
ℹ pass 135
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1 (Mock Cloud Gemini Integration Test)
ℹ todo 0
ℹ duration_ms 1355.1ms
```

### 6.2 TypeScript Compilation (`npx tsc --noEmit`)
- **Status:** **PASS**
- **Output:** Clean exit with code 0. Zero type errors.

### 6.3 ESLint Check (`npm run lint`)
- **Status:** **PASS**
- **Output:** Clean exit with code 0. Zero lint warnings or errors across all files.

### 6.4 Next.js Production Build (`npm run build`)
- **Status:** **PASS**
- **Routes compiled:**
  - `○ /` (Static)
  - `○ /_not-found` (Static)
  - `ƒ /api/products/analyze` (Dynamic API)
  - `ƒ /api/tariffs/calculate` (Dynamic API)
  - `ƒ /api/tariffs/classify` (Dynamic API)
  - `○ /corridor/india-usa` (Static)
  - `○ /export/new` (Static)

---

## 7. Remaining Unresolved Items

In accordance with strict verification integrity standards, the following items remain open and are not claimed as resolved:
1. **Sheesham Coaster Botanical Classification:** Without a formal CBP binding ruling under 19 C.F.R. Part 177 or laboratory wood anatomy certification, *Dalbergia sissoo* cannot be definitively assigned to `4419.20.90.00` (tropical wood) versus `4419.90.91.00` (other wood). It remains **BLOCKED** (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`).
2. **Darjeeling Tea Section 301 Annex II Scope:** The official exclusion scope for agricultural provisions under USTR Doc. 2026-15181 Annex II Part A remains administratively unverified in primary legal gazettes. It remains **PARTIALLY_VERIFIED** with dual bounding scenarios.
3. **Production Database Adapter Deployment:** A live cloud database adapter (e.g. Turso libSQL) has not been deployed or integrated into the production environment.
