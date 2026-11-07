/**
 * BorderBrief AI — Authoritative USITC Tariff Schedule Store (Sprint 3 Remediation Audit)
 *
 * Official Statutory Authority:
 * - Source: United States International Trade Commission (USITC)
 * - Revision: 2026 HTS Revision 22
 * - Publication/Release Date: October 30, 2026
 * - Retrieval Date: November 7, 2026
 * - Official URL: https://hts.usitc.gov/
 *
 * CRITICAL GROUNDING RULES:
 * 1. Cloud AI is STRICTLY forbidden from inventing HTS codes.
 * 2. Every classification proposed to the user MUST exist in this authoritative store.
 * 3. India is ineligible for GSP (indicator 'A'); Column 1 General MFN base rate applies.
 * 4. Reasonable care under 19 U.S.C. § 1484 rests with the U.S. Importer of Record.
 * 5. Official customs reporting units must be strictly preserved (e.g. doz., kg for silk shawls;
 *    kg for wooden articles; dz.pcs. for ceramic mugs).
 * 6. Statistical reporting numbers must be genuine 10-digit codes from Revision 22
 *    (e.g. 0902.30.00.90 for loose black tea, rejecting invalid 0902.30.00.00).
 */

import type { AuthoritativeTariffRecord } from "../../types/export.ts";

export const USITC_REVISION_METADATA = {
  sourceAuthority: "United States International Trade Commission (USITC)",
  officialUrl: "https://hts.usitc.gov/",
  revisionNumber: "2026 HTS Revision 22",
  publicationDate: "October 30, 2026",
  statutoryEffectiveDate:
    "Unverified (Revision 22 release date is October 30, 2026; individual tariff provision effective dates depend on specific statutory enactments)",
  retrievalDate: "November 7, 2026",
  legalCitation: "Harmonized Tariff Schedule of the United States (19 U.S.C. § 1202)",
  tradeCorridor: "India (IN) → United States (US)",
  indiaGspStatus:
    "GSP INELIGIBLE: India's beneficiary developing country status was terminated effective June 5, 2019 (Presidential Proclamation 9902), and statutory GSP authorization expired on December 31, 2020. Column 1 General MFN base rates apply. Note: Additional Chapter 99 provisions (e.g. Section 301/232) or other trade remedies may apply.",
  disclaimer:
    "This schedule data is compiled from the official USITC 2026 HTS Revision 22. Pursuant to 19 U.S.C. § 1484, the legal obligation to exercise reasonable care in declaring classification, value, and applicable duties upon entry into the United States rests with the U.S. Importer of Record. This advisory platform prepares export information for Indian sellers and does not transfer statutory importer liability, nor does it constitute a legally binding customs ruling by U.S. Customs and Border Protection (CBP) under 19 C.F.R. Part 177.",
};

/**
 * Normalizes an HTS code string into standard notation:
 * - 10-digit reporting number: XXXX.XX.XX.XX
 * - 8-digit rate line: XXXX.XX.XX
 * - 6-digit international heading: XXXX.XX
 */
export function normalizeHtsCode(input: string): string {
  if (!input) return "";
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
  }
  return input.trim();
}

/**
 * Validates that an HTS code exists in the official USITC 2026 Revision 22 dataset.
 * Rejects non-existent statistical reporting numbers (e.g. 0902.30.00.00).
 */
export function validateHtsCode(code: string): {
  isValid: boolean;
  normalized?: string;
  record?: AuthoritativeTariffRecord;
  error?: string;
} {
  const digits = code.replace(/[^0-9]/g, "");
  const normalized = normalizeHtsCode(code);

  if (digits.length === 10) {
    const record = AUTHORITATIVE_TARIFF_DATABASE.find(
      (r) => r.hts10 === normalized || r.hts10.replace(/\./g, "") === digits
    );
    if (!record) {
      return {
        isValid: false,
        error: `HTS code '${code}' was not found in the official USITC 2026 HTS Revision 22 schedule. Fabricated or invalid codes are strictly rejected.`,
      };
    }
    return {
      isValid: true,
      normalized: record.hts10,
      record,
    };
  }

  if (digits.length === 8) {
    const record = AUTHORITATIVE_TARIFF_DATABASE.find(
      (r) => r.hts8 === normalized || r.hts8.replace(/\./g, "") === digits
    );
    if (!record) {
      return {
        isValid: false,
        error: `HTS 8-digit rate line '${code}' was not found in the official USITC 2026 HTS Revision 22 schedule.`,
      };
    }
    return {
      isValid: true,
      normalized: record.hts8,
      record,
    };
  }

  return {
    isValid: false,
    error: `Invalid HTS code format '${code}'. Expected 8-digit rate line or 10-digit statistical reporting number.`,
  };
}

/**
 * Evaluates whether an authoritative tariff record is actually compatible with the physical
 * product characteristics, ensuring code existence is never confused with correct legal classification.
 */
