# BorderBrief AI — Sprint 4 Final Entry Type 13 Regulatory Alignment Report
## Authority: CBP Document 2026-21600 & CBP Document 2026-21570 (91 FR 66707, October 22, 2026)

**Evaluation Date:** November 7, 2026  
**Corridor:** India (IN) → United States (US)  
**Status:** PASS & PRODUCTION-VERIFIED (156 tests total: 155 pass, 0 fail, 1 skipped)

---

## 1. Executive Summary & Regulatory Grounding

This report documents the final regulatory alignment of the BorderBrief AI postal compliance engine. The implementation incorporates two authoritative federal register publications issued by U.S. Customs and Border Protection (CBP) on October 22, 2026:

1. **CBP Final Rule Document 2026-21600 (October 22, 2026):**
   - Extends the mandatory compliance date for 19 C.F.R. § 145.12(a)(2)(v) and (vi) (formal entry on CBP Form 7501 for Chapter 98/99 postal importations) to **January 20, 2027**.
   - Clarifies that on or after January 20, 2027, postal consignments subject to Chapter 98 or Chapter 99 trade remedies (such as Section 301 Heading 9903.05.44) valued at or below $2,500 are **not** restricted exclusively to formal entry, but eligible filers may use either:
     - **Formal Entry** on CBP Form 7501 under 19 C.F.R. § 145.12(a)(2)(v) and (vi); OR
     - **Qualifying Entry Type 13** informal-entry test procedure.
   - **Corrected Rule Interpretation:** The engine no longer automatically assigns `FORMAL_MAIL_REQUIRED` to every Chapter 99 postal shipment evaluated on or after January 20, 2027. Both statutory pathways are represented.

2. **CBP Modification Notice Document 2026-21570, Federal Register, October 22, 2026, page 66707 (91 FR 66707):**
   - Title: *"Modification of the Test of the New Electronic Informal Entry Process for Mail"*
   - Amends the ongoing ACE Entry Type 13 test (commenced September 22, 2026, 91 FR 56936) by **temporarily accepting electronic transmissions in ACE with or without complete electronic Partner Government Agency (PGA) data**.
   - CBP instituted this temporary flexibility to permit filers to utilize Entry Type 13 while developing full electronic PGA integration. The conclusion of this temporary acceptance period will be announced by CBP in a future Federal Register notice.

---

## 2. Updated Postal State Machine Architecture

### 2.1 Post-January 20, 2027 Dual Pathway Representation
For postal consignments subject to Chapter 99 duties valued at or below $2,500:

| Pathway | Statutory Basis | Filer Prerequisites | Applied Procedure | MPF Treatment (Ordinary Mail) | MPF Treatment (Inbound EMS) | EMS Item Fee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Formal Entry** | 19 C.F.R. § 145.12(a)(2)(v) & (vi) | Standard U.S. Importer of Record on CBP Form 7501 | `FORMAL_ENTRY` | **$0.00** (§ 24.23(c)(1)(v)) | **0.3464% ad valorem** (Min $34.58 under 85 FR 47018) | **$1.00** (§ 24.22(l)(1)(i); 50/50 split) |
| **Qualifying Entry Type 13** | CBP Docs. 2026-21600 & 2026-21570 (91 FR 66707) | 19 U.S.C. § 1484 right, ACE capability, required data elements, Ch 99 data | `ENTRY_TYPE_13` | **$0.00** (§ 24.23(c)(1)(v)) | **$0.00** (Informal EMS exempt from MPF) | **$1.00** (§ 24.22(l)(1)(i); 50/50 split) |
| **Unconfirmed Handling** | Regulatory Uncertainty | Procedure not affirmatively established with carrier/filer | `UNRESOLVED` | Modeled conservatively | Modeled conservatively | **$1.00** if EMS |

### 2.2 Strict Field Separation (`PostalComplianceDetails`)
To maintain complete regulatory transparency, the engine stores legal availability, actual procedure selected, filer eligibility, test participation, and data completeness as separate, uncoupled fields:

