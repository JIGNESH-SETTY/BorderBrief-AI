# BorderBrief AI — Sprint 8 Implementation Report: Cloud Database Migration & Deployment Preparation

**Date:** November 8, 2026  
**Project:** BorderBrief AI (*"Know the Rules. Know the Cost. Ship with Confidence."*)  
**Corridor:** India ($\text{IN}$) $\rightarrow$ United States ($\text{US}$) Export Trade Corridor  
**Deployment Target:** Vercel (Frontend & Serverless Edge/Node APIs) + Turso / libSQL (Persistent Cloud Database) + PayPal Sandbox (Payment Processing)  
**Status:** **SPRINT 8 IMPLEMENTATION COMPLETE — DEPLOYMENT CONFIGURATION AND LIVE INTEGRATION CHECKS PENDING**

---

## 1. Executive Summary

Sprint 8 successfully implemented the application architecture and cloud-compatible database adapter required for serverless cloud deployment. All core implementation objectives outlined in [`SPRINT8_DEPLOYMENT_READINESS_AUDIT.md`](./SPRINT8_DEPLOYMENT_READINESS_AUDIT.md) and validated in [`SPRINT8_IMPLEMENTATION_PREFLIGHT.md`](./SPRINT8_IMPLEMENTATION_PREFLIGHT.md) have been implemented and locally verified, with live Turso database connectivity confirmed. Final cloud deployment, Vercel environment variable configuration, and live external transaction verifications (live PayPal Sandbox buyer checkout, live webhook processing, and live Gemini API calls) remain pending.

### Key Milestones Achieved:
1. **Dual-Driver Database Architecture:** Implemented a unified, hybrid database layer in [`src/lib/db/database.ts`](./src/lib/db/database.ts) supporting both local synchronous `node:sqlite` (`borderbrief.db`) and asynchronous remote Turso via `@libsql/client` (over HTTPS/Hrana protocol).
2. **Atomic Batch Transactions:** Replaced stateless SQLite-specific HTTP-incompatible pragmas and raw `BEGIN IMMEDIATE;` locks with `@libsql/client` write batching (`client.batch([...], 'write')`), guaranteeing atomicity and rollback across multi-statement operations.
3. **Live Turso Cloud Verification:** Successfully connected to the live Turso cloud database (`borderbrief-db` hosted in AWS AP South - Mumbai), applied all 9 relational table DDLs, verified schema equivalence, and performed live atomic CRUD roundtrips without credential exposure.
4. **Demo Security & Passcode Gatekeeper:** Implemented a lightweight, evaluator-friendly access gate in [`src/middleware.ts`](./src/middleware.ts), [`src/lib/security/demo-auth.ts`](./src/lib/security/demo-auth.ts), and [`src/app/demo-login/page.tsx`](./src/app/demo-login/page.tsx). It protects public demonstrations using HttpOnly session cookies (`bb_demo_session`), disables destructive mutations (draft deletion), and **strictly exempts `/api/payments/paypal/webhook`** so PayPal Sandbox server-to-server callbacks are never blocked.
5. **Caller Modernization:** Updated all 8 core API route handlers, background services, and test suites to `await` database operations while preserving synchronous backward compatibility when an explicit `DatabaseSync` instance is passed (e.g. in test suites).
6. **Zero-Regression Quality Gates:** All 228 executed tests passed, with 3 opt-in live integration tests skipped and 0 failures (231 total tests across 31 test suites: 228 passed, 3 skipped, 0 failed), 0 TypeScript compiler errors (`npx tsc --noEmit`), 0 ESLint warnings (`npm run lint`), and a clean Turbopack production build (`npm run build`).

---

## 2. Exact Caller Reconciliation

Initial preflight inspections estimated caller touchpoints. A rigorous symbol audit revealed exactly **13 files** importing directly from [`src/lib/db/database.ts`](./src/lib/db/database.ts), plus 2 additional API routes consuming database services through [`src/lib/services/idempotency.ts`](./src/lib/services/idempotency.ts). All 15 files were reconciled and updated:

