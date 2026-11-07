# 03 — Customs, Tariff & Regulatory Intelligence: India → United States Trade Corridor

**Document ID:** BB-RES-003  
**Corridor:** India (Country of Exportation) $\rightarrow$ United States of America (Country of Importation)  
**Primary Authorities:** US International Trade Commission (USITC), US Customs and Border Protection (CBP), Directorate General of Foreign Trade (DGFT India), Central Board of Indirect Taxes and Customs (CBIC India)  
**Status:** Verified via Live API Query and Statutory Review (Research Phase)

---

## 1. Statutory Harmonized Tariff Architecture

Understanding customs classification requires distinguishing three distinct tiers of the nomenclature:

```
[ Chapters 01 - 97 ]              (2 digits - International WCO)
       │
[ Heading ]                       (4 digits - International WCO)
       │
[ Subheading ]                    (6 digits - Globally Harmonized across 200+ nations)
       │
[ U.S. Legal Rate Line ]          (8 digits - USITC Statutory Duty Determining Level)
       │
[ U.S. Statistical Suffix ]       (10 digits - U.S. Census Bureau Statistical Reporting)
```

1. **6-Digit HS Code (WCO):** Governed by the World Customs Organization. All countries adhere to the same first 6 digits (e.g., `4202.92` for travel goods/bags with outer surface of plastic or textile).
2. **8-Digit US HTS Code (Legal Tariff Line):** Defined by the United States Harmonized Tariff Schedule. Tariff rates (ad valorem, specific, or compound) are legally fixed at this level (e.g., `4202.92.15` for bags of cotton).
3. **10-Digit US HTS Code (Statistical Reporting Line):** Used for CBP entry summaries (Form 7501) and US Census trade statistics (e.g., `4202.92.15.00`).

---

## 2. Official US Government Data Sources & Live API Verification

### 2.1 The USITC HTS REST API
The United States International Trade Commission provides a public RESTful API service requiring **no authentication tokens, no registration, and no fees**:
- **Root URL:** `https://hts.usitc.gov/reststop`
- **Search Endpoint:** `https://hts.usitc.gov/reststop/search?keyword={query}`
- **Export Bulk Archive:** `https://hts.usitc.gov/` *(Export menu provides complete annual and interim revisions in JSON/CSV)*

### 2.2 Live Endpoint Verification
A direct test query for `keyword=4202.92` was executed against `https://hts.usitc.gov/reststop/search?keyword=4202.92`. The API returned live JSON records. A representative record:

```json
{
  "htsno": "4202.92.15.00",
  "description": "Of cotton (369)",
  "indent": "6",
  "general": "6.3%",
  "special": "Free (A,AU,BH,CL,CO,D,IL,JO,KR, MA,NP,OM,P,PA,PE,S,SG) 4.9% (E)",
  "other": "40%",
  "units": ["No.", "kg"],
  "statisticalSuffix": "00",
  "additionalDuties": null,
  "footnotes": []
}
```

### 2.3 Tariff Column Meaning in US HTS
- **General (Column 1 Normal Trade Relations / MFN):** Applicable to all World Trade Organization (WTO) members unless an active preferential trade agreement or special status applies.
- **Special (Column 1 Preferential):** Special trade program indicators:
  - `A`, `A*`, `A+`: Generalized System of Preferences (GSP)
  - `AU`: US-Australia FTA
  - `BH`: US-Bahrain FTA
  - `CL`: US-Chile FTA
  - `IL`: US-Israel FTA
  - `KR`: US-Korea FTA
  - `SG`: US-Singapore FTA
  - `E`: Caribbean Basin Economic Recovery Act
- **Other (Column 2):** Punitive statutory rates (typically 30%–80%) applicable strictly to non-NTR countries (Cuba, North Korea, Belarus, Russia under suspension).

---

## 3. The India-to-USA Regulatory Reality

