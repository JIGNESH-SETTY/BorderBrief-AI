/**
 * BorderBrief AI — Pure Zero-Dependency PayPal Sandbox Client (Sprint 6)
 *
 * Implements the official PayPal Orders API v2 and Webhooks Verification API:
 * - OAuth 2.0 client credentials token management with in-memory caching
 * - Order creation (POST /v2/checkout/orders) with line item breakdowns
 * - Server-side order capture (POST /v2/checkout/orders/{id}/capture)
 * - Cryptographic webhook signature verification (POST /v1/notifications/verify-webhook-signature)
 * - Currency and decimal precision validation
 * - Safe error handling without credential leakage
 *
 * Official PayPal References:
 * - Orders API v2: https://developer.paypal.com/docs/api/orders/v2/
 * - Authentication: https://developer.paypal.com/api/rest/authentication/
 * - Webhook Verification: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */

import type { CommercialInvoiceDraft } from "../../types/invoice.ts";

export const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";

export const SUPPORTED_PAYPAL_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "HKD",
  "NZD", "SEK", "DKK", "PLN", "NOK", "HUF", "CZK", "ILS", "MXN",
  "BRL", "MYR", "PHP", "TWD", "THB"
]);

export class PayPalError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "PayPalError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookId?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

/**
 * Resets in-memory cached token (used in tests or on auth failure).
 */
export function resetTokenCache(): void {
  cachedToken = null;
}

/**
 * Validates whether PayPal credentials are configured in the environment.
 */
export function isPayPalConfigured(): boolean {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  return Boolean(clientId && clientSecret);
}

/**
 * Retrieves validated PayPal configuration from environment.
 * Strict Sandbox safeguard: will not connect to live endpoints.
 */
export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const baseUrl = (process.env.PAYPAL_BASE_URL || PAYPAL_SANDBOX_BASE_URL).trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

  if (!clientId || !clientSecret) {
    throw new PayPalError(
      "PayPal Sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment variables.",
      "PAYPAL_CREDENTIALS_MISSING",
      503
    );
  }

  // Strict Sandbox Guardrail: Disallow live URLs in Sprint 6
  if (baseUrl.includes("api-m.paypal.com") && !baseUrl.includes("sandbox")) {
    throw new PayPalError(
      "Live PayPal production endpoints are strictly disabled in Sprint 6. Only PayPal Sandbox is supported.",
      "LIVE_PAYPAL_DISALLOWED",
      403
    );
  }

  return { clientId, clientSecret, baseUrl, webhookId };
}

/**
 * Validates that currency is supported by PayPal.
 */
export function validatePaymentCurrency(currency: string): void {
  const upper = (currency || "").toUpperCase().trim();
  if (!upper || !SUPPORTED_PAYPAL_CURRENCIES.has(upper)) {
    throw new PayPalError(
      `Currency "${currency}" is not supported by PayPal Sandbox. Supported export currencies include: USD, EUR, GBP, CAD, etc.`,
      "UNSUPPORTED_CURRENCY",
      400
    );
  }
}

/**
 * Formats amount with correct decimal precision for PayPal.
 * Zero-decimal currencies (e.g. JPY) omit decimals; others require 2 decimals.
 */
export function formatPayPalAmount(amount: number, currency: string): string {
  const upper = currency.toUpperCase().trim();
  if (upper === "JPY" || upper === "HUF" || upper === "TWD") {
    return Math.round(amount).toString();
  }
  return Number(amount).toFixed(2);
}

/**
 * Converts a monetary amount to integer minor units (e.g. cents, pence, paise).
 * Zero-decimal currencies (JPY, HUF, TWD) are rounded to the nearest integer.
 * Standard 2-decimal currencies are multiplied by 100 and rounded to eliminate float drift.
 */
export function toMinorUnits(amount: number, currency = "USD"): number {
  const upper = currency.toUpperCase().trim();
  const isZeroDecimal = upper === "JPY" || upper === "HUF" || upper === "TWD";
  if (isZeroDecimal) {
    return Math.round(amount);
  }
  return Math.round(Number(amount.toFixed(4)) * 100);
}

/**
 * Checks whether two monetary amounts are exactly identical in their currency's minor units.
 * Eliminates IEEE 754 floating-point comparison errors.
 */
export function areAmountsEqual(amount1: number, amount2: number, currency = "USD"): boolean {
  return toMinorUnits(amount1, currency) === toMinorUnits(amount2, currency);
}

/**
 * Obtains an OAuth 2.0 access token using client credentials grant.
 * Caches token until 60 seconds before expiration.
 */
