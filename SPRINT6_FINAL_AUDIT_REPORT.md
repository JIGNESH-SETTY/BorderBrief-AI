# BorderBrief AI — Sprint 6 Final Payment Integrity Audit Report
**Focused Security, Financial Accuracy & Payment Integrity Audit**

---

## 1. Executive Summary

A comprehensive, read-only-first security and payment-integrity audit of Sprint 6 (PayPal Sandbox Payment Integration) was conducted for **BorderBrief AI** (*"Know the Rules. Know the Cost. Ship with Confidence."*).

The audit systematically examined all payment routes, database operations, the pure TypeScript zero-dependency PayPal Sandbox client, webhook verification and event dispatching, monetary precision, data privacy boundaries, and reconciliation failure modes.

Specific material findings were identified and resolved via targeted, minimal corrections that preserve all Sprint 1–5 functionality, maintain the single-user hackathon demo constraints, and enforce strict regulatory and financial separation under Incoterms® 2020 DAP.

---

## 2. Files Inspected

| File Path | Inspection Focus |
|---|---|
| [`src/app/api/payments/paypal/webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts) | Webhook cryptographic signature verification, order/payment matching, amount and currency validation, terminal state preservation, and event dispatching. |
| [`src/lib/paypal/paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts) | Pure zero-dependency Orders API v2 client, token management, currency validation, decimal formatting, capture error recovery, and webhook signature verification API. |
| [`src/app/api/payments/paypal/create-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/create-order/route.ts) | Order creation, server-side SQLite invoice lookup, amount derivation, currency checks, and idempotency key handling. |
| [`src/app/api/payments/paypal/capture-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/capture-order/route.ts) | Server-side capture execution, amount/currency matching, duplicate capture prevention (HTTP 409), interim status handling, and post-capture database failure reconciliation. |
| [`src/app/api/payments/[id]/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/%5Bid%5D/route.ts) | Payment status lookup, PII masking, route parameter sanitization, and demo disclaimer boundaries. |
| [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts) | SQLite transactions (`BEGIN IMMEDIATE;` ... `COMMIT;`), payment persistence, capture ID lookup, invoice status synchronization (`PAID`, `REFUNDED`), and WAL mode. |
| [`src/lib/db/schema.ts`](file:///d:/BorderBrief%20AI/src/lib/db/schema.ts) | DDL for `payments`, `webhook_logs`, `invoices`, and `paypal_orders`. Uniqueness constraints and indices. |
| [`src/types/payment.ts`](file:///d:/BorderBrief%20AI/src/types/payment.ts) | Strongly typed payment domain contracts. |
| [`src/types/invoice.ts`](file:///d:/BorderBrief%20AI/src/types/invoice.ts) | Commercial invoice data contract; expanded status types to include `"REFUNDED"`. |
| [`src/components/payment/paypal-sandbox-checkout.tsx`](file:///d:/BorderBrief%20AI/src/components/payment/paypal-sandbox-checkout.tsx) | Step 5 UI integration, PayPal JS SDK lifecycle, interactive smart buttons, progress indicators, and verified receipt rendering. |
| [`src/tests/paypal-integration.test.ts`](file:///d:/BorderBrief%20AI/src/tests/paypal-integration.test.ts) | Automated unit and integration test suite (26 passing tests + 1 opt-in test). |

---

## 3. Findings Classified by Severity

### Finding 1: Unverified Webhook Capture Marking Invoice Paid
- **Severity:** **CRITICAL** (DEF-06-01)
- **Component:** `POST /api/payments/paypal/webhook`
- **Description:** Previously, receipt of a cryptographically valid `PAYMENT.CAPTURE.COMPLETED` webhook event updated the payment to `COMPLETED` and marked the invoice `PAID` without verifying whether the capture amount or currency matched the saved commercial invoice, without checking whether the payment was already in an incompatible terminal state (`REFUNDED`, `FAILED`, `CANCELLED`), and without validating associated invoice existence.
- **Risk:** An attacker or rogue Sandbox event with a valid signature for an arbitrary order or mismatched amount (e.g. $1.00 on a $271.00 invoice) could mark a commercial invoice as `PAID`.
- **Correction Made:** Implemented a strict 7-point pre-completion verification barrier in `route.ts`:
  1. Verified local PayPal order mapping via `getPaymentByOrderId` and fallback `getPaymentByCaptureId`.
  2. Verified associated invoice existence via `getInvoice(payment.invoiceId)`.
  3. Extracted capture amount and currency; if missing/untrusted, fetched authoritative order details from PayPal via `getPayPalOrderDetails`.
  4. Verified exact currency match (`capturedCurrency === invoice.currency`).
  5. Verified exact monetary match in integer minor units using `areAmountsEqual(numericAmount, invoice.invoiceTotalUSD, currency)`.
  6. Enforced terminal state preservation: blocked state transitions if payment is in terminal `REFUNDED`, `FAILED`, or `CANCELLED` status.
  7. Mismatches automatically set payment to `FAILED` and return HTTP 422, preserving invoice draft status.

---

### Finding 2: Refunded Payments Left Associated Invoice Marked as Paid
- **Severity:** **HIGH** (DEF-06-02)
- **Component:** `updatePaymentStatus()` in `src/lib/db/database.ts` & `src/types/invoice.ts`
- **Description:** When a `PAYMENT.CAPTURE.REFUNDED` webhook was received, `updatePaymentStatus()` updated `payments.status` to `REFUNDED`, but left `invoices.status` as `'PAID'` in both the SQLite relational column and the embedded `invoice_data_json`.
- **Risk:** Exporters reviewing commercial invoices would see an invoice marked `PAID` despite the funds having been fully refunded on PayPal.
- **Correction Made:**
  - Expanded `CommercialInvoiceDraft.status` in [`src/types/invoice.ts`](file:///d:/BorderBrief%20AI/src/types/invoice.ts) to `"DRAFT" | "ISSUED" | "PAID" | "REFUNDED"`.
  - Added optional `refundInfo` audit object to `CommercialInvoiceDraft`.
  - Updated `updatePaymentStatus()` in [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts) so that upon `status === "REFUNDED"`, it updates both `invoices.status = 'REFUNDED'` and deserialized `invoice_data_json.status = "REFUNDED"` with audit timestamps, capture IDs, and reason.

---

### Finding 3: Floating-Point Epsilon Drift in Amount Comparisons
- **Severity:** **HIGH** (DEF-06-03)
- **Component:** `src/app/api/payments/paypal/capture-order/route.ts` & `paypal-client.ts`
- **Description:** Financial amounts were compared using floating-point subtraction: `Math.abs(capturedAmount - expectedAmount) > 0.01`. In IEEE 754 floating point arithmetic, values like `271.01 - 271.00` equal `0.010000000000019327`, which exceeds `0.01` and could trigger false `CAPTURE_AMOUNT_MISMATCH` errors.
- **Correction Made:**
  - Engineered `toMinorUnits(amount, currency)` in [`src/lib/paypal/paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts) to convert amounts to integer minor units (e.g. cents, pence, paise). Zero-decimal currencies (`JPY`, `HUF`, `TWD`) are rounded to integers; 2-decimal currencies are multiplied by 100.
  - Engineered `areAmountsEqual(amount1, amount2, currency)` to evaluate exact integer equality in minor units.
  - Replaced floating-point comparisons in `capture-order/route.ts` and `webhook/route.ts` with `areAmountsEqual`.