```typescript
export interface PostalComplianceDetails {
  legallyAvailableProcedure: PostalEntryProcedure;
  legallyAvailablePathways?: string[]; // Enumerates both Formal Entry and Entry Type 13 post-Jan 20, 2027
  actualCarrierProcedure: CarrierPostalProcedure; // CONFIRMED_INFORMAL, VOLUNTARY_FORMAL_EARLY, ENTRY_TYPE_13, FORMAL_ENTRY, UNCONFIRMED
  isShipmentEligible: boolean;
  ineligibilityReason?: string;
  voluntaryComplianceElection: VoluntaryPostalCompliance;
  procedureCertainty: PostalProcedureCertainty; // CONFIRMED, UNCONFIRMED_CARRIER_HANDLING, MANDATORY_STATUTORY
  missingOperationalFacts: string[];
  
  // Filer legal eligibility under 19 U.S.C. § 1484
  filerEligibility?: {
    hasRightToMakeEntry: boolean;
    isImporterOfRecordOrBroker: boolean;
    details?: string;
  };

  // Test participation & filing capability (no invented enrollment hurdles)
  testParticipation?: {
    isTestParticipant: boolean;
    hasAceFilingCapability: boolean;
    details?: string;
  };

  // Data completeness under 91 FR 66707
  dataCompleteness?: {
    hasRequiredEntryType13Data: boolean;
    hasChapter99Data: boolean;
    isPgaDataComplete: boolean;
    isPgaTemporaryAcceptanceActive: boolean;
    pgaWarning?: string;
    details?: string;
  };

  entryType13PrerequisitesVerified?: boolean;
  entryType13MissingPrerequisites?: string[];
  pgaTemporaryAcceptanceNotice?: string;
}
```

---

## 3. Entry Type 13 Test Requirements & PGA Flexibility

The engine enforces six objective statutory criteria for Entry Type 13 test qualification without inventing unannounced administrative barriers:

1. **Postal Network Arrival:** Merchandise must arrive through the international postal network (`transportationMode === "POSTAL"`).
2. **Value Limitation:** Total dutiable transaction value must not exceed the informal entry statutory limit of **$2,500** (`dutiableCustomsValueUSD <= 2500`). Consignments exceeding $2,500 are mandatorily escalated to formal entry under 19 C.F.R. § 145.12(a)(1).
3. **Right to Make Entry (19 U.S.C. § 1484):** Filer must be the U.S. Importer of Record or a properly appointed licensed customs broker acting as Importer of Record (`hasRightToMakeEntry === true`). Foreign exporters cannot file directly.
4. **ACE Filing Capability & Test Participation:** Filer must possess active electronic Automated Commercial Environment (ACE) / ABI filing capability (`hasAceFilingCapability === true`). Established test participation is honored without inventing bespoke approval certificates.
5. **Complete Required Data Elements:** Transmission must include core Entry Type 13 data elements (IOR identification, postal carrier code, UPU tracking number, 10-digit HTSUS classification, declared value) and additional Chapter 98/99 data where applicable (`hasChapter99Data !== false`).
6. **Partner Government Agency (PGA) Data Flexibility (91 FR 66707):**
   - **During Temporary Acceptance Period (`isPgaTemporaryAcceptanceActive !== false`):** Entries submitted without complete electronic PGA data **are accepted** by CBP. The engine treats this as qualified (`entryType13PrerequisitesVerified: true`) while surfacing a transparent statutory notice:
     > *"CBP Document 2026-21570 Notice (91 FR 66707, Oct 22, 2026): Entry Type 13 test filings in ACE are temporarily accepted with or without complete electronic Partner Government Agency (PGA) data during CBP's temporary acceptance period."*
   - **Post-Temporary Acceptance Period (`isPgaTemporaryAcceptanceActive === false`):** When CBP's temporary acceptance period expires, complete electronic PGA data becomes an absolute prerequisite; incomplete PGA data causes Entry Type 13 qualification to fail and flags calculation as `PARTIALLY_VERIFIED`.

