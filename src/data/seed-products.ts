/**
 * BorderBrief AI — Curated Seed Dataset (Sprint 2)
 * 7 authentic Indian export profiles for small businesses and handicraft sellers.
 * Grounded in official USITC 2026 HTS Revision 22 (published October 30, 2026),
 * 19 U.S.C. § 1401a(b)(4)(A) international shipment cost exclusion,
 * and WCO General Rules of Interpretation (GRIs).
 */

import type { ProductAnalysisResult } from "../types/export.ts";

export interface SeedProductProfile {
  id: string;
  category: string;
  title: string;
  description: string;
  declaredMaterials: string;
  intendedUse: string;
  originCountry: string;
  destinationCountry: string;
  itemPriceUSD: number;
  shippingCostUSD: number; // Incident to international shipment under § 1401a(b)(4)(A)
  suggestedHS6: string;
  candidateHTS10: string;
  htsDescription: string;
  generalDutyRate: number; // ad valorem percentage (e.g. 6.3 means 6.3%)
  specialRateText: string;
  unitOfQuantity: string;
  wcoGriRationale: string;
  plainLanguageExplanation: string;
  clarifyingQuestions?: string[];
  tariffRevision: string;
  provenanceNote?: string;
  mockAnalysis: ProductAnalysisResult;
}

