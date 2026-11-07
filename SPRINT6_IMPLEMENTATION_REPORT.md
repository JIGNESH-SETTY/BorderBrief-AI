# BorderBrief AI — Sprint 6 Implementation Report
**PayPal Sandbox Payment Integration**

---

## 1. Executive Summary

Sprint 6 of **BorderBrief AI** (*"Know the Rules. Know the Cost. Ship with Confidence."*) delivers a production-grade, secure, zero-dependency **PayPal Sandbox Payment Integration** using the official PayPal Orders API v2 (`https://api-m.sandbox.paypal.com`).

This integration empowers Indian micro, small, and medium exporters (MSMEs) to transition from landed-cost calculation (Sprint 4) and commercial invoice drafting (Sprint 5) into secure digital export receivables collection for goods shipped to the United States.

### Core Objectives Achieved
1. **Official PayPal Orders API v2 Integration:** Pure zero-dependency client (`src/lib/paypal/paypal-client.ts`) utilizing Node.js native `fetch` and `crypto` with automatic OAuth 2.0 Client Credentials token management, in-memory caching with expiry buffers, order creation with strict itemized breakdowns, server-side capture verification, and cryptographic webhook signature verification (`POST /v1/notifications/verify-webhook-signature`).
2. **Strict Financial & Regulatory Separation:** Under Incoterms® 2020 DAP (Delivered at Place), the PayPal transaction collects **exclusively** seller commercial invoice receivables:
   $$\text{PayPal Charge Amount} = \text{Merchandise Subtotal} + \text{Shipping/Freight} + \text{Agreed Cargo Insurance (if applicable)}$$
   Estimated U.S. customs duties (MFN base tariff + Section 301) and CBP user fees (Merchandise Processing Fee, Harbor Maintenance Fee, Inbound EMS Fee) are **strictly excluded** from the payment charge. Exporters and buyers are presented with clear statutory notices that U.S. import duties/fees are payable by the U.S. Importer of Record upon entry to U.S. Customs and Border Protection.
3. **Zero-Trust Server-Side Amount & Currency Validation:** The client/browser never dictates or submits the charge amount. The server retrieves the verified `CommercialInvoiceDraft` record from SQLite by `invoiceId`, recalculates line-item totals, and constructs the authoritative PayPal order payload. Furthermore, upon `capture`, the server verifies the captured amount and currency against the SQLite invoice record before marking the order completed.
4. **Resilient Transactional Database Layer:** Introduced Table 9 (`payments`) with foreign key constraints, atomic transactions (`BEGIN IMMEDIATE;` ... `COMMIT;`), cascade deletions, and idempotency guarantees. Invoice status transitions cleanly from `DRAFT` to `PAID` in both the relational column and the embedded JSON payload upon verified server capture.
5. **Robust Webhook Handling & Idempotency:** Implemented `POST /api/payments/paypal/webhook` with cryptographic signature verification, persistent event deduplication in `webhook_logs`, and lifecycle handlers for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED` while preserving completed states against out-of-order deliveries.
6. **Polished Sandbox UI Integration:** Rendered `<PayPalSandboxCheckout />` directly below the commercial invoice in Step 5 ("Export Documents"). Features prominent `"PAYPAL SANDBOX — TEST PAYMENT ONLY"` warnings, live configuration detection, official PayPal JS SDK script injection, interactive PayPal Buttons, real-time progress indicators, and verified receipt cards with transaction IDs and timestamps.
7. **Production Quality & Test Suite Coverage:** 
   - All **203 tests across 24 suites pass cleanly** (2 skipped: 1 mock Gemini, 1 opt-in live PayPal test).
   - `src/tests/paypal-integration.test.ts` contains 22 comprehensive tests verifying all 20 required scenarios.
   - `npx tsc --noEmit` and `npm run lint` compile with **0 errors and 0 warnings**.
   - `next build` produces an optimized production build mapping all 5 payment routes.
   - Zero paid subscriptions, ₹0 development budget, and zero local AI or Ollama dependencies.

---

## 2. Preflight Findings & Architecture Review

Before developing Sprint 6, an exhaustive audit of Sprints 1–5 was conducted:
- **Sprint 3 (Classification & Rules):** 7 authentic Indian seed products in `src/data/seed-products.ts` with USITC 2026 Revision 22 grounding. Unaltered.
- **Sprint 4 (Landed-Cost Engine):** 19 U.S.C. § 1401a transaction value calculations, Section 301 duties, postal formal/informal compliance dates (January 20, 2027 under CBP Doc. 2026-21600), Entry Type 13 under 91 FR 66707, and user fees (MPF, HMF, Inbound EMS). Unaltered.
- **Sprint 5 (Commercial Invoice):** `CommercialInvoiceDraft` data contract, PDF 1.4 generator, and SQLite storage. Updated `status` type definition from strict `"DRAFT"` to `"DRAFT" | "ISSUED" | "PAID"`.
- **Database & Concurrency:** Ensured SQLite WAL mode (`PRAGMA journal_mode = WAL;`) and busy timeout (`PRAGMA busy_timeout = 10000;`) to eliminate lock contention during concurrent test runs.

---

## 3. Pure Zero-Dependency PayPal Sandbox Client

Location: [`src/lib/paypal/paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts)

