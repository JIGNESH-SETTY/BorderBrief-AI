"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommercialInvoicePreview } from "@/components/invoice/commercial-invoice-preview";
import type { CommercialInvoiceDraft } from "@/types/invoice";
import type { PaymentStatus } from "@/types/payment";
import {
  Receipt,
  FileText,
  Download,
  Eye,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  ArrowRight,
  FilePlus,
  ShieldCheck,
  Building,
  Calendar,
  X,
  Trash2,
} from "lucide-react";

interface EnrichedInvoice extends CommercialInvoiceDraft {
  payment?: {
    id: string;
    paypalOrderId: string;
    paypalCaptureId: string | null;
    status: PaymentStatus;
    amount: number;
    currency: string;
    captureTime: string | null;
  } | null;
}

export default function InvoicesHistoryPage() {
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewInvoice, setPreviewInvoice] = useState<EnrichedInvoice | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<EnrichedInvoice | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/invoices?limit=50&offset=0");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load invoices (HTTP ${res.status})`);
      }
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error retrieving invoices";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

  const handleDeleteInvoice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this invoice draft? This action cannot be undone.")) {
      return;
    }
    setIsDeletingId(id);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete invoice");
      }
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      if (previewInvoice?.id === id) setPreviewInvoice(null);
      if (receiptPayment?.id === id) setReceiptPayment(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting invoice");
    } finally {
      setIsDeletingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.buyer?.name?.toLowerCase().includes(q) ||
      inv.buyer?.city?.toLowerCase().includes(q) ||
      inv.items?.[0]?.description?.toLowerCase().includes(q) ||
      inv.status?.toLowerCase().includes(q) ||
      inv.payment?.paypalOrderId?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge variant="mint">PAID</Badge>;
      case "REFUNDED":
        return <Badge variant="warning">REFUNDED</Badge>;
      case "ISSUED":
        return <Badge variant="primary">ISSUED</Badge>;
      default:
        return <Badge variant="saffron">DRAFT</Badge>;
    }
  };

  const getPaymentBadge = (payment?: EnrichedInvoice["payment"]) => {
    if (!payment) {
      return <span className="text-xs text-mute font-mono">Unpaid</span>;
    }
    switch (payment.status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sea bg-sea-soft px-2.5 py-0.5 rounded-full border border-sea/20">
            <CheckCircle2 className="w-3 h-3 text-sea" />
            Verified Paid
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A5200] bg-saffron-soft px-2.5 py-0.5 rounded-full border border-saffron/20">
            Refunded
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sea bg-mint-soft px-2.5 py-0.5 rounded-full border border-mint/20">
            <Clock className="w-3 h-3 text-sea" />
            Approved
          </span>
        );
      case "FAILED":
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text bg-bg px-2.5 py-0.5 rounded-full border border-line">
            {payment.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Redesigned Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-line">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            Invoices &amp; receipts
          </h1>
          <p className="text-sm sm:text-base text-mute">
            Open saved drafts, download official PDF invoices and view verified PayPal Sandbox receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchInvoices}
            disabled={isLoading}
            className="btn-g inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/export/new"
            className="btn-p inline-flex items-center gap-1.5 px-5 py-2 rounded-full font-semibold text-xs transition-all shadow-sm"
          >
            <FilePlus className="w-3.5 h-3.5 text-[#1A1204]" />
            <span>New export</span>
          </Link>
        </div>
      </div>

      {/* Redesigned Note Banner */}
      <div className="note text-text">
        <ShieldCheck className="w-5 h-5 text-sea shrink-0" />
        <span className="text-[13.5px] sm:text-sm">
          <strong className="text-text font-bold">Saved on this device.</strong> Invoices and payments live locally in <code>borderbrief.db</code>. No payment credentials are stored. Single-user demo mode.
        </span>
      </div>

      {/* Search Bar & Counter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-mute absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search by invoice number, buyer, city or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-line bg-card text-xs sm:text-sm text-text placeholder:text-mute focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20 transition-all shadow-sm"
          />
        </div>

        <div className="text-xs text-mute flex items-center gap-2">
          <span>{filteredInvoices.length} of {invoices.length} invoice(s)</span>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <Card className="border-rose-200 bg-rose-50 text-rose-900 p-4 rounded-[18px]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-rose-950">Failed to load invoices</h4>
              <p className="text-xs text-rose-800">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInvoices}
                className="mt-2 text-xs border-rose-300 text-rose-900 hover:bg-rose-100 rounded-full"
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-[22px] border border-line bg-card animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-32 h-4 bg-line rounded" />
                <div className="w-16 h-4 bg-line rounded" />
              </div>
              <div className="w-48 h-3 bg-bg rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State matching Design file with Slanted Document */}
      {!isLoading && !errorMessage && filteredInvoices.length === 0 && (
        <div className="text-center py-16 px-6 border-2 border-dashed border-line rounded-[22px] bg-card space-y-3">
          <div className="empty-doc" />
          <h3 className="font-heading text-2xl font-bold text-text">
            {searchQuery ? "No matching invoices found" : "No invoices yet"}
          </h3>
          <p className="text-sm text-mute max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? "Try adjusting your search query or clear the filter to view all drafts."
              : "Finish an export assessment and your commercial invoice draft will be saved here, ready to download."}
          </p>
          <div className="pt-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="btn-g px-5 py-2.5 rounded-full text-xs font-semibold"
              >
                Clear Search Filter
              </button>
            ) : (
              <Link
                href="/export/new"
                className="btn-p inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold shadow-md"
              >
                <FilePlus className="w-4 h-4 text-[#1A1204]" />
                <span>Start your first assessment</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Invoice List / Table */}
      {!isLoading && filteredInvoices.length > 0 && (
        <div className="space-y-3.5">
          {filteredInvoices.map((inv) => {
            const hasPayment = Boolean(inv.payment);
            const isPaid = inv.status === "PAID" || inv.payment?.status === "COMPLETED";

            return (
              <div
                key={inv.id}
                className={`p-5 sm:p-6 rounded-[22px] border bg-card hover:border-sea/40 hover:shadow-sm transition-all overflow-hidden ${
                  isPaid ? "border-mint/50" : "border-line"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Number, Buyer, Date */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-text tracking-tight">
                        {inv.invoiceNumber}
                      </span>
                      {getStatusBadge(inv.status)}
                      {getPaymentBadge(inv.payment)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-mute shrink-0" />
                        <span className="font-medium text-text">{inv.buyer?.name || "U.S. Buyer"}</span>
                        {inv.buyer?.city && <span className="text-mute">• {inv.buyer.city}, {inv.buyer.country || "US"}</span>}
                      </span>

                      <span className="flex items-center gap-1 text-mute">
                        <Calendar className="w-3.5 h-3.5 text-mute shrink-0" />
                        <span>{inv.shipment?.invoiceDate || inv.createdAt?.slice(0, 10)}</span>
                      </span>

                      <span className="text-[11px] font-mono text-mute bg-bg px-2 py-0.5 rounded-full border border-line">
                        {inv.shipment?.incoterm || "DAP"}
                      </span>
                    </div>

                    {/* Line item summary */}
                    <p className="text-xs text-mute truncate max-w-xl">
                      {inv.items?.[0]?.description || "Export Merchandise"}
                      {inv.items?.[0]?.quantity ? ` (${inv.items[0].quantity} pcs)` : ""}
                    </p>
                  </div>

                  {/* Middle Column: Financial Amount */}
                  <div className="text-left md:text-right shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-line">
                    <div className="text-[11px] font-semibold text-mute uppercase tracking-wider">
                      Invoice Total
                    </div>
                    <div className="font-mono font-extrabold text-lg text-text">
                      ${Number(inv.invoiceTotalUSD || 0).toFixed(2)}{" "}
                      <span className="text-xs font-normal text-mute">{inv.currency || "USD"}</span>
                    </div>
                    <div className="text-[10px] text-mute">
                      Excludes U.S. customs duties
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-line">
                    {/* View Preview Button */}
                    <button
                      type="button"
                      onClick={() => setPreviewInvoice(inv)}
                      className="btn-g inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold hover:text-sea"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    {/* Download PDF Button */}
                    <a
                      href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                      download={`${inv.invoiceNumber}.pdf`}
                      className="btn-p inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#1A1204] shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-[#1A1204]" />
                      <span>PDF</span>
                    </a>

                    {/* Payment Receipt / Status Button (if payment exists) */}
                    {hasPayment && (
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(inv)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-mint/40 text-sea bg-mint-soft hover:bg-mint-soft/80"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-sea" />
                        <span>Receipt</span>
                      </button>
                    )}

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteInvoice(inv.id, e)}
                      disabled={isDeletingId === inv.id}
                      className="p-2 rounded-full text-mute hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete invoice draft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-bg rounded-[24px] shadow-2xl border border-line max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-card border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sea" />
                <h3 className="font-heading font-bold text-sm text-text">
                  Commercial Invoice Preview — {previewInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="p-1.5 rounded-full text-mute hover:text-text hover:bg-bg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <CommercialInvoicePreview invoice={previewInvoice} />
            </div>

            <div className="flex items-center justify-between p-4 bg-card border-t border-line shrink-0">
              <span className="text-xs text-mute">
                Format: 19 U.S.C. § 1401a DAP Commercial Invoice
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/invoices/${encodeURIComponent(previewInvoice.id)}/pdf`}
                  download={`${previewInvoice.invoiceNumber}.pdf`}
                  className="btn-p inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#1A1204]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="btn-g px-4 py-2 rounded-full text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {receiptPayment && receiptPayment.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card rounded-[24px] shadow-2xl border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-mint" />
                <h3 className="font-heading font-bold text-base text-text">
                  PayPal Sandbox Payment Receipt
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPayment(null)}
                className="p-1.5 rounded-full text-mute hover:text-text hover:bg-bg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between py-1 border-b border-line">
                <span className="text-mute">Status:</span>
                <span className="font-bold text-sea">{receiptPayment.payment.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line">
                <span className="text-mute">Order ID:</span>
                <span className="font-mono text-text">{receiptPayment.payment.paypalOrderId}</span>
              </div>
              {receiptPayment.payment.paypalCaptureId && (
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-mute">Capture ID:</span>
                  <span className="font-mono text-text">{receiptPayment.payment.paypalCaptureId}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-line">
                <span className="text-mute">Amount:</span>
                <span className="font-bold font-mono text-text">
                  ${Number(receiptPayment.payment.amount).toFixed(2)} {receiptPayment.payment.currency}
                </span>
              </div>
              {receiptPayment.payment.captureTime && (
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-mute">Capture Time:</span>
                  <span className="text-text">{new Date(receiptPayment.payment.captureTime).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setReceiptPayment(null)}
                className="btn-g px-5 py-2 rounded-full text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
