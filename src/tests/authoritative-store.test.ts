import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  USITC_REVISION_METADATA,
  AUTHORITATIVE_TARIFF_DATABASE,
  normalizeHtsCode,
  validateHtsCode,
  validateCandidateSuitability,
  searchTariffRecords,
  getTariffRecordByHts10,
  getTariffRecordsByHs6,
} from "../lib/tariff/authoritative-store.ts";

describe("USITC Authoritative Tariff Schedule Store (Sprint 3 Remediation Audit)", () => {
  test("maintains official USITC 2026 Revision 22 metadata integrity and honest effective-date handling", () => {
    assert.equal(USITC_REVISION_METADATA.sourceAuthority, "United States International Trade Commission (USITC)");
    assert.equal(USITC_REVISION_METADATA.revisionNumber, "2026 HTS Revision 22");
    assert.equal(USITC_REVISION_METADATA.publicationDate, "October 30, 2026");
    assert.ok(
      USITC_REVISION_METADATA.statutoryEffectiveDate.includes("Unverified"),
      "Revision-level effective date must be marked unverified rather than assuming publication date for all lines"
    );
    assert.equal(USITC_REVISION_METADATA.officialUrl, "https://hts.usitc.gov/");
    assert.ok(USITC_REVISION_METADATA.indiaGspStatus.includes("GSP INELIGIBLE"));
    assert.ok(USITC_REVISION_METADATA.indiaGspStatus.includes("Chapter 99"));
  });

  test("STATUTORY DISCLAIMER: 19 U.S.C. § 1484 notice attributes reasonable-care obligation to the U.S. Importer of Record", () => {
    const disclaimer = USITC_REVISION_METADATA.disclaimer;
    assert.ok(disclaimer.includes("19 U.S.C. § 1484"));
    assert.ok(disclaimer.includes("U.S. Importer of Record"));
    assert.ok(disclaimer.includes("does not transfer statutory importer liability"));
    assert.ok(!disclaimer.includes("exporter is legally responsible for using reasonable care"));
  });

  test("normalizes HTS codes across various input formats", () => {
    assert.equal(normalizeHtsCode("4202921500"), "4202.92.15.00");
    assert.equal(normalizeHtsCode("4202.92.15.00"), "4202.92.15.00");
    assert.equal(normalizeHtsCode("4202.92.15"), "4202.92.15");
    assert.equal(normalizeHtsCode("420292"), "4202.92");
    assert.equal(normalizeHtsCode(""), "");
  });

  test("validates genuine HTS codes in the official dataset", () => {
    const bagValidation = validateHtsCode("4202.92.15.00");
    assert.equal(bagValidation.isValid, true);
    assert.equal(bagValidation.normalized, "4202.92.15.00");
    assert.ok(bagValidation.record);
    assert.equal(bagValidation.record.heading, "4202");
    assert.equal(bagValidation.record.generalDutyRate, 6.3);

    const brassValidation = validateHtsCode("8306.29.00.00");
    assert.equal(brassValidation.isValid, true);
    assert.equal(brassValidation.record?.generalRateStr, "Free");

    // Genuine USITC Rev 22 loose-leaf black tea line
    const teaValidation = validateHtsCode("0902.30.00.90");
    assert.equal(teaValidation.isValid, true);
    assert.equal(teaValidation.record?.generalRateStr, "Free");
    assert.deepEqual(teaValidation.record?.units, ["kg"]);

    // Strict rejection of non-existent statistical line 0902.30.00.00
    const invalidTeaValidation = validateHtsCode("0902.30.00.00");
    assert.equal(invalidTeaValidation.isValid, false);
    assert.ok(invalidTeaValidation.error?.includes("official USITC 2026 HTS Revision 22"));
  });

  test("REGULATORY CORRECTION: ceramic schedule distinguishes 6912.00.44 (10%), 6911.10.45 (14%), 6911.10.52 (8%), and 6911.10.80 (20.8%)", () => {
    // 1. Non-porcelain stoneware/earthenware mugs: 6912.00.44.00 (10.0%)
    const mugRecord = getTariffRecordByHts10("6912.00.44.00");
    assert.ok(mugRecord, "HTS 6912.00.44.00 must exist in authoritative store");
    assert.equal(mugRecord.generalDutyRate, 10.0);
    assert.equal(mugRecord.generalRateStr, "10.0%");
    assert.ok(mugRecord.description.includes("Mugs and other steins"));
    assert.ok(mugRecord.units.includes("dz.pcs."));

    // 2. Porcelain/china mugs and steins: 6911.10.45.00 (14.0%)
    const porcelainMugRecord = getTariffRecordByHts10("6911.10.45.00");
    assert.ok(porcelainMugRecord, "HTS 6911.10.45.00 must exist in authoritative store");
    assert.equal(porcelainMugRecord.generalDutyRate, 14.0);
    assert.equal(porcelainMugRecord.generalRateStr, "14.0%");
    assert.ok(porcelainMugRecord.description.includes("Mugs and other steins"));
    assert.ok(porcelainMugRecord.units.includes("dz.pcs."));

    // 3. Specified porcelain tableware price tier: 6911.10.52.00 (8.0%)
    const specifiedTablewareRecord = getTariffRecordByHts10("6911.10.52.00");
    assert.ok(specifiedTablewareRecord, "HTS 6911.10.52.00 must exist in authoritative store");
    assert.equal(specifiedTablewareRecord.generalDutyRate, 8.0);
    assert.equal(specifiedTablewareRecord.generalRateStr, "8.0%");
    assert.ok(!specifiedTablewareRecord.description.includes("Mugs and other steins"), "6911.10.52 does not cover mugs");

    // 4. Other porcelain tableware basket: 6911.10.80.00 (20.8%)
    const otherPorcelainRecord = getTariffRecordByHts10("6911.10.80.00");
    assert.ok(otherPorcelainRecord, "HTS 6911.10.80.00 must exist in authoritative store");
    assert.equal(otherPorcelainRecord.generalDutyRate, 20.8);
    assert.equal(otherPorcelainRecord.generalRateStr, "20.8%");

    // 5. Non-porcelain other food-contact tableware: 6912.00.48.10 (9.8%)
    const otherTablewareRecord = getTariffRecordByHts10("6912.00.48.10");
    assert.ok(otherTablewareRecord, "HTS 6912.00.48.10 must exist in authoritative store");
    assert.equal(otherTablewareRecord.generalDutyRate, 9.8);
    assert.equal(otherTablewareRecord.generalRateStr, "9.8%");
    assert.ok(otherTablewareRecord.description.includes("Suitable for food or drink contact"));
  });

  test("CBP RULING AUDIT: verifies genuine CBP rulings across all 7 seed profiles, eliminating invented ruling numbers", () => {
    // 1. Cotton tote bag (4202.92.15.00): Verified NY I89837
    const bagRecord = getTariffRecordByHts10("4202.92.15.00")!;
    assert.ok(bagRecord.crossRulingReference?.includes("NY I89837"), "Must cite verified cotton tote bag ruling NY I89837");
    assert.ok(!bagRecord.crossRulingReference?.includes("N301452"), "Must eliminate unverified N301452");

    // 2. Cast brass statuette (8306.29.00.00): Verified NY 816037
    const brassRecord = getTariffRecordByHts10("8306.29.00.00")!;
    assert.ok(brassRecord.crossRulingReference?.includes("NY 816037"), "Must cite verified brass statuette ruling NY 816037");
    assert.ok(!brassRecord.crossRulingReference?.includes("N283419"), "Must eliminate unverified N283419");

    // 3. Silk shawl / scarf (6214.10.10.00): Verified NY I87170
    const silkRecord = getTariffRecordByHts10("6214.10.10.00")!;
    assert.ok(silkRecord.crossRulingReference?.includes("NY I87170"), "Must cite verified silk scarf ruling NY I87170");
    assert.ok(!silkRecord.crossRulingReference?.includes("N294112"), "Must eliminate unverified N294112");

    // 4. Ceramic mug (6912.00.44.00): Verified NY N023339 & NY N124608
    const mugRecord = getTariffRecordByHts10("6912.00.44.00")!;
    assert.ok(mugRecord.crossRulingReference?.includes("NY N124608"), "Must cite verified ceramic mug ruling NY N124608");
    assert.ok(mugRecord.crossRulingReference?.includes("NY N023339"), "Must cite mug criteria ruling NY N023339");
    assert.ok(!mugRecord.crossRulingReference?.includes("N298319"), "Must eliminate herbicide citation NY N298319");
    assert.ok(
      mugRecord.crossRulingReference?.includes("do not substitute for a binding ruling"),
      "Must caveat that rulings are merchandise-specific and non-transferable"
    );

    // 5. Wood coasters (4419.90.91.00 & 4419.20.90.00): Accurate CBP rulings metadata and relevance labels
    const coasterTablewareRecord = getTariffRecordByHts10("4419.90.91.00")!;
    assert.ok(coasterTablewareRecord.crossRulingReference?.includes("NY N095158"), "Must cite wooden coaster ruling NY N095158");
    assert.ok(coasterTablewareRecord.crossRulingReference?.includes("March 23, 2010"), "Must correct NY N095158 date to March 23, 2010");
    assert.ok(
      coasterTablewareRecord.crossRulingReference?.includes("redwood frame, plywood base, and decorative paper"),
      "Must accurately describe NY N095158 composite coaster merchandise"
    );
    assert.ok(coasterTablewareRecord.crossRulingReference?.includes("NY N240071"), "Must cite wooden coaster set ruling NY N240071");
    assert.ok(
      coasterTablewareRecord.crossRulingReference?.includes("medium density fiberboard (MDF) drink coasters with decorative paper surface"),
      "Must accurately describe NY N240071 MDF coaster merchandise"
    );
    assert.ok(
      coasterTablewareRecord.crossRulingReference?.includes("[Related Heading Precedent / Composite & MDF Construction]"),
      "Must label rulings honestly as related heading precedents, not direct material precedents"
    );
    assert.ok(
      coasterTablewareRecord.crossRulingReference?.includes("Neither NY N095158 nor NY N240071 is a direct material match for solid carved Sheesham coasters"),
      "Must explain that prior rulings are not direct material matches for solid carved Sheesham"
    );
    assert.ok(
      coasterTablewareRecord.crossRulingReference?.includes("NY R04475"),
      "Must retain closer solid-wood coaster precedent NY R04475"
    );

    // Also verify tropical wood line 4419.20.90.00
    const tropicalCoasterRecord = getTariffRecordByHts10("4419.20.90.00")!;
    assert.ok(tropicalCoasterRecord.crossRulingReference?.includes("NY N324277"), "Must cite solid mango wood tray ruling NY N324277");
    assert.ok(
      tropicalCoasterRecord.legalNotes?.some((n) => n.includes("Subheading Note 1's enumerated tropical wood list applies strictly to specified subheadings in 4403, 4407, 4408, and 4412")),
      "Must document that Subheading Note 1 does not legally govern 4419.20"
    );

    // Also verify residual basket 4421.99.98.80
    const coasterRecord = getTariffRecordByHts10("4421.99.98.80")!;
    assert.ok(!coasterRecord.crossRulingReference?.includes("N291882"), "Must eliminate unverified N291882");
    assert.ok(coasterRecord.crossRulingReference?.includes("Unverified"), "Must mark as unverified / residual basket");
    assert.ok(coasterRecord.crossRulingReference?.includes("NY N240071"), "Must note Heading 4419 tableware distinction (NY N240071)");

    // 6. Leather wallet (4202.31.60.00): Verified NY N248778
    const walletRecord = getTariffRecordByHts10("4202.31.60.00")!;
    assert.ok(walletRecord.crossRulingReference?.includes("NY N248778"), "Must cite verified leather wallet ruling NY N248778");
    assert.ok(!walletRecord.crossRulingReference?.includes("N295431"), "Must eliminate unverified N295431");

    // 7. Darjeeling tea (0902.30.00.90): Verified NY N203765
    const teaRecord = getTariffRecordByHts10("0902.30.00.90")!;
    assert.ok(teaRecord.crossRulingReference?.includes("NY N203765"), "Must cite verified retail black tea ruling NY N203765");
    assert.ok(!teaRecord.crossRulingReference?.includes("N296541"), "Must eliminate unverified N296541");
  });

  test("SUITABILITY GUARDRAIL: distinguishes code existence from product suitability", () => {
    const stonewareMugRecord = getTariffRecordByHts10("6912.00.44.00")!;
    const porcelainMugRecord = getTariffRecordByHts10("6911.10.45.00")!;
    const cottonBagRecord = getTariffRecordByHts10("4202.92.15.00")!;

    // 1. Stoneware ceramic mug against 6912.00.44.00 -> Suitable
    const validMugCheck = validateCandidateSuitability(stonewareMugRecord, {
      title: "Handmade Glazed Ceramic Coffee Mug",
      description: "Wheel-thrown stoneware mug with ergonomic handle.",
      materials: "Glazed stoneware clay",
    });
    assert.equal(validMugCheck.isSuitable, true);

    // 2. Translucent porcelain mug against 6912.00.44.00 -> Inappropriate (belongs in 6911)
    const porcelainOnStonewareCheck = validateCandidateSuitability(stonewareMugRecord, {
      title: "Fine Bone China Porcelain Mug",
      description: "Translucent white porcelain coffee mug.",
      materials: "Kaolin clay, bone china",
    });
    assert.equal(porcelainOnStonewareCheck.isSuitable, false);
    assert.ok(porcelainOnStonewareCheck.reason?.includes("heading 6911"));

    // 3. Porcelain mug against 6911.10.45.00 -> Suitable
    const validPorcelainCheck = validateCandidateSuitability(porcelainMugRecord, {
      title: "Fine Bone China Porcelain Mug",
      description: "Translucent white porcelain coffee mug.",
      materials: "Kaolin clay, bone china",
    });
    assert.equal(validPorcelainCheck.isSuitable, true);

    // 4. Stoneware mug against 6911.10.45.00 -> Inappropriate (belongs in 6912)
    const stonewareOnPorcelainCheck = validateCandidateSuitability(porcelainMugRecord, {
      title: "Handmade Glazed Ceramic Coffee Mug",
      description: "Wheel-thrown stoneware mug with ergonomic handle.",
      materials: "Glazed stoneware clay",
    });
    assert.equal(stonewareOnPorcelainCheck.isSuitable, false);
    assert.ok(stonewareOnPorcelainCheck.reason?.includes("heading 6912"));

    // 5. Ceramic mug against cotton bag record -> Inappropriate! (rejection even though code exists)
    const inappropriateCheck = validateCandidateSuitability(cottonBagRecord, {
      title: "Handmade Glazed Ceramic Coffee Mug",
      description: "Wheel-thrown stoneware mug with ergonomic handle.",
      materials: "Glazed stoneware clay",
    });
    assert.equal(inappropriateCheck.isSuitable, false);
    assert.ok(inappropriateCheck.reason?.includes("travel goods, bags, and wallets"));

    // 6. Tea suitability: loose leaf vs tea bags vs organic
    const looseTeaRecord = getTariffRecordByHts10("0902.30.00.90")!;
    const organicTeaBagRecord = getTariffRecordByHts10("0902.30.00.15")!;
    const conventionalTeaBagRecord = getTariffRecordByHts10("0902.30.00.50")!;

    // Loose leaf product against 0902.30.00.90 -> Suitable
    const validLooseCheck = validateCandidateSuitability(looseTeaRecord, {
      title: "Single-Estate Darjeeling Loose Leaf Black Tea",
      description: "Orthodox whole leaf tea in 100g tin canister.",
      materials: "100% Camellia sinensis",
    });
    assert.equal(validLooseCheck.isSuitable, true);

    // Tea bag product against 0902.30.00.90 -> Inappropriate (belongs in .15 or .50)
    const teaBagOnLooseCheck = validateCandidateSuitability(looseTeaRecord, {
      title: "Darjeeling Black Tea",
      description: "50 individual tea bags.",
      materials: "Black tea in tea bags",
    });
    assert.equal(teaBagOnLooseCheck.isSuitable, false);
    assert.ok(teaBagOnLooseCheck.reason?.includes("loose tea"));

    // Loose leaf product against 0902.30.00.15 -> Inappropriate (belongs in .90)
    const looseOnBagCheck = validateCandidateSuitability(organicTeaBagRecord, {
      title: "Single-Estate Darjeeling Loose Leaf Black Tea",
      description: "Orthodox whole leaf tea in tin canister.",
      materials: "100% Camellia sinensis",
    });
    assert.equal(looseOnBagCheck.isSuitable, false);
    assert.ok(looseOnBagCheck.reason?.includes("tea in tea bags"));

    // Conventional tea against certified organic tea bag line (0902.30.00.15) -> Inappropriate
    const conventionalOnOrganicCheck = validateCandidateSuitability(organicTeaBagRecord, {
      title: "Darjeeling Tea Bags",
      description: "Conventional non-organic black tea in tea bags.",
      materials: "Black tea",
    });
    assert.equal(conventionalOnOrganicCheck.isSuitable, false);
    assert.ok(conventionalOnOrganicCheck.reason?.includes("certified organic tea"));

    // Conventional tea bags against 0902.30.00.50 -> Suitable
    const validConventionalBagCheck = validateCandidateSuitability(conventionalTeaBagRecord, {
      title: "Darjeeling Tea Bags",
      description: "Box of 25 conventional tea bags.",
      materials: "Black tea in tea bags",
    });
    assert.equal(validConventionalBagCheck.isSuitable, true);

    // 7. Wood coaster suitability: 4419 tableware vs 4421 residual basket
    const basketWoodRecord = getTariffRecordByHts10("4421.99.98.80")!;
    const coasterBasketCheck = validateCandidateSuitability(basketWoodRecord, {
      title: "Handmade Wooden Drink Coaster Set",
      description: "Set of circular drink coasters for table protection.",
      materials: "Sheesham wood",
    });
    assert.equal(coasterBasketCheck.isSuitable, false, "4421 must reject drink coasters because they belong under 4419");
    assert.ok(coasterBasketCheck.reason?.includes("4419"), "Reason must cite heading 4419");

    // Sheesham against 4419.90.91.00 -> Suitable (competing candidate)
    const sheeshamTablewareRecord = getTariffRecordByHts10("4419.90.91.00")!;
    const validSheeshamCheck90 = validateCandidateSuitability(sheeshamTablewareRecord, {
      title: "Hand-Carved Sheesham Coaster Set",
      description: "Drink coasters of Sheesham timber.",
      materials: "Dalbergia sissoo",
    });
    assert.equal(validSheeshamCheck90.isSuitable, true);

    // Sheesham against 4419.20.90.00 -> Suitable (competing candidate under ordinary meaning, as Subheading Note 1 does not govern 4419.20)
    const tropicalTablewareRecord = getTariffRecordByHts10("4419.20.90.00")!;
    const validSheeshamCheck20 = validateCandidateSuitability(tropicalTablewareRecord, {
      title: "Hand-Carved Sheesham Coaster Set",
      description: "Drink coasters of Sheesham timber.",
      materials: "Dalbergia sissoo",
    });
    assert.equal(validSheeshamCheck20.isSuitable, true, "Sheesham is plausible under 4419.20 because Subheading Note 1 does not govern 4419.20");

    // Oak (unambiguously temperate) against 4419.90.91.00 -> Suitable
    const validOakCheck = validateCandidateSuitability(sheeshamTablewareRecord, {
      title: "Solid Oak Coasters",
      description: "Drink coasters made of solid white oak wood.",
      materials: "Oak",
    });
    assert.equal(validOakCheck.isSuitable, true);

    // Oak against 4419.20.90.00 (tropical wood) -> Inappropriate
    const oakOnTropicalCheck = validateCandidateSuitability(tropicalTablewareRecord, {
      title: "Solid Oak Coasters",
      description: "Drink coasters made of solid white oak wood.",
      materials: "Oak",
    });
    assert.equal(oakOnTropicalCheck.isSuitable, false);
    assert.ok(oakOnTropicalCheck.reason?.includes("tropical wood"));

    // Teak (tropical) against 4419.20.90.00 -> Suitable
    const validTeakCheck = validateCandidateSuitability(tropicalTablewareRecord, {
      title: "Solid Teak Coasters",
      description: "Drink coasters carved from teak wood.",
      materials: "Teak",
    });
    assert.equal(validTeakCheck.isSuitable, true);

    // Teak against 4419.90.91.00 (other wood) -> Inappropriate (Teak is tropical under 4419.20)
    const teakOnOtherWoodCheck = validateCandidateSuitability(sheeshamTablewareRecord, {
      title: "Solid Teak Coasters",
      description: "Drink coasters carved from teak wood.",
      materials: "Teak",
    });
    assert.equal(teakOnOtherWoodCheck.isSuitable, false);
    assert.ok(teakOnOtherWoodCheck.reason?.includes("4419.20.90.00"));
  });

  test("OFFICIAL USITC REVISION 22 QUANTITY UNITS: coaster is kg, silk shawl is doz. and kg, tea is kg", () => {
    // 1. Wood coasters & tableware (4419.90.91.00 & 4419.20.90.00) -> kg
    const coasterTablewareRecord = getTariffRecordByHts10("4419.90.91.00");
    assert.ok(coasterTablewareRecord);
    assert.equal(coasterTablewareRecord.generalDutyRate, 3.2);
    assert.deepEqual(coasterTablewareRecord.units, ["kg"]);
    assert.ok(!coasterTablewareRecord.units.includes("No."));
    assert.ok(!coasterTablewareRecord.units.includes("pcs."));

    const tropicalCoasterRecord = getTariffRecordByHts10("4419.20.90.00");
    assert.ok(tropicalCoasterRecord);
    assert.equal(tropicalCoasterRecord.generalDutyRate, 3.2);
    assert.deepEqual(tropicalCoasterRecord.units, ["kg"]);

    // Residual wood basket (4421.99.98.80) -> kg, 3.3%
    const residualWoodRecord = getTariffRecordByHts10("4421.99.98.80");
    assert.ok(residualWoodRecord);
    assert.equal(residualWoodRecord.generalDutyRate, 3.3);
    assert.deepEqual(residualWoodRecord.units, ["kg"]);

    // 2. Silk shawls/scarves (6214.10.10.00) -> doz., kg (dual reporting units)
    const shawlRecord = getTariffRecordByHts10("6214.10.10.00");
    assert.ok(shawlRecord);
    assert.equal(shawlRecord.generalDutyRate, 1.2);
    assert.deepEqual(shawlRecord.units, ["doz.", "kg"]);
    assert.ok(!shawlRecord.units.includes("No."));

    // 3. Darjeeling black tea lines under parent 0902.30.00 -> kg
    const looseTeaRecord = getTariffRecordByHts10("0902.30.00.90");
    assert.ok(looseTeaRecord);
    assert.deepEqual(looseTeaRecord.units, ["kg"]);

    const organicTeaBagRecord = getTariffRecordByHts10("0902.30.00.15");
    assert.ok(organicTeaBagRecord);
    assert.deepEqual(organicTeaBagRecord.units, ["kg"]);

    const otherTeaBagRecord = getTariffRecordByHts10("0902.30.00.50");
    assert.ok(otherTeaBagRecord);
    assert.deepEqual(otherTeaBagRecord.units, ["kg"]);
  });

  test("ANTI-FABRICATION GUARDRAIL: strictly rejects hallucinated or non-existent HTS codes", () => {
    const fake1 = validateHtsCode("9999.99.99.99");
    assert.equal(fake1.isValid, false);
    assert.ok(fake1.error?.includes("was not found in the official USITC 2026 HTS Revision 22"));

    const fake2 = validateHtsCode("0000.00.00.00");
    assert.equal(fake2.isValid, false);

    const fake3 = validateHtsCode("4202.99.99.99");
    assert.equal(fake3.isValid, false);
  });

  test("searches authoritative records by keyword", () => {
    const toteHits = searchTariffRecords("cotton canvas tote bag");
    assert.ok(toteHits.length > 0);
    assert.equal(toteHits[0].hts10, "4202.92.15.00");

    const teaHits = searchTariffRecords("darjeeling black tea");
    assert.ok(teaHits.length > 0);
    assert.equal(teaHits[0].hts10, "0902.30.00.90");

    const silverHits = searchTariffRecords("silver filigree earrings jewelry");
    assert.ok(silverHits.length > 0);
    assert.equal(silverHits[0].hts10, "7113.11.50.00");
  });

  test("STATUTORY COMPLIANCE: every record marks India as ineligible for GSP benefits and avoids invented effective dates", () => {
    assert.ok(AUTHORITATIVE_TARIFF_DATABASE.length >= 15);
    for (const record of AUTHORITATIVE_TARIFF_DATABASE) {
      assert.equal(
        record.indiaEligibleSpecial,
        false,
        `Record ${record.hts10} must strictly mark indiaEligibleSpecial as false (GSP expired/terminated)`
      );
      assert.ok(record.statutoryRevision.includes("USITC 2026 HTS Revision 22"));
      // Must not invent 2026-10-30 as the effective date for statutory baselines
      if (record.effectiveDate !== "Unverified") {
        assert.ok(record.effectiveDateSource, `Record ${record.hts10} with verified effective date must document its legal source`);
      }
      assert.ok(record.relevantGris.length > 0);
      assert.ok(record.chapter99Notice, `Record ${record.hts10} must note Chapter 99 provisions / base rate status`);
    }
  });

  test("retrieves records by HS-6 subheading", () => {
    const lines = getTariffRecordsByHs6("4202.92");
    assert.ok(lines.length >= 3);
    const codes = lines.map((l) => l.hts10);
    assert.ok(codes.includes("4202.92.15.00")); // cotton
    assert.ok(codes.includes("4202.92.31.31")); // plastic sheeting
    assert.ok(codes.includes("4202.92.91.00")); // man-made fiber
  });
});