| Caller Category | File Path | DB Operations Invoked | Modernization Strategy |
|:---|:---|:---|:---|
| **API Route** | `src/app/api/invoices/route.ts` | `saveInvoice`, `listInvoices`, `getPaymentByInvoiceId` | Made all DB and idempotency operations `await`ed. Handled concurrent draft generation. |
| **API Route** | `src/app/api/invoices/[id]/route.ts` | `getInvoice`, `getInvoiceByNumber`, `deleteInvoice` | Added `await`. Integrated `isDemoMutationRestricted()` to block deletion in demo mode (HTTP 403). |
| **API Route** | `src/app/api/invoices/[id]/pdf/route.ts` | `getInvoice`, `getInvoiceByNumber` | Made invoice resolution `await`ed prior to streaming PDF binary buffer. |
| **API Route** | `src/app/api/payments/[id]/route.ts` | `getPayment`, `getPaymentByOrderId`, `getPaymentByInvoiceId` | Made all three lookup strategies asynchronous and `await`ed. |
| **API Route** | `src/app/api/payments/paypal/create-order/route.ts` | `getInvoice`, `savePayment` | Made invoice verification and initial payment record creation asynchronous and `await`ed. |
| **API Route** | `src/app/api/payments/paypal/capture-order/route.ts` | `getPaymentByOrderId`, `getInvoice`, `updatePaymentStatus` | `await`ed local payment retrieval, invoice lookup, and atomic status transition to `COMPLETED`. |
| **API Route** | `src/app/api/payments/paypal/webhook/route.ts` | `saveWebhookLog`, `isWebhookEventProcessed`, `getPaymentByOrderId`, `getPaymentByCaptureId`, `getInvoice`, `updatePaymentStatus` | All 6 methods `await`ed. Webhook endpoint explicitly exempt from demo auth middleware. |
| **API Route** | `src/app/api/tariffs/calculate/route.ts` | `saveLandedCostCalculation` | Made calculation persistence `await`ed. Cleanly binds all 12 parameters. |
| **API Route** | `src/app/api/products/analyze/route.ts` | Idempotency service store | Converted idempotency calls to `await` to persist deduplication records across serverless invocations. |
| **API Route** | `src/app/api/tariffs/classify/route.ts` | Idempotency service store | Converted idempotency calls to `await` for serverless-safe classification caching. |
| **Service Layer** | `src/lib/services/idempotency.ts` | `getIdempotencyKey`, `saveIdempotencyKey`, `completeIdempotencyKey`, `failIdempotencyKey` | Implemented dual-driver hybrid pattern: in-memory fast caching + async Turso / local SQLite fallback. |
| **Test Suite** | `src/tests/db-persistence.test.ts` | All DB methods | Passes explicit `DatabaseSync` (`memDb`), verified synchronous backward-compatibility. |
| **Test Suite** | `src/tests/integration-polish.test.ts` | `saveInvoice`, `savePayment`, `deleteInvoice` | Updated test harness to `await` database operations in `async` test blocks. |
| **Test Suite** | `src/tests/invoice-generator.test.ts` | `saveInvoice`, `getInvoice`, `listInvoices`, `deleteInvoice` | Preserved synchronous execution contract with local SQLite instance. |
| **Test Suite** | `src/tests/paypal-integration.test.ts` | `savePayment`, `getPayment`, `updatePaymentStatus`, `getInvoice` | Preserved synchronous unit test execution with local SQLite instance. |

---

## 3. Dual-Driver Database Architecture

### A. Architectural Overview
[`src/lib/db/database.ts`](./src/lib/db/database.ts) provides seamless switching between local development and cloud production:

```
                                  ┌─────────────────────────────┐
                                  │      Application Layer      │
                                  │   (API Routes & Services)   │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │     database.ts Adapter     │
                                  │    Unified Async Signatures │
                                  └──────┬───────────────┬──────┘
                                         │               │
                 TURSO_DATABASE_URL set? │               │ Fallback / memDb passed
                                         ▼               ▼
                      ┌──────────────────────┐  ┌──────────────────────┐
                      │    @libsql/client    │  │     node:sqlite      │
                      │  (Turso Cloud / HTTP)│  │ (Local / In-Memory)  │
                      └──────────┬───────────┘  └──────────┬───────────┘
                                 │                         │
                                 ▼                         ▼
                      ┌──────────────────────┐  ┌──────────────────────┐
                      │    borderbrief-db    │  │    borderbrief.db    │
                      │   (AWS AP South-1)   │  │   (Local Disk / RAM) │
                      └──────────────────────┘  └──────────────────────┘
```

