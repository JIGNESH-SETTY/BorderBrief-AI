"use client";

import React, { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle,
  Building,
  User,
  Truck,
  ShieldAlert,
  Info,
  DollarSign,
  ArrowLeft,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CommercialInvoiceDraft } from "@/types/invoice";

interface CommercialInvoicePreviewProps {
  invoice: CommercialInvoiceDraft;
  onEdit?: () => void;
  onReturnToLandedCost?: () => void;
}

export function CommercialInvoicePreview({
  invoice,
  onEdit,
  onReturnToLandedCost,
}: CommercialInvoicePreviewProps) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate PDF (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber || "draft-commercial-invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "PDF download failed.";
      setDownloadError(msg);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const hasUnresolvedItems = Array.isArray(invoice?.items) && invoice.items.some(
    (item) => item.classificationStatus === "UNRESOLVED_AMBIGUITY"
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {onReturnToLandedCost && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReturnToLandedCost}
              className="text-xs text-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Landed Cost</span>
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="text-xs text-slate-700">
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              <span>Edit Invoice Details</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Print Invoice</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="text-xs font-semibold shadow-sm text-[#1A1204]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>{isDownloadingPdf ? "Generating PDF..." : "Download Draft PDF"}</span>
          </Button>
        </div>
      </div>

      {downloadError && (
        <div className="print:hidden p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Missing Required Fields Notice (if any) */}
      {!invoice?.isComplete && Array.isArray(invoice?.missingRequiredFields) && invoice.missingRequiredFields.length > 0 && (
        <div className="print:hidden p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Incomplete Draft Notice: The following required fields are missing</span>
          </div>
          <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
            {invoice.missingRequiredFields.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-700">
            You can still preview and download this draft, but all fields should be completed before commercial issuance.
          </p>
        </div>
      )}

      {/* Main Commercial Invoice Document (Print-ready) */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200/90 shadow-md relative overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Prominent Diagonal Draft Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-5 z-0">
          <span className="text-7xl sm:text-8xl font-black text-slate-900 -rotate-45 whitespace-nowrap tracking-widest">
            DRAFT — FOR REVIEW ONLY
          </span>
        </div>

        <div className="relative z-10 space-y-6">
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wider text-sky-800 uppercase bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    BorderBrief AI
                  </span>
                  <Badge variant="warning" className="text-[10px] tracking-wide uppercase font-semibold">
                    Draft for Review Only
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                  COMMERCIAL INVOICE
                </h1>
                <p className="text-xs text-slate-500">
                  Export Document • India (IN) → United States (US)
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-slate-700">INVOICE NUMBER</div>
                <div className="text-base font-mono font-bold text-slate-900">{invoice.invoiceNumber}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Date: <span className="font-medium text-slate-800">{invoice.shipment.invoiceDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seller & Buyer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exporter / Seller Box */}
            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-sky-700" />
                  <span>1. Exporter / Seller (India)</span>
                </span>
                <span className="text-[10px] text-slate-500">Origin</span>
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">
                  {invoice.seller.businessName || "Exporter Name Not Provided"}
                </div>
                <div className="text-xs text-slate-600 whitespace-pre-line mt-0.5">
                  {invoice.seller.address}
                </div>
                {(invoice.seller.city || invoice.seller.state || invoice.seller.postalCode) && (
                  <div className="text-xs text-slate-600">
                    {[invoice.seller.city, invoice.seller.state, invoice.seller.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                <div className="text-xs font-medium text-slate-700 mt-1">
                  Country: {invoice.seller.country || "India"}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-0.5">
                <div>Email: <span className="font-medium text-slate-800">{invoice.seller.email}</span></div>
                <div>Phone: <span className="font-medium text-slate-800">{invoice.seller.phone}</span></div>
                <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 pt-1">
                  <span>IEC: <span className="font-mono text-slate-800">{invoice.seller.iecNumber || "Unspecified"}</span></span>
                  <span>GSTIN: <span className="font-mono text-slate-800">{invoice.seller.gstin || "Unspecified"}</span></span>
                  {invoice.seller.lutArn && <span>LUT ARN: <span className="font-mono text-slate-800">{invoice.seller.lutArn}</span></span>}
                </div>
              </div>
            </div>

            {/* Buyer / Consignee Box */}
            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-700" />
                  <span>2. Buyer / Consignee (United States)</span>
                </span>
                <span className="text-[10px] text-slate-500">Destination</span>
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">
                  {invoice.buyer.name || "Buyer Name Not Provided"}
                </div>
                <div className="text-xs text-slate-600 whitespace-pre-line mt-0.5">
                  {invoice.buyer.address}
                </div>
                {(invoice.buyer.city || invoice.buyer.state || invoice.buyer.postalCode) && (
                  <div className="text-xs text-slate-600">
                    {[invoice.buyer.city, invoice.buyer.state, invoice.buyer.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                <div className="text-xs font-medium text-slate-700 mt-1">
                  Country: {invoice.buyer.country || "United States"}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-0.5">
                {invoice.buyer.email && <div>Email: <span className="font-medium text-slate-800">{invoice.buyer.email}</span></div>}
                {invoice.buyer.phone && <div>Phone: <span className="font-medium text-slate-800">{invoice.buyer.phone}</span></div>}
                <div className="text-[10px] text-slate-500 pt-1">
                  {invoice.buyer.isImporterOfRecord !== false ? (
                    <span className="text-emerald-700 font-medium">✓ Buyer is presumed Importer of Record</span>
                  ) : (
                    <span className="text-amber-700 font-medium">⚠ Separate Importer of Record Designated</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Shipment & Transport Strip */}
          <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200/80 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Export Corridor</span>
                <span className="font-medium text-slate-800">India → United States</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Transport Mode</span>
                <span className="font-medium text-slate-800">{invoice.shipment.transportationMode || "POSTAL"}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Delivery Term</span>
                <span className="font-semibold text-sky-800">{invoice.shipment.incoterm} (Incoterms® 2020)</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Origin of Goods</span>
                <span className="font-medium text-slate-800">{invoice.shipment.countryOfOrigin || "India"}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Packages / Weight</span>
                <span className="font-medium text-slate-800">
                  {invoice.shipment.totalPackages || 1} pkg
                  {invoice.shipment.grossWeightKg ? ` | ${invoice.shipment.grossWeightKg}kg` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Merchandise Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="bg-slate-900 text-white text-xs px-3 py-2 font-semibold grid grid-cols-12 gap-2">
                  <span className="col-span-1 text-center">#</span>
                  <span className="col-span-5">Product Description & Materials</span>
                  <span className="col-span-2">HTS-10 Code</span>
                  <span className="col-span-1 text-center">Qty</span>
                  <span className="col-span-1 text-right">Unit Price</span>
                  <span className="col-span-2 text-right">Total ({invoice.currency})</span>
                </div>

                <div className="divide-y divide-slate-200 text-xs bg-white">
                  {invoice.items.map((item, idx) => (
                    <div key={item.id} className="p-3 grid grid-cols-12 gap-2 items-start hover:bg-slate-50/50">
                      <span className="col-span-1 text-center font-medium text-slate-500">{idx + 1}</span>
                      <div className="col-span-5 space-y-0.5">
                        <div className="font-semibold text-slate-900">{item.description}</div>
                        {item.materialComposition && (
                          <div className="text-[11px] text-slate-600">Material: {item.materialComposition}</div>
                        )}
                        <div className="text-[10px] text-slate-500">Origin: {item.countryOfOrigin}</div>
                        {item.classificationWarning && (
                          <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1 pt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{item.classificationWarning}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="font-mono text-slate-800 font-medium">{item.hts10 || item.hs6 || "Unclassified"}</span>
                        {item.classificationStatus && (
                          <div className="pt-0.5">
                            <Badge
                              variant={
                                item.classificationStatus === "CLASSIFIED"
                                  ? "success"
                                  : item.classificationStatus === "ALTERNATIVE_CANDIDATES"
                                  ? "warning"
                                  : "outline"
                              }
                              className={`text-[9px] px-1 py-0 ${
                                item.classificationStatus === "UNRESOLVED_AMBIGUITY"
                                  ? "text-rose-700 border-rose-300 bg-rose-50"
                                  : ""
                              }`}
                            >
                              {item.classificationStatus}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <span className="col-span-1 text-center text-slate-800">
                        {item.quantity} {item.unitOfMeasure}
                      </span>
                      <span className="col-span-1 text-right text-slate-800">
                        ${Number(item.unitPriceUSD || 0).toFixed(2)}
                      </span>
                      <span className="col-span-2 text-right font-bold text-slate-900">
                        ${Number(item.totalPriceUSD || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary & Landed Cost Reference Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Informational Estimated U.S. Import Costs (Sprint 4 Integration) */}
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Estimated US Import Costs — For Reference</span>
                </span>
                {invoice.estimatedImportCosts && (
                  <Badge
                    variant={
                      invoice.estimatedImportCosts.calculationStatus === "VERIFIED" ? "success" : "warning"
                    }
                    className="text-[9px]"
                  >
                    {invoice.estimatedImportCosts.calculationStatus}
                  </Badge>
                )}
              </div>

              {invoice.estimatedImportCosts ? (
                <div className="space-y-1.5 text-amber-950">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-800">Dutiable Customs Value ({invoice.estimatedImportCosts.valuationStatutoryBasis || "19 U.S.C. § 1401a"}):</span>
                    <span className="font-mono font-medium">${Number(invoice.estimatedImportCosts.dutiableValueUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-800">Estimated Customs Duty (Base + Sec 301):</span>
                    <span className="font-mono font-medium">${Number(invoice.estimatedImportCosts.totalCustomsDutyUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-800">Customs Fees (MPF + EMS Fee):</span>
                    <span className="font-mono font-medium">${Number(invoice.estimatedImportCosts.totalCustomsFeesUSD || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-amber-200/80 flex justify-between font-bold text-xs text-amber-900">
                    <span>Total Estimated Import Charges:</span>
                    <span className="font-mono">${Number(invoice.estimatedImportCosts.totalEstimatedImportChargesUSD || 0).toFixed(2)} USD</span>
                  </div>
                  <p className="text-[10px] text-amber-700 leading-tight pt-1">
                    ⚠ <strong>Important Notice:</strong> Under Incoterm DAP, estimated U.S. import duties and fees are assessed by CBP and payable by the buyer/importer upon U.S. arrival. They are <strong>strictly excluded</strong> from the seller&apos;s invoice total.
                  </p>
                </div>
              ) : (
                <div className="text-xs text-amber-800 py-2">
                  No landed-cost calculation attached. U.S. import duties and customs fees will be assessed by CBP upon arrival.
                </div>
              )}
            </div>

            {/* Seller Commercial Invoice Total Box */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="font-bold text-slate-800 uppercase border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Commercial Financial Summary</span>
                <span className="text-[10px] text-slate-500 font-normal">Amounts in {invoice.currency || "USD"}</span>
              </div>
              <div className="space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Merchandise Subtotal:</span>
                  <span className="font-mono font-medium">${Number(invoice.subtotalUSD || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>International Shipping ({invoice.shipment?.incoterm || "DAP"}):</span>
                  <span className="font-mono font-medium">${Number(invoice.shippingCostUSD || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cargo Insurance (Optional under DAP):</span>
                  <span className="font-mono font-medium">
                    {Number(invoice.shipment?.insuranceCostUSD || 0) > 0
                      ? `$${Number(invoice.shipment.insuranceCostUSD).toFixed(2)}`
                      : "Not Charged ($0.00)"}
                  </span>
                </div>
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline font-bold text-sm text-slate-900">
                  <span>INVOICE TOTAL (SELLER):</span>
                  <span className="font-mono text-base text-sky-800">${Number(invoice.invoiceTotalUSD || 0).toFixed(2)} {invoice.currency || "USD"}</span>
                </div>
                <p className="text-[10px] text-slate-500 pt-0.5">
                  Amount payable by buyer to exporter for merchandise and transport.
                </p>
              </div>
            </div>
          </div>

          {/* Exporter Declaration & Signature Block */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3 text-xs">
            <div className="font-bold text-slate-800 uppercase text-[11px] border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>3. Exporter Truth Declaration & Authorized Signatory</span>
              <span className="text-[10px] text-slate-500">Legal Representation</span>
            </div>
            <p className="text-slate-700 italic text-[11px] leading-relaxed">
              &ldquo;{invoice.declaration.statement}&rdquo;
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5">
                {invoice.declaration.isConfirmedBySeller ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-800">
                      Confirmed by Exporter: {invoice.declaration.signatoryName || invoice.seller.businessName}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-semibold text-amber-800">Unconfirmed Draft</span>
                  </>
                )}
              </div>
              <div className="text-right text-[11px] text-slate-600">
                <div>Title: <span className="font-medium text-slate-800">{invoice.declaration.signatoryTitle || "Authorized Signatory"}</span></div>
                <div>Date: <span className="font-medium text-slate-800">{invoice.declaration.signatureDate || invoice.shipment.invoiceDate}</span></div>
              </div>
            </div>
          </div>

          {/* Statutory Disclaimers Footer */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1 leading-relaxed">
            <div className="font-semibold text-slate-700 uppercase">Statutory Notice & Legal Disclaimers:</div>
            {Array.isArray(invoice?.legalDisclaimers) && invoice.legalDisclaimers.map((disc, idx) => (
              <p key={idx}>• {disc}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
