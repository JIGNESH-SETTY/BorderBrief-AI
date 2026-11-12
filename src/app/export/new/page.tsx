"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Stepper, StepItem } from "@/components/ui/stepper";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIMARY_CORRIDOR } from "@/config/corridor";
import { SEED_EXPORT_PROFILES, SeedProductProfile } from "@/data/seed-products";
import {
  ProductAnalysisResult,
  SellerConfirmedProductReview,
  ClassificationResult,
  ClassificationCandidate,
  LandedCostCalculationResult,
  TransportationMode,
  PostalServiceType,
  VoluntaryPostalCompliance,
  CarrierPostalProcedure,
  CustomsEntryType,
  LandedCostStatus,
  CommercialInvoiceDraft,
  CreateInvoiceRequest,
  IncotermRule,
  InvoiceLineItem,
} from "@/types/export";
import { CommercialInvoicePreview } from "@/components/invoice/commercial-invoice-preview";
import { PayPalSandboxCheckout } from "@/components/payment/paypal-sandbox-checkout";
import { buildCommercialInvoice, generateDraftInvoiceNumber } from "@/lib/invoice/invoice-engine";
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  Edit3,
  BookOpen,
  Scale,
  ExternalLink,
  Lock,
  Layers,
  Check,
  Calculator,
  DollarSign,
  Truck,
  Ship,
  Plane,
  Receipt,
  AlertCircle,
  Download,
  Printer,
  Building,
  User,
  RotateCcw,
  Trash2,
} from "lucide-react";