export async function getPayPalAccessToken(
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const cfg = config || getPayPalConfig();

  // Return cached token if still valid
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const authHeader = "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const tokenUrl = `${cfg.baseUrl}/v1/oauth2/token`;

  let response: Response;
  try {
    response = await fetchFn(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error contacting PayPal OAuth";
    throw new PayPalError(`Failed to reach PayPal OAuth endpoint: ${msg}`, "PAYPAL_OAUTH_NETWORK_ERROR", 502);
  }

  if (!response.ok) {
    resetTokenCache();
    const errorText = await response.text();
    throw new PayPalError(
      "PayPal authentication failed. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
      "PAYPAL_OAUTH_FAILED",
      response.status,
      { status: response.status, response: errorText }
    );
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new PayPalError("PayPal OAuth response did not contain an access_token.", "PAYPAL_OAUTH_INVALID_RESPONSE", 502);
  }

  const expiresIn = json.expires_in || 3600;
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return json.access_token;
}

export interface CreateOrderResult {
  orderId: string;
  status: string;
  approveUrl?: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Creates a PayPal Orders API v2 order based strictly on a saved commercial invoice.
 * STRICT FINANCIAL SEPARATION: Excludes all estimated U.S. customs duties and user fees.
 */
export async function createPayPalOrder(
  invoice: CommercialInvoiceDraft,
  idempotencyKey?: string,
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<CreateOrderResult> {
  const cfg = config || getPayPalConfig();
  validatePaymentCurrency(invoice.currency);

  if (!invoice.invoiceTotalUSD || invoice.invoiceTotalUSD <= 0) {
    throw new PayPalError("Commercial invoice total must be greater than zero.", "INVALID_INVOICE_AMOUNT", 400);
  }

  const accessToken = await getPayPalAccessToken(cfg, fetchFn);
  const currency = invoice.currency.toUpperCase();

  // Financial breakdown calculation
  const itemTotalStr = formatPayPalAmount(invoice.subtotalUSD, currency);
  const shippingStr = formatPayPalAmount(invoice.shippingCostUSD, currency);
  const isInsuranceIncluded = Boolean(invoice.shipment?.isInsuranceIncluded);
  const insuranceAmount = isInsuranceIncluded ? Number(invoice.insuranceCostUSD || 0) : 0;
  const insuranceStr = formatPayPalAmount(insuranceAmount, currency);
  const invoiceTotalStr = formatPayPalAmount(invoice.invoiceTotalUSD, currency);

  // Line items
  const items = invoice.items.map((item, idx) => ({
    name: (item.description || `Merchandise Item ${idx + 1}`).slice(0, 127),
    quantity: String(Math.max(1, Math.round(item.quantity))),
    unit_amount: {
      currency_code: currency,
      value: formatPayPalAmount(item.unitPriceUSD, currency),
    },
    category: "PHYSICAL_GOODS",
  }));

  const orderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: invoice.id,
        custom_id: invoice.id,
        invoice_id: invoice.invoiceNumber,
        description: `BorderBrief Export Invoice ${invoice.invoiceNumber}`,
        amount: {
          currency_code: currency,
          value: invoiceTotalStr,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: itemTotalStr,
            },
            shipping: {
              currency_code: currency,
              value: shippingStr,
            },
            ...(insuranceAmount > 0
              ? {
                  insurance: {
                    currency_code: currency,
                    value: insuranceStr,
                  },
                }
              : {}),
          },
        },
        items,
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          brand_name: "BorderBrief AI",
          locale: "en-US",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: "http://localhost:3000/export/new?payment=success",
          cancel_url: "http://localhost:3000/export/new?payment=cancel",
        },
      },
    },
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (idempotencyKey) {
    headers["PayPal-Request-Id"] = idempotencyKey;
  }

  const orderUrl = `${cfg.baseUrl}/v2/checkout/orders`;
  let response: Response;
  try {
    response = await fetchFn(orderUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(orderPayload),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error contacting PayPal Orders API";
    throw new PayPalError(`Failed to reach PayPal Orders API: ${msg}`, "PAYPAL_ORDER_NETWORK_ERROR", 502);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new PayPalError(
      "Failed to create PayPal order.",
      "PAYPAL_ORDER_CREATION_FAILED",
      response.status,
      { response: errorBody }
    );
  }

  const orderData = (await response.json()) as {
    id: string;
    status: string;
    links?: Array<{ href: string; rel: string }>;
  };

  const approveLink = orderData.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");

  return {
    orderId: orderData.id,
    status: orderData.status,
    approveUrl: approveLink?.href,
    rawResponse: orderData as Record<string, unknown>,
  };
}

