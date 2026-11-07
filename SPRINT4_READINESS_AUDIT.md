# BorderBrief AI — Sprint 4 Readiness Inspection & Architecture Audit

**Document ID:** SPRINT4_READINESS_AUDIT.md  
**Audit Date:** November 7, 2026 (Final Section 301 Legal Interpretation Correction)  
**Corridor:** India (Country of Export) $\rightarrow$ United States of America (Country of Importation)  
**Corridor Incoterm:** DAP (Delivered at Place, Incoterms 2020)  
**Primary Regulatory Authorities:** 
- United States International Trade Commission (USITC) — 2026 HTS Revision 22 (Published Oct 30, 2026), Chapter 99 & U.S. Note 52
- Office of the United States Trade Representative (USTR) — Notice of Actions under Section 301 (91 FR Doc. 2026-15181; Presidential Memorandum, July 23, 2026; effective July 24, 2026; Section 24 Determination, Annex I & Annex II Part A Exemption Schedules)
- U.S. Customs and Border Protection (CBP) — CSMS #69326983; 19 U.S.C. § 1401a (Customs Valuation / Transaction Value); 19 U.S.C. § 58c & 19 C.F.R. § 24.23 (Merchandise Processing Fee, Express Consignment Carrier Facility & Centralized Hub Facility Fees, FY2027 Schedule 91 FR 48398); 26 U.S.C. § 4461 & 19 C.F.R. § 24.24 (Harbor Maintenance Fee & Informal Entry Exemption § 24.24(d)(3)(i))
**Status:** Architecture Blueprint & Regulatory Baseline Verified. Ready for Sprint 4.

---

## 1. Executive Summary & Audit Mandate

This document establishes the technical, statutory, and architectural foundation for **Sprint 4: Deterministic Landed-Cost Calculator** in BorderBrief AI (*"Know the Rules. Know the Cost. Ship with Confidence."*).