export default function NewExportPage() {
  // Form State
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [declaredMaterials, setDeclaredMaterials] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [originCountry] = useState("IN");
  const [destinationCountry] = useState("US");
  const [itemPrice, setItemPrice] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Cloud AI Privacy & Consent State
  const [consentGiven, setConsentGiven] = useState(true);
  const [forceDemoMode, setForceDemoMode] = useState(false);

  // Flow State
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ProductAnalysisResult | null>(null);

  // Seller Clarification & Confirmation State (Step 2)
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [editableMaterials, setEditableMaterials] = useState("");
  const [editableUse, setEditableUse] = useState("");
  const [confirmedReview, setConfirmedReview] = useState<SellerConfirmedProductReview | null>(null);

  // Classification State (Step 3)
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);
  const [selectedCandidateHts, setSelectedCandidateHts] = useState<string | null>(null);
  const [isClassificationConfirmed, setIsClassificationConfirmed] = useState(false);
  const [tariffClarificationAnswers, setTariffClarificationAnswers] = useState<Record<string, string>>({});

  // Landed Cost State (Step 4)
  const [quantity, setQuantity] = useState<number>(1);
  const [transportationMode, setTransportationMode] = useState<TransportationMode>("AIR_CARGO");
  const [postalServiceType, setPostalServiceType] = useState<PostalServiceType>("ORDINARY_MAIL");
  const [voluntaryPostalCompliance, setVoluntaryPostalCompliance] = useState<VoluntaryPostalCompliance>("NONE");
  const [carrierPostalProcedure, setCarrierPostalProcedure] = useState<CarrierPostalProcedure>("CONFIRMED_INFORMAL");
  const [isPostalProcedureConfirmed, setIsPostalProcedureConfirmed] = useState<boolean>(true);
  const [entryType13HasRight, setEntryType13HasRight] = useState<boolean>(false);
  const [entryType13IsParticipant, setEntryType13IsParticipant] = useState<boolean>(true);
  const [entryType13HasAce, setEntryType13HasAce] = useState<boolean>(false);
  const [entryType13HasReqData, setEntryType13HasReqData] = useState<boolean>(false);
  const [entryType13HasChapter99Data, setEntryType13HasChapter99Data] = useState<boolean>(true);
  const [entryType13IsPgaComplete, setEntryType13IsPgaComplete] = useState<boolean>(false);
  const [entryType13IsPgaTempActive, setEntryType13IsPgaTempActive] = useState<boolean>(true);
  const [importDate, setImportDate] = useState<string>("");
  const [isShippingDocumented, setIsShippingDocumented] = useState<boolean>(true);
  const [isQualifyingEccfOrHub, setIsQualifyingEccfOrHub] = useState<boolean>(false);
  const [packingCostUSD, setPackingCostUSD] = useState<string>("");
  const [assistsCostUSD, setAssistsCostUSD] = useState<string>("");
  const [isCalculatingLandedCost, setIsCalculatingLandedCost] = useState<boolean>(false);
  const [landedCostResult, setLandedCostResult] = useState<LandedCostCalculationResult | null>(null);
  const [landedCostError, setLandedCostError] = useState<string | null>(null);
  const [landedCostErrorCode, setLandedCostErrorCode] = useState<string | null>(null);

  // Commercial Invoice State (Step 5)
  const [sellerBusinessName, setSellerBusinessName] = useState("Vardhan Handcrafted Exports");
  const [sellerAddress, setSellerAddress] = useState("Plot 42, Sitapura Industrial Area, Tonk Road");
  const [sellerCity, setSellerCity] = useState("Jaipur");
  const [sellerState, setSellerState] = useState("Rajasthan");
  const [sellerPostalCode, setSellerPostalCode] = useState("302022");
  const [sellerCountry, setSellerCountry] = useState("India");
  const [sellerEmail, setSellerEmail] = useState("exports@vardhancrafts.example.in");
  const [sellerPhone, setSellerPhone] = useState("+91 141 277 0192");
  const [sellerIec, setSellerIec] = useState("");
  const [sellerGstin, setSellerGstin] = useState("");
  const [sellerLutArn, setSellerLutArn] = useState("");

  const [buyerName, setBuyerName] = useState("Manhattan Heritage Goods LLC");
  const [buyerAddress, setBuyerAddress] = useState("350 Fifth Avenue, Suite 4800");
  const [buyerCity, setBuyerCity] = useState("New York");
  const [buyerState, setBuyerState] = useState("NY");
  const [buyerPostalCode, setBuyerPostalCode] = useState("10118");
  const [buyerCountry, setBuyerCountry] = useState("United States");
  const [buyerEmail, setBuyerEmail] = useState("procurement@manhattanheritage.example.com");
  const [buyerPhone, setBuyerPhone] = useState("+1 (212) 555-0144");
  const [buyerIsIor, setBuyerIsIor] = useState(true);

  const [invoiceIncoterm, setInvoiceIncoterm] = useState<IncotermRule>("DAP");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isInsuranceCharged, setIsInsuranceCharged] = useState(false);
  const [invoiceInsuranceUSD, setInvoiceInsuranceUSD] = useState("0");
  const [invoiceDeclarationConfirmed, setInvoiceDeclarationConfirmed] = useState(true);
  const [invoiceSignatoryName, setInvoiceSignatoryName] = useState("K. Y. Vardhan");
  const [invoiceSignatoryTitle, setInvoiceSignatoryTitle] = useState("Managing Partner / Exporter");

  const [invoiceDraft, setInvoiceDraft] = useState<CommercialInvoiceDraft | null>(null);
  const [invoiceViewTab, setInvoiceViewTab] = useState<"preview" | "edit">("preview");
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [saveInvoiceSuccess, setSaveInvoiceSuccess] = useState<string | null>(null);
  const [saveInvoiceError, setSaveInvoiceError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-Progress Draft Recovery State (Sprint 7 Task 3)
  const DRAFT_STORAGE_KEY = "borderbrief_export_draft_v1";
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const isHydratedRef = useRef(false);

  // 1. Safe in-progress form recovery on mount across browser reloads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 1 && parsed.data) {
            const d = parsed.data;
            const hasContent = Boolean(
              d.productTitle ||
              d.productDescription ||
              (d.activeStep && d.activeStep > 1)
            );
            if (hasContent) {
              if (typeof d.productTitle === "string") setProductTitle(d.productTitle);
              if (typeof d.productDescription === "string") setProductDescription(d.productDescription);
              if (typeof d.declaredMaterials === "string") setDeclaredMaterials(d.declaredMaterials);
              if (typeof d.intendedUse === "string") setIntendedUse(d.intendedUse);
              if (typeof d.itemPrice === "string") setItemPrice(d.itemPrice);
              if (typeof d.shippingCost === "string") setShippingCost(d.shippingCost);
              if (d.activeStep && [1, 2, 3, 4, 5].includes(d.activeStep)) setActiveStep(d.activeStep);
              if (d.analysisResult) setAnalysisResult(d.analysisResult);
              if (d.clarificationAnswers) setClarificationAnswers(d.clarificationAnswers);
              if (typeof d.editableMaterials === "string") setEditableMaterials(d.editableMaterials);
              if (typeof d.editableUse === "string") setEditableUse(d.editableUse);
              if (d.confirmedReview) setConfirmedReview(d.confirmedReview);
              if (d.classificationResult) setClassificationResult(d.classificationResult);
              if (typeof d.selectedCandidateHts === "string") setSelectedCandidateHts(d.selectedCandidateHts);
              if (typeof d.isClassificationConfirmed === "boolean") setIsClassificationConfirmed(d.isClassificationConfirmed);
              if (d.tariffClarificationAnswers) setTariffClarificationAnswers(d.tariffClarificationAnswers);
              if (typeof d.quantity === "number") setQuantity(d.quantity);
              if (d.transportationMode) setTransportationMode(d.transportationMode);
              if (d.postalServiceType) setPostalServiceType(d.postalServiceType);
              if (d.voluntaryPostalCompliance) setVoluntaryPostalCompliance(d.voluntaryPostalCompliance);
              if (d.carrierPostalProcedure) setCarrierPostalProcedure(d.carrierPostalProcedure);
              if (typeof d.isPostalProcedureConfirmed === "boolean") setIsPostalProcedureConfirmed(d.isPostalProcedureConfirmed);
              if (typeof d.importDate === "string") setImportDate(d.importDate);
              if (typeof d.packingCostUSD === "string") setPackingCostUSD(d.packingCostUSD);
              if (typeof d.assistsCostUSD === "string") setAssistsCostUSD(d.assistsCostUSD);
              if (d.landedCostResult) setLandedCostResult(d.landedCostResult);
              if (typeof d.sellerBusinessName === "string") setSellerBusinessName(d.sellerBusinessName);
              if (typeof d.sellerAddress === "string") setSellerAddress(d.sellerAddress);
              if (typeof d.sellerCity === "string") setSellerCity(d.sellerCity);
              if (typeof d.sellerState === "string") setSellerState(d.sellerState);
              if (typeof d.sellerPostalCode === "string") setSellerPostalCode(d.sellerPostalCode);
              if (typeof d.sellerCountry === "string") setSellerCountry(d.sellerCountry);
              if (typeof d.sellerEmail === "string") setSellerEmail(d.sellerEmail);
              if (typeof d.sellerPhone === "string") setSellerPhone(d.sellerPhone);
              if (typeof d.sellerIec === "string") setSellerIec(d.sellerIec);
              if (typeof d.sellerGstin === "string") setSellerGstin(d.sellerGstin);
              if (typeof d.sellerLutArn === "string") setSellerLutArn(d.sellerLutArn);
              if (typeof d.buyerName === "string") setBuyerName(d.buyerName);
              if (typeof d.buyerAddress === "string") setBuyerAddress(d.buyerAddress);
              if (typeof d.buyerCity === "string") setBuyerCity(d.buyerCity);
              if (typeof d.buyerState === "string") setBuyerState(d.buyerState);
              if (typeof d.buyerPostalCode === "string") setBuyerPostalCode(d.buyerPostalCode);
              if (typeof d.buyerCountry === "string") setBuyerCountry(d.buyerCountry);
              if (typeof d.buyerEmail === "string") setBuyerEmail(d.buyerEmail);
              if (typeof d.buyerPhone === "string") setBuyerPhone(d.buyerPhone);
              if (typeof d.buyerIsIor === "boolean") setBuyerIsIor(d.buyerIsIor);
              if (d.invoiceIncoterm) setInvoiceIncoterm(d.invoiceIncoterm);
              if (typeof d.invoiceDate === "string") setInvoiceDate(d.invoiceDate);
              if (typeof d.invoiceNumber === "string") setInvoiceNumber(d.invoiceNumber);
              if (typeof d.isInsuranceCharged === "boolean") setIsInsuranceCharged(d.isInsuranceCharged);
              if (typeof d.invoiceInsuranceUSD === "string") setInvoiceInsuranceUSD(d.invoiceInsuranceUSD);
              if (typeof d.invoiceSignatoryName === "string") setInvoiceSignatoryName(d.invoiceSignatoryName);
              if (typeof d.invoiceSignatoryTitle === "string") setInvoiceSignatoryTitle(d.invoiceSignatoryTitle);
              if (d.invoiceDraft) setInvoiceDraft(d.invoiceDraft);
              if (typeof d.savedInvoiceId === "string") setSavedInvoiceId(d.savedInvoiceId);
              setIsDraftRestored(true);
            }
          }
        }
      } catch (err) {
        console.warn("Could not restore draft from sessionStorage:", err);
      } finally {
        isHydratedRef.current = true;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // 2. Persist draft changes to sessionStorage (strictly excludes tokens/credentials)
  useEffect(() => {
    if (!isHydratedRef.current || typeof window === "undefined") return;
    if (!productTitle && !productDescription && activeStep === 1) return;

    try {
      const draftData = {
        version: 1,
        savedAt: new Date().toISOString(),
        data: {
          productTitle,
          productDescription,
          declaredMaterials,
          intendedUse,
          itemPrice,
          shippingCost,
          activeStep,
          analysisResult,
          clarificationAnswers,
          editableMaterials,
          editableUse,
          confirmedReview,
          classificationResult,
          selectedCandidateHts,
          isClassificationConfirmed,
          tariffClarificationAnswers,
          quantity,
          transportationMode,
          postalServiceType,
          voluntaryPostalCompliance,
          carrierPostalProcedure,
          isPostalProcedureConfirmed,
          importDate,
          packingCostUSD,
          assistsCostUSD,
          landedCostResult,
          sellerBusinessName,
          sellerAddress,
          sellerCity,
          sellerState,
          sellerPostalCode,
          sellerCountry,
          sellerEmail,
          sellerPhone,
          sellerIec,
          sellerGstin,
          sellerLutArn,
          buyerName,
          buyerAddress,
          buyerCity,
          buyerState,
          buyerPostalCode,
          buyerCountry,
          buyerEmail,
          buyerPhone,
          buyerIsIor,
          invoiceIncoterm,
          invoiceDate,
          invoiceNumber,
          isInsuranceCharged,
          invoiceInsuranceUSD,
          invoiceSignatoryName,
          invoiceSignatoryTitle,
          invoiceDraft,
          savedInvoiceId,
        },
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch {
      // Ignore quota or private-browsing errors
    }
  }, [
    productTitle,
    productDescription,
    declaredMaterials,
    intendedUse,
    itemPrice,
    shippingCost,
    activeStep,
    analysisResult,
    clarificationAnswers,
    editableMaterials,
    editableUse,
    confirmedReview,
    classificationResult,
    selectedCandidateHts,
    isClassificationConfirmed,
    tariffClarificationAnswers,
    quantity,
    transportationMode,
    postalServiceType,
    voluntaryPostalCompliance,
    carrierPostalProcedure,
    isPostalProcedureConfirmed,
    importDate,
    packingCostUSD,
    assistsCostUSD,
    landedCostResult,
    sellerBusinessName,
    sellerAddress,
    sellerCity,
    sellerState,
    sellerPostalCode,
    sellerCountry,
    sellerEmail,
    sellerPhone,
    sellerIec,
    sellerGstin,
    sellerLutArn,
    buyerName,
    buyerAddress,
    buyerCity,
    buyerState,
    buyerPostalCode,
    buyerCountry,
    buyerEmail,
    buyerPhone,
    buyerIsIor,
    invoiceIncoterm,
    invoiceDate,
    invoiceNumber,
    isInsuranceCharged,
    invoiceInsuranceUSD,
    invoiceSignatoryName,
    invoiceSignatoryTitle,
    invoiceDraft,
    savedInvoiceId,
  ]);

  // 3. Reset form and clear session storage
  const handleResetForm = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setIsDraftRestored(false);
    setProductTitle("");
    setProductDescription("");
    setDeclaredMaterials("");
    setIntendedUse("");
    setItemPrice("");
    setShippingCost("");
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setActiveStep(1);
    setIsAnalyzing(false);
    setValidationError(null);
    setAnalysisResult(null);
    setClarificationAnswers({});
    setEditableMaterials("");
    setEditableUse("");
    setConfirmedReview(null);
    setIsClassifying(false);
    setClassificationError(null);
    setClassificationResult(null);
    setSelectedCandidateHts(null);
    setIsClassificationConfirmed(false);
    setTariffClarificationAnswers({});
    setQuantity(1);
    setTransportationMode("AIR_CARGO");
    setPostalServiceType("ORDINARY_MAIL");
    setVoluntaryPostalCompliance("NONE");
    setCarrierPostalProcedure("CONFIRMED_INFORMAL");
    setIsPostalProcedureConfirmed(true);
    setImportDate("");
    setPackingCostUSD("");
    setAssistsCostUSD("");
    setIsCalculatingLandedCost(false);
    setLandedCostResult(null);
    setLandedCostError(null);
    setLandedCostErrorCode(null);
    setInvoiceDraft(null);
    setInvoiceViewTab("preview");
    setIsSavingInvoice(false);
    setSavedInvoiceId(null);
    setSaveInvoiceSuccess(null);
    setSaveInvoiceError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const steps: StepItem[] = [
    {
      number: 1,
      title: "Product Details",
      status: activeStep === 1 ? "current" : "completed",
    },
    {
      number: 2,
      title: "AI Product Analysis",
      status: activeStep === 2 ? "current" : activeStep > 2 ? "completed" : "upcoming",
    },
    {
      number: 3,
      title: "Customs Grounding",
      status: activeStep === 3 ? "current" : activeStep > 3 ? "completed" : "upcoming",
    },
    {
      number: 4,
      title: "Landed Cost",
      status: activeStep === 4 ? "current" : activeStep > 4 ? "completed" : "upcoming",
    },
    {
      number: 5,
      title: "Export Documents",
      status: activeStep === 5 ? "current" : "upcoming",
    },
  ];

  // Builds or updates an invoice draft from current form values
  const constructDraftInvoice = (overrideInvoiceNumber?: string): CommercialInvoiceDraft => {
    const invNum = overrideInvoiceNumber || invoiceNumber || generateDraftInvoiceNumber(invoiceDate);
    if (!invoiceNumber) {
      setInvoiceNumber(invNum);
    }

    const htsCode = landedCostResult?.dutyBreakdown?.hts10 || selectedCandidateHts || undefined;
    const itemQty = Math.max(1, Number(quantity) || 1);
    const unitPrice = parseFloat(itemPrice) > 0 ? parseFloat(itemPrice) : 25;
    const shipping = parseFloat(shippingCost) >= 0 ? parseFloat(shippingCost) : 15;
    // Under DAP, insurance is strictly optional and only charged when agreed with buyer
    const isInsCharged = isInsuranceCharged && parseFloat(invoiceInsuranceUSD) > 0;
    const insurance = isInsCharged ? parseFloat(invoiceInsuranceUSD) : 0;

    let classStatus: "CLASSIFIED" | "ALTERNATIVE_CANDIDATES" | "UNRESOLVED_AMBIGUITY" = "CLASSIFIED";
    if (landedCostResult) {
      if (landedCostResult.status === "BLOCKED") {
        classStatus = "UNRESOLVED_AMBIGUITY";
      } else if (landedCostResult.status === "PARTIALLY_VERIFIED") {
        classStatus = "ALTERNATIVE_CANDIDATES";
      }
    }

    return buildCommercialInvoice({
      seller: {
        businessName: sellerBusinessName,
        address: sellerAddress,
        city: sellerCity,
        state: sellerState,
        postalCode: sellerPostalCode,
        country: sellerCountry,
        email: sellerEmail,
        phone: sellerPhone,
        iecNumber: sellerIec.trim() || undefined,
        gstin: sellerGstin.trim() || undefined,
        lutArn: sellerLutArn.trim() || undefined,
      },
      buyer: {
        name: buyerName,
        address: buyerAddress,
        city: buyerCity,
        state: buyerState,
        postalCode: buyerPostalCode,
        country: buyerCountry,
        email: buyerEmail,
        phone: buyerPhone,
        isImporterOfRecord: buyerIsIor,
      },
      shipment: {
        invoiceNumber: invNum,
        invoiceDate: invoiceDate,
        countryOfExport: "India",
        countryOfDestination: "United States",
        transportationMode: transportationMode,
        incoterm: invoiceIncoterm,
        currency: "USD",
        shippingCostUSD: shipping,
        isInsuranceIncluded: isInsCharged,
        insuranceCostUSD: insurance,
      },
      items: [
        {
          id: "item_1",
          description: productTitle.trim() || "Handcrafted Export Merchandise",
          materialComposition: declaredMaterials.trim() || undefined,
          quantity: itemQty,
          unitOfMeasure: "pcs",
          unitPriceUSD: unitPrice,
          countryOfOrigin: "India",
          hts10: htsCode,
          classificationStatus: classStatus,
        },
      ],
      declaration: {
        statement:
          "We declare that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that the goods are of Indian origin.",
        isConfirmedBySeller: invoiceDeclarationConfirmed,
        signatoryName: invoiceSignatoryName,
        signatoryTitle: invoiceSignatoryTitle,
        signatureDate: invoiceDate,
      },
      landedCostResult: landedCostResult || undefined,
      calculationId: landedCostResult?.calculationId || undefined,
    });
  };

  const handleProceedToInvoice = () => {
    try {
      const draft = constructDraftInvoice();
      setInvoiceDraft(draft);
      setActiveStep(5);
    } catch (err: unknown) {
      console.error("Failed to construct draft commercial invoice:", err);
      const msg = err instanceof Error ? err.message : "Failed to generate commercial invoice draft.";
      setLandedCostError(msg);
    }
  };

  const handleUpdateInvoiceDraft = () => {
    try {
      const draft = constructDraftInvoice();
      setInvoiceDraft(draft);
      setSaveInvoiceSuccess(null);
      setSaveInvoiceError(null);
    } catch (err: unknown) {
      console.error("Failed to update commercial invoice draft:", err);
      const msg = err instanceof Error ? err.message : "Failed to update commercial invoice draft.";
      setSaveInvoiceError(msg);
    }
  };

  const handleSaveInvoiceToDatabase = async () => {
    const currentDraft = constructDraftInvoice();
    setInvoiceDraft(currentDraft);
    setIsSavingInvoice(true);
    setSaveInvoiceError(null);
    setSaveInvoiceSuccess(null);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller: currentDraft.seller,
          buyer: currentDraft.buyer,
          shipment: currentDraft.shipment,
          items: currentDraft.items,
          declaration: currentDraft.declaration,
          landedCostResult: currentDraft.estimatedImportCosts ? landedCostResult : undefined,
          calculationId: currentDraft.calculationId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save draft invoice to database.");
      }

      setSavedInvoiceId(data.id);
      setSaveInvoiceSuccess(`Invoice draft saved successfully in database as ${data.invoiceNumber}`);
      setInvoiceDraft(data);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving invoice to database";
      setSaveInvoiceError(msg);
    } finally {
      setIsSavingInvoice(false);
    }
  };

  // Quick-fill sample handler
  const handleSelectSeedProfile = (profile: SeedProductProfile) => {
    setProductTitle(profile.title);
    setProductDescription(profile.description);
    setDeclaredMaterials(profile.declaredMaterials);
    setIntendedUse(profile.intendedUse);
    setItemPrice(profile.itemPriceUSD.toString());
    setShippingCost(profile.shippingCostUSD.toString());
    setValidationError(null);
  };

  // Image Selection & Client Validation
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setValidationError("Only JPEG, PNG, or WebP images are permitted.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setValidationError("Image file size exceeds the 4.0 MB limit.");
      return;
    }

    setSelectedPhoto(file);
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Step 1: Submit Form to /api/products/analyze
  const handleAnalyzeProduct = async (e: React.FormEvent, overrideDemo = false) => {
    e.preventDefault();
    setValidationError(null);

    if (!productTitle.trim()) {
      setValidationError("Please enter a product title.");
      return;
    }
    if (!productDescription.trim()) {
      setValidationError("Please enter a detailed product description.");
      return;
    }
    const parsedPrice = parseFloat(itemPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setValidationError("Please provide a valid item selling price in USD.");
      return;
    }

    const isDemo = overrideDemo || forceDemoMode;
    if (!isDemo && !consentGiven) {
      setValidationError("Consent is required to transmit data to Google AI Studio. Check the consent box or switch to demo mode.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("productTitle", productTitle.trim());
      formData.append("productDescription", productDescription.trim());
      formData.append("declaredMaterials", declaredMaterials.trim());
      formData.append("intendedUse", intendedUse.trim());
      formData.append("originCountry", originCountry);
      formData.append("destinationCountry", destinationCountry);
      formData.append("itemPriceUSD", parsedPrice.toString());
      if (shippingCost) formData.append("shippingCostUSD", shippingCost.trim());
      if (selectedPhoto) formData.append("image", selectedPhoto);
      formData.append("consent", consentGiven ? "true" : "false");
      formData.append("demoMode", isDemo ? "true" : "false");

      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/products/analyze", {
        method: "POST",
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned HTTP ${res.status}`);
      }

      const data: ProductAnalysisResult = await res.json();
      setAnalysisResult(data);
      setEditableMaterials(declaredMaterials || data.inferred_attributes.primary_material || "");
      setEditableUse(intendedUse || data.inferred_attributes.category || "");
      setActiveStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze product.";
      setValidationError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 3 Runner: Trigger /api/tariffs/classify
  const handleRunClassification = async (
    review: SellerConfirmedProductReview,
    answersOverride?: Record<string, string>
  ) => {
    setIsClassifying(true);
    setClassificationError(null);
    setSelectedCandidateHts(null);
    setIsClassificationConfirmed(false);

    try {
      const res = await fetch("/api/tariffs/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: review.confirmedTitle,
          description: review.confirmedDescription,
          materials: review.confirmedMaterials,
          intendedUse: review.confirmedIntendedUse,
          clarificationAnswers: answersOverride || tariffClarificationAnswers,
          forceDemoMode,
          userConsentGiven: consentGiven,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned HTTP ${res.status}`);
      }

      const data: ClassificationResult = await res.json();
      setClassificationResult(data);
      if (data.primaryCandidate) {
        setSelectedCandidateHts(data.primaryCandidate.hts10);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Classification failed.";
      setClassificationError(msg);
    } finally {
      setIsClassifying(false);
    }
  };

  // Confirm seller review in Step 2 and advance to Step 3
  const handleConfirmReview = async () => {
    if (!analysisResult) return;

    const confirmedData: SellerConfirmedProductReview = {
      confirmedTitle: productTitle,
      confirmedDescription: productDescription,
      confirmedMaterials: editableMaterials,
      confirmedIntendedUse: editableUse,
      clarificationAnswers,
      isConfirmedByUser: true,
      confirmedAt: new Date().toISOString(),
    };
    setConfirmedReview(confirmedData);
    setActiveStep(3);
    await handleRunClassification(confirmedData);
  };

  // Deterministic Landed-Cost Calculation Trigger (Step 4)
  const handleCalculateLandedCost = async () => {
    const candidateCode =
      selectedCandidateHts || classificationResult?.primaryCandidate?.hts10;

    if (!candidateCode) {
      setLandedCostError("Please select a candidate HTS code in Step 3 first.");
      setLandedCostErrorCode("CANDIDATE_SELECTION_REQUIRED");
      return;
    }

    setIsCalculatingLandedCost(true);
    setLandedCostError(null);
    setLandedCostErrorCode(null);

    try {
      const payload = {
        hts10: candidateCode,
        productTitle: confirmedReview?.confirmedTitle || productTitle,
        productDescription: confirmedReview?.confirmedDescription || productDescription,
        quantity: Number(quantity) > 0 ? Number(quantity) : 1,
        unitPriceUSD: parseFloat(itemPrice) || 0,
        shippingCostUSD: parseFloat(shippingCost) || 0,
        isShippingDocumented,
        importDate: importDate.trim() || undefined,
        isDemoMode: forceDemoMode,
        transportationMode,
        postalServiceType: transportationMode === "POSTAL" ? postalServiceType : undefined,
        voluntaryPostalCompliance: transportationMode === "POSTAL" ? voluntaryPostalCompliance : undefined,
        carrierPostalProcedure: transportationMode === "POSTAL" ? carrierPostalProcedure : undefined,
        isPostalProcedureConfirmed: transportationMode === "POSTAL" ? isPostalProcedureConfirmed : undefined,
        entryType13Eligibility:
          transportationMode === "POSTAL" && voluntaryPostalCompliance === "ENTRY_TYPE_13_TEST"
            ? {
              hasRightToMakeEntry: entryType13HasRight,
              isTestParticipant: entryType13IsParticipant,
              hasAceFilingCapability: entryType13HasAce,
              hasRequiredDataElements: entryType13HasReqData,
              hasChapter99Data: entryType13HasChapter99Data,
              isPgaDataComplete: entryType13IsPgaComplete,
              isPgaTemporaryAcceptanceActive: entryType13IsPgaTempActive,
            }
            : undefined,
        isQualifyingEccfOrHub,
        packingCostUSD: parseFloat(packingCostUSD) || 0,
        assistsCostUSD: parseFloat(assistsCostUSD) || 0,
        originCountry: "IN",
        destinationCountry: "US",
        classificationStatus: classificationResult?.status || "CLASSIFIED",
      };

      const res = await fetch("/api/tariffs/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `ui_calc_${Date.now()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setLandedCostError(data.error || "Landed cost calculation failed.");
        setLandedCostErrorCode(data.code || "CALCULATION_ERROR");
        setLandedCostResult(null);
        return;
      }

      setLandedCostResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to landed cost calculation service.";
      setLandedCostError(msg);
      setLandedCostErrorCode("NETWORK_ERROR");
      setLandedCostResult(null);
    } finally {
      setIsCalculatingLandedCost(false);
    }
  };

  // Find currently active candidate (primary or seller-selected alternative)
  const activeCandidate: ClassificationCandidate | null =
    classificationResult
      ? selectedCandidateHts === classificationResult.primaryCandidate?.hts10
        ? classificationResult.primaryCandidate
        : classificationResult.alternativeCandidates.find((c) => c.hts10 === selectedCandidateHts) ||
        classificationResult.primaryCandidate
      : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation & Corridor Indicator */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Target Corridor:</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1">
            {PRIMARY_CORRIDOR.originFlag} India → {PRIMARY_CORRIDOR.destinationFlag} USA
          </span>
        </div>
      </div>

      {/* Draft Restoration Banner (Sprint 7 Task 3) */}
      {isDraftRestored && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200/90 text-sky-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg text-sky-700 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sky-950">In-Progress Assessment Restored</p>
              <p className="text-sky-700 mt-0.5">
                We safely recovered your draft export inputs from your current browser session.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetForm}
              className="text-xs border-sky-300 bg-white text-sky-800 hover:bg-sky-100 hover:text-sky-950 font-medium h-8 px-3"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Reset / Start Fresh</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDraftRestored(false)}
              className="text-xs text-sky-600 hover:bg-sky-100/80 h-8 w-8 p-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stepper Progress */}
      <Stepper steps={steps} />

      {/* Validation / API Error Alert */}
      {validationError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Analysis Request Failed</span>
            </div>
            <p className="text-rose-700 leading-relaxed pl-6">{validationError}</p>
            <div className="pl-6 pt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  setForceDemoMode(true);
                  handleAnalyzeProduct(e, true);
                }}
                className="text-xs font-semibold text-rose-900 underline hover:text-rose-950 flex items-center gap-1"
              >
                <span>Switch to Pre-Calibrated Demo Mode (Offline)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-rose-500 hover:text-rose-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= STEP 1: PRODUCT INTAKE FORM ================= */}
      {activeStep === 1 && (
        <Card className="border-line bg-card rounded-[22px] shadow-sm">
          <CardHeader className="p-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="font-heading font-bold text-2xl text-text">Describe what you&apos;re exporting</CardTitle>
                <CardDescription className="text-xs sm:text-sm text-mute mt-1">
                  Step 1 of 5: Tell us what the product is and how it&apos;s made. The AI extracts materials and attributes for US customs.
                </CardDescription>
              </div>
              <Badge variant="mint" className="self-start sm:self-auto text-xs font-semibold">
                Phase: Product Understanding
              </Badge>
            </div>

            {/* Quick-Fill Sample Pills */}
            <div className="quick mt-4">
              <span className="w-full font-semibold text-xs text-text flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-saffron shrink-0" />
                  <span>Try a sample product (1-click fill)</span>
                </span>
                <span className="text-[11px] font-normal text-mute">Indian artisan exports</span>
              </span>

              <div className="flex flex-wrap gap-2 mt-2 w-full">
                {SEED_EXPORT_PROFILES.map((profile) => {
                  const isSelected = productTitle === profile.title;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => handleSelectSeedProfile(profile)}
                      className={`pill ${isSelected ? "sel" : ""}`}
                    >
                      {profile.title.split(" ").slice(0, 3).join(" ")}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 pt-2">
            <form onSubmit={handleAnalyzeProduct} className="space-y-5">
              {/* Product Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Product Title / Commercial Name *</span>
                  <span className="text-[11px] font-normal text-slate-400">e.g., Handcrafted Cotton Canvas Tote Bag</span>
                </label>
                <input
                  type="text"
                  required
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="Enter commercial product name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Product Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Detailed Product Description *</span>
                  <span className="text-[11px] font-normal text-slate-400">Include form, craftsmanship, and styling</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe the physical product, how it is made, its shape, and dimensions..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400 resize-y"
                />
              </div>

              {/* Grid: Materials and Intended Use */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Declared Materials</span>
                    <span className="text-[11px] font-normal text-slate-400">e.g., 100% Cotton, Brass, Sheesham</span>
                  </label>
                  <input
                    type="text"
                    value={declaredMaterials}
                    onChange={(e) => setDeclaredMaterials(e.target.value)}
                    placeholder="e.g., 100% unbleached woven cotton canvas"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Intended Function / Use</span>
                    <span className="text-[11px] font-normal text-slate-400">e.g., Shopping, Tableware, Jewelry</span>
                  </label>
                  <input
                    type="text"
                    value={intendedUse}
                    onChange={(e) => setIntendedUse(e.target.value)}
                    placeholder="e.g., Reusable grocery shopping and daily carry"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Grid: Selling Price & Shipping Estimate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Selling Price per Unit (USD) *</span>
                    <span className="text-[11px] font-normal text-slate-400">Invoice value</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Estimated Shipping Cost (USD)</span>
                    <span className="text-[11px] font-normal text-slate-400">Optional</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Product Photograph Upload */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Product Photograph (Optional)</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Max 4 MB • JPEG, PNG, WebP • Auto-sanitized
                  </span>
                </label>

                {photoPreview ? (
                  <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Uploaded product preview"
                      className="h-36 w-36 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-3 right-3 p-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full shadow-md transition-all"
                      title="Remove photograph"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="mt-1 text-[11px] text-slate-500 font-medium text-center truncate max-w-[144px]">
                      {selectedPhoto?.name}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/20 rounded-xl p-5 text-center cursor-pointer transition-all space-y-1.5"
                  >
                    <Upload className="w-5 h-5 mx-auto text-slate-400" />
                    <div className="text-xs font-medium text-slate-700">
                      Click to upload product photo or drag & drop
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Images are decoded, stripped of EXIF metadata, and downsampled to safe dimensions before processing.
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>

              {/* Cloud AI Privacy & Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">Cloud AI Processing Consent: </span>
                    I authorize BorderBrief AI to transmit sanitized product details and photographs to Google AI Studio (Gemini 2.5 Flash) for physical characteristic extraction and classification preparation.
                  </div>
                </label>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Zero PII retention • Trade codes preserved</span>
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800">
                    <input
                      type="checkbox"
                      checked={forceDemoMode}
                      onChange={(e) => setForceDemoMode(e.target.checked)}
                      className="rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                    />
                    <span>Force Offline Demo Mode</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      <span>Analyzing Product Characteristics...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Product with AI</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ================= STEP 2: AI PRODUCT UNDERSTANDING & SELLER CONFIRMATION ================= */}
      {activeStep === 2 && analysisResult && (
        <div className="space-y-6">
          <Card className="border-line bg-card rounded-[22px] shadow-sm">
            <CardHeader className="p-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading font-bold text-2xl text-text">AI Product Analysis &amp; Attribute Review</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-mute mt-1">
                    Step 2 of 5: Review the physical characteristics identified by Cloud AI. You can edit any field before locking the attributes.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={analysisResult.confidence === "HIGH" ? "success" : "warning"}
                    className="text-xs"
                  >
                    AI Confidence: {analysisResult.confidence}
                  </Badge>
                  {analysisResult.is_demo_mode && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                      Pre-Calibrated Baseline
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-2 space-y-6">
              {/* Product Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Physical Product Summary</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {analysisResult.product_summary}
                </p>
              </div>

              {/* Extracted Attributes Breakdown */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Extracted Physical Characteristics
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analysisResult.identified_attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200/80 bg-white space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-medium text-slate-700">{attr.attributeName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${attr.source === "EXPLICIT_SELLER"
                              ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                              : attr.source === "INFERRED_ANALYSIS"
                                ? "border-sky-200 text-sky-700 bg-sky-50"
                                : "border-slate-200 text-slate-600"
                            }`}
                        >
                          {attr.source === "EXPLICIT_SELLER" ? "Declared by You" : "Inferred by AI"}
                        </Badge>
                      </div>
                      <div className="text-slate-800 font-semibold">{attr.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clarifying Questions */}
              {analysisResult.clarifying_questions && analysisResult.clarifying_questions.length > 0 && (
                <div className="space-y-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>AI Clarification Requests for Customs Accuracy</span>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Customs duty rates often vary depending on subtle construction differences. Answering these helps pinpoint the exact US tariff line.
                  </p>

                  <div className="space-y-3 pt-2">
                    {analysisResult.clarifying_questions.map((q) => (
                      <div key={q.id} className="p-3 bg-white rounded-lg border border-amber-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-800">{q.question}</div>
                        <div className="text-[11px] text-slate-500 italic">{q.context}</div>

                        {q.suggestedOptions && q.suggestedOptions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {q.suggestedOptions.map((opt, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() =>
                                  setClarificationAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: opt,
                                  }))
                                }
                                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${clarificationAnswers[q.id] === opt
                                    ? "bg-sea text-white border-sea font-medium"
                                    : "bg-bg hover:bg-sea-soft text-text border-line"
                                  }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={clarificationAnswers[q.id] || ""}
                            onChange={(e) =>
                              setClarificationAnswers((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            placeholder="Type your clarification..."
                            className="w-full px-3 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Fields Before Final Confirmation */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Verify or Correct Attributes for US Customs</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Material Composition</label>
                    <input
                      type="text"
                      value={editableMaterials}
                      onChange={(e) => setEditableMaterials(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Intended Function / Use</label>
                    <input
                      type="text"
                      value={editableUse}
                      onChange={(e) => setEditableUse(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions & Confirm Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setActiveStep(1)}
                  className="w-full sm:w-auto text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Edit Product Intake Form</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleConfirmReview}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>Confirm & Proceed to Classification (Step 3)</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= STEP 3: CUSTOMS GROUNDING & HTS CLASSIFICATION ================= */}
      {activeStep === 3 && (
        <div className="space-y-6">
          {/* Statutory Authority Header Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold tracking-wider uppercase text-sky-300">
                  Authoritative Statutory Grounding
                </span>
              </div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>USITC Harmonized Tariff Schedule (2026 HTS Revision 22)</span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <span>Effective Date: October 30, 2026</span>
                <span>•</span>
                <span>Corridor: India → USA</span>
              </div>
            </div>

            <a
              href="https://hts.usitc.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors self-start sm:self-auto font-medium"
            >
              <span>Verify at USITC.gov</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Classification Loading State */}
          {isClassifying && (
            <Card className="border-slate-200 shadow-sm p-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-800">
                  Classifying Merchandise Under USITC 2026 Revision 22...
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Applying WCO General Rules of Interpretation (GRI 1-6), evaluating Chapter Legal Notes, and verifying candidates against the authoritative schedule.
                </p>
              </div>
            </Card>
          )}

          {/* Classification Error Alert */}
          {classificationError && !isClassifying && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Classification Request Failed</span>
                </div>
                <p className="text-rose-700 leading-relaxed pl-6">{classificationError}</p>
                <div className="pl-6 pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmedReview) handleRunClassification(confirmedReview);
                    }}
                    className="text-xs font-semibold text-rose-900 underline hover:text-rose-950 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Classification</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForceDemoMode(true);
                      if (confirmedReview) handleRunClassification(confirmedReview);
                    }}
                    className="text-xs font-semibold text-rose-900 underline hover:text-rose-950"
                  >
                    <span>Run in Offline Grounded Mode</span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => setClassificationError(null)}
                className="text-rose-500 hover:text-rose-700 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Classification Result Display */}
          {classificationResult && !isClassifying && (
            <div className="space-y-6">
              {/* Product Confirmation Context Bar */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Exporter Product:</span>
                  <span className="font-bold text-slate-900">{productTitle}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{editableMaterials || declaredMaterials}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium ${classificationResult.status === "CLASSIFIED"
                        ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                        : "border-amber-300 text-amber-800 bg-amber-50"
                      }`}
                  >
                    {classificationResult.status === "CLASSIFIED"
                      ? "High-Confidence Match"
                      : "Alternative Review Required"}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-600">
                    {classificationResult.isAiAssisted ? "AI-Assisted GRI Match" : "Deterministic Schedule Match"}
                  </Badge>
                </div>
              </div>

              {/* UNRESOLVED CLASSIFICATION NOTICE */}
              {!classificationResult.primaryCandidate && (
                <Card className="border-amber-300 bg-amber-50/50 shadow-sm p-6 space-y-3">
                  <div className="flex items-center gap-2.5 text-amber-900 font-semibold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Tariff Classification Unresolved — Clarification Required</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {classificationResult.confidenceExplanation ||
                      "Available product attributes are insufficient to assign an authoritative 10-digit HTS code with legal certainty. Safe compliance requires resolving physical details before determining customs duty rates."}
                  </p>
                  {classificationResult.missingInformation && classificationResult.missingInformation.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                        Missing Critical Details:
                      </div>
                      <ul className="list-disc pl-5 text-xs text-amber-800 space-y-0.5">
                        {classificationResult.missingInformation.map((info, idx) => (
                          <li key={idx}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {/* PRIMARY RECOMMENDED CANDIDATE CARD */}
              {classificationResult.primaryCandidate && (
                <Card
                  className={`border transition-all shadow-sm ${selectedCandidateHts === classificationResult.primaryCandidate.hts10
                      ? "border-sky-400 ring-2 ring-sky-100"
                      : "border-slate-200"
                    }`}
                >
                  <CardHeader className="p-6 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded bg-sky-100 text-sky-900 font-mono font-bold text-sm">
                          HTS {classificationResult.primaryCandidate.hts10}
                        </span>
                        <Badge variant="success" className="text-xs">
                          Primary Recommended Code
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">6-Digit International HS:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {classificationResult.primaryCandidate.hs6}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <h4 className="text-sm font-semibold text-slate-800 leading-snug">
                        {classificationResult.primaryCandidate.officialDescription}
                      </h4>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 pt-2 space-y-4">
                    {/* General Duty Rate and Unit Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">Column 1 General Base Rate</div>
                        <div className="text-base font-bold text-slate-900">
                          {classificationResult.primaryCandidate.generalRateStr}
                        </div>
                        <div className="text-[10px] text-slate-400">Baseline MFN Rate (Chapters 1-97)</div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">Reporting Quantity Unit</div>
                        <div className="text-sm font-semibold text-slate-800">
                          {classificationResult.primaryCandidate.unitOfQuantity || "No."}
                        </div>
                        <div className="text-[10px] text-slate-400">USITC statistical unit</div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">Legal Schedule Source</div>
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {classificationResult.primaryCandidate.sourceReference}
                        </div>
                        <div className="text-[10px] text-slate-400">USITC 2026 Revision 22</div>
                      </div>
                    </div>

                    {/* MANDATORY INDIA GSP INELIGIBILITY NOTICE */}
                    <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-700" />
                        <span>India GSP Status & Duty Structure (Statutory Requirement):</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        India cannot claim Generalized System of Preferences (GSP indicator &apos;A&apos;) duty-free treatment (terminated June 5, 2019 under Presidential Proclamation 9902; GSP authorization expired December 31, 2020). Indian merchandise enters the US under the <strong>Column 1 General MFN base rate of {classificationResult.primaryCandidate.generalRateStr}</strong>. <em>Note:</em> This base rate represents the baseline customs tariff and does not preclude potential Chapter 99 trade remedies (e.g. Section 301, Section 232), antidumping/countervailing duties (AD/CVD), or customs user fees.
                      </p>
                    </div>

                    {/* GRI Legal Basis */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-sky-600" />
                        <span>WCO General Rules of Interpretation (GRI) Legal Rationale</span>
                      </div>
                      <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed font-mono">
                        {classificationResult.primaryCandidate.griLegalBasis}
                      </p>
                    </div>

                    {/* Plain Language Explanation for Exporter */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Plain-Language Guidance for Exporter
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {classificationResult.primaryCandidate.plainLanguageExplanation}
                      </p>
                    </div>

                    {/* Supporting Attributes Tags */}
                    {classificationResult.primaryCandidate.supportingProductAttributes.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-600">Substantiating Product Attributes:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {classificationResult.primaryCandidate.supportingProductAttributes.map((attr, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                            >
                              {attr}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selection Toggle */}
                    <div className="pt-2 flex items-center justify-end">
                      {selectedCandidateHts === classificationResult.primaryCandidate.hts10 ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                          <Check className="w-4 h-4 text-sky-600" />
                          <span>Selected as Declared HTS Code</span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCandidateHts(classificationResult.primaryCandidate!.hts10)}
                          className="text-xs"
                        >
                          Select Primary Recommendation
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CONTRASTING ALTERNATIVE CANDIDATES */}
              {classificationResult.alternativeCandidates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Contrasting Tariff Alternatives for Verification</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    US Customs distinguishes duty rates based on fine material thresholds (e.g. coating, silk percentage, or base metal). Review these alternative lines if your manufacturing specifications differ:
                  </p>

                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {classificationResult.alternativeCandidates.map((alt) => {
                      const isSelected = selectedCandidateHts === alt.hts10;
                      return (
                        <div
                          key={alt.candidateId}
                          className={`p-4 rounded-xl border transition-all ${isSelected
                              ? "bg-sky-50/40 border-sky-400 ring-2 ring-sky-100"
                              : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                                HTS {alt.hts10}
                              </span>
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                Duty: {alt.generalRateStr}
                              </Badge>
                            </div>

                            <Button
                              type="button"
                              variant={isSelected ? "primary" : "outline"}
                              size="sm"
                              onClick={() => setSelectedCandidateHts(alt.hts10)}
                              className={`text-xs ${isSelected ? "text-[#1A1204]" : ""}`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>Select This HTS Line</span>
                              )}
                            </Button>
                          </div>

                          <div className="mt-2 text-xs font-semibold text-slate-800">
                            {alt.officialDescription}
                          </div>

                          <div className="mt-1 text-xs text-slate-600">
                            {alt.plainLanguageExplanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CLARIFYING QUESTIONS IN STEP 3 (IF AMBIGUITIES EXIST) */}
              {classificationResult.clarifyingQuestions && classificationResult.clarifyingQuestions.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <HelpCircle className="w-4 h-4 text-amber-700" />
                    <span>Ambiguity Clarification for Tariff Line Pinpointing</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Select the option matching your product to automatically refine candidate selection:
                  </p>

                  <div className="space-y-3">
                    {classificationResult.clarifyingQuestions.map((q) => (
                      <div key={q.id} className="p-3 bg-white rounded-lg border border-amber-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-800">{q.question}</div>
                        <div className="text-[11px] text-slate-500">{q.context}</div>

                        {q.suggestedOptions && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {q.suggestedOptions.map((opt, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...tariffClarificationAnswers,
                                    [q.id]: opt,
                                  };
                                  setTariffClarificationAnswers(updated);
                                  if (confirmedReview) {
                                    handleRunClassification(confirmedReview, updated);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${tariffClarificationAnswers[q.id] === opt
                                    ? "bg-sea text-white border-sea font-medium"
                                    : "bg-bg hover:bg-sea-soft text-text border-line"
                                  }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONFIRMATION & LOCK SECTION */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Step 3 Confirmation: Lock Declared Tariff Code
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confirming this classification locks the HTS code for your customs entry profile.
                    </p>
                  </div>

                  {!isClassificationConfirmed ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setIsClassificationConfirmed(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      <Lock className="w-4 h-4 mr-1.5" />
                      <span>Confirm & Lock Classification</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsClassificationConfirmed(false)}
                      className="text-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      <span>Unlock / Change Selection</span>
                    </Button>
                  )}
                </div>

                {isClassificationConfirmed && activeCandidate && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Classification Confirmed & Locked for US Customs Declaration</span>
                    </div>
                    <div className="text-xs text-emerald-800 leading-relaxed">
                      Merchandise <strong>{productTitle}</strong> is locked under HTS code{" "}
                      <span className="font-mono font-bold">{activeCandidate.hts10}</span> (Duty Rate:{" "}
                      <strong>{activeCandidate.generalRateStr}</strong>).
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-emerald-200/60 text-[11px] text-emerald-700">
                      <span>Authority: {activeCandidate.sourceReference}</span>
                      <span className="font-semibold text-emerald-900">
                        Classification Locked & Verified
                      </span>
                    </div>

                    <div className="pt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => {
                          setActiveStep(4);
                          if (!landedCostResult) {
                            handleCalculateLandedCost();
                          }
                        }}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Calculator className="w-4 h-4 mr-1" />
                        <span>Proceed to Step 4: Calculate Landed Cost</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* STATUTORY COMPLIANCE LEGAL DISCLAIMER */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Statutory Compliance Notice (19 U.S.C. § 1484)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  {classificationResult.disclaimer} Under U.S. customs law (19 U.S.C. § 1484), the legal obligation to exercise reasonable care in declaring classification, value, and applicable duties upon entry into the United States rests with the U.S. Importer of Record (typically the U.S. buyer, consignee, or designated customs broker). This platform provides export preparation and advisory candidate intelligence for Indian sellers and does not transfer statutory importer liability, nor does it constitute a legally binding classification ruling by U.S. Customs and Border Protection (CBP). Both the seller and the U.S. importer of record should verify classification with a licensed customs broker or request a formal binding ruling under 19 C.F.R. Part 177.
                </p>
              </div>

              {/* Bottom Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setActiveStep(2)}
                  className="text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Return to Step 2 (Product Review)</span>
                </Button>

                {isClassificationConfirmed && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setActiveStep(4);
                      if (!landedCostResult) {
                        handleCalculateLandedCost();
                      }
                    }}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <span>Go to Step 4 (Landed Cost)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 4: DETERMINISTIC LANDED-COST & DUTIES ================= */}
      {activeStep === 4 && (
        <div className="space-y-6">
          {/* Statutory Authority Header Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold tracking-wider uppercase text-sky-300">
                  Deterministic Landed-Cost Calculation Engine
                </span>
              </div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>USITC 2026 Rev 22 • USTR Doc 2026-15181 (Sec 301) • 19 CFR § 24.23/24</span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <span>Corridor: India → United States</span>
                <span>•</span>
                <span>Valuation Law: 19 U.S.C. § 1401a Transaction Value</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-sky-400/40 text-sky-200 bg-sky-950/40 text-xs">
                Zero-AI Math Loop
              </Badge>
            </div>
          </div>

          {/* Context Ribbon: Product & Classification Summary */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Export Item:</span>
              <span className="font-bold text-slate-900">{confirmedReview?.confirmedTitle || productTitle}</span>
              <span className="text-slate-400">•</span>
              <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                HTS {activeCandidate?.hts10 || selectedCandidateHts || "Declared Code"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span>General Base Rate: <strong>{activeCandidate?.generalRateStr || "M.F.N."}</strong></span>
              <span>•</span>
              <span>Section 301: <strong>10.0% (Heading 9903.05.44)</strong></span>
            </div>
          </div>

          {/* Shipment & Valuation Input Configuration Card */}
          <Card className="border-line bg-card rounded-[22px] shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="font-heading text-base font-bold text-text flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sea" />
                <span>Customs Valuation &amp; Logistics Parameters (19 U.S.C. § 1401a)</span>
              </CardTitle>
              <CardDescription className="text-xs text-mute">
                Configure commercial transaction terms to determine dutiable customs value and port-of-entry fees.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Export Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Unit Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Selling Price (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* International Shipping Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    International Shipping (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.00"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Documented Freight Checkbox */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShippingDocumented}
                    onChange={(e) => setIsShippingDocumented(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">
                      Verifiable Carrier Shipping Documentation Available
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Under 19 U.S.C. § 1401a(b)(4)(A), international freight is excluded from dutiable customs value <em>only when documented</em> with an actual carrier air waybill, bill of lading, or freight invoice. If unchecked, CBP assesses customs duty on the full unadjusted gross price.
                    </p>
                  </div>
                </label>
              </div>

              {/* Transportation Mode, Import Date & Logistics Routing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transportation Mode (19 C.F.R. § 24.24)
                  </label>
                  <select
                    value={transportationMode}
                    onChange={(e) => setTransportationMode(e.target.value as TransportationMode)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    <option value="AIR_CARGO">Air Cargo / Commercial Air Freight (HMF Exempt)</option>
                    <option value="AIR_EXPRESS">Air Express Courier (DHL/FedEx/UPS - HMF Exempt)</option>
                    <option value="OCEAN_LCL">Ocean Freight — Less than Container (LCL - 0.125% HMF)</option>
                    <option value="OCEAN_FCL">Ocean Freight — Full Container (FCL - 0.125% HMF)</option>
                    <option value="POSTAL">International Postal Mail (India Post/USPS - HMF Exempt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anticipated U.S. Import Date
                  </label>
                  <input
                    type="date"
                    value={importDate}
                    onChange={(e) => setImportDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {forceDemoMode
                      ? "Demo mode: Defaults to simulation date 2026-11-07 if empty."
                      : "Optional. Governs Jan 20, 2027 postal compliance deadline."}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clearance Facility Type (19 C.F.R. § 24.23(b)(4))
                  </label>
                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isQualifyingEccfOrHub}
                      onChange={(e) => setIsQualifyingEccfOrHub(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-700">
                      Qualifying Express Facility / Centralized Hub ($1.38 fee; exempt from $2.77 informal MPF)
                    </span>
                  </label>
                </div>

                {transportationMode === "POSTAL" && (
                  <div className="sm:col-span-3 p-3 rounded-xl bg-sky-50/60 border border-sky-200/80 space-y-2">
                    <label className="block text-xs font-semibold text-slate-800">
                      Postal Service Classification (19 C.F.R. § 24.23(c)(1)(v))
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="postalType"
                          value="ORDINARY_MAIL"
                          checked={postalServiceType === "ORDINARY_MAIL"}
                          onChange={() => setPostalServiceType("ORDINARY_MAIL")}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">Ordinary International Mail</div>
                          <div className="text-[10px] text-slate-500">
                            India Post / USPS Letter or Parcel Post. Statutorily exempt from MPF ($0.00) under 19 C.F.R. § 24.23(c)(1)(v).
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="postalType"
                          value="INBOUND_EMS"
                          checked={postalServiceType === "INBOUND_EMS"}
                          onChange={() => setPostalServiceType("INBOUND_EMS")}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">Inbound Express Mail Service (EMS / Speed Post)</div>
                          <div className="text-[10px] text-slate-500">
                            Separate $1.00 EMS item fee (19 C.F.R. § 24.22(l)(1)(i)). Formal entries subject to formal ad valorem MPF under 85 FR 47018 exception to § 24.23(c)(1)(v).
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Postal Compliance Transition (CBP Doc. 2026-21600) */}
                    <div className="pt-2 space-y-1.5 border-t border-slate-200/60 mt-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-800">
                          Postal Compliance Mode (CBP Doc. 2026-21600 Extension)
                        </label>
                        <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Mandatory Compliance Date: Jan 20, 2027
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        CBP Final Rule Doc. 2026-21600 (Oct 22, 2026) extended mandatory formal entry for Chapter 99 mail shipments to January 20, 2027. Informal clearance remains available during this transition period.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="voluntaryCompliance"
                            value="NONE"
                            checked={voluntaryPostalCompliance === "NONE" && isPostalProcedureConfirmed}
                            onChange={() => {
                              setVoluntaryPostalCompliance("NONE");
                              setCarrierPostalProcedure("CONFIRMED_INFORMAL");
                              setIsPostalProcedureConfirmed(true);
                            }}
                            className="mt-0.5 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">Confirmed Informal Clearance</div>
                            <div className="text-[10px] text-slate-500">
                              Confirmed that carrier will process under existing informal clearance (19 C.F.R. Part 145) during extension.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="voluntaryCompliance"
                            value="FORMAL_EARLY"
                            checked={voluntaryPostalCompliance === "FORMAL_EARLY"}
                            onChange={() => {
                              setVoluntaryPostalCompliance("FORMAL_EARLY");
                              setCarrierPostalProcedure("VOLUNTARY_FORMAL_EARLY");
                              setIsPostalProcedureConfirmed(true);
                            }}
                            className="mt-0.5 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">Voluntary Early Formal Entry</div>
                            <div className="text-[10px] text-slate-500">
                              Voluntarily elect formal entry on CBP Form 7501 ahead of the January 20, 2027 date.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="voluntaryCompliance"
                            value="ENTRY_TYPE_13_TEST"
                            checked={voluntaryPostalCompliance === "ENTRY_TYPE_13_TEST"}
                            onChange={() => {
                              setVoluntaryPostalCompliance("ENTRY_TYPE_13_TEST");
                              setCarrierPostalProcedure("VOLUNTARY_ENTRY_TYPE_13");
                              setIsPostalProcedureConfirmed(true);
                            }}
                            className="mt-0.5 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">Entry Type 13 Test Pilot</div>
                            <div className="text-[10px] text-slate-500">
                              Voluntary participation in CBP Entry Type 13 informal electronic postal clearance pilot.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="voluntaryCompliance"
                            value="UNKNOWN"
                            checked={voluntaryPostalCompliance === "UNKNOWN" || !isPostalProcedureConfirmed}
                            onChange={() => {
                              setVoluntaryPostalCompliance("UNKNOWN");
                              setCarrierPostalProcedure("UNCONFIRMED");
                              setIsPostalProcedureConfirmed(false);
                            }}
                            className="mt-0.5 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">Unconfirmed / Unknown Carrier Handling</div>
                            <div className="text-[10px] text-slate-500">
                              Carrier or operator handling not yet confirmed. Flags calculation as partially verified.
                            </div>
                          </div>
                        </label>
                      </div>

                      {/* Entry Type 13 Prerequisite Verification Form */}
                      {voluntaryPostalCompliance === "ENTRY_TYPE_13_TEST" && (
                        <div className="mt-3 p-3 bg-amber-50/80 rounded-lg border border-amber-200 space-y-2 text-xs">
                          <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Entry Type 13 Pilot Test Prerequisites (19 U.S.C. § 1484)</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            CBP Entry Type 13 is a restricted voluntary test. All four conditions must be confirmed to calculate as a confirmed entry procedure:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-800">
                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13HasRight}
                                onChange={(e) => setEntryType13HasRight(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">1. Right to Make Entry</div>
                                <div className="text-[10px] text-slate-500">Filer is U.S. Importer of Record or licensed broker (§ 1484).</div>
                              </div>
                            </label>

                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13IsParticipant}
                                onChange={(e) => setEntryType13IsParticipant(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">2. Established Test Participant</div>
                                <div className="text-[10px] text-slate-500">Established test participant under 91 FR 56936 & 91 FR 66707.</div>
                              </div>
                            </label>

                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13HasAce}
                                onChange={(e) => setEntryType13HasAce(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">3. Electronic ACE / ABI Filer</div>
                                <div className="text-[10px] text-slate-500">Active automated electronic interface with CBP ACE.</div>
                              </div>
                            </label>

                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13HasReqData}
                                onChange={(e) => setEntryType13HasReqData(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">4. Complete Mandatory Data</div>
                                <div className="text-[10px] text-slate-500">IOR ID, UPU tracking number, 10-digit HTSUS, value in ACE.</div>
                              </div>
                            </label>

                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13HasChapter99Data}
                                onChange={(e) => setEntryType13HasChapter99Data(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">5. Chapter 98/99 Data</div>
                                <div className="text-[10px] text-slate-500">Heading 9903.05.44 trade remedy declarations in ACE.</div>
                              </div>
                            </label>

                            <label className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entryType13IsPgaComplete}
                                onChange={(e) => setEntryType13IsPgaComplete(e.target.checked)}
                                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-medium">6. Electronic PGA Data</div>
                                <div className="text-[10px] text-slate-500">Partner Government Agency data transmitted electronically.</div>
                              </div>
                            </label>
                          </div>

                          <div className="p-2 bg-blue-50/70 rounded border border-blue-200/80 text-[10px] text-blue-900 leading-normal">
                            <span className="font-semibold">CBP Document 2026-21570 (91 FR 66707, page 66707):</span> CBP temporarily accepts Entry Type 13 filings in ACE with or without complete electronic PGA data during the announced temporary acceptance period.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleCalculateLandedCost}
                  disabled={isCalculatingLandedCost}
                  className="font-semibold text-xs flex items-center gap-1.5"
                >
                  {isCalculatingLandedCost ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Statutory Costs...</span>
                    </>
                  ) : (
                    <>
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Recalculate Landed Cost</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loading Indicator */}
          {isCalculatingLandedCost && (
            <Card className="border-slate-200 shadow-sm p-10 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                Evaluating Statutory Landed Cost & Customs Valuation...
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Applying 19 U.S.C. § 1401a valuation rules, computing Column 1 General duties, auditing Section 301 Heading 9903.05.44 (10%), and clamping FY2027 MPF user fees.
              </p>
            </Card>
          )}

          {/* Calculation Error / Blocked State Alert */}
          {landedCostError && !isCalculatingLandedCost && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3 shadow-sm">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {landedCostErrorCode === "CLASSIFICATION_AMBIGUITY_UNRESOLVED"
                      ? "Calculation Blocked: Tariff Ambiguity Unresolved"
                      : "Landed Cost Calculation Failed"}
                  </span>
                  {landedCostErrorCode && (
                    <Badge variant="outline" className="border-rose-300 text-rose-700 bg-white text-[10px]">
                      {landedCostErrorCode}
                    </Badge>
                  )}
                </div>
                <p className="text-rose-700 leading-relaxed pl-6">{landedCostError}</p>

                {landedCostErrorCode === "CLASSIFICATION_AMBIGUITY_UNRESOLVED" && (
                  <div className="pl-6 pt-1 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveStep(3)}
                      className="text-xs bg-white text-rose-900 border-rose-300 hover:bg-rose-50"
                    >
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      <span>Return to Step 3 to Clarify Material Details</span>
                    </Button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setLandedCostError(null)}
                className="text-rose-500 hover:text-rose-700 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Successful Landed Cost Presentation */}
          {landedCostResult && !isCalculatingLandedCost && (
            <div className="space-y-6">
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm ${landedCostResult.status === "VERIFIED"
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : landedCostResult.status === "PARTIALLY_VERIFIED"
                      ? "bg-amber-50/80 border-amber-200 text-amber-950"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${landedCostResult.status === "VERIFIED"
                        ? "text-emerald-600"
                        : landedCostResult.status === "PARTIALLY_VERIFIED"
                          ? "text-amber-600"
                          : "text-slate-600"
                      }`}
                  />
                  <div>
                    <div className="font-bold text-sm">
                      Calculation Status: {landedCostResult.status}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {landedCostResult.status === "VERIFIED"
                        ? "All tariff provisions, Section 301 determinations, and user fees verified against statutory baselines."
                        : landedCostResult.status === "PARTIALLY_VERIFIED"
                          ? "Base rates verified; Section 301 agricultural exclusion or freight documentation is conditional."
                          : "Advisory landed cost estimate."}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {landedCostResult.isSimulation && (
                    <Badge variant="outline" className="text-[11px] bg-amber-100 border-amber-300 text-amber-900 font-semibold">
                      SIMULATION (Baseline 2026-11-07)
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[11px] bg-white border-slate-300 text-slate-700">
                    Import: {landedCostResult.importDate}
                  </Badge>
                  {landedCostResult.postalComplianceDetails && (
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${landedCostResult.postalComplianceDetails.procedureCertainty === "CONFIRMED"
                          ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                          : landedCostResult.postalComplianceDetails.procedureCertainty === "UNCONFIRMED_CARRIER_HANDLING"
                            ? "bg-amber-100 border-amber-300 text-amber-900"
                            : "bg-sky-100 border-sky-300 text-sky-900"
                        }`}
                    >
                      Postal: {landedCostResult.postalComplianceDetails.procedureCertainty === "CONFIRMED"
                        ? "Confirmed"
                        : landedCostResult.postalComplianceDetails.procedureCertainty === "UNCONFIRMED_CARRIER_HANDLING"
                          ? "Carrier Handling Unconfirmed"
                          : "Mandatory Statutory"}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[11px] bg-white border-slate-300 text-slate-700">
                    {landedCostResult.statutoryRevision}
                  </Badge>
                </div>
              </div>

              {/* Conservative Illustrative Valuation Scenario Banner */}
              {landedCostResult.valuationScenarioType === "CONSERVATIVE_ILLUSTRATIVE_GROSS" && (
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-xs space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Conservative Illustrative Assessment Scenario (Undocumented Freight/Insurance)</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed pl-6 text-[11px]">
                    Under 19 U.S.C. § 1401a(b)(4)(A), international freight and transit insurance are excluded from dutiable customs value <em>only when supported by actual carrier documentation</em>. Because verifiable documentation was not provided, customs duties are assessed on the full unadjusted gross commercial price. This calculation is a conservative illustrative scenario, not a definitive final customs value.
                  </p>
                  {landedCostResult.missingInformation && landedCostResult.missingInformation.length > 0 && (
                    <div className="pl-6 pt-1 text-[11px] text-amber-900">
                      <strong>Required documentation to establish definitive Transaction Value:</strong>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-amber-800">
                        {landedCostResult.missingInformation.map((doc, idx) => (
                          <li key={idx}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 4 Key Metrics High-Level Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Dutiable Customs Value */}
                <Card className="border-slate-200 shadow-sm p-4 space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Dutiable Customs Value</div>
                  <div className="text-xl font-bold text-slate-900 font-mono">
                    ${landedCostResult.dutiableCustomsValueUSD.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">19 U.S.C. § 1401a Transaction Value</div>
                </Card>

                {/* 2. Total Customs Duty */}
                <Card className="border-slate-200 shadow-sm p-4 space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Total Customs Duties</div>
                  <div className="text-xl font-bold text-sky-700 font-mono">
                    ${landedCostResult.totalCustomsDutyUSD.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Base (${landedCostResult.baseCustomsDutyUSD.toFixed(2)}) + Sec 301 (${landedCostResult.section301DutyUSD.toFixed(2)})
                  </div>
                </Card>

                {/* 3. Customs User Fees */}
                <Card className="border-slate-200 shadow-sm p-4 space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Customs User Fees</div>
                  <div className="text-xl font-bold text-slate-900 font-mono">
                    ${landedCostResult.totalCustomsFeesUSD.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    MPF (${landedCostResult.mpfBreakdown.finalMpfAmountUSD.toFixed(2)}) + HMF (${landedCostResult.hmfBreakdown.hmfAmountUSD.toFixed(2)}){landedCostResult.inboundEmsFeeUSD !== undefined ? ` + EMS ($${landedCostResult.inboundEmsFeeUSD.toFixed(2)})` : ""}
                  </div>
                </Card>

                {/* 4. Total Delivered Landed Cost */}
                <Card className="border-sky-300 bg-sky-50/50 shadow-sm p-4 space-y-1">
                  <div className="text-[11px] text-sky-800 font-medium">Total Delivered Landed Cost</div>
                  <div className="text-xl font-bold text-sky-950 font-mono">
                    ${landedCostResult.totalLandedCostUSD.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-sky-700">All-Inclusive Delivered (DAP)</div>
                </Card>
              </div>

              {/* DAP Commercial Responsibility Partition Card */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-sky-600" />
                        <span>Commercial DAP Responsibility Allocation (Who Pays What)</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Incoterms® 2020 Delivered at Place (DAP) partitioning between Indian Exporter and US Importer.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-200 text-slate-600 text-[10px]">
                      Incoterms® 2020 DAP
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Seller Collected via PayPal */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          Collected by Seller (via PayPal / Invoice)
                        </span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          ${landedCostResult.dapAllocation.sellerCollectedViaPaypalUSD.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1 border-t border-slate-200/80 pt-2">
                        <div className="flex justify-between">
                          <span>Merchandise Price ({landedCostResult.quantity} × ${landedCostResult.unitPriceUSD.toFixed(2)}):</span>
                          <span className="font-mono">${(landedCostResult.quantity * landedCostResult.unitPriceUSD).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agreed International Shipping:</span>
                          <span className="font-mono">${landedCostResult.internationalShippingUSD.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Buyer Payable Upon Arrival */}
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900">
                          Payable by US Buyer (at Port of Entry to CBP)
                        </span>
                        <span className="text-base font-bold text-amber-950 font-mono">
                          ${landedCostResult.dapAllocation.buyerPayableUponArrivalUSD.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-800 space-y-1 border-t border-amber-200/80 pt-2">
                        <div className="flex justify-between">
                          <span>Total Import Duties (Base + Sec 301):</span>
                          <span className="font-mono">${landedCostResult.totalCustomsDutyUSD.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Customs User Fees (MPF + HMF{landedCostResult.inboundEmsFeeUSD !== undefined ? " + EMS" : ""}):</span>
                          <span className="font-mono">${landedCostResult.totalCustomsFeesUSD.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    <strong>Commercial Notice:</strong> Under standard DAP export terms, the US buyer is responsible for settling statutory customs import duties and user fees directly with U.S. Customs or their clearing courier prior to package release.
                  </p>
                </CardContent>
              </Card>

              {/* Itemized Duty & Fee Statutory Breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duties Breakdown */}
                <Card className="border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                      <span>Customs Duties Breakdown</span>
                    </span>
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      ${landedCostResult.totalCustomsDutyUSD.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Base Duty */}
                    <div className="p-2.5 rounded-lg bg-slate-50 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Column 1 General Base Duty ({landedCostResult.dutyBreakdown.baseAdValoremRateStr})</span>
                        <span className="font-mono">${landedCostResult.baseCustomsDutyUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        HTS {landedCostResult.dutyBreakdown.hts10} • USITC 2026 Rev 22 MFN rate
                      </div>
                    </div>

                    {/* Section 301 Duty */}
                    <div className="p-2.5 rounded-lg bg-slate-50 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Section 301 Additional Duty (10.0%)</span>
                        <span className="font-mono">${landedCostResult.section301DutyUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Heading {landedCostResult.dutyBreakdown.section301.chapter99Heading} • {landedCostResult.dutyBreakdown.section301.exemptionStatus}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {landedCostResult.dutyBreakdown.section301.exemptionNotes}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* User Fees Breakdown */}
                <Card className="border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Customs User Fees Breakdown</span>
                    </span>
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      ${landedCostResult.totalCustomsFeesUSD.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* MPF */}
                    <div className="p-2.5 rounded-lg bg-slate-50 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Merchandise Processing Fee (MPF)</span>
                        <span className="font-mono">${landedCostResult.mpfBreakdown.finalMpfAmountUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {landedCostResult.mpfBreakdown.appliedEntryType} • 19 C.F.R. § 24.23 (FY2027)
                      </div>
                      {landedCostResult.mpfBreakdown.eccfWaybillFeeUSD && (
                        <div className="text-[10px] text-slate-600">
                          ECCF Hub Facility Fee: ${landedCostResult.mpfBreakdown.eccfWaybillFeeUSD.toFixed(2)}
                        </div>
                      )}
                      {landedCostResult.mpfBreakdown.carrierFacilityFeeNote && (
                        <div className="text-[10px] text-slate-400">
                          {landedCostResult.mpfBreakdown.carrierFacilityFeeNote}
                        </div>
                      )}
                    </div>

                    {/* HMF */}
                    <div className="p-2.5 rounded-lg bg-slate-50 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Harbor Maintenance Fee (HMF)</span>
                        <span className="font-mono">${landedCostResult.hmfBreakdown.hmfAmountUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        19 C.F.R. § 24.24 • Mode: {landedCostResult.hmfBreakdown.transportationMode}
                      </div>
                      {landedCostResult.hmfBreakdown.isExempt && (
                        <div className="text-[10px] text-emerald-700">
                          {landedCostResult.hmfBreakdown.exemptionReason}
                        </div>
                      )}
                    </div>

                    {/* Inbound EMS Item Fee (19 C.F.R. § 24.22(l)) */}
                    {landedCostResult.inboundEmsFeeUSD !== undefined && (
                      <div className="p-2.5 rounded-lg bg-slate-50 space-y-1">
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span>Inbound EMS Item Fee</span>
                          <span className="font-mono">${landedCostResult.inboundEmsFeeUSD.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          19 C.F.R. § 24.22(l)(1)(i) • Statutory $1.00 fee per Inbound EMS item (USPS retains 50% for postal handling, remits 50% quarterly to CBP)
                        </div>
                        {landedCostResult.mpfBreakdown.inboundEmsFeeNote && (
                          <div className="text-[10px] text-slate-400">
                            {landedCostResult.mpfBreakdown.inboundEmsFeeNote}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Postal Entry Procedure Notice */}
                    {landedCostResult.postalEntryProcedure && (
                      <div
                        className={`p-2.5 rounded-lg text-[10px] leading-relaxed border ${landedCostResult.postalEntryProcedure === "FORMAL_MAIL_REQUIRED" ||
                            landedCostResult.postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY"
                            ? "bg-amber-50 text-amber-900 border-amber-200"
                            : landedCostResult.postalEntryProcedure === "INFORMAL_MAIL" ||
                              landedCostResult.postalEntryProcedure === "INFORMAL_MAIL_EXTENDED" ||
                              landedCostResult.postalEntryProcedure === "VOLUNTARY_TEST_ENTRY_TYPE_13"
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                      >
                        <div className="font-semibold">
                          Postal Entry:{" "}
                          {landedCostResult.postalEntryProcedure === "FORMAL_MAIL_REQUIRED"
                            ? "Formal Entry Required (CBP Form 7501)"
                            : landedCostResult.postalEntryProcedure === "VOLUNTARY_FORMAL_EARLY"
                              ? "Voluntary Early Formal Entry (CBP Form 7501)"
                              : landedCostResult.postalEntryProcedure === "VOLUNTARY_TEST_ENTRY_TYPE_13"
                                ? "Voluntary Entry Type 13 Test Pilot"
                                : landedCostResult.postalEntryProcedure === "INFORMAL_MAIL_EXTENDED"
                                  ? "Informal Postal Clearance (CBP Oct 22 Extension)"
                                  : landedCostResult.postalEntryProcedure === "INFORMAL_MAIL"
                                    ? "Informal Postal Clearance Eligible"
                                    : "Unresolved Postal Classification"}
                        </div>
                        {landedCostResult.postalEntryProcedureNotice && (
                          <div className="mt-0.5 opacity-90">
                            {landedCostResult.postalEntryProcedureNotice}
                          </div>
                        )}
                        {landedCostResult.postalRuleExtensionNotice && (
                          <div className="mt-1 text-[9px] text-slate-500 border-t border-slate-200/60 pt-1">
                            {landedCostResult.postalRuleExtensionNotice}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Conditional Scenarios (e.g. for Darjeeling tea) */}
              {landedCostResult.conditionalScenarios && landedCostResult.conditionalScenarios.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Statutory Scenario Bounds (Unresolved Exemption Scope)</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Official publication of USTR Annex II Part A agricultural exclusions is awaiting final administrative clarification. The calculation models both bounding scenarios:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {landedCostResult.conditionalScenarios.map((sc, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-amber-200 space-y-1.5">
                        <div className="font-semibold text-slate-900">{sc.scenarioName}</div>
                        <div className="flex justify-between text-slate-700">
                          <span>Effective Tariff Rate:</span>
                          <span className="font-bold">{sc.applicableDutyRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Estimated Landed Cost:</span>
                          <span className="font-bold font-mono">${sc.estimatedLandedCostUSD.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{sc.conditionRequired}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advisory Warnings */}
              {landedCostResult.advisoryWarnings && landedCostResult.advisoryWarnings.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-600" />
                    <span>Customs Valuation Advisory Warnings:</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] space-y-1 text-slate-600">
                    {landedCostResult.advisoryWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Statutory Compliance Notice */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Statutory Compliance Notice (19 U.S.C. § 1484)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  {landedCostResult.disclaimer} Under U.S. customs law (19 U.S.C. § 1484), the legal obligation to exercise reasonable care in declaring classification, value, and applicable duties upon entry into the United States rests with the U.S. Importer of Record. This calculation is deterministic and grounded in USITC 2026 Revision 22 and official Federal Register schedules, but does not constitute a legally binding classification or valuation ruling under 19 C.F.R. Part 177.
                </p>
              </div>

              {/* Bottom Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setActiveStep(3)}
                  className="text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Return to Step 3 (Classification)</span>
                </Button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Link href="/corridor/india-usa">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="text-xs text-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      <span>View Trade Rules</span>
                    </Button>
                  </Link>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleProceedToInvoice}
                    className="text-xs font-semibold shadow-sm flex items-center gap-1.5"
                  >
                    <span>Proceed to Commercial Invoice (Step 5)</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Export Commercial Invoice Generation */}
      {activeStep === 5 && (
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-line bg-card rounded-[22px] shadow-sm overflow-hidden">
            <CardHeader className="bg-bg/70 border-b border-line pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" className="text-[10px] tracking-wide uppercase font-semibold">
                      Draft for Review Only
                    </Badge>
                    <span className="text-xs text-mute font-medium">Step 5 of 5 • Export Documentation</span>
                  </div>
                  <CardTitle className="font-heading text-2xl font-bold text-text">
                    Export Commercial Invoice
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-mute">
                    Generate, verify, edit, and download a professional commercial invoice for export to the United States.
                  </CardDescription>
                </div>

                {/* Tab Switcher & Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateInvoiceDraft();
                        setInvoiceViewTab("preview");
                      }}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all ${invoiceViewTab === "preview"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Document Preview</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceViewTab("edit")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all ${invoiceViewTab === "edit"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Details</span>
                      </span>
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveInvoiceToDatabase}
                    disabled={isSavingInvoice}
                    className="text-xs bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                  >
                    {isSavingInvoice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        <span>Save Draft</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Status Feedback Messages */}
          {saveInvoiceSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveInvoiceSuccess}</span>
              </div>
              {savedInvoiceId && (
                <a
                  href={`/api/invoices/${savedInvoiceId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline ml-4"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Stored PDF</span>
                </a>
              )}
            </div>
          )}

          {saveInvoiceError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveInvoiceError}</span>
            </div>
          )}

          {/* VIEW: DOCUMENT PREVIEW */}
          {invoiceViewTab === "preview" && (
            <div className="space-y-6">
              {invoiceDraft ? (
                <>
                  <CommercialInvoicePreview
                    invoice={invoiceDraft}
                    onEdit={() => setInvoiceViewTab("edit")}
                    onReturnToLandedCost={() => setActiveStep(4)}
                  />

                  {/* PayPal Sandbox Checkout Integration (Sprint 6) */}
                  <PayPalSandboxCheckout
                    invoice={invoiceDraft}
                    savedInvoiceId={savedInvoiceId}
                    onInvoiceSaved={(id) => setSavedInvoiceId(id)}
                    onPaymentSuccess={() => {
                      if (typeof window !== "undefined") {
                        try {
                          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                        } catch {
                          // ignore
                        }
                      }
                    }}
                  />
                </>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-600">No draft commercial invoice loaded.</p>
                  <Button
                    type="button"
                    onClick={handleProceedToInvoice}
                    className="text-xs bg-sky-600 text-white"
                  >
                    Generate Initial Draft
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* VIEW: EDIT INVOICE DETAILS FORM */}
          {invoiceViewTab === "edit" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Exporter / Seller Details */}
                <Card className="border-slate-200/90 shadow-sm">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-sky-700" />
                      <CardTitle className="text-sm font-semibold text-slate-800">
                        1. Exporter / Seller Information (India)
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Legal Business Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sellerBusinessName}
                        onChange={(e) => setSellerBusinessName(e.target.value)}
                        placeholder="e.g. Royal Heritage Crafts LLP"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sellerAddress}
                        onChange={(e) => setSellerAddress(e.target.value)}
                        placeholder="e.g. Plot 42, Sitapura Industrial Area"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          value={sellerCity}
                          onChange={(e) => setSellerCity(e.target.value)}
                          placeholder="Jaipur"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">State</label>
                        <input
                          type="text"
                          value={sellerState}
                          onChange={(e) => setSellerState(e.target.value)}
                          placeholder="Rajasthan"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">PIN / Postal</label>
                        <input
                          type="text"
                          value={sellerPostalCode}
                          onChange={(e) => setSellerPostalCode(e.target.value)}
                          placeholder="302022"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={sellerEmail}
                          onChange={(e) => setSellerEmail(e.target.value)}
                          placeholder="exports@example.in"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Phone <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={sellerPhone}
                          onChange={(e) => setSellerPhone(e.target.value)}
                          placeholder="+91 141 277 0000"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    {/* Exporter Regulatory Identifiers */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                        <span>Indian Regulatory Identifiers (Optional for Draft)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        BorderBrief AI does NOT invent or fabricate registration IDs. Leave blank if not yet issued.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-600 mb-0.5">IEC (10-digit)</label>
                          <input
                            type="text"
                            value={sellerIec}
                            onChange={(e) => setSellerIec(e.target.value.toUpperCase())}
                            placeholder="Optional"
                            maxLength={10}
                            className="w-full px-2 py-1 font-mono border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-600 mb-0.5">GSTIN</label>
                          <input
                            type="text"
                            value={sellerGstin}
                            onChange={(e) => setSellerGstin(e.target.value.toUpperCase())}
                            placeholder="Optional"
                            maxLength={15}
                            className="w-full px-2 py-1 font-mono border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-600 mb-0.5">LUT ARN</label>
                          <input
                            type="text"
                            value={sellerLutArn}
                            onChange={(e) => setSellerLutArn(e.target.value.toUpperCase())}
                            placeholder="Optional"
                            className="w-full px-2 py-1 font-mono border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Buyer / Consignee Details */}
                <Card className="border-slate-200/90 shadow-sm">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-sky-700" />
                      <CardTitle className="text-sm font-semibold text-slate-800">
                        2. Buyer / Consignee (United States)
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Buyer / Company Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="e.g. Manhattan Heritage Goods LLC"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={buyerAddress}
                        onChange={(e) => setBuyerAddress(e.target.value)}
                        placeholder="e.g. 350 Fifth Avenue, Suite 4800"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          value={buyerCity}
                          onChange={(e) => setBuyerCity(e.target.value)}
                          placeholder="New York"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">State</label>
                        <input
                          type="text"
                          value={buyerState}
                          onChange={(e) => setBuyerState(e.target.value)}
                          placeholder="NY"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">ZIP Code</label>
                        <input
                          type="text"
                          value={buyerPostalCode}
                          onChange={(e) => setBuyerPostalCode(e.target.value)}
                          placeholder="10118"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                          placeholder="buyer@example.com"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          placeholder="+1 (212) 555-0100"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-50/60 border border-sky-200 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={buyerIsIor}
                        onChange={(e) => setBuyerIsIor(e.target.checked)}
                        className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                      />
                      <div className="text-slate-800">
                        <div className="font-semibold text-xs">Buyer is Importer of Record (IOR)</div>
                        <div className="text-[10px] text-slate-600 leading-normal mt-0.5">
                          Under 19 U.S.C. § 1484, the IOR is legally responsible for U.S. customs entry, compliance, and duty payment upon arrival.
                        </div>
                      </div>
                    </label>
                  </CardContent>
                </Card>
              </div>

              {/* 3. Shipment & Commercial Terms */}
              <Card className="border-slate-200/90 shadow-sm">
                <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-700" />
                    <CardTitle className="text-sm font-semibold text-slate-800">
                      3. Shipment & Commercial Incoterms®
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Incoterm Rule</label>
                      <select
                        value={invoiceIncoterm}
                        onChange={(e) => setInvoiceIncoterm(e.target.value as IncotermRule)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 bg-white"
                      >
                        <option value="DAP">DAP — Delivered at Place (Standard)</option>
                        <option value="FOB">FOB — Free on Board</option>
                        <option value="CIF">CIF — Cost, Insurance & Freight</option>
                        <option value="EXW">EXW — Ex Works</option>
                        <option value="DDP">DDP — Delivered Duty Paid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Transit Shipping (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                        placeholder="15.00"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-medium text-slate-700">Cargo Insurance (USD)</label>
                        <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInsuranceCharged}
                            onChange={(e) => {
                              setIsInsuranceCharged(e.target.checked);
                              if (!e.target.checked) setInvoiceInsuranceUSD("0");
                            }}
                            className="rounded text-sky-600"
                          />
                          <span>Agreed with buyer</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!isInsuranceCharged}
                        value={isInsuranceCharged ? invoiceInsuranceUSD : "0"}
                        onChange={(e) => setInvoiceInsuranceUSD(e.target.value)}
                        placeholder="0.00 (Optional under DAP)"
                        className={`w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 ${!isInsuranceCharged ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white"
                          }`}
                      />
                      <span className="text-[9px] text-slate-500 block mt-0.5">
                        Optional under DAP. Seller is not obligated to procure insurance.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                    <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Financial Separation Notice: </span>
                      Under Incoterms® 2020 DAP (Delivered at Place), the Seller Commercial Invoice Total equals{" "}
                      <span className="font-semibold font-mono text-slate-900">Merchandise Subtotal + International Shipping (+ Cargo Insurance if agreed)</span>.
                      Under DAP, the seller is NOT required to provide cargo insurance. Estimated U.S. customs duties and CBP user fees are assessed separately upon arrival and must{" "}
                      <span className="underline font-semibold">NEVER</span> be included in this commercial invoice total.
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Exporter Declaration & Signatory */}
              <Card className="border-slate-200/90 shadow-sm">
                <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-700" />
                    <CardTitle className="text-sm font-semibold text-slate-800">
                      4. Exporter Legal Declaration
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-xs italic">
                    &quot;We declare that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that the goods are of Indian origin.&quot;
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={invoiceDeclarationConfirmed}
                      onChange={(e) => setInvoiceDeclarationConfirmed(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span className="font-semibold text-slate-900">
                      I confirm and authorize this declaration statement on behalf of the exporter.
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Signatory Name</label>
                      <input
                        type="text"
                        value={invoiceSignatoryName}
                        onChange={(e) => setInvoiceSignatoryName(e.target.value)}
                        placeholder="e.g. K. Y. Vardhan"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Signatory Title</label>
                      <input
                        type="text"
                        value={invoiceSignatoryTitle}
                        onChange={(e) => setInvoiceSignatoryTitle(e.target.value)}
                        placeholder="Managing Partner / Exporter"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setActiveStep(4)}
                  className="text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Back to Step 4 (Landed Cost)</span>
                </Button>

                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleSaveInvoiceToDatabase}
                    disabled={isSavingInvoice}
                    className="text-xs bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                  >
                    {isSavingInvoice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        <span>Saving Draft...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        <span>Save Draft to DB</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => {
                      handleUpdateInvoiceDraft();
                      setInvoiceViewTab("preview");
                    }}
                    className="text-xs font-semibold shadow-sm flex items-center gap-1.5"
                  >
                    <span>Update & View Preview</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