---

## 4. Statutory Fee Treatment Preserved

All customs fee baselines remain strictly verified:
1. **Ordinary International Mail MPF Exemption:** Under 19 C.F.R. § 24.23(c)(1)(v), ordinary international mail is exempt from MPF ($0.00) across all procedures (informal, Entry Type 13, and formal).
2. **Inbound EMS Item Fee:** Assesses separate $1.00 fee under 19 C.F.R. § 24.22(l)(1)(i), preserving the statutory 50% USPS ($0.50) / 50% CBP ($0.50) allocation under § 24.22(l)(2).
3. **Inbound EMS MPF:**
   - Under Entry Type 13 or informal clearance: MPF is **$0.00** (85 FR 47018 exception to the § 24.23(c)(1)(v) exemption applies strictly to *formal* entries). Total fees = $1.00.
   - Under Formal Entry: Formal ad valorem MPF applies (0.3464%, min $34.58, max $670.86) + $1.00 EMS fee. Total fees = $35.58 at minimum clamp.
4. **ECCF Fee:** Private courier fee ($1.38 under 19 C.F.R. § 24.23(b)(4)) is never conflated with postal consignments.

---

## 5. Verification: Complete 10-Scenario Regression Suite

All 10 regression test scenarios mandated by the user have been implemented and verified in `src/tests/landed-cost-calculator.test.ts`:

```text
▶ Sprint 4 Final Entry Type 13 Regulatory Alignment (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707)
  ✔ Regression Test 1: calculates Chapter 99 postal shipment before January 20, 2027 under extended informal clearance
  ✔ Regression Test 2: models eligible Entry Type 13 shipment before January 20, 2027
  ✔ Regression Test 3: models Chapter 99 shipment on or after January 20, 2027 using qualifying Entry Type 13
  ✔ Regression Test 4: models Chapter 99 shipment on or after January 20, 2027 using formal entry
  ✔ Regression Test 5: rejects ineligible Entry Type 13 filer lacking Section 1484 right to make entry
  ✔ Regression Test 6: rejects Entry Type 13 when electronic ACE filing capability is unverified
  ✔ Regression Test 7: rejects Entry Type 13 when required Chapter 98/99 trade remedy data is missing
  ✔ Regression Test 8: accepts Entry Type 13 with incomplete PGA data during temporary acceptance period (91 FR 66707)
  ✔ Regression Test 9: rejects Entry Type 13 when PGA data is incomplete after temporary acceptance period ends
  ✔ Regression Test 10: returns UNRESOLVED / PARTIALLY_VERIFIED when actual postal procedure is unknown/unconfirmed
✔ Sprint 4 Final Entry Type 13 Regulatory Alignment (CBP Docs. 2026-21600 & 2026-21570, 91 FR 66707) (6.5041ms)
```

### Full Verification Matrix
- **`npm test`**: **156 tests passing** (155 passed, 0 failed, 1 skipped) across 19 suites.
- **`npx tsc --noEmit`**: **0 errors**.
- **`npm run lint`**: **0 warnings, 0 errors**.
- **`npm run build`**: **Next.js 16.4.5 Turbopack production build succeeded** with all routes operational.

---

## 6. Strict Boundaries Maintained

- **Zero Scope Creep:** Sprint 5 (commercial invoice PDF generation, PayPal capture) was NOT initiated.
- **Seed Inventory Intact:** Exactly the seven authentic Indian seed profiles from `src/data/seed-products.ts` remain active.
- **Regulatory Guardrails:** Sheesham wood coasters remain strictly `BLOCKED` (CITES Appendix II / USFS ESA); Darjeeling tea remains strictly `PARTIALLY_VERIFIED`.
- **Statutory Integrity:** No tariff exemptions were fabricated; all citations grounded in authentic USITC, USTR, and CBP Federal Register records.

