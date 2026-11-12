"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Info,
  Lock,
  XCircle,
  FileText,
} from "lucide-react";
import type { CommercialInvoiceDraft } from "@/types/invoice";
import type { CaptureOrderResponse, PayPalConfigResponse } from "@/types/payment";

interface PayPalButtonsActions {
  resolve: () => void;
  reject: () => void;
}

interface PayPalButtonsComponent {
  render: (element: HTMLElement) => Promise<void>;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
        style?: Record<string, string | number>;
      }) => PayPalButtonsComponent;
    };
  }
}

interface PayPalSandboxCheckoutProps {
  invoice: CommercialInvoiceDraft;
  savedInvoiceId?: string | null;
  onInvoiceSaved?: (invoiceId: string) => void;
  onPaymentSuccess?: (capture: CaptureOrderResponse) => void;
}

export function PayPalSandboxCheckout({
  invoice,
  savedInvoiceId,
  onInvoiceSaved,
  onPaymentSuccess,
}: PayPalSandboxCheckoutProps) {
  const [config, setConfig] = useState<PayPalConfigResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [verifiedCapture, setVerifiedCapture] = useState<CaptureOrderResponse | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRenderedRef = useRef(false);

  // 1. Fetch public PayPal client config
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch("/api/payments/paypal/config");
        if (res.ok) {
          const data = (await res.json()) as PayPalConfigResponse;
          if (isMounted) setConfig(data);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoadingConfig(false);
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Dynamically load official PayPal JS SDK when credentials are configured
  useEffect(() => {
    if (!config?.isConfigured || !config.clientId) return;

    const existingScript = document.getElementById("paypal-sdk-script");
    if (existingScript) {
      setTimeout(() => {
        setSdkLoaded(true);
      }, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      config.clientId
    )}&currency=${encodeURIComponent(invoice.currency || "USD")}&intent=capture`;
    script.async = true;

    script.onload = () => setSdkLoaded(true);
    script.onerror = () => {
      setCheckoutError("Failed to load PayPal Sandbox SDK. Check network connectivity or client credentials.");
    };

    document.body.appendChild(script);

    return () => {
      // Keep script cached
    };
  }, [config, invoice.currency]);

  // Ensure invoice is saved to database before calling create-order
  const ensureInvoicePersisted = useCallback(async (): Promise<string> => {
    if (savedInvoiceId) return savedInvoiceId;

    setStatusMessage("Saving commercial invoice draft to database...");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: invoice.productId,
        calculationId: invoice.calculationId,
        seller: invoice.seller,
        buyer: invoice.buyer,
        shipment: invoice.shipment,
        items: invoice.items,
        declaration: invoice.declaration,
        landedCostResult: invoice.estimatedImportCosts ? {
          dutiableCustomsValueUSD: invoice.estimatedImportCosts.dutiableValueUSD,
          status: invoice.estimatedImportCosts.calculationStatus,
          dutyBreakdown: {
            baseDutyAmountUSD: invoice.estimatedImportCosts.baseCustomsDutyUSD,
            section301: { additionalDutyAmountUSD: invoice.estimatedImportCosts.section301DutyUSD },
            totalDutyAmountUSD: invoice.estimatedImportCosts.totalCustomsDutyUSD,
          },
          mpfBreakdown: { finalMpfAmountUSD: invoice.estimatedImportCosts.merchandiseProcessingFeeUSD },
          hmfBreakdown: { hmfAmountUSD: invoice.estimatedImportCosts.harborMaintenanceFeeUSD },
          inboundEmsFeeUSD: invoice.estimatedImportCosts.inboundEmsFeeUSD,
          totalCustomsFeesUSD: invoice.estimatedImportCosts.totalCustomsFeesUSD,
        } : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to persist commercial invoice before starting payment.");
    }

    const saved = await res.json();
    if (onInvoiceSaved) onInvoiceSaved(saved.id);
    return saved.id;
  }, [savedInvoiceId, invoice, onInvoiceSaved]);

  // 3. Render PayPal Buttons
  useEffect(() => {
    if (!sdkLoaded || !window.paypal || !buttonContainerRef.current) return;
    if (buttonsRenderedRef.current || verifiedCapture) return;

    buttonsRenderedRef.current = true;
    buttonContainerRef.current.innerHTML = "";

    try {
      window.paypal
        .Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: 40,
          },
          createOrder: async () => {
            setCheckoutError(null);
            setIsCancelled(false);
            setIsProcessing(true);
            setStatusMessage("Creating secure PayPal Sandbox order...");

            try {
              const invId = await ensureInvoicePersisted();

              const response = await fetch("/api/payments/paypal/create-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-idempotency-key": `idemp_order_${invId}_${Date.now()}`,
                },
                body: JSON.stringify({ invoiceId: invId }),
              });

              if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || "Failed to create PayPal Sandbox order.");
              }

              const orderData = await response.json();
              setStatusMessage("Waiting for PayPal Sandbox buyer authorization...");
              return orderData.orderId;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error initiating checkout";
              setCheckoutError(msg);
              setIsProcessing(false);
              setStatusMessage(null);
              throw err;
            }
          },
          onApprove: async (data: { orderID: string }) => {
            setIsProcessing(true);
            setStatusMessage("Capturing and verifying payment server-side...");

            try {
              const response = await fetch("/api/payments/paypal/capture-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-idempotency-key": `idemp_cap_${data.orderID}_${Date.now()}`,
                },
                body: JSON.stringify({ orderId: data.orderID }),
              });

              if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || "Server-side payment verification failed.");
              }

              const captureData = (await response.json()) as CaptureOrderResponse;

              // Strictly verify server confirmed COMPLETED status
              if (captureData.status !== "COMPLETED") {
                throw new Error(`Payment not completed. Current status: ${captureData.status}`);
              }

              setVerifiedCapture(captureData);
              setStatusMessage(null);
              setIsProcessing(false);
              onPaymentSuccess?.(captureData);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error capturing PayPal order";
              setCheckoutError(msg);
              setIsProcessing(false);
              setStatusMessage(null);
            }
          },
          onCancel: () => {
            setIsProcessing(false);
            setStatusMessage(null);
            setIsCancelled(true);
          },
          onError: (err: unknown) => {
            setIsProcessing(false);
            setStatusMessage(null);
            const msg = err instanceof Error ? err.message : "PayPal popup window error";
            setCheckoutError(`PayPal Checkout Error: ${msg}`);
          },
        })
        .render(buttonContainerRef.current)
        .catch((err) => {
          setCheckoutError(`Failed to render PayPal Buttons: ${err?.message || "Unknown error"}`);
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error rendering buttons";
      setTimeout(() => {
        setCheckoutError(`Failed to initialize PayPal Checkout: ${msg}`);
      }, 0);
    }
  }, [sdkLoaded, ensureInvoicePersisted, verifiedCapture, onPaymentSuccess]);

  const currencySymbol = invoice.currency === "USD" ? "$" : `${invoice.currency} `;
  const isInsuranceIncluded = Boolean(invoice.shipment?.isInsuranceIncluded);
  const insuranceAmount = isInsuranceIncluded ? Number(invoice.insuranceCostUSD || 0) : 0;

  return (
    <Card className="border-amber-200/90 bg-amber-50/20 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-slate-50 border-b border-amber-200/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600 rounded-lg text-white shadow-sm">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>PayPal Sandbox Checkout</span>
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-2">
                  PAYPAL SANDBOX — TEST PAYMENT ONLY
                </Badge>
              </CardTitle>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Secure buyer checkout for Indian MSME export commercial invoices under Incoterms® 2020 DAP.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 font-mono">
              CORRIDOR: IN → US
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-800">
              INCOTERM: DAP
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Financial Separation Summary Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: What is Included in PayPal Payment */}
          <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Charges Collected via PayPal</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Seller Receivables</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Merchandise Subtotal:</span>
                <span className="font-mono text-slate-800">
                  {currencySymbol}
                  {Number(invoice.subtotalUSD || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>International Shipping ({invoice.shipment?.transportationMode || "POSTAL"}):</span>
                <span className="font-mono text-slate-800">
                  {currencySymbol}
                  {Number(invoice.shippingCostUSD || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cargo Insurance (Optional under DAP):</span>
                <span className="font-mono text-slate-800">
                  {insuranceAmount > 0 ? `${currencySymbol}${Number(insuranceAmount).toFixed(2)}` : "Not Charged ($0.00)"}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>PayPal Order Total:</span>
                <span className="font-mono text-amber-700 text-base">
                  {currencySymbol}
                  {Number(invoice.invoiceTotalUSD || 0).toFixed(2)} {invoice.currency || "USD"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: What is STRICTLY EXCLUDED (Customs Duties & Fees) */}
          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>Excluded from PayPal Payment</span>
              </span>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px]">U.S. Import Costs</Badge>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong className="font-semibold">Notice: </strong>
              Estimated U.S. import duties and customs charges are <span className="underline font-semibold">NOT</span> collected through this PayPal payment.
            </p>

            {invoice.estimatedImportCosts ? (
              <div className="text-[11px] text-amber-900/90 space-y-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                <div className="flex justify-between">
                  <span>Estimated Customs Duty (Base + Sec 301):</span>
                  <span className="font-mono font-semibold">${Number(invoice.estimatedImportCosts.totalCustomsDutyUSD || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customs User Fees (MPF / EMS / HMF):</span>
                  <span className="font-mono font-semibold">${Number(invoice.estimatedImportCosts.totalCustomsFeesUSD || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-amber-200/50 pt-1 font-bold text-amber-950">
                  <span>Payable upon U.S. Arrival (by Buyer):</span>
                  <span className="font-mono">${Number(invoice.estimatedImportCosts.totalEstimatedImportChargesUSD || 0).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-amber-700 italic">
                U.S. customs entry and import fees will be assessed by CBP upon arrival in the United States under 19 U.S.C. § 1484.
              </p>
            )}
          </div>
        </div>

        {/* Status & Alerts Section */}
        {checkoutError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Checkout Encountered an Issue:</span>
              <p className="text-rose-700">{checkoutError}</p>
            </div>
          </div>
        )}

        {isCancelled && !checkoutError && !verifiedCapture && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2 shadow-sm">
            <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>PayPal Sandbox payment was cancelled by the buyer. You can restart checkout at any time.</span>
          </div>
        )}

        {isProcessing && statusMessage && (
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sky-800 text-xs flex items-center gap-3 shadow-sm animate-pulse">
            <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* VERIFIED PAYMENT SUCCESS RESULT */}
        {verifiedCapture ? (
          <div className="p-5 bg-emerald-50/70 border-2 border-emerald-400 rounded-xl shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-full text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Payment Verified Successfully (PayPal Sandbox)
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    Server-side capture confirmed under official PayPal Orders API v2.
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                STATUS: COMPLETED
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-lg border border-emerald-200/80">
              <div>
                <span className="text-[10px] text-slate-500 block">PayPal Order ID</span>
                <span className="font-mono font-semibold text-slate-800 text-[11px] break-all">
                  {verifiedCapture.paypalOrderId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">PayPal Capture ID</span>
                <span className="font-mono font-semibold text-emerald-800 text-[11px] break-all">
                  {verifiedCapture.captureId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Amount Captured</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ${Number(verifiedCapture.amount || 0).toFixed(2)} {verifiedCapture.currency || "USD"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Payer Account</span>
                <span className="text-slate-700 font-medium text-[11px] truncate block">
                  {verifiedCapture.payerEmail || verifiedCapture.payerName || "Sandbox Buyer"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-emerald-800 pt-1">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Invoice status updated to <strong className="font-semibold text-emerald-950">PAID</strong> in local SQLite database.</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {verifiedCapture.capturedAt ? new Date(verifiedCapture.capturedAt).toLocaleString() : ""}
              </span>
            </div>
          </div>
        ) : (
          /* CHECKOUT INTERACTION CONTAINER */
          <div className="space-y-4">
            {isLoadingConfig ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span>Checking PayPal Sandbox configuration...</span>
              </div>
            ) : !config?.isConfigured ? (
              /* UNCONFIGURED CREDENTIALS NOTICE */
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900">
                      PayPal Sandbox Credentials Not Configured
                    </h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      BorderBrief AI integrates with the official PayPal Sandbox API. Because no Sandbox credentials were found in your local environment, live button rendering is paused.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 space-y-1">
                  <span className="text-[10px] font-sans font-semibold text-slate-500 block mb-1">
                    To test Sandbox payments, create a free Sandbox app at developer.paypal.com and set:
                  </span>
                  <div>PAYPAL_CLIENT_ID=&quot;your_sandbox_client_id&quot;</div>
                  <div>PAYPAL_CLIENT_SECRET=&quot;your_sandbox_client_secret&quot;</div>
                  <div>PAYPAL_BASE_URL=&quot;https://api-m.sandbox.paypal.com&quot;</div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="italic">
                    Strict Zero-Simulation Policy: Mock successful payments are never fabricated without server-side verification.
                  </span>
                  <a
                    href="https://developer.paypal.com/dashboard/applications/sandbox"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline"
                  >
                    <span>PayPal Developer Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              /* CONFIGURED — BUTTON RENDER AREA */
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>PayPal Sandbox API connected securely. Ready to test checkout.</span>
                  </div>
                  <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">
                    Sandbox Account Required
                  </Badge>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center space-y-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Pay with PayPal Sandbox Buyer Account:
                  </span>

                  {/* PayPal Buttons rendered here */}
                  <div ref={buttonContainerRef} className="w-full max-w-sm min-h-[44px]" />

                  <span className="text-[10px] text-slate-400">
                    Test payment will be captured server-side and recorded in local SQLite database.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