### B. Driver Activation Rules
1. **Turso Cloud Mode:** Automatically activates when `TURSO_DATABASE_URL` is configured in the environment. All database calls connect over HTTPS using `@libsql/client` (version `0.18.0`).
2. **Local Development Mode:** When `TURSO_DATABASE_URL` is absent, the system initializes native Node.js `node:sqlite` (`DatabaseSync`) using WAL journal mode.
3. **Explicit Database Instance Mode:** When test suites pass an in-memory `DatabaseSync` instance (e.g. `getInvoice(id, memDb)`), the method operates 100% synchronously on that instance, completely bypassing external network calls and environment variables.

### C. Atomic Multi-Statement Writes
Under serverless HTTP execution, raw `BEGIN IMMEDIATE; ... COMMIT;` statements sent as separate HTTP requests cannot maintain transactional state across stateless connections. In `src/lib/db/database.ts`, all multi-statement operations are dispatched via:

```typescript
await client.batch(batchStmts, "write");
```

This ensures that:
- Parent records (e.g., placeholder products or draft invoices) and child records (e.g., payments or calculations) are committed atomically in a single network round-trip.
- If any statement in the batch fails, the entire transaction is automatically rolled back by Turso, preventing orphaned records.
- Lock contention is eliminated because the HTTP connection does not hold persistent database file locks.

---

## 4. Live Turso Cloud Verification

Live connectivity, DDL execution, and atomic operations were executed directly against the user's Turso cloud database (`borderbrief-db`) located in **AWS AP South (Mumbai)**.

### A. Table Audit
All 9 relational tables from [`src/lib/db/schema.ts`](./src/lib/db/schema.ts) were applied and confirmed in the remote database:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
```

| Table Name | Remote Status | Primary Key | Key Relationships / Indices |
|:---|:---:|:---|:---|
| `products` | **VERIFIED** | `id` | Parent entity for classifications and calculations. |
| `classifications` | **VERIFIED** | `id` | Linked to `products(id)`. Indexed on `suggested_hts10`. |
| `landed_cost_calculations` | **VERIFIED** | `id` | Linked to `products(id)` and `classifications(id)`. |
| `invoices` | **VERIFIED** | `id` | Unique `invoice_number`. Linked to `products(id)`. |
| `payments` | **VERIFIED** | `id` | Linked to `invoices(id)`. Unique on `paypal_order_id`. |
| `paypal_orders` | **VERIFIED** | `id` | Linked to `invoices(id)`. Unique on `order_id`. |
| `webhook_logs` | **VERIFIED** | `id` | Unique on `event_id`. Tracks verification status. |
| `idempotency_keys` | **VERIFIED** | `key` | Enforces request deduplication with `expires_at`. |
| `tariff_cache` | **VERIFIED** | `hts_code` | Caches statutory rates for sub-millisecond retrieval. |

### B. Live CRUD & Batch Verification
An opt-in automated test suite was created in [`src/tests/turso-live.test.ts`](./src/tests/turso-live.test.ts). When executed with credentials from `.env.local`:
- Successfully executed ping: `SELECT 1 AS alive` $\rightarrow$ `alive = 1`.
- Verified all 9 tables exist remotely.
- Executed atomic batch insert into `idempotency_keys` via `client.batch([...], 'write')`.
- Successfully queried back the written record.
- Executed clean deletion and verified zero residual test records.
- Output log confirmed **0 credentials, tokens, or URLs printed or exposed**.

---

## 5. Demo Security & Access Gatekeeper

To protect the public deployment during hackathon evaluation while preventing abuse:

### A. Configuration & Passcode Mechanism
- Gatekeeper is governed by the server-side environment variable `DEMO_ACCESS_SECRET`.
- When `DEMO_ACCESS_SECRET` is unset (local development), the gate is transparently inactive and permits all traffic.
- When configured, evaluators enter the passcode at `/demo-login`.
- Upon verification, the server issues a signed session cookie:
  - **Name:** `bb_demo_session`
  - **Flags:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800` (7 days), `Secure` (in production).
  - **Token Generation:** Computed via Web Crypto SHA-256 HMAC digest (`computeDemoToken`).
  - **Constant-Time Verification:** Compared using pure JS `constantTimeEqual` to prevent timing attacks.