Implemented entirely in pure TypeScript without third-party PayPal SDK dependencies (`@paypal/checkout-server-sdk` is deprecated and bloated; custom fetch ensures maximum security and zero vulnerability surface).

### Client Architecture & Capabilities:
- **Sandbox Base URL:** `https://api-m.sandbox.paypal.com`
- **OAuth 2.0 Token Management (`getPayPalAccessToken`):**
  - Authenticates via `POST /v1/oauth2/token` with `grant_type=client_credentials` using Basic Authorization (`Buffer.from('${clientId}:${clientSecret}').toString('base64')`).
  - Implements in-memory token caching with a 60-second safety expiry margin.
  - Automatically refreshes expired tokens or re-authenticates on invalidation.
- **Order Creation (`createPayPalOrder`):**
  - Sends `POST /v2/checkout/orders` with `intent: "CAPTURE"`.
  - Itemized `purchase_units` with detailed line-item breakdown (`item_total`, `shipping`, `insurance`).
  - Sets `application_context` specifying `shipping_preference: "NO_SHIPPING"` (freight arranged by seller under DAP), `user_action: "PAY_NOW"`, and descriptive brand names.
- **Server-Side Capture (`capturePayPalOrder`):**
  - Calls `POST /v2/checkout/orders/{id}/capture` with an optional idempotency key.
  - Inspects the capture payload and guarantees status is `COMPLETED`.
- **Order Lookup (`getPayPalOrderDetails`):**
  - Calls `GET /v2/checkout/orders/{id}` to verify state.
- **Cryptographic Webhook Signature Verification (`verifyPayPalWebhookSignature`):**
  - Calls `POST /v1/notifications/verify-webhook-signature` using the official PayPal API to validate cryptographic signatures against the configured Webhook ID.
- **Validation Helpers:**
  - `validatePaymentCurrency()`: Enforces standard supported export currencies (`USD`, `EUR`, `GBP`, `CAD`, `AUD`, `SGD`, `JPY`).
  - `formatPayPalAmount()`: Formats amounts to 2 decimal places (or 0 decimal places for non-fractional currencies like `JPY`).
- **Dependency Injection:** Accepts an optional `fetchFn` in constructor for seamless offline mocking in automated test environments.

---

## 4. API Endpoints Inventory

### 1. `POST /api/payments/paypal/create-order`
- **Location:** [`src/app/api/payments/paypal/create-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/create-order/route.ts)
- **Purpose:** Initiates a PayPal order for a confirmed commercial invoice.
- **Validation & Guardrails:**
  - Validates `invoiceId` parameter.
  - Fetches the saved commercial invoice from SQLite via `getInvoice(invoiceId)`. Returns HTTP 404 if not found.
  - Validates invoice status: rejects already `PAID` invoices with HTTP 400.
  - Validates amount: rejects invoices where `sellerTotalAmount <= 0`.
  - Validates currency: enforces supported currencies.
  - Strictly derives payment amount from `invoice.sellerTotalAmount` (merchandise + shipping + optional insurance).
  - Explicitly discards any client-supplied amount or duty/fee figures.
  - Stores initial payment record in SQLite with status `CREATED`.
  - Supports `x-idempotency-key` header to prevent duplicate orders.

### 2. `POST /api/payments/paypal/capture-order`
- **Location:** [`src/app/api/payments/paypal/capture-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/capture-order/route.ts)
- **Purpose:** Captures payment for an approved PayPal order and verifies execution.
- **Validation & Guardrails:**
  - Checks if payment record exists and is already `COMPLETED`; returns HTTP 409 Conflict if duplicate capture attempted.
  - Executes capture via `capturePayPalOrder()`.
  - Verifies PayPal response status: handles `COMPLETED`, `PENDING` (HTTP 402), and `DENIED` (HTTP 422).
  - Performs cross-verification: verifies that the captured amount and currency match the SQLite invoice `sellerTotalAmount` and `currency`.
  - In an atomic transaction, updates `payments` table (`status = 'COMPLETED'`, `capture_id`, `payer_id`, `payer_email`, `updated_at`) and marks the commercial invoice as `PAID` (both `invoices.status` and `invoice_data_json.status`).