---

### Finding 4: Unrecoverable State on Post-Capture Database Write Failure
- **Severity:** **MEDIUM** (DEF-06-04)
- **Component:** `src/app/api/payments/paypal/capture-order/route.ts` & `src/lib/paypal/paypal-client.ts`
- **Description:** If PayPal successfully debited the buyer via Orders API v2, but SQLite encountered a transient error during `updatePaymentStatus()` (e.g. disk lock, process termination), the route returned a generic 500 error without capture metadata. When the user retried, PayPal's Orders API returned HTTP 422 `ORDER_ALREADY_CAPTURED`, which caused `capturePayPalOrder` to fail unrecoverably, stranding buyer funds without an updated local invoice.
- **Correction Made:**
  - In `capturePayPalOrder`: Added self-healing recovery. If PayPal returns HTTP 422 with `ORDER_ALREADY_CAPTURED`, the client retrieves the authoritative order details via `getPayPalOrderDetails(orderId)`. If a completed capture exists, it extracts the capture ID, amount, and status and returns them as a valid `CaptureOrderResult`.
  - In `capture-order/route.ts`: Wrapped `updatePaymentStatus()` in a dedicated try/catch after capture execution. If database write fails, it returns HTTP 500 with structured reconciliation metadata (`captureId`, `paypalOrderId`, `amount`, `reconciliationRequired: true`), allowing seamless retries to self-heal.
  - Enforced deterministic capture idempotency keys (`idempotencyKey || 'cap_order_' + orderId`) to prevent concurrent duplicate capture attempts at the PayPal API level.

---

### Finding 5: Public PII Exposure in Unauthenticated Payment Status Route
- **Severity:** **LOW** (DEF-06-05)
- **Component:** `GET /api/payments/[id]/route.ts`
- **Description:** The payment status endpoint returned raw `payerEmail` and `payerName` to any caller providing a valid payment or order ID. In a single-user demo lacking tenant authentication, public ID lookups should not leak personal customer email addresses.
- **Correction Made:**
  - Added email masking helper (`maskEmail`: e.g. `buyer@example.com` becomes `b***r@example.com`).
  - Added explicit payload documentation: `"demoNotice": "BorderBrief AI operates as a single-user unauthenticated demo. Multi-user tenant isolation is not configured. This endpoint is not an authorization boundary."`.

