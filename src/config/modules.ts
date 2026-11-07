import type { ArchitecturalModule, WorkflowStep } from "../types/export.ts";

/**
 * The 5-step user workflow overview displayed on the landing page and dashboard.
 */
export const WORKFLOW_OVERVIEW_STEPS: WorkflowStep[] = [
  {
    stepNumber: 1,
    title: "Describe your product",
    description:
      "Enter basic product details, materials, and selling price. No customs jargon required.",
    iconName: "FileText",
  },
  {
    stepNumber: 2,
    title: "AI attribute extraction",
    description:
      "Cloud Google Gemini multimodal intelligence extracts physical materials and intended use with seller review.",
    iconName: "Sparkles",
  },
  {
    stepNumber: 3,
    title: "Customs grounding",
    description:
      "Retrieve candidate HTS codes grounded in USITC 2026 Revision 22, WCO GRI logic, and official CBP rulings.",
    iconName: "ShieldCheck",
  },
  {
    stepNumber: 4,
    title: "Landed cost math",
    description:
      "Transparent 19 U.S.C. § 1401a transaction valuation calculating duty, Section 301, and MPF without hidden charges.",
    iconName: "Calculator",
  },
  {
    stepNumber: 5,
    title: "Invoice & checkout",
    description:
      "Generate an export commercial invoice, download PDF 1.4, and collect receivables via PayPal Sandbox.",
    iconName: "Receipt",
  },
];

/**
 * Architectural Modules of BorderBrief AI.
 * Documents genuine capabilities implemented and verified across Sprints 1–6.
 */
export const ARCHITECTURAL_MODULES: ArchitecturalModule[] = [
  {
    key: "stage-1-product-info",
    stageNumber: 1,
    title: "Product Information Ingestion",
    shortDescription: "Structured product metadata input and image ingestion boundary.",
    technicalRole: "Client form validation, image file handling, EXIF stripping interface via Sharp.",
    sprintPhase: "Sprint 1 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Eliminates complex forms with simple, guided artisan inputs and 7 Indian seed profiles.",
  },
  {
    key: "stage-2-ai-understanding",
    stageNumber: 2,
    title: "AI Product Understanding",
    shortDescription: "Cloud multimodal extraction of physical materials and construction.",
    technicalRole: "Google AI Studio Developer API (gemini-3.8-flash) with structured schema & consent guardrails.",
    sprintPhase: "Sprint 2 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Interprets plain-language descriptions without requiring trade vocabulary; ₹0 demo fallback.",
  },
  {
    key: "stage-3-hs-assistance",
    stageNumber: 3,
    title: "Explainable HS Code Assistance",
    shortDescription: "Candidate HTS code recommendation grounded in official WCO GRI logic.",
    technicalRole: "Hierarchical matching with human-in-the-loop confirmation safeguards and CITES blocker.",
    sprintPhase: "Sprint 3 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Provides transparent reasoning and asks clarifying questions when ambiguous.",
  },
  {
    key: "stage-4-customs-tariff",
    stageNumber: 4,
    title: "Customs & Tariff Intelligence",
    shortDescription: "USITC 2026 HTS Revision 22 lookup, Chapter 99 provisions, and revision stamping.",
    technicalRole: "Authoritative store with genuine CBP rulings, Section 301 duties, and GSP ineligibility.",
    sprintPhase: "Sprint 3 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Protects sellers from outdated rates and applies official Column 1 MFN duties.",
  },
  {
    key: "stage-5-landed-cost",
    stageNumber: 5,
    title: "Deterministic Landed Cost Estimator",
    shortDescription: "Mathematical calculation of product value, duty, MPF, and postal fees.",
    technicalRole: "Pure TypeScript engine adhering to 19 U.S.C. § 1401a transaction value principles.",
    sprintPhase: "Sprint 4 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Calculates duties, taxes, and fees based on active rules; updated to Jan 20, 2027 postal compliance.",
  },
  {
    key: "stage-6-invoice-generator",
    stageNumber: 6,
    title: "Export Commercial Invoice Draft",
    shortDescription: "In-memory binary PDF 1.4 generation of export commercial invoice drafts.",
    technicalRole: "Pure zero-dependency binary PDF 1.4 stream generator with Indian GST LUT declaration.",
    sprintPhase: "Sprint 5 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Prepares export-ready documentation meeting CBIC standards, Incoterms DAP, and draft watermarks.",
  },
  {
    key: "stage-7-paypal-checkout",
    stageNumber: 7,
    title: "PayPal Sandbox Checkout",
    shortDescription: "Cross-border USD payment collection through PayPal Orders API v2.",
    technicalRole: "Server-side order creation, Smart Buttons, capture verification, and cryptographic webhooks.",
    sprintPhase: "Sprint 6 (Completed)",
    status: "COMPLETED",
    primaryBenefit: "Enables US buyers to pay securely in USD Sandbox with server-side minor-unit reconciliation.",
  },
];