### B. Web Crypto & Edge Compatibility
To ensure compatibility with Next.js Edge Middleware and avoid Node.js runtime warnings:
- [`src/lib/security/demo-auth.ts`](./src/lib/security/demo-auth.ts) uses `crypto.subtle` (standard Web Crypto API).
- Removed all `node:crypto` imports from the middleware boundary.
- [`src/middleware.ts`](./src/middleware.ts) operates cleanly in Edge runtime with 0 warnings.

### C. Mandatory Webhook Exemption
PayPal Sandbox sends asynchronous webhook events (e.g. `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`) directly from PayPal server IP pools. These external servers cannot present demo cookies or login passcodes.
- [`src/middleware.ts`](./src/middleware.ts) contains an **explicit, unbypassable exemption**:
  ```typescript
  if (pathname === "/api/payments/paypal/webhook") {
    return NextResponse.next();
  }
  ```
- Webhook security is strictly maintained cryptographically by PayPal RSA signature verification in [`src/app/api/payments/paypal/webhook/route.ts`](./src/app/api/payments/paypal/webhook/route.ts).

### D. Destructive Mutation Protection
To prevent accidental or malicious destruction of demo evaluation data:
- `DELETE /api/invoices/[id]` checks `isDemoMutationRestricted()`.
- If `DEMO_ACCESS_SECRET` is set or `NODE_ENV === "production"`, deletion requests are rejected with **HTTP 403 Forbidden**:
  ```json
  {
    "error": "Invoice deletion is disabled in shared demo environments to preserve evaluation state.",
    "code": "DEMO_MUTATION_RESTRICTED",
    "statusCode": 403
  }
  ```

### E. Evaluator Login Interface
- Created a polished, accessible UI in [`src/app/demo-login/page.tsx`](./src/app/demo-login/page.tsx).
- Fully wrapped in a React `<Suspense>` boundary to guarantee error-free Next.js static prerendering.
- Supports automatic redirect preservation via `?returnTo=/invoices`.

---

## 6. Frozen Logic & Compliance Preservation

Throughout the Sprint 8 database and security refactoring, all core business logic and statutory compliance rules established in Sprints 1–7 were strictly preserved:

1. **USITC 2026 Revision 22 Tariff Rate Integrity:**
   - Silk Shawl (`6214.10.10.00`) remains strictly at **1.2%** General Duty.
   - Ceramic Mug (`6912.00.44`) remains strictly at **10.0%** General Duty.
   - Sheesham Wood Coasters (`prod-wooden-coasters`) remain strictly under Heading 4419 (tableware and kitchenware of wood, excluded from residual basket Heading 4421 per CBP rulings NY N095158, NY N240071, and NY R04475), competing between candidate codes `4419.20.90.00` (3.2%) and `4419.90.91.00` (3.2%). Classification status remains `UNRESOLVED_AMBIGUITY` with `primaryRecord` as `null` (no definitive primary classification claimed), and landed-cost calculation strictly blocked with HTTP 422 (`CLASSIFICATION_AMBIGUITY_UNRESOLVED`).
   - Exactly 7 authentic Indian seed export profiles remain active.
2. **Incoterms 2020 DAP Financial Separation:**
   - Estimated US customs duties and MPF/HMF user fees (e.g. $40.75 on Silk Shawl) are strictly excluded from the seller receivable invoice total and PayPal checkout order.
   - Customs duties remain clearly designated as payable directly by the US buyer/importer upon port arrival.
3. **Pure Zero-Dependency PDF Engine:**
   - [`src/lib/invoice/pdf-generator.ts`](./src/lib/invoice/pdf-generator.ts) remains 100% pure TypeScript/JavaScript producing genuine binary PDF documents starting with `%PDF-`.
   - Zero native C++ or canvas dependencies (e.g., no Puppeteer, no `canvas`, no `pdfkit`).
4. **Integer Minor-Unit PayPal Math:**
   - Preserved `toMinorUnits` and `areAmountsEqual` in [`src/lib/paypal/paypal-client.ts`](./src/lib/paypal/paypal-client.ts) to eliminate IEEE 754 floating-point drift across all financial comparisons.