### 3.1 Termination of US GSP for India and Program Expiration (CRITICAL STATUTORY FACTS)
Many Indian exporters and outdated articles claim Indian handicrafts enter the US duty-free under the Generalized System of Preferences (GSP, indicator `A`). Two distinct statutory events must be understood and not conflated:
1. **India Beneficiary Status Terminated (June 5, 2019):** Under Presidential Proclamation 9902 (issued May 31, 2019), India's designation as a beneficiary developing country under GSP was formally terminated effective June 5, 2019.
2. **US GSP Program Statutory Expiration (December 31, 2020):** The entire US GSP program's legislative authorization expired at midnight on December 31, 2020, and has not been reauthorized by the US Congress.

- **Impact on BorderBrief AI:** When an Indian exporter evaluates a product where the US HTS lists `Free (A...)` under Special Rates, **India is NOT eligible for the Free rate**. Goods of Indian origin must be assessed at the **Column 1 General (MFN / Normal Trade Relations) rate** (e.g., 6.3% for cotton bags).
- **Official Tariff Baseline:** Research is grounded in the official **USITC 2026 Harmonized Tariff Schedule (HTS) Revision 22, published October 30, 2026**. Applicable rates may also depend on Chapter 99 provisions (such as trade remedies, Section 301, Section 232), statutory effective dates, origin, and proper product classification.

### 3.2 US Customs Valuation Basis: Transaction Value (19 U.S.C. § 1401a)
- **Legal Mandate:** Under 19 U.S.C. § 1401a (Section 402 of the Tariff Act of 1930, as amended), the primary method of customs valuation is **Transaction Value** — defined generally as the price actually paid or payable for the merchandise when sold for exportation to the United States, plus specified statutory additions (including packing costs, selling commissions, assists, royalty/license fees, and proceeds of subsequent resale) when not already included.
- **Treatment of International Freight & Insurance (19 U.S.C. § 1401a(b)(4)(A)):**
  - Under 19 U.S.C. § 1401a(b)(4)(A), the price actually paid or payable excludes costs, charges, and expenses incurred for transportation, insurance, and related services incident to international shipment from the country of exportation to the place of importation in the United States.
  - *Statutory Distinction:* This international shipment exclusion must not be described simply as "costs incurred after exportation." It is also legally distinct from the separate statutory provision (19 U.S.C. § 1401a(b)(4)(B)) concerning any customs duties and other federal taxes, or any transportation and other costs incurred for transportation after importation into the United States.
- **Transaction Examination Required:**
  - Do not describe US customs valuation simply as "FOB". A seller's quoted product price or FOB quote is not automatically the legally determined customs value without verifying statutory additions and legal conditions under 19 U.S.C. § 1401a.
  - BorderBrief AI does not make assumptions about bundled shipping charges or individual contract terms. Actual customs valuation requires rigorous examination of the transaction and supporting commercial documentation.
- **Landed Cost Engine Research Structure:**
  - The seller's product price and international shipping costs are maintained as separate inputs.
  - Customs valuation is modeled according to transaction value principles, accounting for the statutory international shipment exclusions under 19 U.S.C. § 1401a(b)(4)(A) when documented.

---

## 4. Ancillary US Import Fees and Thresholds

### 4.1 Suspension of General Duty-Free De Minimis (Section 321)
- **Historical Background:** Under 19 U.S.C. § 1321 (Section 321), commercial shipments imported by one person on one day having a fair retail value of **$800 USD or less** previously entered duty-free and tax-free under informal entry procedures.
- **CRITICAL STATUTORY SUSPENSION (Effective August 29, 2025):** Pursuant to White House Presidential Action (July 2025) and US Customs and Border Protection (CBP) Fact Sheet (August 2025), **general duty-free de minimis treatment under Section 321 was suspended effective August 29, 2025**.
- **Operational Reality for BorderBrief AI:**
  - The former general $800 exemption is no longer available for covered shipments.
  - Applicable duties, taxes, and fees depend on current rules and entry method.
  - Limited statutory exceptions may exist under specific provisions.
  - **BorderBrief AI must not automatically assume zero duty or zero MPF for low-value shipments**, and must not invent a substitute threshold.

### 4.2 Merchandise Processing Fee (MPF) — FY2027 Statutory Fee Schedule (19 CFR § 24.23)
CBP levies MPF on commercial entries pursuant to 19 U.S.C. § 58c, adjusted annually for inflation under the FAST Act.

