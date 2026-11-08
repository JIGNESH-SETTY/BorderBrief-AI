/**
 * BorderBrief AI — PayPal Webhook Listener API Route (Sprint 6)
 * POST /api/payments/paypal/webhook
 *
 * Responsibilities:
 * 1. Read PayPal transmission headers (ID, time, cert URL, auth algo, signature).
 * 2. Cryptographically verify signature via official PayPal API (POST /v1/notifications/verify-webhook-signature).
 * 3. Enforce idempotency: ignore already-processed webhook events.
 * 4. Process event types:
 *    - CHECKOUT.ORDER.APPROVED (sets status APPROVED, does NOT complete)
 *    - PAYMENT.CAPTURE.COMPLETED (sets status COMPLETED, updates invoice to PAID)
 *    - PAYMENT.CAPTURE.DENIED (sets status FAILED)
 *    - PAYMENT.CAPTURE.REFUNDED (sets status REFUNDED)
 * 5. State preservation: never downgrade an already COMPLETED payment.
 * 6. Audit logging in webhook_logs table.
 */

import { NextRequest, NextResponse } from "next/server.js";
import {
  saveWebhookLog,
  isWebhookEventProcessed,
  getPaymentByOrderId,
  getPaymentByCaptureId,
  getInvoice,
  updatePaymentStatus,
} from "../../../../../lib/db/database.ts";
import {
  verifyPayPalWebhookSignature,
  isPayPalConfigured,
  getPayPalConfig,
  getPayPalOrderDetails,
  getPayPalCaptureDetails,
  areAmountsEqual,
  PayPalError,
} from "../../../../../lib/paypal/paypal-client.ts";
import type { PayPalWebhookPayload } from "../../../../../types/payment.ts";