export const SEED_EXPORT_PROFILES: SeedProductProfile[] = [
  {
    id: "prod-cotton-bag",
    category: "Textiles & Handicrafts",
    title: "Handmade Hand-Printed Cotton Tote Bag",
    description:
      "Eco-friendly shopping tote bag made from 100% natural unbleached cotton canvas with traditional Indian block print, cotton webbing shoulder handles, and open top without zipper.",
    declaredMaterials: "100% Woven Cotton Canvas, Natural Vegetable Dye",
    intendedUse: "Daily shopping bag and casual shoulder tote for retail consumers.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 24.5,
    shippingCostUSD: 14.0,
    suggestedHS6: "4202.92",
    candidateHTS10: "4202.92.15.00",
    htsDescription:
      "Trunks, suit-cases, vanity-cases... with outer surface of textile materials: Of vegetable fibers and not of pile or tufted construction: Of cotton",
    generalDutyRate: 6.3,
    specialRateText: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    unitOfQuantity: "No., kg",
    wcoGriRationale:
      "Classified by application of GRI 1 and GRI 6. Heading 4202 specifically covers travel goods, tote bags, and shopping bags. Subheading 4202.92 covers bags with an outer surface of textile materials. Subheading 4202.92.15 isolates vegetable textile fibers (cotton) not of pile or tufted construction.",
    plainLanguageExplanation:
      "Because your tote bag is made primarily of woven cotton canvas with textile handles, US customs classifies it under Chapter 42 (bags and cases) rather than Chapter 63 (general textile articles). Under Column 1 General MFN rates, the standard tariff rate for Indian cotton bags is 6.3%.",
    clarifyingQuestions: [
      "Does the tote bag have an outer surface of cotton, or does it have an external plastic/PVC water-resistant coating?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    mockAnalysis: {
      product_summary:
        "Handmade block-printed tote bag crafted from woven cotton canvas with textile shoulder straps and unlined interior.",
      identified_attributes: [
        {
          attributeName: "Primary Material",
          value: "Woven Cotton Canvas",
          source: "EXPLICIT_SELLER",
          notes: "Seller declared 100% cotton canvas.",
        },
        {
          attributeName: "Outer Surface",
          value: "Textile (Vegetable Fiber)",
          source: "INFERRED_ANALYSIS",
          notes: "Inferred from canvas description; no plastic coating mentioned.",
        },
        {
          attributeName: "Closure Type",
          value: "Open top (no zipper or clasp)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Lining / Waterproofing",
          value: "Unknown",
          source: "UNKNOWN",
          notes: "Requires confirmation if any internal water-resistant membrane exists.",
        },
      ],
      explicitly_provided: {
        material: "100% Woven Cotton Canvas, Natural Vegetable Dye",
        handles: "Cotton webbing shoulder straps",
        construction: "Hand-printed block print",
      },
      inferred_attributes: {
        category: "Textile shopping / tote bag",
        outer_surface: "Vegetable textile fiber (cotton)",
        pile_construction: "Non-pile, flat-woven",
      },
      unknown_attributes: [
        "Presence of internal plastic or water-resistant laminate lining",
        "Exact grammage / fabric weight (GSM)",
      ],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-cotton-bag-1",
          question: "Does the bag have an internal waterproof lining or plastic film?",
          context:
            "If the bag has a plastic interior or exterior film, it may reclassify under Heading 4202's sheeting of plastics provisions.",
          suggestedOptions: ["No, 100% unlined cotton", "Yes, interior waterproof PVC/PE layer"],
        },
      ],
      analysis_warnings: [
        "Classification preparation only. Not an authoritative customs ruling.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-brass-statue",
    category: "Metal Crafts",
    title: "Handcrafted Cast Brass Ganesha Figurine",
    description:
      "Traditional lost-wax cast brass figurine of Lord Ganesha, decorative home sculpture with antique bronze polish, solid metal construction without precious plating.",
    declaredMaterials: "Brass (Copper-Zinc Alloy), Lacquer Sealant",
    intendedUse: "Decorative religious figurine for home altar or cultural display.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 68.0,
    shippingCostUSD: 28.0,
    suggestedHS6: "8306.29",
    candidateHTS10: "8306.29.00.00",
    htsDescription:
      "Bells, gongs and the like, non-electric, of base metal; statuettes and other ornaments, of base metal: Statuettes and other ornaments, and parts thereof: Other",
    generalDutyRate: 0.0,
    specialRateText: "Free",
    unitOfQuantity: "kg",
    wcoGriRationale:
      "Classified pursuant to GRI 1. Heading 8306 specifically provides for statuettes and other ornaments of base metal. Because brass is a copper alloy classified as a base metal under Section XV, it is classified under subheading 8306.29.",
    plainLanguageExplanation:
      "Decorative metal statuettes made from non-precious base metals (like brass or bronze) fall under Chapter 83. Under the US tariff schedule Column 1 General rate, base metal statuettes enter duty-free (0.0%).",
    clarifyingQuestions: [
      "Is the statue solid cast brass, or is it plated with precious metals like gold or silver?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    mockAnalysis: {
      product_summary:
        "Solid cast brass statuette of deity Ganesha with antique polish finish, ornamental/decorative function.",
      identified_attributes: [
        {
          attributeName: "Primary Composition",
          value: "Brass (Copper-Zinc base metal alloy)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Manufacturing Process",
          value: "Lost-wax casting",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Precious Metal Content",
          value: "None declared",
          source: "INFERRED_ANALYSIS",
          notes: "Non-plated base metal figurine.",
        },
      ],
      explicitly_provided: {
        material: "Brass alloy",
        finish: "Antique polish with lacquer",
      },
      inferred_attributes: {
        category: "Base metal statuette / ornament",
        classification_chapter: "Chapter 83 (Miscellaneous articles of base metal)",
      },
      unknown_attributes: ["Total net weight in kilograms (required on entry summary)"],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-brass-1",
          question: "Does the figurine contain any electroplating of gold or silver?",
          context:
            "Precious metal plating can trigger Chapter 71 jewelry/precious metal provisions if significant.",
          suggestedOptions: ["Solid unplated brass", "Plated with precious metal"],
        },
      ],
      analysis_warnings: [
        "Product understanding analysis only. Formal customs classification requires verification.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-silk-scarf",
    category: "Apparel & Accessories",
    title: "Hand-Woven Mulberry Silk Shawl / Scarf",
    description:
      "Luxurious handloom scarf crafted from 100% pure Mulberry silk with zari thread border, measuring 70 cm x 180 cm, hand-rolled edges.",
    declaredMaterials: "100% Pure Mulberry Silk, Metallic Zari Thread",
    intendedUse: "Fashion accessory and neckwear for personal adornment.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 48.0,
    shippingCostUSD: 16.0,
    suggestedHS6: "6214.10",
    candidateHTS10: "6214.10.10.00",
    htsDescription:
      "Shawls, scarves, mufflers, mantillas, veils and the like: Of silk or silk waste: Containing 70 percent or more by weight of silk or silk waste",
    generalDutyRate: 1.2,
    specialRateText: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    unitOfQuantity: "doz., kg",
    wcoGriRationale:
      "Classified under GRI 1 and GRI 6. Heading 6214 covers shawls and scarves not knitted or crocheted. Subheading 6214.10 specifically isolates items containing 70% or more by weight of silk.",
    plainLanguageExplanation:
      "Handloom silk scarves of pure silk are classified under Chapter 62 (woven apparel accessories). Because your scarf exceeds 70% silk content by weight, it qualifies for the lower 1.2% general duty rate rather than higher blended rates.",
    clarifyingQuestions: [
      "Is the scarf woven on a loom or knitted/crocheted?",
      "Does pure silk make up 70% or more of the total weight including the metallic border?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    mockAnalysis: {
      product_summary:
        "Woven handloom silk shawl measuring 70 x 180 cm with metallic zari border and rolled edges.",
      identified_attributes: [
        {
          attributeName: "Fiber Content",
          value: "Mulberry Silk (>70% by weight)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Weaving Construction",
          value: "Handloom woven (non-knitted)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Trim / Border",
          value: "Metallic zari thread",
          source: "EXPLICIT_SELLER",
        },
      ],
      explicitly_provided: {
        fiber: "100% pure Mulberry silk body",
        dimensions: "70 cm x 180 cm",
      },
      inferred_attributes: {
        apparel_category: "Shawl / scarf (Heading 6214)",
        weight_silk_ratio: "Presumed over 70% silk by total weight",
      },
      unknown_attributes: [
        "Exact percentage by weight of metallic zari vs silk fiber",
      ],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-silk-1",
          question: "Does pure silk make up at least 70% of the total scarf weight?",
          context:
            "Under US HTS 6214.10, products containing 70% or more silk have a specific duty rate distinct from blended scarves.",
          suggestedOptions: ["Yes, >70% silk by weight", "No, heavy metallic zari / blended yarn"],
        },
      ],
      analysis_warnings: [
        "Textile fiber declarations must comply with FTC labeling regulations upon commercial import.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-ceramic-mug",
    category: "Ceramics & Pottery",
    title: "Studio Pottery Hand-Thrown Glazed Stoneware Ceramic Mug",
    description:
      "Artisanal wheel-thrown ceramic mug crafted from 100% opaque stoneware clay (verified non-porcelain), food-safe colored glaze interior, unglazed terracotta texture on outer base, volume 350 ml. Specifically documented as non-porcelain with an opaque body and water absorption <= 3% pursuant to Chapter 69 Additional U.S. Note 5(a).",
    declaredMaterials: "100% Opaque Stoneware Clay (Non-Porcelain), Food-Safe Ceramic Glaze",
    intendedUse: "Drinkware for hot and cold beverages in home or cafe.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 18.0,
    shippingCostUSD: 18.5,
    suggestedHS6: "6912.00",
    candidateHTS10: "6912.00.44.00",
    htsDescription:
      "Ceramic tableware, kitchenware, other household articles and toilet articles, other than of porcelain or china: Tableware and kitchenware: Other: Mugs and other steins",
    generalDutyRate: 10.0,
    specialRateText: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    unitOfQuantity: "dz.pcs.",
    wcoGriRationale:
      "Classified pursuant to GRI 1 and GRI 6. Heading 6912 covers ceramic tableware and kitchenware other than of porcelain or china. The product is documented as made from 100% opaque stoneware clay with zero translucency (non-porcelain), satisfying the statutory criteria of Chapter 69 Additional U.S. Note 5(a) and distinguishing it from porcelain/china under Heading 6911. Subheading 6912.00.44 specifically and eo nomine provides for mugs and other steins. Note on Provenance: Material specifications (100% opaque stoneware clay, opaque body, water absorption <= 3%) are illustrative synthetic demonstration assumptions, not laboratory-verified measurements. Real seller workflows require manufacturer technical specifications or laboratory compliance certificates to establish Chapter 69 Additional U.S. Note 5(a) criteria. Without explicit stoneware/non-porcelain evidence, generic glazed ceramic mugs return UNRESOLVED_AMBIGUITY.",
    plainLanguageExplanation:
      "Handmade ceramic mugs crafted from verified stoneware or earthenware clay fall under subheading 6912.00.44 specifically for mugs and steins. The Column 1 General MFN base rate is 10.0%. If the item were general ceramic tableware (e.g. bowls, plates) rather than a mug, it would fall under 6912.00.48 at 9.8%. If made of translucent porcelain or china, it would fall under subheading 6911.10.45 at 14.0%. Note that this base rate does not include potential Chapter 99 trade remedy duties or customs user fees. (Provenance Note: Material specifications are illustrative synthetic baseline assumptions, not laboratory measurements; real imports require manufacturer test documents).",
    clarifyingQuestions: [
      "Is the ceramic item specifically a single-handled mug or stein, or another tableware piece (bowl, plate, platter)?",
      "Is the clay body opaque stoneware/earthenware (10.0% under 6912.00.44.00), or translucent porcelain/china (14.0% under 6911.10.45.00) pursuant to Chapter 69 Additional U.S. Note 5(a)?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    provenanceNote:
      "ILLUSTRATIVE SYNTHETIC DEMONSTRATION ASSUMPTION: The material specifications for this profile (100% opaque stoneware clay, completely opaque body, and water absorption <= 3%) are illustrative synthetic demonstration baseline assumptions, NOT laboratory-verified physical measurements. In a live production export workflow, U.S. Customs and Border Protection requires the Importer of Record to exercise reasonable care under 19 U.S.C. § 1484. Satisfying the legal criteria of Chapter 69 Additional U.S. Note 5(a) requires documented manufacturer technical specifications, ceramic laboratory test reports, or exporter compliance certificates before definitively ruling out porcelain under Heading 6911.",
    mockAnalysis: {
      product_summary:
        "Hand-thrown artisanal ceramic drinkware made of verified opaque stoneware clay with interior food-safe glaze.",
      identified_attributes: [
        {
          attributeName: "Ceramic Type",
          value: "100% Opaque Stoneware Clay (verified non-porcelain)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Translucency",
          value: "Completely opaque (non-translucent, confirming Heading 6912 non-porcelain)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Form Factor",
          value: "Mug / cup with handle",
          source: "INFERRED_ANALYSIS",
        },
        {
          attributeName: "Capacity",
          value: "350 ml",
          source: "EXPLICIT_SELLER",
        },
      ],
      explicitly_provided: {
        clay: "100% Opaque Stoneware Clay (Non-Porcelain)",
        glaze: "Food-safe colored glaze",
      },
      inferred_attributes: {
        translucency: "Opaque (not porcelain or fine china)",
        statutory_note_check: "Complies with Chapter 69 Additional U.S. Note 5(a)",
      },
      unknown_attributes: ["FDA food contact substance compliance certification"],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-mug-1",
          question: "Is the ceramic opaque (stoneware/earthenware) or translucent (bone china/porcelain)?",
          context: "Porcelain mugs fall under subheading 6911.10.45.00 at 14.0%, whereas stoneware mugs fall under 6912.00.44.00 at 10.0%.",
          suggestedOptions: ["Opaque stoneware / clay", "Translucent porcelain / china"],
        },
      ],
      analysis_warnings: [
        "Food-contact ceramic imports require lead/cadmium leach compliance under FDA regulations.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-wooden-coasters",
    category: "Wood & Carvings",
    title: "Hand-Carved Sheesham Wood Coasters Set of 6",
    description:
      "Set of 6 circular drink coasters carved from sustainable Indian rosewood (Sheesham) with brass inlay floral motifs and matching wooden holder box.",
    declaredMaterials: "Solid Sheesham Wood (Dalbergia sissoo), Brass Inlay",
    intendedUse: "Drink coasters for table protection in residential homes.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 22.0,
    shippingCostUSD: 15.0,
    suggestedHS6: "4419.90",
    candidateHTS10: "4419.90.91.00",
    htsDescription: "Tableware and kitchenware, of wood: Other: Other",
    generalDutyRate: 3.2,
    specialRateText: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    unitOfQuantity: "kg",
    wcoGriRationale:
      "Classified pursuant to GRI 1, GRI 3(b), and GRI 6 under Heading 4419 (tableware and kitchenware of wood). CBP rulings NY N095158 (March 23, 2010), NY N240071 (April 10, 2013), and NY R04475 (August 24, 2006) establish that beverage coasters are tableware under Heading 4419 rather than residual basket 4421. Under GRI 3(b), the solid wood body imparts essential character over minor decorative brass inlays. However, the legal determination between subheading 4419.20 ('Of tropical wood') and 4419.90 ('Other') is UNRESOLVED: Chapter 44 Subheading Note 1's enumerated species list does not govern Heading 4419 by its explicit statutory terms, and CBP has not issued a binding classification ruling determining whether Dalbergia sissoo (Sheesham) is treated as 'tropical wood' under ordinary commercial/botanical meaning. Both candidate lines carry a 3.2% Column 1 General rate (kg). Final determination rests with the U.S. Importer of Record under 19 U.S.C. § 1484.",
    plainLanguageExplanation:
      "Wooden drink coasters are legally classified as tableware under Heading 4419 (CBP precedents NY N095158, NY N240071, NY R04475), rather than general wood articles under Heading 4421. Both competing candidate lines—4419.20.90.00 ('Of tropical wood') and 4419.90.91.00 ('Other wood')—carry an identical 3.2% Column 1 General base rate and quantity unit (kg). However, because Chapter 44 Subheading Note 1 does not govern Heading 4419, and CBP has not published a binding ruling on Dalbergia sissoo (Sheesham), the tropical wood determination is legally unresolved. Note: Lacey Act species declaration (PPQ 505) is an independent environmental import requirement and does not determine the tariff subheading.",
    clarifyingQuestions: [
      "Does the exporter or importer have documentation supporting whether Dalbergia sissoo is declared as tropical wood (4419.20.90.00) or other wood (4419.90.91.00) under 19 U.S.C. § 1484?",
      "Is the wood natural solid timber or engineered/composite fiberboard?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    provenanceNote:
      "ILLUSTRATIVE SYNTHETIC DEMONSTRATION ASSUMPTION: The timber species identification (Sheesham / Dalbergia sissoo) and construction details are illustrative synthetic demonstration baseline assumptions. Under 19 U.S.C. § 1484, the legal classification of Dalbergia sissoo between 4419.20.90.00 (tropical wood) and 4419.90.91.00 (other wood) is unresolved and must be determined by the Importer of Record or via a binding ruling under 19 C.F.R. Part 177. USDA APHIS Lacey Act declaration (PPQ 505) requires declaring scientific genus, species, and country of harvest independently of the tariff classification.",
    mockAnalysis: {
      product_summary:
        "Hand-carved wooden coaster set of 6 crafted from solid Sheesham timber featuring brass floral inlay and holder.",
      identified_attributes: [
        {
          attributeName: "Wood Species",
          value: "Sheesham / Indian Rosewood (Dalbergia sissoo)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Decorative Element",
          value: "Brass inlay floral design",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Set Count",
          value: "6 coasters + 1 holder",
          source: "EXPLICIT_SELLER",
        },
      ],
      explicitly_provided: {
        material: "Solid timber and brass wire",
      },
      inferred_attributes: {
        essential_character: "Wood imparts essential character under GRI 3(b)",
      },
      unknown_attributes: [
        "Statutory tropical wood determination under 4419.20 vs 4419.90 (unresolved under Chapter 44 notes)",
        "USDA APHIS Lacey Act declaration readiness and CITES timber certification status (independent non-tariff requirement)",
      ],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-wood-1",
          question: "Is the wood solid natural timber or an engineered/MDF composite?",
          context: "Engineered wood products may carry different resin and formaldehyde requirements.",
          suggestedOptions: ["Solid natural timber (Sheesham)", "Engineered MDF/Plywood"],
        },
      ],
      analysis_warnings: [
        "Wood articles imported to the US require Lacey Act declaration (PPQ 505) stating scientific genus/species as an independent environmental requirement.",
        "The legal basis for distinguishing 4419.20 (tropical wood) from 4419.90 (other wood) is unresolved for Dalbergia sissoo because Subheading Note 1 does not govern Heading 4419.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-leather-wallet",
    category: "Leather Goods",
    title: "Handmade Vegetable-Tanned Leather Bi-fold Wallet",
    description:
      "Slim men's bi-fold pocket wallet made from genuine full-grain vegetable-tanned buffalo leather with hand-waxed linen thread stitching, 6 card slots, and currency compartment.",
    declaredMaterials: "Full-Grain Bovine/Buffalo Leather, Waxed Thread",
    intendedUse: "Pocket wallet for carrying currency and identification cards.",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 32.0,
    shippingCostUSD: 12.0,
    suggestedHS6: "4202.31",
    candidateHTS10: "4202.31.60.00",
    htsDescription:
      "Articles of a kind normally carried in the pocket or in the handbag: With outer surface of leather or of composition leather: Other",
    generalDutyRate: 8.0,
    specialRateText: "Free (AU, BH, CL, CO, IL, JO, KR, MA, OM, P, PA, PE, S, SG)",
    unitOfQuantity: "No.",
    wcoGriRationale:
      "Classified by application of GRI 1 and GRI 6. Heading 4202 covers pocket articles (wallets, purses). Subheading 4202.31 covers articles normally carried in the pocket with outer surface of leather. Subheading 4202.31.60 covers wallets not of reptile leather.",
    plainLanguageExplanation:
      "Pocket wallets made with a leather outer surface fall under Chapter 42. Vegetable-tanned buffalo leather wallets carry a standard Column 1 General duty rate of 8.0%.",
    clarifyingQuestions: [
      "Is the exterior 100% genuine leather or synthetic PU/faux leather?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    mockAnalysis: {
      product_summary:
        "Full-grain buffalo leather bi-fold pocket wallet featuring hand-stitched linen thread and 6 card slots.",
      identified_attributes: [
        {
          attributeName: "Outer Surface Material",
          value: "Full-grain genuine bovine/buffalo leather",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Tanning Process",
          value: "Vegetable tanned",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Type",
          value: "Pocket article / bi-fold wallet",
          source: "EXPLICIT_SELLER",
        },
      ],
      explicitly_provided: {
        leather_type: "Full-grain vegetable-tanned buffalo leather",
        thread: "Hand-waxed linen",
      },
      inferred_attributes: {
        animal_species: "Bovine / buffalo (non-reptile)",
      },
      unknown_attributes: ["Presence of RFID-blocking metallic mesh foil inside lining"],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-wallet-1",
          question: "Is the wallet 100% genuine animal leather, or does it incorporate synthetic faux leather?",
          context: "Wallets with outer surface of plastic sheeting fall under a different subheading.",
          suggestedOptions: ["100% genuine full-grain leather", "Composite or PU faux leather"],
        },
      ],
      analysis_warnings: [
        "Country of origin marking ('Made in India') must be legibly stamped or sewn on the finished article.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
  {
    id: "prod-darjeeling-tea",
    category: "Food & Agri Exports",
    title: "Single-Estate Darjeeling First Flush Whole Leaf Black Tea (100g)",
    description:
      "Single-origin premium loose whole-leaf Darjeeling black tea, non-organic conventional harvest, packaged in an airtight sealed tin can for retail sale.",
    declaredMaterials: "100% Camellia sinensis (Black Tea Leaves), Tinplate Canister",
    intendedUse: "Beverage consumption (brewing hot black tea).",
    originCountry: "IN",
    destinationCountry: "US",
    itemPriceUSD: 16.5,
    shippingCostUSD: 12.0,
    suggestedHS6: "0902.30",
    candidateHTS10: "0902.30.00.90",
    htsDescription:
      "Tea, whether or not flavored: Black tea (fermented) and partly fermented tea, in immediate packings of a content not exceeding 3 kg: Other",
    generalDutyRate: 0.0,
    specialRateText: "Free",
    unitOfQuantity: "kg",
    wcoGriRationale:
      "Classified pursuant to GRI 1 and GRI 6. Chapter 09 covers coffee, tea, mate and spices. Subheading 0902.30 covers black tea in retail packaging of not more than 3 kg. Statistical reporting suffix 0902.30.00.90 isolates loose-leaf black tea not packed in individual tea bags.",
    plainLanguageExplanation:
      "Loose-leaf black tea in retail containers not exceeding 3 kg enters the United States duty-free (0.0%) under HTS line 0902.30.00.90 (inheriting the Free rate from parent subheading 0902.30.00). If the tea were packaged in tea bags, statistical line 0902.30.00.15 (organic) or 0902.30.00.50 (other) would apply. FDA prior notice and bioterrorism registration apply upon import.",
    clarifyingQuestions: [
      "Is the tea loose-leaf or packaged in individual tea bags?",
      "If in tea bags, is it certified organic by a USDA-accredited certifier?",
    ],
    tariffRevision: "USITC 2026 HTS Rev 22 (Oct 30, 2026)",
    mockAnalysis: {
      product_summary:
        "Retail-packaged loose whole-leaf Darjeeling black tea in airtight tin canister (100g net weight).",
      identified_attributes: [
        {
          attributeName: "Botanical Species",
          value: "Camellia sinensis (pure fermented black tea)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Packaging Type",
          value: "Immediate tinplate packing under 3 kg (100g loose leaf)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Tea Format",
          value: "Loose-leaf whole tea (not in tea bags, statistical suffix .90)",
          source: "EXPLICIT_SELLER",
        },
        {
          attributeName: "Flavors / Additives",
          value: "None (pure unflavored tea)",
          source: "EXPLICIT_SELLER",
        },
      ],
      explicitly_provided: {
        product: "Conventional Darjeeling first-flush loose-leaf tea",
        pack_size: "100g airtight tin",
      },
      inferred_attributes: {
        fermentation_state: "Fermented black tea",
        retail_ready: "Immediate packings not exceeding 3 kg",
      },
      unknown_attributes: [
        "FDA Facility Registration Number and Prior Notice Confirmation Number",
      ],
      confidence: "HIGH",
      clarifying_questions: [
        {
          id: "q-tea-1",
          question: "Is the tea 100% pure black tea, or are there flavorings, herbs, or flowers added?",
          context: "Flavored teas may require separate botanical disclosure and different HTS suffixes.",
          suggestedOptions: ["100% pure black tea without additives", "Flavored / blended with herbs"],
        },
      ],
      analysis_warnings: [
        "Food products imported into the US require FDA Prior Notice filing prior to cargo arrival.",
      ],
      is_demo_mode: true,
      model_used: "demo-grounded-analyzer",
      analyzed_at: new Date().toISOString(),
    },
  },
];
