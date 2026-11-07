/**
 * BorderBrief AI — PayPal Sandbox Payment Types (Sprint 6)
 * Strongly typed domain interfaces for PayPal Orders API v2, captures, webhooks, and persistence.
 */

export type PaymentStatus =
  | "CREATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "CAPTURE_PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface PaymentRecord {
  id: string; // e.g. "pay_..."
  invoiceId: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  isSandbox: boolean;
  payerEmail?: string;
  payerName?: string;
  captureTime?: string;
  lastWebhookEventId?: string;
  paymentData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  invoiceId: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  approveUrl?: string;
}

export interface CaptureOrderRequest {
  orderId: string;
  invoiceId?: string;
}

export interface CaptureOrderResponse {
  paymentId: string;
  invoiceId: string;
  paypalOrderId: string;
  captureId: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
  amount: number;
  currency: string;
  payerEmail?: string;
  payerName?: string;
  capturedAt: string;
  disclaimer: string;
}

export interface PayPalConfigResponse {
  clientId: string | null;
  environment: "sandbox";
  isConfigured: boolean;
  currency: string;
}

export interface PayPalWebhookVerificationRequest {
  transmission_id: string;
  transmission_time: string;
  cert_url: string;
  auth_algo: string;
  transmission_sig: string;
  webhook_id: string;
  webhook_event: Record<string, unknown>;
}

export interface PayPalWebhookPayload {
  id: string;
  event_version?: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary?: string;
  resource: Record<string, unknown>;
}