---

## 4. Summary of Corrections Made

1. **[`src/types/invoice.ts`](file:///d:/BorderBrief%20AI/src/types/invoice.ts):** Expanded `CommercialInvoiceDraft.status` to include `"REFUNDED"`; added `refundInfo` audit contract.
2. **[`src/lib/paypal/paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts):**
   - Added `toMinorUnits(amount, currency)` and `areAmountsEqual(amount1, amount2, currency)` for exact integer minor-unit financial comparisons.
   - Added `getPayPalCaptureDetails(captureId)` for authoritative capture retrieval.
   - Added self-healing recovery in `capturePayPalOrder` for PayPal HTTP 422 `ORDER_ALREADY_CAPTURED`.
3. **[`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts):**
   - Added `getPaymentByCaptureId(captureId)` for reverse capture lookups.
   - Synchronized invoice refund status (`invoices.status = 'REFUNDED'` and `invoice_data_json.status = "REFUNDED"`) upon payment refund.
4. **[`src/app/api/payments/paypal/capture-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/capture-order/route.ts):**
   - Switched to integer minor-unit comparison via `areAmountsEqual`.
   - Derived deterministic `PayPal-Request-Id` per order to enforce idempotency.
   - Wrapped database write in dedicated try/catch with `reconciliationRequired` payload.
5. **[`src/app/api/payments/[id]/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/%5Bid%5D/route.ts):**
   - Added `maskEmail` to protect PII.
   - Added explicit single-user demo notice in response headers and JSON body.
6. **[`src/app/api/payments/paypal/webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts):**
   - Enforced 7-point verification barrier on `PAYMENT.CAPTURE.COMPLETED`.
   - Enforced terminal state preservation (`REFUNDED`, `FAILED`, `CANCELLED`).
   - Server-side authoritative retrieval of order/capture details when webhook payload lacks reliable fields.
7. **[`src/tests/paypal-integration.test.ts`](file:///d:/BorderBrief%20AI/src/tests/paypal-integration.test.ts):**
   - Added 6 dedicated automated audit tests (tests 21–26) covering amount mismatch rejection, currency mismatch rejection, terminal REFUNDED state protection, invoice refund synchronization, minor-unit precision, and 422 `ORDER_ALREADY_CAPTURED` recovery.

---

## 5. Remaining Limitations

1. **Single-User Demo Boundary:** BorderBrief AI is engineered as an unauthenticated single-user demo application for hackathon presentation. Multi-tenant merchant onboarding (PayPal Partner Referrals API) and JWT user sessions are intentionally out of scope.
2. **Sandbox Environment Constraint:** Production live payments are strictly disabled. The system rejects live endpoint URLs by policy.
3. **Webhook Internet Ingress:** In a local development environment, PayPal cannot reach `http://localhost:3000/api/payments/paypal/webhook` without an HTTPS tunnel (e.g. ngrok or webhook simulator). The application provides complete offline simulation and cryptographic verification tests.

---

## 6. Verification & Test Suite Execution

All test suites were executed sequentially:

### 1. Automated Test Suite (`npm test`)
```
ℹ tests 211
ℹ suites 24
ℹ pass 209
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ duration_ms 1673.9ms
```
*(Skipped tests: 1 mock Gemini live test when no API key is provided; 1 opt-in live PayPal test when `RUN_LIVE_PAYPAL_TEST` is not set).*

### 2. TypeScript Static Typing (`npx tsc --noEmit`)
- **Status:** **PASS** (Exit code 0, 0 errors across all 24 test files and source modules).

### 3. ESLint Code Quality (`npm run lint`)
- **Status:** **PASS** (Exit code 0, 0 errors, 0 warnings across all files).

### 4. Next.js Production Build (`npm run build`)
- **Status:** **PASS** (Exit code 0; all 14 pages and API routes successfully compiled and statically optimized).

---

## 7. Audit Decisions

### Approval for Single-User Hackathon Demo
**STATUS: APPROVED**
Sprint 6 satisfies all architectural, security, financial, and Incoterms® requirements. The payment workflow collects exclusively seller receivables, strictly excludes U.S. import duties and fees, verifies captures server-side, validates amounts in integer minor units, and handles webhook edge cases with full idempotency and state preservation.

### Real PayPal Sandbox Transaction Status
**STATUS: UNTESTED IN LIVE SANDBOX (VERIFIED VIA DETERMINISTIC MOCK SUITE)**
Per audit guidelines, no live external HTTP call to `api-m.sandbox.paypal.com` was executed during this automated run because live credentials were not configured in `.env.local` and `RUN_LIVE_PAYPAL_TEST` was not set. The entire implementation was thoroughly verified across 26 comprehensive automated test scenarios with deterministic mocked responses mirroring official PayPal Orders API v2 contracts.

---

**Audit completed. No Sprint 7 work has been started.**

