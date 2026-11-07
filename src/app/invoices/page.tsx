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
        return <Badge variant="success">PAID</Badge>;
      case "REFUNDED":
        return <Badge variant="warning" className="bg-purple-100 text-purple-800 border-purple-200">REFUNDED</Badge>;
      case "ISSUED":
        return <Badge variant="primary">ISSUED</Badge>;
      default:
        return <Badge variant="warning">DRAFT</Badge>;
    }
  };

  const getPaymentBadge = (payment?: EnrichedInvoice["payment"]) => {
    if (!payment) {
      return <span className="text-xs text-slate-400 font-mono">Unpaid</span>;
    }
    switch (payment.status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified Paid
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            Refunded
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" />
            Approved
          </span>
        );
      case "FAILED":
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {payment.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Export Commercial Invoices & Receipts
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Retrieve saved draft invoices, download official binary PDF documents, and view verified PayPal Sandbox payment receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoices}
            disabled={isLoading}
            className="text-xs text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/export/new">
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs shadow-sm">
              <FilePlus className="w-3.5 h-3.5 mr-1.5" />
              <span>Create New Export</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Demo Mode Notice */}
      <div className="p-3 bg-sky-50 border border-sky-200/80 rounded-xl text-xs text-sky-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <strong>Local SQLite Persistence:</strong> Saved commercial invoices and payments are persisted locally in <code className="bg-sky-100 px-1 py-0.5 rounded font-mono text-[11px]">borderbrief.db</code>. No sensitive payment credentials are stored.
          </span>
        </div>
        <span className="text-[10px] font-mono text-sky-700 uppercase bg-sky-100/80 px-2 py-0.5 rounded shrink-0">
          Single-User Demo
        </span>
      </div>

      {/* Search Bar & Counter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice #, buyer name, city, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Showing <strong>{filteredInvoices.length}</strong> of {invoices.length} saved invoice(s)</span>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <Card className="border-rose-200 bg-rose-50 text-rose-900 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-rose-950">Failed to load invoices</h4>
              <p className="text-xs text-rose-800">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInvoices}
                className="mt-2 text-xs border-rose-300 text-rose-900 hover:bg-rose-100"
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
            <div key={i} className="p-5 rounded-xl border border-slate-200 bg-white animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-32 h-4 bg-slate-200 rounded" />
                <div className="w-16 h-4 bg-slate-200 rounded" />
              </div>
              <div className="w-48 h-3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMessage && filteredInvoices.length === 0 && (
        <Card className="border-slate-200 text-center py-12 px-6">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {searchQuery ? "No matching invoices found" : "No saved commercial invoices yet"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {searchQuery
                  ? "Try adjusting your search query or clear the filter to view all drafts."
                  : "Complete an export assessment to generate, save, and download an official commercial invoice draft."}
              </p>
            </div>
            {searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs"
              >
                Clear Search Filter
              </Button>
            ) : (
              <Link href="/export/new">
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs">
                  <FilePlus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Start First Assessment</span>
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Invoice List / Table */}
      {!isLoading && filteredInvoices.length > 0 && (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const hasPayment = Boolean(inv.payment);
            const isPaid = inv.status === "PAID" || inv.payment?.status === "COMPLETED";

            return (
              <Card
                key={inv.id}
                className={`border-slate-200/90 bg-white hover:border-sky-300 hover:shadow-sm transition-all overflow-hidden ${
                  isPaid ? "border-emerald-200/90" : ""
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Number, Buyer, Date */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900 tracking-tight">
                        {inv.invoiceNumber}
                      </span>
                      {getStatusBadge(inv.status)}
                      {getPaymentBadge(inv.payment)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{inv.buyer?.name || "U.S. Buyer"}</span>
                        {inv.buyer?.city && <span className="text-slate-400">• {inv.buyer.city}, {inv.buyer.country || "US"}</span>}
                      </span>

                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{inv.shipment?.invoiceDate || inv.createdAt?.slice(0, 10)}</span>
                      </span>

                      <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {inv.shipment?.incoterm || "DAP"}
                      </span>
                    </div>

                    {/* Line item summary */}
                    <p className="text-xs text-slate-500 truncate max-w-xl">
                      {inv.items?.[0]?.description || "Export Merchandise"}
                      {inv.items?.[0]?.quantity ? ` (${inv.items[0].quantity} pcs)` : ""}
                    </p>
                  </div>

                  {/* Middle Column: Financial Amount */}
                  <div className="text-left md:text-right shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Invoice Total
                    </div>
                    <div className="font-mono font-extrabold text-base sm:text-lg text-slate-900">
                      ${Number(inv.invoiceTotalUSD || 0).toFixed(2)}{" "}
                      <span className="text-xs font-normal text-slate-500">{inv.currency || "USD"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Excludes U.S. customs duties
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    {/* View Preview Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewInvoice(inv)}
                      className="text-xs text-slate-700 hover:text-sky-700 hover:bg-sky-50"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>Preview</span>
                    </Button>

                    {/* Download PDF Button */}
                    <a
                      href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                      download={`${inv.invoiceNumber}.pdf`}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-sky-700 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      <span>PDF</span>
                    </a>

                    {/* Payment Receipt / Status Button (if payment exists) */}
                    {hasPayment && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptPayment(inv)}
                        className="text-xs border-emerald-200 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/60"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Receipt</span>
                      </Button>
                    )}

                    {/* Delete Action */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteInvoice(inv.id, e)}
                      disabled={isDeletingId === inv.id}
                      className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2"
                      title="Delete invoice draft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Commercial Invoice Preview — {previewInvoice.invoiceNumber}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewInvoice(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <CommercialInvoicePreview invoice={previewInvoice} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <a
                href={`/api/invoices/${encodeURIComponent(previewInvoice.id)}/pdf`}
                download={`${previewInvoice.invoiceNumber}.pdf`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Draft PDF</span>
              </a>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewInvoice(null)}
                className="text-xs"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {receiptPayment && receiptPayment.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="text-sm font-bold">PayPal Sandbox Payment Receipt</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReceiptPayment(null)}
                className="text-white hover:bg-white/20 p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-sm text-emerald-950">
                  <span>Verified Payment Status</span>
                  <Badge variant="success">{receiptPayment.payment.status}</Badge>
                </div>
                <p className="text-[11px] text-emerald-800">
                  This transaction was verified server-side against the official PayPal Orders API v2.
                </p>
              </div>

              <div className="space-y-2 border-y border-slate-100 py-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Commercial Invoice Ref:</span>
                  <span className="font-mono font-bold text-slate-900">{receiptPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Charged to Buyer:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    ${Number(receiptPayment.payment.amount).toFixed(2)} {receiptPayment.payment.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PayPal Order ID:</span>
                  <span className="font-mono text-slate-800">{receiptPayment.payment.paypalOrderId}</span>
                </div>
                {receiptPayment.payment.paypalCaptureId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">PayPal Capture ID:</span>
                    <span className="font-mono text-slate-800">{receiptPayment.payment.paypalCaptureId}</span>
                  </div>
                )}
                {receiptPayment.payment.captureTime && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Capture Timestamp:</span>
                    <span className="text-slate-700">{receiptPayment.payment.captureTime}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 space-y-1">
                <strong className="text-slate-700 block">Statutory Customs Disclaimer:</strong>
                <p>
                  This payment covers exclusively the exporter&apos;s commercial receivables under Incoterms® DAP (merchandise subtotal and agreed transport). Under U.S. customs law, applicable import duties and customs fees are assessed upon arrival by CBP and payable by the U.S. Importer of Record.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReceiptPayment(null)}
                className="text-xs"
              >
                Close Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