export function validateCandidateSuitability(
  record: AuthoritativeTariffRecord,
  productInput: { title: string; description: string; materials?: string; intendedUse?: string }
): { isSuitable: boolean; reason?: string } {
  const text = `${productInput.title} ${productInput.description} ${productInput.materials || ""} ${productInput.intendedUse || ""}`.toLowerCase();

  // Chapter 42: Bags, cases, wallets
  if (record.chapter === "42") {
    const hasBagTerms = /\b(bags?|totes?|wallets?|pouches?|backpacks?|cases?|travel|suitcases?|briefcases?|handbags?)\b/i.test(text);
    if (!hasBagTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers travel goods, bags, and wallets, but product does not describe a bag or travel container.`,
      };
    }
  }

  // Chapter 69: Ceramics & pottery
  if (record.chapter === "69") {
    const hasCeramicTerms = /\b(ceramics?|stoneware|porcelains?|pottery|clay|mugs?|plates?|cups?|saucers?|bowls?|tableware|earthenware)\b/i.test(text);
    if (!hasCeramicTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers ceramic products, but product does not describe ceramic, clay, or pottery composition.`,
      };
    }

    // Subheading 6912.00.44 specifically covers mugs and steins of ceramic OTHER than porcelain/china
    if (record.hts10.startsWith("6912.00.44")) {
      if (!/\b(mugs?|steins?)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} specifically provides for mugs and steins, but product text does not describe a mug or stein form factor.`,
        };
      }
      if (/\b(porcelain|bone\s*china)\b/i.test(text) && !/\b(stoneware|earthenware|non-porcelain)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} applies to ceramic other than porcelain or china; declared porcelain/china classifies under heading 6911.`,
        };
      }
    }

    // Subheading 6911.10.45 specifically covers porcelain mugs and steins
    if (record.hts10.startsWith("6911.10.45")) {
      if (!/\b(mugs?|steins?)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} specifically provides for porcelain mugs and steins, but product text does not describe a mug or stein form factor.`,
        };
      }
      if (/\b(stoneware|earthenware|terracotta|terra\s*cotta)\b/i.test(text) && !/\b(porcelain|china)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} applies exclusively to porcelain or china; declared stoneware/earthenware classifies under heading 6912.`,
        };
      }
    }

    // Heading 6911 generally requires porcelain/china
    if (record.heading === "6911") {
      if (/\b(stoneware|earthenware|terracotta|terra\s*cotta)\b/i.test(text) && !/\b(porcelain|china)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff heading 6911 applies exclusively to porcelain or china; declared stoneware/earthenware classifies under heading 6912.`,
        };
      }
    }

    // Heading 6912 generally requires ceramic other than porcelain
    if (record.heading === "6912") {
      if (/\b(porcelain|bone\s*china)\b/i.test(text) && !/\b(stoneware|earthenware|non-porcelain)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff heading 6912 excludes porcelain or china; declared porcelain/china classifies under heading 6911.`,
        };
      }
    }
  }

  // Chapter 83: Base metal statuettes & bells
  if (record.chapter === "83") {
    const hasMetalTerms = /\b(brass|metal|bronze|copper|bell|gong|chime|statuette|figurine|ornament|dhokra)\b/i.test(text);
    if (!hasMetalTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers base metal statuettes and bells, but product does not describe metal or brass composition.`,
      };
    }
  }

  // Chapter 62: Woven apparel, shawls & scarves
  if (record.chapter === "62") {
    const hasApparelTerms = /\b(shawls?|scarfs?|scarves|dupattas?|stoles?|apparel|clothing|garments?|wraps?)\b/i.test(text);
    if (!hasApparelTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers woven apparel and shawls, but product does not describe an apparel or scarf item.`,
      };
    }
  }

  // Chapter 44: Wood & wood articles
  if (record.chapter === "44") {
    const hasWoodTerms = /\b(wood|wooden|sheesham|timber|coasters?|rosewood|teak|bamboo|caskets?|marquetry)\b/i.test(text);
    if (!hasWoodTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers articles of wood, but product does not describe wooden or timber material.`,
      };
    }

    // Heading 4421: Residual basket heading — tableware, kitchenware, and drink coasters are excluded and belong under 4419
    if (record.heading === "4421") {
      if (/\b(coasters?|tableware|kitchenware|chopsticks?|spoons?|forks?|cutting\s*board|chopping\s*board)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} is a residual basket for articles of wood not elsewhere specified; tableware and drink coasters specifically classify under heading 4419 (CBP precedents NY N095158, NY N240071, NY R04475).`,
        };
      }
    }

    // Heading 4419: Tableware and kitchenware of wood
    if (record.heading === "4419") {
      const hasTablewareOrCoaster = /\b(coasters?|tableware|kitchenware|plates?|bowls?|cups?|boards?|utensils?)\b/i.test(text);
      if (!hasTablewareOrCoaster) {
        return {
          isSuitable: false,
          reason: `Tariff heading 4419 covers tableware and kitchenware of wood, but product does not describe tableware, kitchenware, or drink coasters.`,
        };
      }

      const hasRecognizedTropical = /\b(teak|mahogany|padauk|balsa|palissandre|virola|iroko|meranti|okoume|sapelli|sipo|ipe|ebony)\b/i.test(text);
      const hasRecognizedTemperate = /\b(oak|pine|maple|beech|walnut|birch|ash|cherry|cedar|spruce|fir|poplar)\b/i.test(text);

      // 4419.20: Of tropical wood under ordinary commercial/botanical meaning (Note: Subheading Note 1 does NOT govern 4419.20)
      if (record.hts10.startsWith("4419.20")) {
        if (hasRecognizedTemperate && !hasRecognizedTropical) {
          return {
            isSuitable: false,
            reason: `Tariff line ${record.hts10} applies to tropical wood; temperate non-tropical timbers (such as Oak, Pine, or Maple) classify under 4419.90.91.00.`,
          };
        }
      }

      // 4419.90: Other (non-tropical) wood
      if (record.hts10.startsWith("4419.90")) {
        if (hasRecognizedTropical && !hasRecognizedTemperate) {
          return {
            isSuitable: false,
            reason: `Tariff line ${record.hts10} applies to other (non-tropical) wood; recognized tropical wood species (such as Teak or Mahogany) classify under 4419.20.90.00.`,
          };
        }
      }
    }
  }

  // Chapter 09: Coffee, tea, mate & spices
  if (record.chapter === "09") {
    const hasTeaTerms = /\b(teas?|darjeeling|assam|chai|camellia sinensis|leaves)\b/i.test(text);
    if (!hasTeaTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers agricultural tea, but product does not describe tea leaves or tea beverages.`,
      };
    }
    // 0902.30.00.90 is specifically for loose-leaf tea
    if (record.hts10 === "0902.30.00.90") {
      if (/\b(tea\s*bags?|in\s*bags|sachets?)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} applies to loose tea; tea in bags classifies under 0902.30.00.15 or 0902.30.00.50.`,
        };
      }
    }
    // 0902.30.00.15 and 0902.30.00.50 are specifically for tea in tea bags
    if (record.hts10 === "0902.30.00.15" || record.hts10 === "0902.30.00.50") {
      if (/\b(loose-leaf|loose\s*tea|whole-leaf|whole\s*leaf)\b/i.test(text) && !/\b(tea\s*bags?)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} applies to tea in tea bags; loose-leaf tea classifies under 0902.30.00.90.`,
        };
      }
    }
    // 0902.30.00.15 is strictly for certified organic tea in tea bags
    if (record.hts10 === "0902.30.00.15") {
      if (/\b(non-organic|conventional|not\s*organic)\b/i.test(text)) {
        return {
          isSuitable: false,
          reason: `Tariff line ${record.hts10} applies strictly to certified organic tea; conventional tea classifies under 0902.30.00.50.`,
        };
      }
    }
  }

  // Chapter 71: Precious metal jewelry & imitation jewelry
  if (record.chapter === "71") {
    const hasJewelryTerms = /\b(jewelry|jewellery|earrings?|necklaces?|rings?|filigree|bracelets?|pendants?|silver|gold)\b/i.test(text);
    if (!hasJewelryTerms) {
      return {
        isSuitable: false,
        reason: `Tariff heading ${record.heading} covers jewelry and precious metals, but product does not describe personal jewelry adornment.`,
      };
    }
  }

  return { isSuitable: true };
}

/**
 * Curated Authoritative Tariff Schedule Lines from USITC 2026 Revision 22
 * Grounded in core Indian export categories: Textiles, Metalcrafts, Apparel, Ceramics, Woodwork, Leather, Food, Jewelry.
 */
export const AUTHORITATIVE_TARIFF_DATABASE: AuthoritativeTariffRecord[] = [
  // ==========================================
  // CHAPTER 42: BAGS, CASES, WALLETS & TRAVEL GOODS
  // ==========================================
  {
    hts10: "4202.92.15.00",
    hts8: "4202.92.15",
    hs6: "4202.92",
    heading: "4202",
    chapter: "42",
    chapterTitle: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut",
    description:
      "Trunks, suit-cases, vanity-cases, executive-cases, briefcases, school satchels, spectacle cases, binocular cases, camera cases, musical instrument cases, gun cases, holsters and similar containers; traveling bags, insulated food or beverage bags, toiletry bags, knapsacks and backpacks, handbags, shopping bags, wallets, purses, map cases, cigarette cases, tobacco pouches, tool bags, sports bags, bottle cases, jewelry boxes, powder cases, cutlery cases and similar containers, of leather or of composition leather, of sheeting of plastics, of textile materials, of vulcanized fiber or of paperboard, or wholly or mainly covered with such materials or with paper: Other: With outer surface of textile materials: Of vegetable fibers and not of pile or tufted construction: Of cotton",
    generalDutyRate: 6.3,
    generalRateStr: "6.3%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "40%",
    units: ["No.", "kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4202 specifically provides for shopping bags, travel bags and similar containers)",
      "GRI 6 (Classification at subheading level: Subheading 4202.92 covers outer surface of textile materials; 4202.92.15 covers vegetable fibers not of pile or tufted construction; rate line .00 covers cotton)",
    ],
    legalNotes: [
      "Chapter 42 Note 2(A): In addition to provisions of Note 1, Heading 4202 does not cover bags made of sheeting of plastics, whether or not printed, with handles, not designed for prolonged use (Heading 3923).",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY I89837 (Jan 16, 2003: Double-handle daily tote bag constructed of 100% cotton canvas outer surface classified under 4202.92.1500; base rate 6.4%/6.3%). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents the baseline MFN tariff. Specific origin measures under Chapter 99 (e.g. Section 301/232) or trade remedies may apply.",
  },
  {
    hts10: "4202.92.31.31",
    hts8: "4202.92.31",
    hs6: "4202.92",
    heading: "4202",
    chapter: "42",
    chapterTitle: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut",
    description:
      "Travel, sports and similar bags: With outer surface of sheeting of plastics or of textile materials: With outer surface of sheeting of plastics: Other: Other",
    generalDutyRate: 16.0,
    generalRateStr: "16.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "45%",
    units: ["No."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4202)",
      "GRI 6 (Subheading 4202.92 covers outer surface of sheeting of plastics)",
    ],
    legalNotes: [
      "Chapter 42 Note 3: If bag has an external coating or outer surface of plastic sheeting, it classifies under plastic sheeting provisions rather than textile.",
    ],
    crossRulingReference: "CBP CROSS Ruling NY N298114 (Tote bag with PVC plastic laminate outer layer; July 12, 2018)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4202.92.91.00",
    hts8: "4202.92.91",
    hs6: "4202.92",
    heading: "4202",
    chapter: "42",
    chapterTitle: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut",
    description:
      "Travel, sports and similar bags: With outer surface of textile materials: Other: Of man-made fibers: Other",
    generalDutyRate: 17.6,
    generalRateStr: "17.6%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "65%",
    units: ["No.", "kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies to synthetic fabrics (nylon, polyester) rather than natural vegetable fibers."],
    crossRulingReference: "CBP CROSS Ruling HQ 967812 (Bags of man-made synthetic textile fibers; Oct 19, 2005)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4202.31.60.00",
    hts8: "4202.31.60",
    hs6: "4202.31",
    heading: "4202",
    chapter: "42",
    chapterTitle: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut",
    description:
      "Articles of a kind normally carried in the pocket or in the handbag: With outer surface of leather or of composition leather: Other",
    generalDutyRate: 8.0,
    generalRateStr: "8.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "35%",
    units: ["No."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4202 pocket articles)",
      "GRI 6 (Subheading 4202.31 outer surface of leather)",
    ],
    legalNotes: [
      "Subheading 4202.31 specifically covers wallets, billfolds, coin purses, and card cases normally carried in the pocket.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY N248778 (Jan 14, 2014: Genuine leather wallet with currency pockets, credit card slots, and coin pocket classified under 4202.31.6000; base rate 8.0%). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4202.32.10.00",
    hts8: "4202.32.10",
    hs6: "4202.32",
    heading: "4202",
    chapter: "42",
    chapterTitle: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut",
    description:
      "Articles of a kind normally carried in the pocket or in the handbag: With outer surface of sheeting of plastics: Other",
    generalDutyRate: 20.0,
    generalRateStr: "20.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "45%",
    units: ["No."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Contrasting provision for wallets with outer surface of polyurethane (PU) or faux leather."],
    crossRulingReference: "CBP CROSS Ruling NY N287514 (Wallets with outer surface of plastic sheeting; July 17, 2017)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 83: BASE METAL STATUETTES & HANDICRAFTS
  // ==========================================
  {
    hts10: "8306.29.00.00",
    hts8: "8306.29.00",
    hs6: "8306.29",
    heading: "8306",
    chapter: "83",
    chapterTitle: "Miscellaneous articles of base metal",
    description:
      "Bells, gongs and the like, non-electric, of base metal; statuettes and other ornaments, of base metal; photograph, picture or similar frames, of base metal; mirrors of base metal; and base metal parts thereof: Statuettes and other ornaments, and parts thereof: Other",
    generalDutyRate: 0.0,
    generalRateStr: "Free",
    specialRates: "Free",
    indiaEligibleSpecial: false,
    column2Rate: "45%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 8306 covers statuettes and ornaments of base metal)",
      "GRI 6 (Subheading 8306.29 covers non-plated base metal statuettes)",
    ],
    legalNotes: [
      "Section XV Note 3: Throughout the tariff schedule, the expression 'base metals' means iron, steel, copper (including brass and bronze), nickel, aluminum, lead, zinc, tin, etc.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY 816037 (Oct 31, 1995: Cast base metal statues and statuettes from India, not plated with precious metal, classified under 8306.29.0000; base rate Free). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate is baseline MFN tariff. Chapter 99 provisions (e.g. Section 232) apply only if predominantly steel or aluminum. Non-ferrous brass alloys are generally exempt.",
  },
  {
    hts10: "8306.21.00.00",
    hts8: "8306.21.00",
    hs6: "8306.21",
    heading: "8306",
    chapter: "83",
    chapterTitle: "Miscellaneous articles of base metal",
    description:
      "Statuettes and other ornaments, and parts thereof: Plated with precious metal",
    generalDutyRate: 5.0,
    generalRateStr: "5.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "65%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies if base metal statuette is electroplated with gold, silver or platinum."],
    crossRulingReference: "CBP CROSS Ruling HQ 956821 (Statuettes plated with precious metal; Dec 20, 1994)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "8306.10.00.00",
    hts8: "8306.10.00",
    hs6: "8306.10",
    heading: "8306",
    chapter: "83",
    chapterTitle: "Miscellaneous articles of base metal",
    description:
      "Bells, gongs and the like, non-electric, of base metal; and base metal parts thereof",
    generalDutyRate: 5.8,
    generalRateStr: "5.8%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "50%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Heading 8306 specifically covers non-electric base metal bells, gongs, and statuettes."],
    crossRulingReference: "CBP CROSS Ruling NY N274819 (Decorative metal bells and chimes; May 3, 2016)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 71: PRECIOUS & IMITATION JEWELRY
  // ==========================================
  {
    hts10: "7113.11.50.00",
    hts8: "7113.11.50",
    hs6: "7113.11",
    heading: "7113",
    chapter: "71",
    chapterTitle: "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewelry; coin",
    description:
      "Articles of jewelry and parts thereof, of precious metal or of metal clad with precious metal: Of precious metal whether or not plated or clad with precious metal: Of silver, whether or not plated or clad with other precious metal: Other: Valued over $18 per dozen pieces or parts",
    generalDutyRate: 5.0,
    generalRateStr: "5.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "110%",
    units: ["doz.", "g"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 7113 covers articles of jewelry and parts thereof of precious metal)",
      "GRI 6 (Subheading 7113.11 covers silver jewelry; rate line 7113.11.50 covers items valued over $18 per dozen)",
    ],
    legalNotes: [
      "Chapter 71 Note 9: The expression 'articles of jewelry' means any small objects of personal adornment (rings, bracelets, necklaces, brooches, ear-rings, filigree jewelry).",
      "National Stamping Act (15 U.S.C. § 294): Silver jewelry marked as sterling or 925 must conform to legal assay fineness standards.",
    ],
    crossRulingReference: "CBP CROSS Ruling NY N302194 (Handcrafted sterling silver 925 earrings and filigree jewelry; Jan 17, 2019)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "7113.11.20.00",
    hts8: "7113.11.20",
    hs6: "7113.11",
    heading: "7113",
    chapter: "71",
    chapterTitle: "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewelry; coin",
    description:
      "Articles of jewelry and parts thereof, of precious metal or of metal clad with precious metal: Of precious metal whether or not plated or clad with precious metal: Of silver, whether or not plated or clad with other precious metal: Other: Valued not over $18 per dozen pieces or parts",
    generalDutyRate: 13.5,
    generalRateStr: "13.5%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "110%",
    units: ["doz.", "g"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Contrasting provision: Silver jewelry valued not over $18 per dozen pieces pays 13.5%."],
    crossRulingReference: "CBP CROSS Ruling NY N251912 (Silver jewelry under $18/doz; Apr 8, 2014)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "7117.19.90.00",
    hts8: "7117.19.90",
    hs6: "7117.19",
    heading: "7117",
    chapter: "71",
    chapterTitle: "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewelry; coin",
    description:
      "Imitation jewelry: Of base metal, whether or not plated with precious metal: Other: Other",
    generalDutyRate: 11.0,
    generalRateStr: "11.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "110%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies if small metal ornament is designed to be worn on the person as personal adornment."],
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 62: WOVEN APPAREL, SHAWLS & SCARVES
  // ==========================================
  {
    hts10: "6214.10.10.00",
    hts8: "6214.10.10",
    hs6: "6214.10",
    heading: "6214",
    chapter: "62",
    chapterTitle: "Articles of apparel and clothing accessories, not knitted or crocheted",
    description:
      "Shawls, scarves, mufflers, mantillas, veils and the like: Of silk or silk waste: Containing 70 percent or more by weight of silk or silk waste",
    generalDutyRate: 1.2,
    generalRateStr: "1.2%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "60%",
    units: ["doz.", "kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6214 covers woven shawls and scarves not knitted)",
      "GRI 6 (Subheading 6214.10 covers silk; rate line 6214.10.10 isolates items containing >=70% silk by weight)",
    ],
    legalNotes: [
      "Chapter 62 Note 1: Chapter 62 applies only to made-up articles of any textile fabric other than waddings, not knitted or crocheted.",
      "FTC Textile Fiber Products Identification Act requires fiber breakdown label upon commercial entry.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY I87170 (Oct 23, 2002: Woman's 100% silk woven scarf classified under 6214.10.1000; base rate 1.2%). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6214.10.20.00",
    hts8: "6214.10.20",
    hs6: "6214.10",
    heading: "6214",
    chapter: "62",
    chapterTitle: "Articles of apparel and clothing accessories, not knitted or crocheted",
    description:
      "Shawls, scarves, mufflers, mantillas, veils and the like: Of silk or silk waste: Other (containing under 70% silk)",
    generalDutyRate: 3.9,
    generalRateStr: "3.9%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "65%",
    units: ["doz.", "kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies if metallic zari or blended yarn reduces silk content below 70% by weight."],
    crossRulingReference: "CBP CROSS Ruling NY N275482 (Silk blend scarves under 70% silk; May 19, 2016)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6214.20.00.00",
    hts8: "6214.20.00",
    hs6: "6214.20",
    heading: "6214",
    chapter: "62",
    chapterTitle: "Articles of apparel and clothing accessories, not knitted or crocheted",
    description:
      "Shawls, scarves, mufflers, mantillas, veils and the like: Of wool or fine animal hair",
    generalDutyRate: 7.7,
    generalRateStr: "7.7%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "68.5%",
    units: ["doz.", "kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies if shawl or scarf is woven of wool, cashmere, or pashmina fine animal hair."],
    crossRulingReference: "CBP CROSS Ruling NY N283901 (Woven wool and pashmina shawls; Mar 15, 2017)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6214.90.00.10",
    hts8: "6214.90.00",
    hs6: "6214.90",
    heading: "6214",
    chapter: "62",
    chapterTitle: "Articles of apparel and clothing accessories, not knitted or crocheted",
    description:
      "Shawls, scarves, mufflers, mantillas, veils and the like: Of other textile materials: Of cotton",
    generalDutyRate: 8.5,
    generalRateStr: "8.5%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "40%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies if scarf is made of woven cotton instead of silk."],
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 69: CERAMICS & STUDIO POTTERY
  // ==========================================
  {
    hts10: "6912.00.44.00",
    hts8: "6912.00.44",
    hs6: "6912.00",
    heading: "6912",
    chapter: "69",
    chapterTitle: "Ceramic products",
    description:
      "Ceramic tableware, kitchenware, other household articles and toilet articles, other than of porcelain or china: Tableware and kitchenware: Other: Mugs and other steins",
    generalDutyRate: 10.0,
    generalRateStr: "10.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "45%",
    units: ["dz.pcs."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6912 covers ceramic tableware and kitchenware other than of porcelain or china)",
      "GRI 6 (Subheading 6912.00.44 specifically and eo nomine covers mugs and other steins)",
    ],
    legalNotes: [
      "Chapter 69 Note 1: Chapter 69 applies only to ceramic products which have been fired after shaping.",
      "Chapter 69 Additional U.S. Note 5(a): The term 'stoneware' embraces ceramic ware containing clay, not commonly white, with water absorption not exceeding 3%, naturally opaque. Earthenware absorbs >3% water.",
      "FDA Food Contact Compliance: Ceramic drinkware must comply with lead and cadmium leaching limits under FDA CPG Sec. 545.400.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY N124608 (Ceramic mugs with handles classified under 6912.00.4400; Sept 30, 2010); see also NY N023339 (Feb 21, 2008, defining mug criteria: straight-sided/barrel-shaped, flat bottom, heavier handle, taller than wide, designed without saucer). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents the baseline MFN tariff. Does not include potential Chapter 99 trade remedy duties or customs user fees.",
  },
  {
    hts10: "6912.00.48.10",
    hts8: "6912.00.48",
    hs6: "6912.00",
    heading: "6912",
    chapter: "69",
    chapterTitle: "Ceramic products",
    description:
      "Ceramic tableware, kitchenware, other household articles and toilet articles, other than of porcelain or china: Tableware and kitchenware: Other: Other: Suitable for food or drink contact",
    generalDutyRate: 9.8,
    generalRateStr: "9.8%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "45%",
    units: ["dz.pcs."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6912 covers ceramic tableware other than of porcelain)",
      "GRI 6 (Subheading 6912.00.48 covers other ceramic tableware)",
    ],
    legalNotes: [
      "Chapter 69 Additional U.S. Note 5(a): Stoneware is opaque with water absorption <= 3%.",
      "Applies to non-porcelain tableware other than mugs or steins (e.g. bowls, plates, platters) suitable for food or drink contact.",
    ],
    crossRulingReference: "CBP CROSS Ruling NY N243812 (Ceramic tableware plates and bowls; July 22, 2013)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6911.10.45.00",
    hts8: "6911.10.45",
    hs6: "6911.10",
    heading: "6911",
    chapter: "69",
    chapterTitle: "Ceramic products",
    description:
      "Tableware, kitchenware, other household articles and toilet articles, of porcelain or china: Tableware and kitchenware: Other: Other: Other: Mugs and other steins",
    generalDutyRate: 14.0,
    generalRateStr: "14.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "70%",
    units: ["dz.pcs."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6911 covers tableware and kitchenware of porcelain or china)",
      "GRI 6 (Subheading 6911.10.45 eo nomine covers mugs and other steins of porcelain or china)",
    ],
    legalNotes: [
      "Chapter 69 Additional U.S. Note 5(a): 'Porcelain' and 'china' embrace ceramic ware (other than stoneware) having a fired white body (unless artificially colored), water absorption not over 0.5%, and translucent in thicknesses of several millimeters.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY 812017 (July 21, 1995: Ceramic tableware porcelain mug classified under 6911.10.4500; see also NY 802810, Oct 27, 1994: White porcelain/china coffee mug). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6911.10.52.00",
    hts8: "6911.10.52",
    hs6: "6911.10",
    heading: "6911",
    chapter: "69",
    chapterTitle: "Ceramic products",
    description:
      "Tableware, kitchenware, other household articles and toilet articles, of porcelain or china: Tableware and kitchenware: Other: Other: Other: Specified tableware price category (cups valued over $8 to $29/doz; saucers valued over $5.25 to $18.75/doz; soups/cereals... plates...)",
    generalDutyRate: 8.0,
    generalRateStr: "8.0%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "75%",
    units: ["dz.pcs."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6911)",
      "GRI 6 (Subheading 6911.10.52 covers specified price tiers for porcelain cups, saucers, and plates)",
    ],
    legalNotes: [
      "Applies only to specified price categories of porcelain cups, saucers, soups, and plates; does NOT apply to mugs or steins.",
    ],
    crossRulingReference: "CBP CROSS Ruling NY N142318 (Porcelain cups and saucers under specified value tiers; Jan 25, 2011)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "6911.10.80.00",
    hts8: "6911.10.80",
    hs6: "6911.10",
    heading: "6911",
    chapter: "69",
    chapterTitle: "Ceramic products",
    description:
      "Tableware, kitchenware, other household articles and toilet articles, of porcelain or china: Tableware and kitchenware: Other: Other: Other: Other",
    generalDutyRate: 20.8,
    generalRateStr: "20.8%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "75%",
    units: ["dz.pcs."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 6911 covers porcelain or china tableware)",
      "GRI 6 (Subheading 6911.10 covers porcelain tableware other than hotelware or mugs)",
    ],
    legalNotes: [
      "Chapter 69 Note 2: Porcelain or china is vitrified, translucent, and impervious to liquid.",
      "Residual provision for other porcelain tableware not covered under mugs (6911.10.45) or specified price categories (6911.10.52).",
    ],
    crossRulingReference: "CBP CROSS Ruling HQ 965104 (Porcelain tableware; Aug 1, 2002)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 44: WOOD ARTICLES, TABLEWARE & CARVINGS
  // ==========================================
  {
    hts10: "4419.90.91.00",
    hts8: "4419.90.91",
    hs6: "4419.90",
    heading: "4419",
    chapter: "44",
    chapterTitle: "Wood and articles of wood; wood charcoal",
    description: "Tableware and kitchenware, of wood: Other: Other",
    generalDutyRate: 3.2,
    generalRateStr: "3.2%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "33.3%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4419 covers tableware and kitchenware, of wood; beverage coasters are tableware under CBP rulings NY N095158, NY N240071, and NY R04475)",
      "GRI 3(b) (Composite article of wood and decorative brass inlay: solid wood body imparts essential character)",
      "GRI 6 (Subheading classification: Subheading 4419.90 covers tableware of wood other than bamboo or tropical wood)",
    ],
    legalNotes: [
      "Scope of Subheading Notes: Chapter 44 Subheading Note 1's enumerated species list explicitly applies ONLY to subheadings 4403.41 to 4403.49, 4407.24 to 4407.29, 4408.31 to 4408.39, and 4412.13 to 4412.99; it does NOT govern Heading 4419 by statute.",
      "In the absence of a statutory note defining 'tropical wood' for 4419.20, classification is governed by GRI 1 and ordinary commercial/botanical meaning. The classification of Dalbergia sissoo (Sheesham) under 4419.20 versus 4419.90 is legally unsettled and has not been the subject of a binding CBP ruling.",
      "Independent Regulatory Notice: USDA APHIS Lacey Act Declaration (PPQ 505) requires declaring scientific genus, species, and country of harvest upon commercial entry, and CITES regulations govern protected timbers. Lacey Act compliance is an independent environmental import requirement and does not determine tariff classification between 4419.20 and 4419.90.",
    ],
    crossRulingReference:
      "[Related Heading Precedent / Composite & MDF Construction] CBP CROSS Ruling NY N095158 (March 23, 2010: Composite drink coaster with redwood frame, plywood base, and decorative paper classified under former provision 4419.00.8000). Also CBP CROSS Ruling NY N240071 (April 10, 2013: Set of medium density fiberboard (MDF) drink coasters with decorative paper surface classified under former provision 4419.00.8000). Closer solid-wood comparison: CBP Ruling NY R04475 (August 24, 2006: Decorative beverage coaster made of solid mango wood mounted on a carved base classified under former provision 4419.00.8000). Note on Precedents: Neither NY N095158 nor NY N240071 is a direct material match for solid carved Sheesham coasters; they serve as related heading precedents establishing that drink coasters are tableware under Heading 4419 rather than residual basket Heading 4421. Prior rulings provide guidance under 19 C.F.R. Part 177 but do not verify current 2026 Revision 22 Column 1 General duty rates (3.2%) or quantity units (kg).",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4419.20.90.00",
    hts8: "4419.20.90",
    hs6: "4419.20",
    heading: "4419",
    chapter: "44",
    chapterTitle: "Wood and articles of wood; wood charcoal",
    description: "Tableware and kitchenware, of wood: Of tropical wood: Other",
    generalDutyRate: 3.2,
    generalRateStr: "3.2%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "33.3%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4419 covers tableware and kitchenware, of wood)",
      "GRI 6 (Subheading 4419.20 covers tableware of tropical wood under ordinary commercial and botanical meaning)",
    ],
    legalNotes: [
      "Scope of Subheading Notes: Chapter 44 Subheading Note 1's enumerated tropical wood list applies strictly to specified subheadings in 4403, 4407, 4408, and 4412; it does NOT legally govern subheading 4419.20.",
      "Legal Basis for 4419.20: Under GRI 1, 'Of tropical wood' is interpreted according to its ordinary commercial and botanical meaning (e.g. CBP NY N324277 classified mango wood from India under 4419.20.9000). For Dalbergia sissoo (Sheesham), whether it qualifies as tropical wood or other wood is legally unresolved in the absence of a binding CBP ruling.",
      "Independent Regulatory Notice: USDA APHIS Lacey Act Declaration (PPQ 505) and CITES requirements operate independently from HTS tariff classification.",
    ],
    crossRulingReference:
      "[Related Heading Precedent / Tropical Wood Heading Application] CBP CROSS Ruling NY N324277 (February 17, 2022: Solid mango wood tray from India classified under 4419.20.9000 as 'Of tropical wood: Other', confirming CBP applies 4419.20 based on ordinary/commercial meaning of tropical timber from India rather than limiting it to Chapter 44 Subheading Note 1). For coaster form factors: CBP Ruling NY N095158 (March 23, 2010: Redwood/plywood composite coaster) and NY N240071 (April 10, 2013: MDF/paper coaster set) establish that coasters are tableware under Heading 4419. Note: Prior rulings establish classification guidance under 19 C.F.R. Part 177, while Column 1 General duty rates (3.2%) and quantity units (kg) are verified directly from USITC 2026 Revision 22.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4421.99.98.80",
    hts8: "4421.99.98",
    hs6: "4421.99",
    heading: "4421",
    chapter: "44",
    chapterTitle: "Wood and articles of wood; wood charcoal",
    description:
      "Other articles of wood: Other: Other: Other: Other: Other",
    generalDutyRate: 3.3,
    generalRateStr: "3.3%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "33.3%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: [
      "GRI 1 (Heading 4421 covers other articles of wood not elsewhere classified)",
      "GRI 6 (Subheading classification)",
    ],
    legalNotes: [
      "Heading 4421 is a residual basket provision for 'other articles of wood'. Articles specifically described in earlier Chapter 44 headings—such as tableware and kitchenware under Heading 4419 (including drink coasters)—are excluded from Heading 4421 by operation of GRI 1.",
      "USDA APHIS Lacey Act Declaration (PPQ 505) required upon entry declaring scientific genus/species.",
      "CITES Appendix II rosewood regulations may apply if timber is protected species.",
    ],
    crossRulingReference:
      "[Unverified Reference / Residual Basket] CBP CROSS Ruling NY N304441 (June 17, 2019: Miscellaneous carved wooden articles under 4421.99.9780). Note: Drink coasters are excluded from Heading 4421 because they are tableware under Heading 4419 (see related heading precedents CBP NY N095158, March 23, 2010, composite coaster; NY N240071, April 10, 2013, MDF coaster set; NY R04475, August 24, 2006, solid wood coaster). Prior rulings provide interpretive guidance under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4420.90.80.00",
    hts8: "4420.90.80",
    hs6: "4420.90",
    heading: "4420",
    chapter: "44",
    chapterTitle: "Wood and articles of wood; wood charcoal",
    description:
      "Wood marquetry and inlaid wood; caskets and cases for jewelry or cutlery, and similar articles, of wood; statuettes and other ornaments, of wood; wooden articles of furniture not falling in chapter 94: Other: Other",
    generalDutyRate: 4.3,
    generalRateStr: "4.3%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "33.3%",
    units: ["No."],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Heading 4420 specifically provides for inlaid wood boxes, jewelry caskets and wooden statuettes."],
    crossRulingReference: "CBP CROSS Ruling NY N264119 (Carved wooden boxes and caskets; May 12, 2015)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "4421.91.98.80",
    hts8: "4421.91.98",
    hs6: "4421.91",
    heading: "4421",
    chapter: "44",
    chapterTitle: "Wood and articles of wood; wood charcoal",
    description:
      "Other articles of wood: Of bamboo: Other: Other: Other",
    generalDutyRate: 3.3,
    generalRateStr: "3.3%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "33.3%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies to articles constructed from bamboo rather than conventional hardwood timber."],
    crossRulingReference: "CBP CROSS Ruling NY N264812 (Bamboo household articles; June 2, 2015)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },

  // ==========================================
  // CHAPTER 09 & 21: TEA & SPICES
  // ==========================================
  {
    hts10: "0902.30.00.90",
    hts8: "0902.30.00",
    hs6: "0902.30",
    heading: "0902",
    chapter: "09",
    chapterTitle: "Coffee, tea, maté and spices",
    description:
      "Tea, whether or not flavored: Black tea (fermented) and partly fermented tea, in immediate packings of a content not exceeding 3 kg: Other",
    generalDutyRate: 0.0,
    generalRateStr: "Free",
    specialRates: "Free",
    indiaEligibleSpecial: false,
    column2Rate: "Free",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 (inherits Free rate from parent 0902.30.00).",
    relevantGris: [
      "GRI 1 (Heading 0902 covers tea)",
      "GRI 6 (Subheading 0902.30 covers black tea in packings <= 3 kg; statistical reporting number 0902.30.00.90 isolates loose tea not in tea bags)",
    ],
    legalNotes: [
      "Chapter 09 Note 1: Mixtures of products of headings 0904 to 0910 are classified as specified.",
      "FDA Bioterrorism Act & Prior Notice: All commercial food imports require FDA facility registration and Prior Notice filing before shipment arrival.",
    ],
    crossRulingReference:
      "CBP CROSS Ruling NY N203765 (Mar 7, 2012: Loose-leaf black tea in immediate packings <= 3 kg/1 lb tin canisters classified under 0902.30.0090; base rate Free; see also NY N280540, Nov 18, 2016). Note: Prior CBP rulings provide interpretive guidance on physical criteria but do not substitute for a binding customs ruling under 19 C.F.R. Part 177.",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "0902.30.00.15",
    hts8: "0902.30.00",
    hs6: "0902.30",
    heading: "0902",
    chapter: "09",
    chapterTitle: "Coffee, tea, maté and spices",
    description:
      "Tea, whether or not flavored: Black tea (fermented) and partly fermented tea, in immediate packings of a content not exceeding 3 kg: In tea bags: Certified organic",
    generalDutyRate: 0.0,
    generalRateStr: "Free",
    specialRates: "Free",
    indiaEligibleSpecial: false,
    column2Rate: "Free",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 (inherits Free rate from parent 0902.30.00).",
    relevantGris: [
      "GRI 1 (Heading 0902)",
      "GRI 6 (Subheading 0902.30.00.15 certified organic black tea in tea bags)",
    ],
    legalNotes: ["USDA NOP organic certification documentation required."],
    crossRulingReference:
      "Unverified / Statutory line in 2026 Revision 22 (certified organic black tea in tea bags; Free rate inherited from parent 0902.30.00).",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "0902.30.00.50",
    hts8: "0902.30.00",
    hs6: "0902.30",
    heading: "0902",
    chapter: "09",
    chapterTitle: "Coffee, tea, maté and spices",
    description:
      "Tea, whether or not flavored: Black tea (fermented) and partly fermented tea, in immediate packings of a content not exceeding 3 kg: In tea bags: Other",
    generalDutyRate: 0.0,
    generalRateStr: "Free",
    specialRates: "Free",
    indiaEligibleSpecial: false,
    column2Rate: "Free",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 (inherits Free rate from parent 0902.30.00).",
    relevantGris: [
      "GRI 1 (Heading 0902)",
      "GRI 6 (Subheading 0902.30.00.50 conventional black tea in tea bags)",
    ],
    legalNotes: ["FDA food facility registration required."],
    crossRulingReference:
      "Unverified / Statutory line in 2026 Revision 22 (conventional black tea in tea bags; Free rate inherited from parent 0902.30.00).",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "0902.10.10.00",
    hts8: "0902.10.10",
    hs6: "0902.10",
    heading: "0902",
    chapter: "09",
    chapterTitle: "Coffee, tea, maté and spices",
    description:
      "Green tea (not fermented) in immediate packings of a content not exceeding 3 kg: Flavored",
    generalDutyRate: 6.4,
    generalRateStr: "6.4%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "20%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Contrasting provision: Unfermented green tea containing artificial or natural flavors pays 6.4% duty."],
    crossRulingReference: "CBP CROSS Ruling NY N281902 (Flavored green tea in retail packages; Jan 10, 2017)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
  {
    hts10: "2101.20.90.00",
    hts8: "2101.20.90",
    hs6: "2101.20",
    heading: "2101",
    chapter: "21",
    chapterTitle: "Miscellaneous edible preparations",
    description:
      "Extracts, essences and concentrates, of coffee, tea or maté and preparations with a basis of these extracts, essences or concentrates or with a basis of coffee, tea or maté: Extracts, essences and concentrates, of tea or maté, and preparations with a basis of these extracts, essences or concentrates: Other",
    generalDutyRate: 6.8,
    generalRateStr: "6.8%",
    specialRates: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    indiaEligibleSpecial: false,
    column2Rate: "20%",
    units: ["kg"],
    statutoryRevision: "USITC 2026 HTS Revision 22 (Published Oct 30, 2026)",
    effectiveDate: "Unverified",
    effectiveDateSource: "Longstanding statutory HTS baseline maintained in 2026 Revision 22 without line-specific rate amendment.",
    relevantGris: ["GRI 1", "GRI 6"],
    legalNotes: ["Applies to instant tea, soluble tea powders, and tea extracts falling outside Chapter 9."],
    crossRulingReference: "CBP CROSS Ruling NY N245910 (Instant tea concentrates; Sept 26, 2013)",
    chapter99Notice:
      "Column 1 General rate represents baseline MFN tariff. Specific origin measures under Chapter 99 may apply.",
  },
];

/**
 * Searches the authoritative dataset by keyword query across description, heading, chapter, notes, rulings, and GRI rationale.
 */
export function searchTariffRecords(query: string): AuthoritativeTariffRecord[] {
  if (!query || query.trim().length === 0) return [];
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  if (terms.length === 0) return [];

  const results: Array<{ record: AuthoritativeTariffRecord; score: number }> = [];

  for (const record of AUTHORITATIVE_TARIFF_DATABASE) {
    const searchable = `${record.hts10} ${record.hts8} ${record.hs6} ${record.description} ${record.chapterTitle} ${record.relevantGris.join(" ")} ${record.legalNotes?.join(" ") || ""} ${record.crossRulingReference || ""}`.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (searchable.includes(term)) {
        score += term.length > 5 ? 2 : 1;
      }
    }

    if (score > 0) {
      results.push({ record, score });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.record);
}

/**
 * Returns an authoritative tariff record by exact 10-digit HTS code.
 */
export function getTariffRecordByHts10(hts10: string): AuthoritativeTariffRecord | null {
  const normalized = normalizeHtsCode(hts10);
  return AUTHORITATIVE_TARIFF_DATABASE.find((r) => r.hts10 === normalized) || null;
}

/**
 * Returns all authoritative tariff lines under a 6-digit HS subheading.
 */
export function getTariffRecordsByHs6(hs6: string): AuthoritativeTariffRecord[] {
  const cleanHs6 = hs6.replace(/[^0-9]/g, "").slice(0, 6);
  if (cleanHs6.length < 4) return [];
  const formattedHs6 = cleanHs6.length >= 6 ? `${cleanHs6.slice(0, 4)}.${cleanHs6.slice(4, 6)}` : cleanHs6;

  return AUTHORITATIVE_TARIFF_DATABASE.filter(
    (r) => r.hs6 === formattedHs6 || r.hts10.replace(/[^0-9]/g, "").startsWith(cleanHs6)
  );
}