5. **AI Vision & Classification Model:**
   - Authoritative default cloud model remains locked to `gemini-2.5-flash` in [`src/lib/services/gemini-service.ts`](./src/lib/services/gemini-service.ts).
   - Strict demo fallback mode remains active when `GEMINI_API_KEY` is omitted.

---

## 7. Comprehensive Test Verification

All automated test suites were executed locally using Node.js native test runner (`node --test`).

### A. Offline Test Suite Execution
```bash
npm test
```
```
ℹ tests 231
ℹ suites 31
ℹ pass 228
ℹ fail 0
ℹ cancelled 0
ℹ skipped 3
ℹ todo 0
ℹ duration_ms 2727.474
```
- **Total Test Count:** 231 tests across 31 suites.
- **Passed:** **228 tests**.
- **Failed:** **0 tests**.
- **Skipped (Opt-In Guarded):** 3 tests across the offline test run:
  1. `src/tests/paypal-live.test.ts`: Skipped because live PayPal Sandbox checkout, capture, and webhook verification require an active public HTTPS domain with registered webhooks; no actual PayPal Sandbox checkout and capture transaction has yet been completed.
  2. `src/tests/gemini-live.test.ts`: Skipped during this Sprint 8 test run because `GEMINI_API_KEY` was not populated in `.env.local`; offline deterministic fallback mode passed 100%.
  3. `src/tests/turso-live.test.ts`: Skipped in the offline suite to prevent network dependency; verified separately via the dedicated opt-in live execution documented below.

### B. Live Turso Cloud Suite Execution
```bash
cmd /c "set RUN_LIVE_TURSO_TEST=true&& node --env-file=.env.local --test --experimental-strip-types src/tests/turso-live.test.ts"
```
```
▶ Sprint 8: Turso Cloud Database Live Suite
  ✔ verifies live Turso cloud connectivity, schema, and atomic batching (opt-in) (2478.364ms)
✔ Sprint 8: Turso Cloud Database Live Suite (2482.7688ms)
ℹ tests 1
ℹ suites 1
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```
- Real cloud round-trip latency to AWS AP South (Mumbai): **2.48 seconds**.
- Remote schema confirmed. Atomic batch write and immediate cleanup verified.

---

## 8. Quality Gates & Build Verification

### A. TypeScript Type Check
```bash
npx tsc --noEmit
```
- **Exit Code:** `0` (Clean).
- **Errors:** `0`.
- **Validation:** All synchronous test overloads and asynchronous route handler signatures compile without any `any` leaks or unhandled promises.

### B. ESLint Static Analysis
```bash
npm run lint
```
- **Exit Code:** `0` (Clean).
- **Warnings / Errors:** `0`.
- **Validation:** All 15 modified files adhere strictly to project ESLint rules.

### C. Next.js Production Build
```bash
npm run build
```
```
▲ Next.js 16.4.5 (Turbopack)
- Environments: .env.local
✓ Running next.config.js took 52ms
- Experiments (use with caution):
  · serverActions
✓ Compiled successfully in 3.5s
  Running TypeScript ...
  Finished TypeScript in 4.8s ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (17/17) in 1138ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/demo/auth
├ ƒ /api/invoices
├ ƒ /api/invoices/[id]
├ ƒ /api/invoices/[id]/pdf
├ ƒ /api/invoices/generate-pdf
├ ƒ /api/payments/[id]
├ ƒ /api/payments/paypal/capture-order
├ ƒ /api/payments/paypal/config
├ ƒ /api/payments/paypal/create-order
├ ƒ /api/payments/paypal/webhook
├ ƒ /api/products/analyze
├ ƒ /api/tariffs/calculate
├ ƒ /api/tariffs/classify
├ ○ /corridor/india-usa
├ ○ /demo-login
├ ○ /export/new
└ ○ /invoices

ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
- **Exit Code:** `0` (Clean).
- **Turbopack Compilation:** 3.5 seconds.
- **Static Prerendering:** All 6 UI pages prerendered successfully with zero CSR bailout warnings.
- **API Packaging:** All 13 API endpoints packaged cleanly as dynamic serverless functions.
- **Edge Middleware:** Packaged cleanly with zero unsupported runtime modules.

---

## 9. Deployment Configuration Matrix & Pending Live Checks

No Vercel deployment has been performed yet. When deploying to Vercel (or equivalent serverless host), the following environment variables must be configured in project settings, followed by post-deployment live verification:

### A. Environment Configuration Matrix

| Environment Variable Name | Purpose | Current Local Status | Vercel Deployment Action Required | Sensitivity |
|:---|:---|:---:|:---|:---:|
| `TURSO_DATABASE_URL` | Cloud database URL | Configured | Copy from `.env.local` to Vercel Environment | Secret |
| `TURSO_AUTH_TOKEN` | Read & Write auth token | Configured | Copy from `.env.local` to Vercel Environment | **High Secret** |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox Client ID | Configured | Copy from `.env.local` to Vercel Environment | Config |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox Client Secret | Configured | Copy from `.env.local` to Vercel Environment | **High Secret** |
| `PAYPAL_BASE_URL` | PayPal REST API endpoint | Configured (`https://api-m.sandbox.paypal.com`) | Copy from `.env.local` to Vercel Environment | Standard |
| `PAYPAL_WEBHOOK_ID` | Registered PayPal Webhook ID | **Empty / Pending** | Register webhook in PayPal Developer Dashboard after public URL is live, then add ID to Vercel | Config |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash API Key | **Pending for Cloud** | Add Google AI Studio API key to Vercel for live multimodal extraction | **High Secret** |
| `DEMO_ACCESS_SECRET` | Passcode for hackathon demo | **Pending for Cloud** | Add evaluator passcode in Vercel to activate demo gate | Secret |
| `NEXT_PUBLIC_APP_URL` | Canonical public application URL | **Pending for Cloud** | Set to assigned public Vercel domain (e.g. `https://borderbrief-ai.vercel.app`) | Standard |