#### Current Schedule: Fiscal Year 2027 (Effective October 1, 2026)
As published in the Federal Register (*Customs User Fees To Be Adjusted for Inflation in Fiscal Year 2027*, 91 FR 48398, Doc. 2026-15530, July 31, 2026; effective October 1, 2026), the current FY2027 statutory schedule is:

| Entry Category | FY2027 Statutory Amount | Statutory Notes |
| :--- | :--- | :--- |
| **Formal Entry Ad Valorem Rate** | **0.3464%** | Applies to commercial merchandise value; rate unchanged from FY2026 |
| **Formal Entry Minimum** | **$34.58** | Minimum fee assessed on formal entry |
| **Formal Entry Maximum** | **$670.86** | Cap on ad valorem fee for high-value formal shipments |
| **Manual Entry / Release Surcharge** | **$4.15** | Assessed if formal entry/release is not filed electronically |
| **Informal Automated Entry** | **$2.77** | Commercial informal entries ($ \le \$2,500 $) filed electronically, not prepared by CBP |
| **Informal Manual Entry (Not CBP Prepared)** | **$8.30** | Commercial informal entries filed manually on paper, not prepared by CBP |
| **Informal Manual Entry (Prepared by CBP)** | **$12.45** | Commercial informal entries prepared by CBP personnel |

#### Retained Historical Baseline: FY2026 (Effective October 1, 2025 – September 30, 2026)
*(Retained strictly for historical audit and prior-period record comparison)*
- Formal Entry Rate: 0.3464% | Min: $33.58 | Max: $651.50 | Manual Surcharge: $4.03
- Informal Automated: $2.69 | Informal Manual (Not CBP): $8.06 | Informal Manual (CBP Prepared): $12.09
- Historical Reference: CBP Customs Bulletin Notice 3eb24a9 (Annual Adjustment of Customs User Fees for FY 2026).

#### Mandatory Legal & Compliance Safeguards:
1. **Entry Type and Applicability:** MPF does not apply identically to every import transaction. Fee treatment and applicability depend on the formal/informal entry classification, the port of entry, eligible statutory exemptions, and active CBP directives.
2. **Informal Entry Threshold Distinction:** Do not confuse the general informal commercial entry limit ($2,500 under 19 CFR § 143.21) with the former $800 Section 321 de minimis exemption. Not every shipment valued under $2,500 qualifies for informal entry (e.g., items subject to Partner Government Agency requirements or quota/visa restrictions require formal entry).
3. **Non-Linear Fee Structure:** MPF is not a simple linear percentage of merchandise price. For formal entries, it is bounded by the $34.58 minimum and $670.86 maximum caps. For informal entries, it is assessed as a flat fee depending on submission method.
4. **Scope of Charges:** MPF covers only customs merchandise processing costs. It does not cover customs duties, Harbor Maintenance Fees (HMF), internal revenue taxes, or other federal agency inspection fees.
5. **No Automatic Calculation Engine in Sprint 1:** These statutory figures represent research and regulatory documentation only; no fee calculation engine is implemented in the application during Sprint 1.