export interface CaptureOrderResult {
  orderId: string;
  captureId: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
  amount: number;
  currency: string;
  payerEmail?: string;
  payerName?: string;
  capturedAt: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Captures an approved PayPal order server-side and validates capture status and financial integrity.
 */
export async function capturePayPalOrder(
  orderId: string,
  idempotencyKey?: string,
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<CaptureOrderResult> {
  const cfg = config || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(cfg, fetchFn);

  const captureUrl = `${cfg.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (idempotencyKey) {
    headers["PayPal-Request-Id"] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetchFn(captureUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error contacting PayPal Capture API";
    throw new PayPalError(`Failed to reach PayPal Capture API: ${msg}`, "PAYPAL_CAPTURE_NETWORK_ERROR", 502);
  }

  if (!response.ok) {
    const errorBody = await response.text();

    // If order was already captured on PayPal (e.g. earlier network timeout or retry),
    // self-heal by retrieving authoritative order details rather than failing with 422.
    if (response.status === 422 && errorBody.includes("ORDER_ALREADY_CAPTURED")) {
      try {
        const orderDetails = await getPayPalOrderDetails(orderId, cfg, fetchFn);
        const captures = (orderDetails as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string }; create_time?: string }> } }> })
          ?.purchase_units?.[0]?.payments?.captures;
        const existingCapture = captures?.[0];
        if (existingCapture && existingCapture.status.toUpperCase() === "COMPLETED") {
          return {
            orderId,
            captureId: existingCapture.id,
            status: "COMPLETED",
            amount: parseFloat(existingCapture.amount.value),
            currency: existingCapture.amount.currency_code.toUpperCase(),
            capturedAt: existingCapture.create_time || new Date().toISOString(),
            rawResponse: orderDetails,
          };
        }
      } catch {
        // Fallback to standard error if lookup fails
      }
    }

    throw new PayPalError(
      "Failed to capture PayPal order.",
      "PAYPAL_CAPTURE_FAILED",
      response.status,
      { response: errorBody }
    );
  }

  const captureData = (await response.json()) as {
    id: string;
    status: string;
    payer?: {
      email_address?: string;
      name?: { given_name?: string; surname?: string };
    };
    payment_source?: {
      paypal?: {
        email_address?: string;
        name?: { given_name?: string; surname?: string };
      };
    };
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
          amount: { value: string; currency_code: string };
          create_time?: string;
        }>;
      };
    }>;
  };

  const primaryCapture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  if (!primaryCapture) {
    throw new PayPalError(
      "PayPal capture response did not contain capture details.",
      "NO_CAPTURE_IN_RESPONSE",
      502,
      { response: captureData }
    );
  }

  const captureStatus = primaryCapture.status.toUpperCase();
  let normalizedStatus: "COMPLETED" | "PENDING" | "FAILED" = "FAILED";

  if (captureStatus === "COMPLETED") {
    normalizedStatus = "COMPLETED";
  } else if (captureStatus === "PENDING") {
    normalizedStatus = "PENDING";
  }

  const payerEmail =
    captureData.payer?.email_address ||
    captureData.payment_source?.paypal?.email_address;

  const payerGiven =
    captureData.payer?.name?.given_name ||
    captureData.payment_source?.paypal?.name?.given_name ||
    "";
  const payerSurname =
    captureData.payer?.name?.surname ||
    captureData.payment_source?.paypal?.name?.surname ||
    "";
  const payerName = [payerGiven, payerSurname].filter(Boolean).join(" ") || undefined;

  return {
    orderId: captureData.id || orderId,
    captureId: primaryCapture.id,
    status: normalizedStatus,
    amount: parseFloat(primaryCapture.amount.value),
    currency: primaryCapture.amount.currency_code.toUpperCase(),
    payerEmail,
    payerName,
    capturedAt: primaryCapture.create_time || new Date().toISOString(),
    rawResponse: captureData as Record<string, unknown>,
  };
}

/**
 * Retrieves PayPal order details from the PayPal Orders API v2.
 */
export async function getPayPalOrderDetails(
  orderId: string,
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<Record<string, unknown>> {
  const cfg = config || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(cfg, fetchFn);

  const orderUrl = `${cfg.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  const response = await fetchFn(orderUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new PayPalError(
      `Failed to retrieve PayPal order: ${orderId}`,
      "PAYPAL_ORDER_NOT_FOUND",
      response.status
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * Retrieves PayPal capture details from the PayPal Payments API v2.
 * Ref: GET /v2/payments/captures/{capture_id}
 */
export async function getPayPalCaptureDetails(
  captureId: string,
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<Record<string, unknown>> {
  const cfg = config || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(cfg, fetchFn);

  const captureUrl = `${cfg.baseUrl}/v2/payments/captures/${encodeURIComponent(captureId)}`;
  const response = await fetchFn(captureUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new PayPalError(
      `Failed to retrieve PayPal capture: ${captureId}`,
      "PAYPAL_CAPTURE_NOT_FOUND",
      response.status
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

export interface WebhookVerificationParams {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  webhookEvent: Record<string, unknown>;
}

/**
 * Cryptographically verifies PayPal webhook signature using the official PayPal verification API.
 * Ref: POST /v1/notifications/verify-webhook-signature
 */
export async function verifyPayPalWebhookSignature(
  params: WebhookVerificationParams,
  config?: PayPalConfig,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const cfg = config || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(cfg, fetchFn);

  const verifyUrl = `${cfg.baseUrl}/v1/notifications/verify-webhook-signature`;

  const verifyPayload = {
    transmission_id: params.transmissionId,
    transmission_time: params.transmissionTime,
    cert_url: params.certUrl,
    auth_algo: params.authAlgo,
    transmission_sig: params.transmissionSig,
    webhook_id: params.webhookId,
    webhook_event: params.webhookEvent,
  };

  let response: Response;
  try {
    response = await fetchFn(verifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(verifyPayload),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error verifying webhook signature";
    throw new PayPalError(`Webhook verification failed due to network error: ${msg}`, "WEBHOOK_VERIFY_NETWORK_ERROR", 502);
  }

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}