*(Note: In strict compliance with security standards, actual credential values are excluded from this report).*

### B. Pending Post-Deployment Verification Items
The following live integrations and transactions remain pending until cloud deployment:
1. **Copying Variables to Vercel:** Transferring the 5 locally verified Turso and PayPal Sandbox credentials from `.env.local` to Vercel project environment settings.
2. **Setting Cloud Keys:** Configuring `GEMINI_API_KEY`, `DEMO_ACCESS_SECRET`, and `NEXT_PUBLIC_APP_URL` in Vercel.
3. **Webhook Registration:** Registering the live endpoint (`https://<domain>/api/payments/paypal/webhook`) in PayPal Developer Dashboard to obtain `PAYPAL_WEBHOOK_ID`.
4. **Actual PayPal Sandbox Transaction:** Performing a real end-to-end checkout, capture, and webhook event verification using a PayPal Sandbox buyer account on the deployed domain.
5. **Live Gemini Extraction Verification:** Executing live multimodal product analysis against Google AI Studio on the deployed serverless instance.

---

## 10. Sprint 8 Completion Verdict

```
=============================================================================
  FINAL VERDICT: SPRINT 8 IMPLEMENTATION COMPLETE — DEPLOYMENT CONFIGURATION 
                     AND LIVE INTEGRATION CHECKS PENDING
=============================================================================
```

### Justification:
1. **Implementation & Architecture Complete:** Fully operational dual-driver database adapter with atomic batching implemented and verified. All callers modernized, demo gatekeeper implemented with Web Crypto, and 0-dependency PDF / Incoterms / tariff compliance preserved.
2. **Verified Test & Build Baseline:** 228 passed automated offline tests (0 failed, 3 skipped), 1 passed live Turso cloud test (verifying schema, ping, and batch transaction against AWS AP South Mumbai), 0 TypeScript errors, 0 ESLint warnings, and successful Next.js 16.4.5 Turbopack production build.
3. **Deployment Configuration Pending:** No Vercel deployment has been performed. Required environment variables (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`) must be copied into Vercel settings, and cloud-only variables (`GEMINI_API_KEY`, `DEMO_ACCESS_SECRET`, `NEXT_PUBLIC_APP_URL`) must be configured.
4. **Live Integration Verification Pending:** Actual end-to-end PayPal Sandbox buyer checkout, capture, and server-to-server webhook delivery remain pending deployment to a public HTTPS domain. Live Gemini API extraction remains pending API key configuration in Vercel.
5. **Deployment Boundary Respected:** In strict compliance with user directives, **no public deployment has been initiated, and no Git push has been performed**. Sprint 8 implementation and documentation corrections are complete locally. Final Git inspection remains pending before staging and committing.