### 3. `GET /api/payments/[id]`
- **Location:** [`src/app/api/payments/[id]/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/%5Bid%5D/route.ts)
- **Purpose:** Retrieves sanitized payment status by internal ID or PayPal Order ID.
- **Security:**
  - Parameter sanitized via regex `/^[a-zA-Z0-9_-]{1,64}$/`.
  - Returns sanitized public fields (`id`, `orderId`, `status`, `amount`, `currency`, `invoiceId`, `payerEmail`, `createdAt`). Never leaks secret keys or access tokens.

### 4. `POST /api/payments/paypal/webhook`
- **Location:** [`src/app/api/payments/paypal/webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts)
- **Purpose:** Handles asynchronous notifications from PayPal Sandbox.
- **Security & Integrity:**
  - Header Validation: Enforces presence of `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`. Rejects missing headers with HTTP 400.
  - Signature Verification: Calls PayPal `POST /v1/notifications/verify-webhook-signature` or logs bypass in mock mode.
  - Idempotency: Checks `isWebhookEventProcessed(event.id)`. If previously processed, returns HTTP 200 `ALREADY_PROCESSED` without re-executing logic.
  - Event Dispatcher:
    - `PAYMENT.CAPTURE.COMPLETED`: Updates payment to `COMPLETED` and marks invoice `PAID`.
    - `CHECKOUT.ORDER.APPROVED`: Updates status to `APPROVED` only if not already `COMPLETED`.
    - `PAYMENT.CAPTURE.DENIED`: Marks payment as `FAILED`.
    - `PAYMENT.CAPTURE.REFUNDED`: Marks payment as `REFUNDED`.
  - Records event in `webhook_logs` table.