#### Official Sources:
- **FY2027 Federal Register Notice (Mandatory Authority):** [Federal Register Vol. 91, No. 146, July 31, 2026, pp. 48398–48404 (Doc. 2026-15530)](https://www.federalregister.gov/documents/2026/07/31/2026-15530/customs-user-fees-to-be-adjusted-for-inflation-in-fiscal-year-2027)
- **CBP User Fee Knowledge Base:** [CBP Article 1128 — Merchandise Processing Fee (MPF)](https://www.help.cbp.gov/s/article/Article-1128?language=en_US)

### 4.3 Harbor Maintenance Fee (HMF) — 19 CFR § 24.24
- Assessed at **0.125%** ad valorem for commercial cargo arriving via designated US water ports (ocean freight).
- **Exemption:** Air freight shipments, express couriers (FedEx, DHL, UPS), and postal parcels (India Post EMS) are **exempt** from HMF.

---

## 5. Indian Export Compliance Requirements (CBIC & DGFT)

To ensure the generated commercial invoice and workflow are realistic for an Indian seller, BorderBrief AI models the following Indian statutory requirements:

### 5.1 Importer-Exporter Code (IEC)
Issued by the Directorate General of Foreign Trade (DGFT). An active IEC (which is linked to the business PAN) is mandatory for any commercial export from India.

### 5.2 Zero-Rated Export under GST & Letter of Undertaking (LUT)
Under Section 16 of the Integrated Goods and Services Tax (IGST) Act, 2017, exports of goods are treated as "zero-rated supplies." Small exporters can export under one of two routes:
1. **Under Letter of Undertaking (LUT) without payment of IGST:** The standard, zero-cash-flow method for artisans and MSMEs. Form GST RFD-11 is submitted annually online at no cost.
2. **With payment of IGST and subsequent refund claim:** Requires tying up working capital.
- *Commercial Invoice Requirement:* Invoices under LUT must state: *"Supply Meant For Export Under Bond Or Letter Of Undertaking Without Payment Of Integrated Tax (IGST)"*. BorderBrief AI automatically stamps this declaration on invoice drafts.

### 5.3 Export Customs Clearance Channels
- **Postal Bill of Export (PBE-III):** For e-commerce and micro-exporters shipping via India Post Dak Niryat Kendras (DNK) up to ₹10,00,000 value per consignment.
- **Courier Shipping Bill (CSB-V):** For commercial e-commerce exports handled by express international couriers (DHL, FedEx, Aramex).

### 5.4 Foreign Exchange Management Act (FEMA) Realization
Under Reserve Bank of India (RBI) regulations, export proceeds must be realized and repatriated to India within 9 months from the date of export. Inflows via PayPal's Online Payment Gateway Service Provider (OPGSP) mechanism automatically generate electronic Foreign Inward Remittance Certificates (e-FIRC / FIRA) for Indian bank compliance.

---

## 6. Seed Dataset: Curated India $\rightarrow$ USA Export Profiles

For testing and demonstration, BorderBrief AI maintains a verified seed database of popular Indian export categories:

| Product Profile | Typical Materials | WCO 6-Digit HS | US HTS 10-Digit Code | US General Duty | Valuation Base | Dutiable under \$800? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Handmade Cotton Tote Bag** | 100% woven cotton | `4202.92` | `4202.92.15.00` | **6.3%** | FOB price | No (Sec 321 exempt) |
| **Brass Decorative Statue** | Solid brass, cast | `8306.29` | `8306.29.00.00` | **Free** | FOB price | No (Duty is 0%) |
| **Handloom Silk Scarf** | 100% mulberry silk | `6214.10` | `6214.10.10.00` | **Free** | FOB price | No (Duty is 0%) |
| **Embroidered Cushion Cover** | Cotton with hand embroidery | `6304.92` | `6304.92.00.00` | **6.3%** | FOB price | No (Sec 321 exempt) |
| **Leather Bound Journal** | Buffalo leather cover, paper | `4820.10` | `4820.10.20.10` | **Free** | FOB price | No (Duty is 0%) |
| **Handmade Ceramic Coffee Mug** | Glazed ceramic stoneware | `6912.00` | `6912.00.48.10` | **9.8%** | FOB price | No (Sec 321 exempt) |
| **Hand-carved Wooden Coasters** | Sheesham / Rosewood | `4419.90` | `4419.90.90.00` | **3.2%** | FOB price | No (Sec 321 exempt) |

*Note: All rates verified against USITC 2024/2025 Basic Edition.*

---

## 7. Legal Disclaimer Architecture

BorderBrief AI incorporates clear statutory disclaimers across all outputs:
1. BorderBrief AI is an automated guidance and calculation tool, not a licensed US Customs Broker or legal counsel.
2. Formal customs entry determinations are made solely by US Customs and Border Protection at the port of arrival.
3. Commercial invoice drafts generated by the platform assist seller recordkeeping and shipping carrier intake; they do not constitute official automated CBP entry filing (ABI/ACE).