### Strict Boundary Protections:
- **Zero Application Source Code Changes:** No files in `src/` or existing configuration files have been modified.
- **Zero UI Changes:** Existing layouts and intake flows in [`src/app/export/new/page.tsx`](file:///d:/BorderBrief%20AI/src/app/export/new/page.tsx) remain untouched.
- **Zero Dependencies Added:** No npm packages, external dependencies, or paid APIs have been installed.
- **No Calculation Logic Implemented:** Arithmetic, duty calculations, and PayPal payment execution remain completely unimplemented pending Sprint 4 approval.
- **Zero Fabrication Mandate:** Never fabricate or invent tariff exemptions, trade certifications, or statutory fees. If primary legal sources do not confirm an exemption, the duty is assessed or marked unresolved.
- **Component Separation Mandate:** Base customs duty, Section 301 duties, user fees, and freight exclusions must be stored, evaluated, and presented as separate statutory lines, never collapsed into hardcoded blended rates in calculation logic.
- **100% Deterministic Math Mandate:** All arithmetic must eventually be executed by pure TypeScript functions with zero AI in the math loop.

---

## 2. Existing Architecture Inspection

We performed a comprehensive code inspection across the repository to determine how tariff data, classification state, and persistence currently operate:

| Architectural Component | Inspected File(s) | Current State & Findings | Sprint 4 Implications & Requirements |
| :--- | :--- | :--- | :--- |
| **Tariff Schedule Data Storage** | [`src/lib/tariff/authoritative-store.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/authoritative-store.ts) | Stored as an in-memory typed TypeScript array (`AUTHORITATIVE_TARIFF_DATABASE`) containing exactly **30 curated tariff records** spanning Chapters 09, 42, 44, 48, 62, 63, 69, 71, and 83. It is **not** the entire 25,000+ line USITC schedule, but a curated slice for authentic Indian export profiles. | The calculator must resolve rates directly from these validated records. For codes outside this curated set, the calculator must gracefully return `DATASET_COVERAGE_UNSUPPORTED` rather than hallucinating rates. |
| **HTS Revision Metadata** | `USITC_REVISION_METADATA` in `authoritative-store.ts` | Explicitly stamped with **`USITC 2026 HTS Revision 22`** (Publication Date: October 30, 2026; Retrieval Date: November 7, 2026). Source URL: `https://hts.usitc.gov/view/export`. | Every landed-cost calculation output must carry this exact revision stamp so auditability is maintained over time. |
| **Effective Date & Source Tracking** | `AuthoritativeTariffRecord` interface | Every record contains `statutoryRevision`, `effectiveDate: "Unverified"`, `effectiveDateSource` (documenting longstanding statutory baseline), `relevantGris`, `legalNotes`, `crossRulingReference`, and `chapter99Notice`. | The calculator must report whether rates are based on the active 2026 Revision 22 baseline or if line-specific amendments exist. |
| **Classification Engine Linkage** | [`src/lib/tariff/classification-engine.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/classification-engine.ts) | `classifyDeterministically` and `classifyProduct` map inputs to `ClassificationResult`. Candidates are built via `buildCandidate()` from `AuthoritativeTariffRecord`, transferring `hts10`, `generalDutyRate`, `unitOfQuantity`, and legal citations. | The calculator must consume `ClassificationCandidate` or verified HTS records as its direct tariff input. |
| **Ambiguity Handling in Classification** | `classification-engine.ts` | When material evidence is insufficient (e.g. ceramic mug body unknown, wood coaster species unknown, Sheesham legal status unsettled), `status: "UNRESOLVED_AMBIGUITY"` is returned and `primaryCandidate` is set to `null`. | **CRITICAL GUARDRAIL:** An unresolved classification (`primaryCandidate === null`) must **never silently generate a definitive landed-cost figure**. It must produce a `BLOCKED` status. |
| **Persistence Layer** | [`src/lib/db/schema.ts`](file:///d:/BorderBrief%20AI/src/lib/db/schema.ts) & [`src/lib/services/idempotency.ts`](file:///d:/BorderBrief%20AI/src/lib/services/idempotency.ts) | Table DDLs for `products`, `classifications`, `landed_cost_calculations`, and `tariff_cache` are defined in `schema.ts`. However, runtime persistence in Sprints 2–3 is **in-memory/stateless**: API routes return JSON directly to frontend React state. Idempotency is managed via in-memory `Map`. | In Sprint 4, landed-cost calculations will operate deterministically on the request payload. Database binding to SQLite (`borderbrief.db`) can be layered cleanly without breaking the calculation contract. |
| **Historical Date Support** | Authoritative store and engine | Currently, the engine matches against the single active 2026 Revision 22 dataset. There is **no historical revision archive** or date-filtering parameter in the lookup methods. | Sprint 4 will evaluate calculations against the active statutory baseline, with input validation for the planned `importDate`. |

---

## 3. Customs Valuation Statutory Audit & State Logic (19 U.S.C. § 1401a)

Customs duties in the United States are assessed on the **Customs Value**, not on arbitrary commercial quotes or total landed costs. The calculator must strictly model the statutory requirements of Section 402 of the Tariff Act of 1930, as amended (19 U.S.C. § 1401a).

### 3.1 Primary Valuation Basis: Transaction Value (19 U.S.C. § 1401a(b))
The primary method of customs valuation is **Transaction Value**, defined by statute as:
> *"The price actually paid or payable for the merchandise when sold for exportation to the United States"*, plus statutory additions specified in subsection (b)(1).

### 3.2 Price Actually Paid or Payable (PAPP)
- PAPP encompasses the total payment (direct or indirect) made, or to be made, for the imported merchandise by the buyer to, or for the benefit of, the seller.
- It includes all payments made as a condition of sale.
- Customs valuation is **NOT** an automatic "FOB" assumption. Customs value is determined strictly by examining commercial terms, proof of payment, and statutory additions/deductions.

### 3.3 Statutory Additions (19 U.S.C. § 1401a(b)(1))
The following amounts must be added to PAPP to the extent they are incurred by the buyer, are not already included in the price, and are supported by objective, quantifiable data:
1. **Packing Costs:** Incurred by the buyer with respect to the merchandise (containers, coverings, labor).
2. **Selling Commissions:** Incurred by the buyer. *(Note: Legitimate buying commissions paid to an independent buyer's purchasing agent are NOT dutiable).*
3. **Assists:** The value of goods or services provided directly or indirectly by the buyer free of charge or at reduced cost for use in connection with production or sale (tooling, molds, dies, engineering/design executed outside the US).
4. **Royalty or License Fees:** Required to be paid by the buyer, directly or indirectly, as a condition of the sale for exportation to the US.
5. **Resale Proceeds:** The proceeds of any subsequent resale, disposal, or use of the merchandise that accrue directly or indirectly to the seller.

### 3.4 Elimination of Assumed Freight Deductions (19 U.S.C. § 1401a(b)(4)(A))
Under explicit statutory terms, the price actually paid or payable **shall not include**:
> *"Any reasonable cost or charge that is incurred for... transportation, insurance, and related services incident to the international shipment of the merchandise from the country of exportation to the place of importation in the United States."*

- **STRICT PROHIBITION ON ASSUMED FREIGHT DEDUCTIONS:**
  - A freight or insurance deduction is legally permitted **only if supported by actual transaction facts and sufficient supporting documentation** (e.g. carrier bill of lading, air waybill, or actual freight invoice).
  - The calculator **must never assume a deduction merely because freight is separately entered or appears reasonable**.
  - If required evidentiary documentation is missing, the engine **must not fabricate a deduction**.
  - In such circumstances, the calculator marks valuation status as **`UNRESOLVED`** or **`PARTIALLY_VERIFIED`**, explicitly documents the missing evidence, and warns that CBP assesses duty on the full unadjusted gross price if freight documentation is absent.
  - An overall `VERIFIED` landed-cost result is **strictly prohibited** when freight or valuation evidence is incomplete.

### 3.5 Related-Party Transactions & Invalidation of Transaction Value
- Under 19 U.S.C. § 1401a(b)(2), if buyer and seller are related (§ 1401a(g)), transaction value is acceptable **only** if the relationship did not influence the price, or if transaction value closely approximates recognized test values.
- If transaction value cannot be used (§ 1401a(a)(1)), secondary valuation methods must be applied. BorderBrief AI flags any non-transaction-value scenario as **`UNRESOLVED`**.

---

## 4. Section 301 Trade Remedies & Corrected Legal Interpretation

### 4.1 Column 1 General Rates & Ineligibility for Special Programs
- **WTO / NTR Baseline:** Goods of Indian origin are assessed at Column 1 General MFN rates.
- **Ineligibility for Special Rates:** India's GSP status was terminated on June 5, 2019 (Presidential Proclamation 9902), the statutory GSP program lapsed on December 31, 2020, and no bilateral US-India FTA exists. Special rate indicators (`A`, `AU`, etc.) are strictly disregarded for India.

### 4.2 July 2026 Section 301 Action (`9903.05.44` @ 10%)
- **Statutory Authority:** USTR Notice of Actions, Federal Register document **2026-15181** (July 2026); Presidential Memorandum dated **July 23, 2026**; CBP **CSMS #69326983**.
- **Effective Date:** **July 24, 2026**.
- **Statutory Provision:** Chapter 99 Subchapter V, **Heading `9903.05.44`**.
- **Additional Duty Rate:** **10% ad valorem** on covered products originating in India.
- **Distinction from Terminated IEEPA Duties:** Former emergency duties under the International Emergency Economic Powers Act (IEEPA) were **formally terminated in February 2026**. The July 2026 Section 301 action is an active, distinct trade remedy and must not be conflated with IEEPA.

### 4.3 Critical Correction: Legal Nature of Annex I and Annex II Part A
An inspection of the official USTR Federal Register document 2026-15181, including the general description of annexes and Section 24 (Determination on India), establishes the following authoritative legal structure:
- **General Scope of the Action:** The 10% additional ad valorem duty on products of India applies to covered merchandise originating in India **except as provided in Annex I and Annex II, Part A**.
- **Both Annex I and Annex II Part A are EXEMPTION Schedules:**
  - Products listed in Annex I are **exemptions** from the Section 301 action.
  - Products listed in Annex II Part A (“Goods of Any Investigated Economy”) are **exemptions** from the Section 301 action.
  - **Correction:** It was an error to describe Annex I as an "affirmative covered list" of products subject to Section 301. Annex I does **not** designate goods for duties; it designates **exemptions**.
- **Correct Legal Mechanism for Indian Merchandise:**
  1. Merchandise originating in India is subject to the additional 10% duty under `9903.05.44` **unless** it qualifies for an exemption.
  2. To determine if an exemption applies, evaluate:
     - Specific Chapter 99 subheadings `9903.05.85` through `9903.05.92`.
     - **Annex I Exemption List:** Is the HTS provision listed in Annex I?
     - **Annex II Part A Exemption List:** Is the HTS provision listed in Annex II Part A, and does the article satisfy any specified `Ex` scope limitations?
  3. If an HTS provision is **absent from both Annex I and Annex II Part A**, and does not qualify under `9903.05.85`–`9903.05.92`, then **no exemption applies**, and the product is **subject to the 10% duty under `9903.05.44`** (`VERIFIED_SUBJECT`).
  4. If annex evidence is unverified or ambiguous, the Section 301 status is marked **`UNRESOLVED`**. Under no circumstances will uncertainty be converted into a zero duty.

### 4.4 Verified Legal Scopes of Chapter 99 Subheadings under U.S. Note 52

| Heading | Verified Legal Scope (USITC 2026 Rev 22 / U.S. Note 52) | Critical Negative Finding (What It Is NOT) |
| :--- | :--- | :--- |
| **`9903.05.44`** | Additional 10% ad valorem duty on covered products originating in India (effective July 24, 2026; USTR Doc 2026-15181; CSMS #69326983). Attaches in addition to Column 1 rates. | Distinct from terminated February 2026 IEEPA duties. |
| **`9903.05.85`** | **Narrow In-Transit Transition Exemption** for merchandise exported from India prior to July 24, 2026 and entered for consumption before the specified cutoff date. | **NOT a foodstuff or agricultural exemption.** Glazed mugs, tea, and other consumer goods cannot claim this transition heading. |
| **`9903.05.86`** | Specific statutory HTS provision exclusion list set forth in U.S. Note 52(b). | Covers only the precise 8-digit/10-digit lines enumerated in Note 52(b). |
| **`9903.05.87`** | Enumerated products meeting technical specifications detailed in U.S. Note 52(c). | Limited to strictly enumerated industrial and manufacturing articles. |
| **`9903.05.88`** | **Civil Aircraft, Aircraft Engines, and Qualifying Aerospace Parts.** | **NOT a handloom, textile, or craft exemption.** Handloom textiles and silk scarves cannot claim this heading. |
| **`9903.05.89`** | **Qualifying Pharmaceutical-Use Articles** and designated active pharmaceutical ingredients (APIs). | Strictly confined to medical and pharmaceutical articles. |
| **`9903.05.90`** | **Coordinated Wood Products under U.S. Note 52(f):** Specifically limited to wood articles coordinated with Section 232 provisions (`9903.76.01`, `9903.76.02`, `9903.76.03`, and `9903.76.20` through `9903.76.24`). | **NOT a general exemption for primary timber (4403/4407), nor does it cover finished tableware/kitchenware under 4419.** Wooden coasters and tableware are NOT exempt under `9903.05.90`. |
| **`9903.05.91`** | **Qualifying Humanitarian Donations** and disaster relief consignments certified under U.S. Note 52(h). | **NOT a silver jewelry, hallmark, or precious metal exemption.** Commercial jewelry under Heading 7113 cannot claim `9903.05.91`. |
| **`9903.05.92`** | **Informational Materials** (books, publications, newspapers, music manuscripts under Chapter 49). | Limited to printed and informational media. |

### 4.5 Wood-Products Conclusion: Note 52(f) vs. Annex II Part A Independence
A critical distinction must be maintained between:
1. **The Specific Provisions Referenced by U.S. Note 52(f) and Heading 9903.05.90:** Note 52(f) coordinates Section 301 action with preexisting Section 232 wood-product tariff-rate quotas and duty provisions (`9903.76.01`–`03`, `9903.76.20`–`24`). Heading 4419 finished tableware is **not** among these Section 232 provisions.
2. **Independent Exclusions under Annex II Part A:** Annex II Part A is an independent exclusion schedule under the Section 301 action. One **must not infer Annex II treatment solely from the fact that Heading 4419 is outside the referenced Section 232 wood-product headings**.
3. **Sheesham Coasters Classification Ambiguity & Calculation Blocking:** For Sheesham coasters, the classification between `4419.20.90.00` and `4419.90.91.00` remains unresolved (`primaryCandidate === null`). By strict contract rules, unresolved classification ambiguity results in an overall calculation status of **`BLOCKED`**. Conditional tariff scenarios belong in research documentation only, not as an active calculated result.

---

## 5. Actual Seed Inventory & Exemption Re-Audit (Annex I & Annex II Part A)

### 5.1 Reconciled Seven Core Seed Product Profiles ([`src/data/seed-products.ts`](file:///d:/BorderBrief%20AI/src/data/seed-products.ts))
Direct inspection of `src/data/seed-products.ts` establishes that the actual, authoritative seven core seed export profiles are:
1. `prod-cotton-bag` — Handmade Hand-Printed Cotton Tote Bag
2. `prod-brass-statue` — Handcrafted Cast Brass Ganesha Figurine
3. `prod-silk-scarf` — Hand-Woven Mulberry Silk Shawl / Scarf
4. `prod-ceramic-mug` — Studio Pottery Hand-Thrown Glazed Ceramic Mug
5. `prod-wooden-coasters` — Hand-Carved Sheesham Wood Coasters (Set of 6)
6. `prod-leather-wallet` — Full-Grain Vegetable-Tanned Leather Bi-Fold Wallet
7. `prod-darjeeling-tea` — Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g)

*(Note: "Decorative Brass Bell" `8306.10.00.00` and "Handmade Silver Filigree Earrings" `7113.11.50.00` are supplementary catalogue entries in `authoritative-store.ts`, not core seed profiles in `seed-products.ts`).*

### 5.2 Re-Audit of All Seven Seed Products (Under Corrected Exemption Analysis)
Every product is evaluated to determine whether it qualifies for an exemption under Annex I, Annex II Part A, or Chapter 99:

| Core Seed Product ID & Name | Actual HTS-10 Code & Provision Checked | Annex I Exemption Search (India Specific) | Annex II Part A Exemption Search (General, pp. 42–60) | Scope Limitations & Actual Product Analysis | Section 301 Component Status & Rate | Overall Landed Cost Calculation Status | Illustrative Combined Duty Rate *(Example Only)* |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **`prod-cotton-bag`**<br>Handmade Cotton Tote Bag | Subheading `4202.92.15`<br>(HTS-10: `4202.92.15.00`) | Absent from Annex I exemption list. | Absent from Annex II Part A (search of Ch. 42, p. 48). No matching listed provision. | Standard commercial cotton canvas shopping bag cannot satisfy any exemption. | **`VERIFIED_SUBJECT`**<br>(10.0% duty under `9903.05.44`) | `VERIFIED`<br>*(if valuation documented & fees resolved)* | 16.3% *(6.3% base + 10.0% Sec 301)* |
| **`prod-brass-statue`**<br>Cast Brass Ganesha Figurine | Subheading `8306.29.00`<br>(HTS-10: `8306.29.00.00`) | Absent from Annex I exemption list. | Absent from Annex II Part A (search of Ch. 83, p. 56). No matching listed provision. | Solid cast brass religious figurine is an ornament of base metal; no exemption applies. | **`VERIFIED_SUBJECT`**<br>(10.0% duty under `9903.05.44`) | `VERIFIED`<br>*(if valuation documented & fees resolved)* | 10.0% *(0.0% base + 10.0% Sec 301)* |
| **`prod-silk-scarf`**<br>Mulberry Silk Shawl / Scarf | Subheading `6214.10.10`<br>(HTS-10: `6214.10.10.00`) | Absent from Annex I exemption list. | Absent from Annex II Part A (search of Ch. 62, p. 52). No matching listed provision. | Woven silk scarf with zari border; heading `9903.05.88` covers aircraft only. | **`VERIFIED_SUBJECT`**<br>(10.0% duty under `9903.05.44`) | `VERIFIED`<br>*(if valuation documented & fees resolved)* | 11.2% *(1.2% base + 10.0% Sec 301)* |
| **`prod-ceramic-mug`**<br>Glazed Ceramic Mug | Subheading `6912.00.44`<br>*(Alt: `6911.10.45`)* | Absent from Annex I exemption list. | Absent from Annex II Part A (search of Ch. 69, p. 54). No matching listed provision. | Glazed ceramic drinking mug cannot claim in-transit heading `9903.05.85` or Annex II. | **`VERIFIED_SUBJECT`**<br>(10.0% duty under `9903.05.44`) | `VERIFIED` (if body confirmed) / `BLOCKED` (if body unknown) | 20.0% (Stoneware) / 24.0% (Porcelain) |
| **`prod-wooden-coasters`**<br>Sheesham Wood Coasters | Subheadings `4419.20.90` / `4419.90.91` | Absent from Annex I exemption list. | Heading 4419 not confirmed as an exemption on Annex II Part A (Ch. 44, p. 49). | Unresolved classification between tropical vs non-tropical wood (`primaryCandidate === null`). Public docket petitions remain unadjudicated. | **`UNRESOLVED`**<br>(10.0% additional duty unconfirmed) | **`BLOCKED`**<br>*(Classification unresolved; scenarios in research only)* | 3.2% (if exempt) vs 13.2% (if covered) *(Research scenario bounds only)* |
| **`prod-leather-wallet`**<br>Leather Bi-Fold Wallet | Subheading `4202.31.60`<br>(HTS-10: `4202.31.60.00`) | Absent from Annex I exemption list. | Absent from Annex II Part A (search of Ch. 42, p. 48). No matching listed provision. | Full-grain leather bi-fold wallet; standard pocket article. No exemption applies. | **`VERIFIED_SUBJECT`**<br>(10.0% duty under `9903.05.44`) | `VERIFIED`<br>*(if valuation documented & fees resolved)* | 18.0% *(8.0% base + 10.0% Sec 301)* |
| **`prod-darjeeling-tea`**<br>Darjeeling Black Tea (100g) | Subheading `0902.30.00`<br>(HTS-10: `0902.30.00.90`) | Absent from Annex I exemption list. | Unverified whether Chapter 09 tea qualifies under Annex II Part A agricultural schedules (p. 43). | Loose black tea in retail tins $\le 3\text{ kg}$; agricultural exclusion scope unverified in official docket. | **`UNRESOLVED`**<br>(0.0% or 10.0% additional duty) | **`PARTIALLY_VERIFIED`**<br>*(Base Free verified; Sec 301 conditional)* | 0.0% (if exempt) vs 10.0% (if covered) *(Conditional scenario bounds)* |

### 5.3 Supplementary Catalogue Entries (from `authoritative-store.ts`)

| Supplementary Item | HTS-10 Code & Provision Checked | Annex I Exemption Search | Annex II Part A Exemption Search | Section 301 Component Status & Rate | Overall Landed Cost Calculation Status | Illustrative Combined Duty Rate |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: |
| **Decorative Brass Bell** | Subheading `8306.10.00`<br>(HTS-10: `8306.10.00.00`) | Absent from Annex I. | Absent from Annex II Part A (p. 56). No exemption applies. | **`VERIFIED_SUBJECT`** (10.0%) | `VERIFIED` *(if valuation documented & fees resolved)* | 15.8% *(5.8% base + 10.0% Sec 301)* |
| **Silver Filigree Earrings** | Subheading `7113.11.50`<br>(HTS-10: `7113.11.50.00`) | Absent from Annex I. | Absent from Annex II Part A (p. 55). `9903.05.91` is humanitarian donations only. | **`VERIFIED_SUBJECT`** (10.0%) | `VERIFIED` *(if valuation documented & fees resolved)* | 15.0% *(5.0% base + 10.0% Sec 301)* |

---

## 6. Merchandise Processing Fee (MPF) & Express Consignment / Centralized Hub Facility Fee Model

Merchandise Processing Fee is assessed by CBP under **19 U.S.C. § 58c** and **19 C.F.R. § 24.23**, adjusted annually for inflation under the FAST Act.

### 6.1 Official FY2027 Fee Schedule (Effective October 1, 2026 – September 30, 2027)
Published in the Federal Register: **91 FR 48398, Doc. 2026-15530 (July 31, 2026)**, effective **October 1, 2026**:

| Fee Component | Statutory Basis | FY2027 Statutory Amount | Exact Application Rules in BorderBrief AI |
| :--- | :--- | :---: | :--- |
| **Formal Entry Ad Valorem Rate** | 19 C.F.R. § 24.23(b)(1)(i)(A) | **0.3464%** | Applies to commercial entered customs value for formal entries (commercial value $> \$2,500$ or mandatory formal). |
| **Formal Entry Minimum** | 19 C.F.R. § 24.23(b)(1)(i)(B) | **$34.58** | Assessed whenever `Customs Value * 0.003464 < $34.58`. |
| **Formal Entry Maximum** | 19 C.F.R. § 24.23(b)(1)(i)(B) | **$670.86** | Cap on formal MPF. Assessed whenever `Customs Value * 0.003464 > $670.86` (reached at customs values $\ge \$193,666.28$). |
| **Formal Manual Surcharge** | 19 C.F.R. § 24.23(b)(1)(ii) | **$4.15** | Surcharge if formal entry is filed on paper without Automated Broker Interface (ABI). BorderBrief assumes electronic filing ($0.00 surcharge) by default. |
| **Informal Automated Entry** | 19 C.F.R. § 24.23(b)(2)(i) | **$2.77** | Flat fee for commercial informal entries ($\le \$2,500$) filed electronically (ABI) not prepared by CBP. |
| **Informal Manual (Not CBP Prepared)** | 19 C.F.R. § 24.23(b)(2)(ii) | **$8.30** | Flat fee for commercial informal entries filed on paper, not prepared by CBP personnel. |
| **Informal Manual (Prepared by CBP)** | 19 C.F.R. § 24.23(b)(2)(iii) | **$12.45** | Flat fee for informal entries prepared by CBP customs officers at the port of arrival. |

### 6.2 Express Consignment Carrier Facility (ECCF) & Centralized Hub Facility Fee Treatment (19 C.F.R. § 24.23)
The terminology and separate obligations under **19 U.S.C. § 58c** and **19 C.F.R. § 24.23** must be strictly distinguished:
- **Statutory Terms:** Use strictly **Express Consignment Carrier Facility (ECCF)** and **Centralized Hub Facility** as defined in 19 C.F.R. § 24.23(b)(4). Do **NOT** use "Centralized Examination Station (CES)" as a synonym for either facility. (A CES is a privately operated physical inspection site designated under 19 C.F.R. Part 151, not an express consignment clearance facility).
- **Five Separate Statutory Obligations:**
  1. **Carrier/Operator Waybill Fee (19 C.F.R. § 24.23(b)(4)):** The FY2027 fee of **$1.38 per individual air waybill or bill of lading** (91 FR 48398) is paid quarterly directly to CBP by the **qualifying carrier or operator using an ECCF or Centralized Hub Facility**.
  2. **Not Automatically Assigned to Every DHL or FedEx Shipment:** The $1.38 fee does not apply simply because a private courier transports the goods. It applies **only** if the consignment is processed through an authorized ECCF or Centralized Hub Facility. Regular air cargo, postal channels, or standard freight forwarders are not subject to this fee.
  3. **Informal MPF Express Consignment Exception (19 C.F.R. § 24.23(b)(2)(i)):** Under § 24.23(b)(2)(i), informal MPF ($2.77) applies to commercial informal entries $\le \$2,500$, but explicitly exempts express consignment shipments where the carrier/facility pays the waybill fee under paragraph (b)(4). **Do NOT charge both informal MPF ($2.77) and the $1.38 ECCF fee merely because a shipment is low value.**
  4. **Formal Entry MPF on Shipments $\le \$2,500$ at an ECCF/Hub:** When a shipment valued at $2,500$ or less is required to undergo **formal entry** (e.g. Partner Government Agency detention, anti-dumping proceedings, or specific quota restrictions under 19 C.F.R. § 143.21/22), the **importer of record owes the formal ad valorem MPF (0.3464% with the $34.58 minimum)** on the entry summary (CBP Form 7501).
  5. **Private Courier Commercial Surcharges:** Private courier brokerage, advancement, and disbursement charges ($10–$15) are commercial service fees billed by express carriers to importers for advancing funds, completely separate from statutory CBP user fees.

---

## 7. Harbor Maintenance Fee (HMF) Statutory Audit & Informal Exemption

### 7.1 Statutory Authority & Rate
- Enacted under the Water Resources Development Act of 1986 (26 U.S.C. § 4461–4462) and codified in **19 C.F.R. § 24.24**.
- Statutory ad valorem rate: **0.125%** (0.00125) of commercial cargo value.
- Caps: **There is NO minimum fee and NO maximum cap.**

### 7.2 Statutory Exemption for Cargo Entitled to Informal Entry (19 C.F.R. § 24.24(d)(3)(i))
Under **19 C.F.R. § 24.24(d)(3)(i)**:
> *"The fee shall not apply to: ... (3) The following are not subject to the fee: (i) Commercial cargo entering under the informal entry procedures of part 143 of this chapter..."*
- **Scope of Exemption:** Applies to shipments **entitled to informal entry under 19 C.F.R. § 143.21** (commercial shipments $\le \$2,500$ that do not require mandatory formal entry).
- **Waterborne vs. Air:**
  - Air freight (`AIR_EXPRESS`, `AIR_CARGO`) and postal shipments are **exempt because they are not waterborne cargo**.
  - Ocean cargo (`OCEAN_LCL`, `OCEAN_FCL`) valued at $\le \$2,500$ entitled to informal entry under Part 143 incurs **$0.00 HMF**.
  - Ocean cargo valued at $> \$2,500$ (or $\le \$2,500$ subject to mandatory formal entry) is assessed at **0.125% of commercial customs value**.
- **Unresolved Handling:** If cargo eligibility for informal entry cannot be confirmed (e.g. uncertain PGA restrictions), HMF status must be reported as **`UNRESOLVED`**.

---

## 8. Separate Duty Components Mandate & Illustrative Totals

The calculator engine must **never store or calculate from hardcoded combined percentages** (e.g., storing "16.3%" or "20.0%"):
1. **Base Customs Duty:** Calculated independently from Column 1 General rate in USITC 2026 Revision 22.
2. **Section 301 Duty:** Calculated independently from Heading `9903.05.44` (10.0%).
3. **Other Chapter 99 Duties:** Evaluated independently from specific applicable provisions.
4. **Exemptions:** Evaluated independently against verified primary sources.
5. **Effective Dates & Citations:** Each component carries its own independent statutory authority.
- **Strict Distinction:** A sum of base and additional duty rates (e.g. 6.3% + 10.0% = 16.3%) is an **illustrative arithmetic example only**, NOT a verified landed-cost figure. Landed cost incorporates customs valuation, MPF, HMF, and international freight.

---

## 9. Reconciled Calculation Status Architecture (4-State Enum)

The overall calculation status enum has **strictly four defined values**:
- **`VERIFIED`**
- **`PARTIALLY_VERIFIED`**
- **`ESTIMATED`**
- **`BLOCKED`**

```
[ Landed Cost Calculation Status ]
               │
  ┌────────────┼───────────────────────────┬──────────────────────────┐
  ▼            ▼                           ▼                          ▼
[ VERIFIED ] [ PARTIALLY_VERIFIED ]     [ ESTIMATED ]              [ BLOCKED ]
  │            │                           │                          │
  │ All facts  │ Base verified; Sec 301,   │ Preliminary advisory     │ Classification ambiguous,
  │ verified   │ HMF, or freight deduction │ calculation based on     │ uncataloged HTS, or
  ▼            │ conditional (scenarios)   │ user provisional values  │ invalid valuation
HTTP 200       ▼                           ▼                          ▼
Definitive     HTTP 200                    HTTP 200                   HTTP 422
Calculation    Baseline + Scenario Bounds  Advisory Indication Only   Calculation Refused
```

### 9.1 Rigorous Overall Verification Criteria
Assigning an overall calculation status of **`VERIFIED`** requires that ALL of the following criteria are satisfied:
1. **Resolved and Supported HTS Classification:** Unambiguous 10-digit code confirmed by the user (`status === "CLASSIFIED"` and `primaryCandidate !== null`).
2. **Verified Column 1 General Base Duty:** Resolved from USITC 2026 Revision 22.
3. **Verified Section 301 Applicability & Exemption Analysis:** Confirmed as subject (`VERIFIED_SUBJECT`) or confirmed as exempt under primary legal sources (`VERIFIED_EXEMPT`).
4. **Verified Other Applicable Chapter 99 Measures:** Evaluated and confirmed.
5. **Supported Customs Valuation:** Transaction value supported by actual transaction facts and sufficient documentation (no undocumented deductions; unrelated parties or valid test value; assists/royalties quantified).
6. **Resolved Applicable MPF & HMF Treatment:** Entry category (informal vs. formal) and freight mode eligibility established.
7. **Resolved Entry & Shipment Assumptions:** Express hub status, carrier documentation, and commercial DAP assignment established.
8. **Effective Dates & Authoritative Citations Stamped:** USITC Revision 22 and Federal Register notices cited.

### 9.2 Critical Status Guardrails:
1. **Component Verification vs. Overall Verification:** A verified Section 301 component (`VERIFIED_SUBJECT`) does **NOT** imply that the overall landed-cost result is verified. If customs valuation lacks documentation or fee treatment is conditional, the overall status is `PARTIALLY_VERIFIED`.
2. **Wooden Coasters Overall Status is BLOCKED:** Because Sheesham wood coasters have unresolved classification ambiguity between `4419.20.90.00` and `4419.90.91.00`, the overall status is **`BLOCKED`**. Scenario bounds are maintained in research documentation only.
3. **Definition of ESTIMATED:** `ESTIMATED` applies strictly to preliminary advisory calculation requests based on user-declared provisional figures. It **does NOT assume unsupported freight deductions, arbitrary entry treatment, or fabricated exemptions**.
4. **Zero-Defaulting Prohibition:** Unknown base duty, additional duty, exemption, valuation, or fee treatment **never silently becomes zero**.

---

## 10. Curated Tariff Dataset Limitation (30 Records)

- **Store Size:** [`src/lib/tariff/authoritative-store.ts`](file:///d:/BorderBrief%20AI/src/lib/tariff/authoritative-store.ts) contains **exactly 30 curated records**.
- **Refusal to Calculate Uncataloged Codes:** If an HTS code is not present in the curated store, the calculator returns `DATASET_COVERAGE_UNSUPPORTED` (HTTP 422). Under no circumstances will any rate be estimated or invented.

---

## 11. Delivered at Place (DAP) Demonstration Workflow Assessment

- **DAP (Delivered at Place):**
  - **Seller (India):** Responsible for carriage to named destination; collects `Merchandise Price + Agreed Shipping` via PayPal Orders API v2.
  - **Buyer (USA):** Responsible for customs clearance; pays customs duties, Section 301 additional duties, MPF, and carrier disbursement fees upon US border arrival.
- **PayPal Realities:** PayPal never collects or remits customs duties, Section 301 duties, or MPF. BorderBrief AI provides upfront landed-cost visibility so the US buyer is not surprised by post-arrival bills.

---

## 12. FINAL SECTION 301 LEGAL INTERPRETATION & CONSISTENCY GATE — NOVEMBER 7, 2026

### 1. Annex I and Annex II Exemption Interpretation Corrected
- Formally corrected the misinterpretation of Annex I. Re-reading USTR Document 2026-15181 (Section 24) establishes that the Section 301 10% action on India applies **except as provided in Annex I and Annex II, Part A**.
- Both Annex I and Annex II Part A are **exemption** schedules.
- Replaced all incorrect descriptions of Annex I as an "affirmative covered list." Merchandise is subject to 10% duty under `9903.05.44` because it is covered by the general Section 301 determination on India and is **absent from both exemption annexes**.

### 2. Seven Core Seed Products Re-Audited
- **Cotton Tote Bag (`4202.92.15.00`):** Absent from Annex I and Annex II Part A exemptions; Section 301 component is `VERIFIED_SUBJECT` (10.0%).
- **Brass Statue (`8306.29.00.00`):** Absent from Annex I and Annex II Part A exemptions; Section 301 component is `VERIFIED_SUBJECT` (10.0%).
- **Silk Scarf (`6214.10.10.00`):** Absent from Annex I and Annex II Part A exemptions; `9903.05.88` covers aircraft only; Section 301 component is `VERIFIED_SUBJECT` (10.0%).
- **Ceramic Mug (`6912.00.44.00`):** Absent from Annex I and Annex II Part A exemptions; Section 301 component is `VERIFIED_SUBJECT` (10.0%).
- **Leather Wallet (`4202.31.60.00`):** Absent from Annex I and Annex II Part A exemptions; Section 301 component is `VERIFIED_SUBJECT` (10.0%).
- **Wooden Coasters (`4419.20.90.00` / `4419.90.91.00`):** Classification ambiguity unresolved (`primaryCandidate === null`); overall status is **`BLOCKED`**. Section 301 status is `UNRESOLVED`. Scenario bounds remain in research documentation only.
- **Darjeeling Tea (`0902.30.00.90`):** Agricultural exclusion status on Annex II Part A unverified in official docket; Section 301 status is `UNRESOLVED`; overall status is `PARTIALLY_VERIFIED`.

### 3. Elimination of Assumed Freight Deductions
- Eradicated all wording suggesting a "reasonable freight deduction assumed."
- Deductions under 19 U.S.C. § 1401a(b)(4)(A) strictly require actual transaction facts and sufficient documentation. Missing evidence results in `PARTIALLY_VERIFIED` or `BLOCKED`.

### 4. ECCF & Centralized Hub Terminology and User Fee Model
- Codified precise terms under 19 C.F.R. § 24.23: **Express Consignment Carrier Facility (ECCF)** and **Centralized Hub Facility**.
- Codified that the FY2027 $1.38 waybill fee is paid by the carrier/facility operator, and does not apply to every courier shipment.
- Enforced the § 24.23(b)(2)(i) exception: low-value express consignments do not double-pay informal MPF ($2.77) and the waybill fee.
- Reaffirmed that formal entry at $\le \$2,500$ triggers formal MPF ($34.58 minimum).

### 5. Implementation Readiness
- All legal citations, status state machines, fee formulas, and valuation guardrails are verified and reconciled.
- The documentation is **FULLY READY FOR SPRINT 4 IMPLEMENTATION** upon user authorization.