### 5. `GET /api/payments/paypal/config`
- **Location:** [`src/app/api/payments/paypal/config/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/config/route.ts)
- **Purpose:** Exposes public PayPal configuration to the frontend.
- **Security:** Returns only `{ clientId: string, isConfigured: boolean, mode: "sandbox" }`. Excludes `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID`.

---

## 5. Database Schema & Persistence

Location: [`src/lib/db/schema.ts`](file:///d:/BorderBrief%20AI/src/lib/db/schema.ts) & [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts)

### 1. `payments` Table Schema
```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  paypal_order_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('CREATED', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED')),
  amount REAL NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payer_id TEXT,
  payer_email TEXT,
  payer_name TEXT,
  capture_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON payments(paypal_order_id);
```

### 2. `webhook_logs` Table Schema
```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  summary TEXT,
  raw_payload TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id);
```

### 3. Atomicity & Concurrency Controls
- **Atomic State Transitions:** In `updatePaymentStatus()`, when status reaches `COMPLETED`, SQLite executes an atomic transaction updating `payments`, `invoices.status = 'PAID'`, and the deserialized `invoice_data_json.status = "PAID"`.
- **Cascade Deletion:** `deleteInvoice()` safely removes linked records from `payments` and `paypal_orders` before deleting the invoice.
- **WAL Mode & Busy Timeout:** Configured with `PRAGMA busy_timeout = 10000;` to ensure tests and simultaneous requests do not experience SQLite lock starvation.

---

## 6. User Interface Integration

Location: [`src/components/payment/paypal-sandbox-checkout.tsx`](file:///d:/BorderBrief%20AI/src/components/payment/paypal-sandbox-checkout.tsx)  
Integrated into: [`src/app/export/new/page.tsx`](file:///d:/BorderBrief%20AI/src/app/export/new/page.tsx) (Step 5: Export Documents)

### Key UI Features:
1. **Prominent Sandbox Badging & Disclaimers:**
   - Gold/amber banner with yellow badge: `"PAYPAL SANDBOX — TEST PAYMENT ONLY"`.
   - Clear advisory: *"This transaction uses PayPal Sandbox test mode. No genuine currency or bank accounts are debited. Test buyers can use their PayPal Sandbox buyer credentials."*
2. **Financial Separation Breakdown Card:**
   - Visual breakdown explicitly listing:
     - Merchandise Subtotal
     - International Freight
     - Transit Cargo Insurance (if included in terms)
     - **Total PayPal Receivable**
   - Blue statutory info box: *"Estimated U.S. Import Duties & Fees ($40.75 in sample) are NOT included in this payment. Under DAP terms, duties are payable by the U.S. buyer directly to U.S. Customs upon arrival."*
3. **Dynamic Official PayPal JS SDK Loading:**
   - Fetches public `clientId` from `/api/payments/paypal/config`.
   - Injects official script `https://www.paypal.com/sdk/js` asynchronously with active currency and `intent=capture`.
   - Prevents duplicate script injections.
4. **Interactive PayPal Smart Buttons:**
   - Standard PayPal gold styling (`layout: "vertical"`, `color: "gold"`, `shape: "rect"`).
   - Renders interactive PayPal payment popup on click.
   - Automatically handles `createOrder` (calling `/api/payments/paypal/create-order`) and `onApprove` (calling `/api/payments/paypal/capture-order`).
   - Gracefully handles user cancellations (`onCancel`) and window errors (`onError`).
5. **Verified Payment Receipt Display:**
   - Upon successful capture, transitions into a green verified success panel.
   - Displays Verified Capture ID, PayPal Order ID, Payer Email, Paid Amount, and Date.
   - Updates invoice badge in real time to `PAID`.
6. **Graceful Unconfigured Fallback:**
   - When PayPal credentials are not present in `.env.local`, displays a helpful configuration guide with sample environment variables and instructions for creating Sandbox accounts at [developer.paypal.com](https://developer.paypal.com).

---

## 7. Security Controls & Financial Guardrails

| Security Control | Implementation Mechanism | Threat Mitigated |
|---|---|---|
| **Zero-Trust Amount Validation** | Server fetches authoritative amount from SQLite `invoices` table; ignores client amount | Price tampering / parameter manipulation |
| **Strict Incoterms Separation** | Commercial invoice excludes U.S. customs duties and CBP user fees from PayPal order | Double-billing buyer; customs valuation distortion |
| **Server-Side Capture Verification** | Payment is never marked complete until PayPal API returns `status === "COMPLETED"` | Client-side fake success injection |
| **Capture Amount/Currency Match** | Server checks `capture.amount === invoice.amount` and `capture.currency === invoice.currency` | Order substitution / currency arbitrage |
| **Double-Capture Prevention** | `POST /capture-order` checks existing payment status; returns HTTP 409 Conflict | Duplicate payment captures / double charges |
| **Cryptographic Webhook Validation** | Calls PayPal `POST /v1/notifications/verify-webhook-signature` using transmission headers | Spoofed webhook notifications |
| **Webhook Idempotency** | Event IDs logged in `webhook_logs` table with `UNIQUE` constraint | Duplicate webhook execution / replay attacks |
| **No Credential Leakage** | Client secret and webhook ID kept exclusively in server environment; `/config` leaks nothing | Secret exfiltration / API abuse |
| **Input Sanitization** | `ID_REGEX` on route params; strict validation on invoice IDs | SQL injection / path traversal |

---

## 8. Automated Test Results

Test File: [`src/tests/paypal-integration.test.ts`](file:///d:/BorderBrief%20AI/src/tests/paypal-integration.test.ts)

### 20 Verified Required Scenarios:
1. `handles missing PayPal credentials gracefully without revealing secrets` — **PASS**
2. `rejects missing or invalid invoice ID with HTTP 400` — **PASS**
3. `returns HTTP 404 when commercial invoice is not found in database` — **PASS**
4. `rejects invoices with zero or negative total amount with HTTP 400` — **PASS**
5. `validates currency and rejects unsupported currencies` — **PASS**
6. `creates PayPal order with exact seller receivables and correct breakdown` — **PASS**
7. `STRICT FINANCIAL SEPARATION: excludes estimated US import duties ($40.75) from PayPal payment` — **PASS**
8. `handles PayPal OAuth token failures cleanly` — **PASS**
9. `handles PayPal order creation failure (HTTP 422)` — **PASS**
10. `executes server-side capture, verifies COMPLETED status, and updates invoice to PAID` — **PASS**
11. `prevents duplicate capture of an already COMPLETED order with HTTP 409` — **PASS**
12. `detects and rejects capture amount mismatch (HTTP 422)` — **PASS**
13. `detects and rejects capture currency mismatch (HTTP 422)` — **PASS**
14. `handles PENDING capture status without marking completed (HTTP 402)` — **PASS**
15. `handles DENIED capture status and marks payment FAILED` — **PASS**
16. `allows retrieving safe payment details by payment ID or PayPal order ID` — **PASS**
17. `rejects webhook deliveries with missing or invalid signature headers` — **PASS**
18. `idempotently ignores duplicate webhook events` — **PASS**
19. `preserves COMPLETED payment state when out-of-order CHECKOUT.ORDER.APPROVED arrives` — **PASS**
20. `handles PAYMENT.CAPTURE.REFUNDED webhook event and updates status to REFUNDED` — **PASS**
21. `GET /api/payments/paypal/config returns safe public client configuration without leaking secrets` — **PASS**
22. `Opt-in: executes live PayPal Sandbox test when RUN_LIVE_PAYPAL_TEST is true` — **SKIPPED (Opt-in)**

### Full Project Test Suite Status:
```
ℹ tests 205
ℹ suites 24
ℹ pass 203
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ duration_ms 2259.79ms
```

---

## 9. Live Sandbox Testing & Setup Guide

To perform live test payments using a real PayPal Developer account:

### 1. Configure `.env.local`
Create or update `.env.local` with your PayPal Sandbox credentials from [developer.paypal.com](https://developer.paypal.com):
```bash
NEXT_PUBLIC_PAYPAL_CLIENT_ID="your_sandbox_client_id_here"
PAYPAL_CLIENT_SECRET="your_sandbox_client_secret_here"
PAYPAL_WEBHOOK_ID="your_sandbox_webhook_id_here"
```

### 2. Start Application
```bash
npm run dev
```

### 3. Workflow Steps
1. Navigate to `/export/new`.
2. Select any Indian export product (e.g. *Handloom Cotton Canvas Tote Bags*).
3. Confirm product details and calculate landed cost (Sprint 4).
4. Review generated draft commercial invoice (Sprint 5).
5. Scroll to the **"PayPal Sandbox Checkout"** card.
6. Click the yellow **PayPal** button.
7. Log in with your PayPal Sandbox Personal (Buyer) account.
8. Authorize the payment.
9. Verify that the window closes, the server verifies the capture, the status badge turns to **PAID**, and the verified receipt card appears.

---

## 10. Known Limitations & Regulatory Disclaimers

1. **Sandbox Environment Only:** This integration is strictly configured for the PayPal Sandbox environment (`https://api-m.sandbox.paypal.com`). Live/production credentials are intentionally blocked by configuration to prevent accidental financial liabilities.
2. **Local Multi-User Isolation:** BorderBrief AI is currently an export-preparation tool designed for individual exporter sessions. Multi-tenant merchant account onboarding (PayPal Partner Referrals API) is out of scope for Sprint 6.
3. **Statutory Regulatory Disclaimer:** As mandated across all sprints, BorderBrief AI provides export preparation, customs estimates, and draft invoice capabilities. It is neither a customs broker nor a commercial bank. Payment through PayPal covers only commercial invoice obligations between buyer and seller; official customs clearance and duty payments remain subject to U.S. Customs and Border Protection laws.

---

## 11. Confirmation of Preserved Functionality

- **Sprint 1 (Corridor & Product Intake):** Fully intact.
- **Sprint 2 (Architecture & Data Contracts):** Fully intact.
- **Sprint 3 (HS/HTS Classification & Rules):** All 7 authentic Indian seed products intact in `src/data/seed-products.ts`.
- **Sprint 4 (Landed-Cost Engine & Postal Compliance):** All customs valuation algorithms, Section 301 calculations, October 22, 2026 extension compliance dates (January 20, 2027), Entry Type 13 under 91 FR 66707, and user fees (MPF, HMF, Inbound EMS) remain 100% intact and passing tests.
- **Sprint 5 (Commercial Invoice Drafting & PDF):** Invoice preview, PDF 1.4 generation, printing, and SQLite persistence fully operational.

**Sprint 6 is complete, fully tested, and ready for review. No Sprint 7 work has been started.**

