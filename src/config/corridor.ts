import { TradeCorridor } from "@/types/export";

/**
 * Initial Trade Corridor Configuration: India -> United States
 * Grounded in statutory trade findings and current official trade regulations.
 */
export const PRIMARY_CORRIDOR: TradeCorridor = {
  id: "IN-US",
  originCountry: "IN",
  originName: "India",
  originFlag: "🇮🇳",
  destinationCountry: "US",
  destinationName: "United States",
  destinationFlag: "🇺🇸",
  valuationLaw: "19 U.S.C. § 1401a (Tariff Act of 1930, as amended)",
  valuationBasis: "TRANSACTION_VALUE",
  deMinimisStatus: "SUSPENDED",
  formerDeMinimisThresholdUSD: 800,
  htsRevisionBaseline: "USITC 2026 HTS Rev 22 (Published Oct 30, 2026)",
  status: "ACTIVE_CORRIDOR",
};

export const CORRIDOR_COMPLIANCE_NOTES = [
  {
    title: "US Customs Valuation: Transaction Value (19 U.S.C. § 1401a)",
    description:
      "Under 19 U.S.C. § 1401a, primary customs value is transaction value (price actually paid or payable for goods sold for export to the US, plus specified statutory additions). Under 19 U.S.C. § 1401a(b)(4)(A), the price actually paid or payable excludes costs, charges, and expenses incurred for transportation, insurance, and related services incident to international shipment from the country of exportation to the place of importation in the United States (distinct from the separate statutory provision for transportation after importation under § 1401a(b)(4)(B)). BorderBrief AI avoids assumptions about bundled shipping charges; actual customs valuation requires examination of the transaction and supporting documentation.",
    tag: "19 U.S.C. § 1401a",
  },
  {
    title: "Suspension of General Duty-Free De Minimis (Section 321)",
    description:
      "The former general $800 duty-free de minimis exemption under 19 U.S.C. § 1321 (Section 321) was suspended effective August 29, 2025. The general exemption is no longer available for covered shipments. Applicable duties, taxes, and fees depend on current rules and entry method, though limited statutory exceptions may exist. BorderBrief AI does not automatically assume zero duty or zero MPF for low-value shipments.",
    tag: "CBP Aug 2025 Notice",
  },
  {
    title: "GSP Ineligibility & Column 1 General (MFN) Tariffs",
    description:
      "Two separate legal events apply: (1) India lost US GSP beneficiary status effective June 5, 2019 under Presidential Proclamation 9902; (2) The US GSP program's statutory authorization expired on December 31, 2020. For India-origin goods, GSP preferential rates do not apply. Duties must be determined under Column 1 General rates using the USITC 2026 HTS Revision 22 baseline (published Oct 30, 2026), accounting for product classification, Chapter 99 provisions, and effective dates.",
    tag: "USITC 2026 Rev 22",
  },
  {
    title: "Indian Export Compliance (LUT & IEC)",
    description:
      "Under Indian GST law (IGST Act Section 16), exports are zero-rated supplies. Indian micro-exporters file a Letter of Undertaking (LUT) annually on the GST portal to supply goods without upfront payment of IGST, requiring an active Importer-Exporter Code (IEC) from DGFT.",
    tag: "DGFT / CBIC India",
  },
];