export async function POST(req: NextRequest) {
  try {
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";

    let eventPayload: PayPalWebhookPayload;
    try {
      eventPayload = (await req.json()) as PayPalWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in webhook payload.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const eventId = eventPayload.id;
    const eventType = eventPayload.event_type;

    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: "Webhook event missing mandatory id or event_type.", code: "INVALID_WEBHOOK_EVENT" },
        { status: 400 }
      );
    }

    // 1. Mandatory Signature Headers Presence Check
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      await saveWebhookLog(eventId, eventType, eventPayload, "FAILED");
      return NextResponse.json(
        {
          error: "Missing required PayPal signature verification headers.",
          code: "MISSING_WEBHOOK_SIGNATURE_HEADERS",
        },
        { status: 400 }
      );
    }

    // 2. Idempotency Check: Don't re-process previously recorded webhooks
    if (await isWebhookEventProcessed(eventId)) {
      return NextResponse.json(
        { status: "ALREADY_PROCESSED", eventId },
        { status: 200 }
      );
    }

    if (!isPayPalConfigured()) {
      await saveWebhookLog(eventId, eventType, eventPayload, "FAILED");
      return NextResponse.json(
        { error: "PayPal credentials not configured on server.", code: "PAYPAL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const config = getPayPalConfig();
    const webhookId = config.webhookId;

    if (!webhookId) {
      // If PAYPAL_WEBHOOK_ID is not configured, we cannot verify the signature
      await saveWebhookLog(eventId, eventType, eventPayload, "FAILED");
      return NextResponse.json(
        {
          error: "PAYPAL_WEBHOOK_ID is not configured in environment. Cannot verify signature.",
          code: "WEBHOOK_ID_MISSING",
        },
        { status: 503 }
      );
    }

    const isVerified = await verifyPayPalWebhookSignature({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookId,
      webhookEvent: eventPayload as unknown as Record<string, unknown>,
    });

    if (!isVerified) {
      await saveWebhookLog(eventId, eventType, eventPayload, "FAILED");
      return NextResponse.json(
        { error: "PayPal webhook signature verification failed.", code: "WEBHOOK_SIGNATURE_INVALID" },
        { status: 400 }
      );
    }

    // Log verified event
    await saveWebhookLog(eventId, eventType, eventPayload, "VERIFIED");

    // 3. Process Specific Event Types
    const resource = eventPayload.resource || {};
    let orderId: string | undefined;
    let captureId: string | undefined;

    // Determine relevant order ID or capture ID based on resource type
    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      orderId = resource.id as string;
    } else if (
      eventType.startsWith("PAYMENT.CAPTURE.") ||
      eventType.startsWith("PAYMENT.ORDER.")
    ) {
      const suppData = resource.supplementary_data as { related_ids?: { order_id?: string; capture_id?: string } } | undefined;
      orderId = suppData?.related_ids?.order_id || (resource.custom_id as string);
      captureId = suppData?.related_ids?.capture_id || (resource.id as string);
    }

    let payment = orderId ? (await getPaymentByOrderId(orderId)) : null;
    if (!payment && captureId) {
      payment = await getPaymentByCaptureId(captureId);
    }

    // Server-side Authoritative Retrieval if payload lacks reliable identifiers
    if (!payment && captureId && isPayPalConfigured()) {
      try {
        const capDetails = await getPayPalCaptureDetails(captureId);
        const capSupp = capDetails.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
        const retrievedOrderId = capSupp?.related_ids?.order_id || (capDetails.custom_id as string);
        if (retrievedOrderId) {
          orderId = retrievedOrderId;
          payment = await getPaymentByOrderId(retrievedOrderId);
        }
      } catch {
        // Fallback safely if capture lookup fails
      }
    }

    // If order/payment is not recognized locally, safely ignore
    if (!payment) {
      return NextResponse.json(
        { status: "IGNORED", reason: "UNMATCHED_ORDER_OR_PAYMENT", eventId, eventType },
        { status: 200 }
      );
    }

    // 4. Strict State Preservation & Incompatible Terminal State Protection
    // Terminal REFUNDED state: never permit upgrade back to COMPLETED or APPROVED
    if (payment.status === "REFUNDED") {
      return NextResponse.json(
        { status: "IGNORED", reason: "TERMINAL_STATE_REFUNDED", eventId },
        { status: 200 }
      );
    }

    // Terminal COMPLETED state: only PAYMENT.CAPTURE.REFUNDED can modify it
    if (payment.status === "COMPLETED" && eventType !== "PAYMENT.CAPTURE.REFUNDED") {
      return NextResponse.json(
        { status: "IGNORED", reason: "PAYMENT_ALREADY_COMPLETED", eventId },
        { status: 200 }
      );
    }

    // Terminal FAILED or CANCELLED state: cannot be approved or marked completed
    if ((payment.status === "FAILED" || payment.status === "CANCELLED") && eventType !== "PAYMENT.CAPTURE.REFUNDED") {
      return NextResponse.json(
        { status: "IGNORED", reason: "TERMINAL_STATE_INCOMPATIBLE", eventId },
        { status: 200 }
      );
    }

    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED": {
        // Approval is NOT capture; update status to APPROVED only if currently CREATED.
        // Strictly never marks invoice PAID.
        if (payment.status === "CREATED") {
          await updatePaymentStatus(payment.id, "APPROVED", undefined, undefined, undefined, {
            lastWebhookEvent: eventType,
            eventId,
          });
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        // 7-Point Webhook Payment Integrity Verification
        const capId = (resource.id as string) || captureId || payment.paypalCaptureId;
        const payerEmail = (resource.payer as { email_address?: string })?.email_address;

        // 1. Verify associated invoice exists
        const invoice = await getInvoice(payment.invoiceId);
        if (!invoice) {
          await updatePaymentStatus(payment.id, "FAILED", capId, payerEmail, undefined, {
            error: "ASSOCIATED_INVOICE_NOT_FOUND",
            eventId,
          });
          return NextResponse.json(
            { error: "Associated invoice not found for payment.", code: "ASSOCIATED_INVOICE_NOT_FOUND" },
            { status: 422 }
          );
        }

        // 2. Extract capture amount and currency
        const rawAmount = resource.amount as { value?: string; total?: string; currency_code?: string; currency?: string } | undefined;
        let amountVal = rawAmount?.value || rawAmount?.total;
        let currencyVal = rawAmount?.currency_code || rawAmount?.currency;

        // If amount/currency are missing in webhook payload, retrieve authoritative order details from PayPal
        if ((!amountVal || !currencyVal) && isPayPalConfigured()) {
          try {
            const orderDetails = await getPayPalOrderDetails(payment.paypalOrderId);
            const captures = (orderDetails as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; amount: { value: string; currency_code: string } }> } }> })
              ?.purchase_units?.[0]?.payments?.captures;
            const primaryCapture = captures?.[0];
            if (primaryCapture) {
              amountVal = primaryCapture.amount?.value;
              currencyVal = primaryCapture.amount?.currency_code;
            }
          } catch {
            // fallback
          }
        }

        const numericAmount = amountVal ? parseFloat(amountVal) : payment.amount;
        const upperCurrency = (currencyVal || payment.currency || "USD").toUpperCase();
        const expectedCurrency = (invoice.currency || "USD").toUpperCase();

        // 3. Verify capture currency
        if (upperCurrency !== expectedCurrency) {
          await updatePaymentStatus(payment.id, "FAILED", capId, payerEmail, undefined, {
            error: "WEBHOOK_CURRENCY_MISMATCH",
            expectedCurrency,
            receivedCurrency: upperCurrency,
            eventId,
          });
          return NextResponse.json(
            {
              error: `Payment currency mismatch. Expected ${expectedCurrency}, but received ${upperCurrency}.`,
              code: "CURRENCY_MISMATCH",
            },
            { status: 422 }
          );
        }

        // 4. Verify capture amount in minor units
        if (!areAmountsEqual(numericAmount, invoice.invoiceTotalUSD, expectedCurrency)) {
          await updatePaymentStatus(payment.id, "FAILED", capId, payerEmail, undefined, {
            error: "WEBHOOK_AMOUNT_MISMATCH",
            expectedAmount: invoice.invoiceTotalUSD,
            receivedAmount: numericAmount,
            eventId,
          });
          return NextResponse.json(
            {
              error: `Payment amount mismatch. Expected $${invoice.invoiceTotalUSD.toFixed(2)}, but received $${numericAmount.toFixed(2)}.`,
              code: "AMOUNT_MISMATCH",
            },
            { status: 422 }
          );
        }

        // 5. Verification passed: update payment to COMPLETED (atomically marks invoice as PAID)
        await updatePaymentStatus(payment.id, "COMPLETED", capId, payerEmail, undefined, {
          lastWebhookEvent: eventType,
          eventId,
          captureDetails: resource,
        });
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        await updatePaymentStatus(payment.id, "FAILED", (resource.id as string) || captureId, undefined, undefined, {
          lastWebhookEvent: eventType,
          eventId,
          denialDetails: resource,
        });
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        await updatePaymentStatus(payment.id, "REFUNDED", (resource.id as string) || captureId, undefined, undefined, {
          lastWebhookEvent: eventType,
          eventId,
          refundDetails: resource,
        });
        break;
      }

      default:
        // Unhandled event types acknowledged cleanly
        break;
    }

    return NextResponse.json(
      { status: "SUCCESS", eventId, eventType },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof PayPalError) {
      return NextResponse.json(
        { error: err.message, code: err.code, statusCode: err.statusCode },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Error processing webhook";
    return NextResponse.json(
      { error: message, code: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 }
    );
  }
}
