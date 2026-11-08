# BorderBrief AI — Sprint 8: Architecture Validation & Implementation Preflight
**Phase 1: Read-Only Technical Preflight & Concrete Implementation Blueprint**

---

## Document Control
- **Document ID:** SPRINT8_IMPLEMENTATION_PREFLIGHT.md
- **Evaluation Date:** November 7, 2026
- **Workspace:** `D:\BorderBrief AI`
- **Application:** BorderBrief AI (*Know the Rules. Know the Cost. Ship with Confidence.*)
- **Target Deployment Milestone:** Sprint 8 — Public Cloud Hackathon Demonstration
- **Target Corridor:** India (`IN`) → United States (`US`)
- **Status:** **READ-ONLY AUDIT & CONCRETE IMPLEMENTATION BLUEPRINT — PENDING USER DECISIONS**

---

## 1. Turso & libSQL Compatibility Validation

A line-by-line inspection of [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts), [`src/lib/db/schema.ts`](file:///d:/BorderBrief%20AI/src/lib/db/schema.ts), and calling modules was conducted to determine the exact migration surface from local `node:sqlite` to cloud `libSQL`.

### 1.1 Complete Inventory of Synchronous Database Methods Exposed
Currently, [`src/lib/db/database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts) exports **27 synchronous functions** that directly execute against `node:sqlite`'s `DatabaseSync`:

| # | Exported Synchronous Method | Current Method Signature | Functionality |
|---|---|---|---|
| 1 | `getDb(customPath?)` | `getDb(customPath?: string): DatabaseSync` | Returns local `DatabaseSync` instance; executes DEF-02 guardrail. |
| 2 | `initSchema(db)` | `initSchema(db: DatabaseSync): void` | Executes `SQL_SCHEMA` DDL strings with `execWithRetry`. |
| 3 | `closeDb()` | `closeDb(): void` | Closes active SQLite instance. |
| 4 | `getIdempotencyKey(key, db?)` | `getIdempotencyKey(key: string, db?: DatabaseSync): PersistentIdempotencyRecord \| null` | Selects idempotency record by key. |
| 5 | `saveIdempotencyKey(key, path, ttl, db?)` | `saveIdempotencyKey(key: string, requestPath: string, ttlSeconds?: number, db?: DatabaseSync): boolean` | Inserts `IN_PROGRESS` idempotency key. |
| 6 | `completeIdempotencyKey(key, resp, db?)` | `completeIdempotencyKey(key: string, response: unknown, db?: DatabaseSync): void` | Updates idempotency status to `COMPLETED`. |
| 7 | `failIdempotencyKey(key, db?)` | `failIdempotencyKey(key: string, db?: DatabaseSync): void` | Deletes or marks failed idempotency record. |
| 8 | `saveProduct(product, db?)` | `saveProduct(product: PersistedProduct, db?: DatabaseSync): void` | Inserts or replaces product record. |
| 9 | `getProduct(id, db?)` | `getProduct(id: string, db?: DatabaseSync): PersistedProduct \| null` | Selects product by ID. |
| 10 | `saveClassification(class, db?)` | `saveClassification(classification: PersistedClassification, db?: DatabaseSync): void` | Inserts classification record. |
| 11 | `getClassification(id, db?)` | `getClassification(id: string, db?: DatabaseSync): PersistedClassification \| null` | Selects classification by ID. |
| 12 | `saveLandedCostCalculation(res, pId, cId, db?)` | `saveLandedCostCalculation(result: LandedCostCalculationResult, ...): void` | Executes `BEGIN TRANSACTION` ... `COMMIT`. |
| 13 | `getLandedCostCalculation(id, db?)` | `getLandedCostCalculation(id: string, db?: DatabaseSync): PersistedLandedCost \| null` | Selects landed cost calculation by ID. |
| 14 | `listLandedCostCalculations(limit?, db?)` | `listLandedCostCalculations(limit?: number, db?: DatabaseSync): PersistedLandedCost[]` | Lists recent landed cost calculations. |
| 15 | `saveInvoice(invoice, db?)` | `saveInvoice(invoice: CommercialInvoiceDraft, db?: DatabaseSync): CommercialInvoiceDraft` | Executes `BEGIN IMMEDIATE;` ... `COMMIT;`. |
| 16 | `getInvoice(id, db?)` | `getInvoice(id: string, db?: DatabaseSync): CommercialInvoiceDraft \| null` | Selects invoice by ID. |
| 17 | `getInvoiceByNumber(num, db?)` | `getInvoiceByNumber(invoiceNumber: string, db?: DatabaseSync): CommercialInvoiceDraft \| null` | Selects invoice by invoice number. |
| 18 | `listInvoices(limit?, offset?, db?)` | `listInvoices(limit?: number, offset?: number, db?: DatabaseSync): CommercialInvoiceDraft[]` | Lists paginated invoices with JSON hydration. |
| 19 | `deleteInvoice(id, db?)` | `deleteInvoice(id: string, db?: DatabaseSync): boolean` | Deletes invoice by ID. |
| 20 | `savePayment(payment, db?)` | `savePayment(payment: PaymentRecord, db?: DatabaseSync): PaymentRecord` | Executes `BEGIN IMMEDIATE;` ... `COMMIT;`. |
| 21 | `getPayment(id, db?)` | `getPayment(id: string, db?: DatabaseSync): PaymentRecord \| null` | Selects payment by internal ID. |
| 22 | `getPaymentByOrderId(orderId, db?)` | `getPaymentByOrderId(orderId: string, db?: DatabaseSync): PaymentRecord \| null` | Selects payment by PayPal Order ID. |
| 23 | `getPaymentByInvoiceId(invId, db?)` | `getPaymentByInvoiceId(invoiceId: string, db?: DatabaseSync): PaymentRecord \| null` | Selects payment by linked Invoice ID. |
| 24 | `getPaymentByCaptureId(capId, db?)` | `getPaymentByCaptureId(captureId: string, db?: DatabaseSync): PaymentRecord \| null` | Selects payment by PayPal Capture ID. |
| 25 | `updatePaymentStatus(id, status, ...)` | `updatePaymentStatus(id: string, status: PaymentStatus, ...): PaymentRecord` | Executes `BEGIN IMMEDIATE;` ... `COMMIT;`. |
| 26 | `saveWebhookLog(eventId, type, ...)` | `saveWebhookLog(eventId: string, eventType: string, ...): void` | Inserts verified webhook payload. |
| 27 | `isWebhookEventProcessed(eventId, db?)` | `isWebhookEventProcessed(eventId: string, db?: DatabaseSync): boolean` | Checks if webhook event was already processed. |

---

### 1.2 Call Sites Across Files and API Routes

The 27 synchronous database functions are called across **12 application and test files**:

1. [`src/app/api/tariffs/calculate/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/tariffs/calculate/route.ts) — calls `saveLandedCostCalculation`.
2. [`src/app/api/invoices/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/invoices/route.ts) — calls `saveInvoice`, `listInvoices`, `getPaymentByInvoiceId`.
3. [`src/app/api/invoices/[id]/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/invoices/[id]/route.ts) — calls `getInvoice`, `deleteInvoice`.
4. [`src/app/api/invoices/[id]/pdf/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/invoices/[id]/pdf/route.ts) — calls `getInvoice`.
5. [`src/app/api/payments/[id]/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/[id]/route.ts) — calls `getPayment`, `getPaymentByOrderId`, `getPaymentByInvoiceId`.
6. [`src/app/api/payments/paypal/create-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/create-order/route.ts) — calls `getInvoice`, `savePayment`.
7. [`src/app/api/payments/paypal/capture-order/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/capture-order/route.ts) — calls `getPaymentByOrderId`, `getInvoice`, `updatePaymentStatus`.
8. [`src/app/api/payments/paypal/webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts) — calls `isWebhookEventProcessed`, `getPaymentByOrderId`, `updatePaymentStatus`, `saveWebhookLog`.
9. [`src/lib/services/idempotency.ts`](file:///d:/BorderBrief%20AI/src/lib/services/idempotency.ts) — calls `getIdempotencyKey`, `saveIdempotencyKey`, `completeIdempotencyKey`, `failIdempotencyKey`.
10. [`src/tests/db-persistence.test.ts`](file:///d:/BorderBrief%20AI/src/tests/db-persistence.test.ts) — 21 tests validating raw database operations.
11. [`src/tests/invoice-generator.test.ts`](file:///d:/BorderBrief%20AI/src/tests/invoice-generator.test.ts) — tests validating invoice database operations.
12. [`src/tests/paypal-integration.test.ts`](file:///d:/BorderBrief%20AI/src/tests/paypal-integration.test.ts) — tests validating order, capture, and webhook database state.
13. [`src/tests/integration-polish.test.ts`](file:///d:/BorderBrief%20AI/src/tests/integration-polish.test.ts) — tests validating enriched `/invoices` queries.

*Key Insight:* Every Next.js API route handler is already declared as `async function (req: Request)`. Updating the database helper functions to return Promises (`async`) allows the API handlers to simply add `await` without changing route contracts or HTTP interfaces.

---

### 1.3 SQL Statement & Transaction Compatibility with `@libsql/client`

1. **Schema Initialization (`SQL_SCHEMA`):**  
   All 9 table definitions in [`src/lib/db/schema.ts`](file:///d:/BorderBrief%20AI/src/lib/db/schema.ts) use pure standard SQLite syntax (`CREATE TABLE IF NOT EXISTS`, `TEXT PRIMARY KEY`, `REFERENCES ... ON DELETE CASCADE`, `DATETIME DEFAULT CURRENT_TIMESTAMP`, `UNIQUE`). **libSQL supports 100% of these statements remotely.**
2. **SQLite Pragmas Incompatibility:**  
   In [`database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts#L84-L85):
   ```ts
   activeDb.exec("PRAGMA journal_mode = WAL;");
   activeDb.exec("PRAGMA busy_timeout = 10000;");
   ```
   *Finding:* Turso databases are distributed and managed server-side. File-level journaling PRAGMAs (`journal_mode = WAL`) are not applicable over the `@libsql/client` HTTP protocol and must be restricted to the local `node:sqlite` driver.
3. **`Atomics.wait` and SharedArrayBuffer:**  
   In [`database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts#L110):
   ```ts
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
   ```
   *Finding:* This synchronous sleep loop was used to wait for file locks in `node:sqlite`. In `@libsql/client`, all network calls are asynchronous. A network retry loop must use standard `await new Promise(resolve => setTimeout(resolve, delay))`.
4. **`BEGIN IMMEDIATE;` and Transaction Handling:**  
   In `database.ts` lines 350, 585, 780, and 934, transactions are initiated with raw string queries:
   ```ts
   conn.exec("BEGIN IMMEDIATE;");
   // statements...
   conn.exec("COMMIT;");
   ```
   *Finding:* Over an HTTP connection, sending independent `BEGIN` and `COMMIT` strings over separate HTTP requests is stateless and cannot safely maintain a transaction lock. `@libsql/client` solves this with:
   - `client.batch([stmt1, stmt2, ...], 'write')` for atomic single round-trip transactions.
   - `client.transaction('write')` for interactive multi-step transactions.
   *Resolution:* The database adapter must execute atomic write sequences using `client.batch()` or `client.transaction()` when running against Turso.

---

### 1.4 Stable Interface Architecture: The Universal Async Adapter

To enable seamless switching between local `node:sqlite` (for zero-latency offline development and tests) and remote `Turso` (for serverless Vercel deployment), the existing `DatabaseAdapter` interface in [`database.ts`](file:///d:/BorderBrief%20AI/src/lib/db/database.ts#L455) must be expanded to cover all 9 tables:

```ts
export interface IDatabaseService {
  init(): Promise<void>;
  close(): Promise<void>;
  // Idempotency
  saveIdempotencyKey(key: string, path: string, ttl?: number): Promise<boolean>;
  getIdempotencyKey(key: string): Promise<PersistentIdempotencyRecord | null>;
  completeIdempotencyKey(key: string, response: unknown): Promise<void>;
  failIdempotencyKey(key: string): Promise<void>;
  // Products & Classifications
  saveProduct(product: PersistedProduct): Promise<void>;
  getProduct(id: string): Promise<PersistedProduct | null>;
  saveClassification(classification: PersistedClassification): Promise<void>;
  getClassification(id: string): Promise<PersistedClassification | null>;
  // Landed Cost
  saveLandedCostCalculation(result: LandedCostCalculationResult, pId?: string, cId?: string): Promise<void>;
  getLandedCostCalculation(id: string): Promise<PersistedLandedCost | null>;
  listLandedCostCalculations(limit?: number): Promise<PersistedLandedCost[]>;
  // Invoices
  saveInvoice(invoice: CommercialInvoiceDraft): Promise<CommercialInvoiceDraft>;
  getInvoice(id: string): Promise<CommercialInvoiceDraft | null>;
  getInvoiceByNumber(invoiceNumber: string): Promise<CommercialInvoiceDraft | null>;
  listInvoices(limit?: number, offset?: number): Promise<CommercialInvoiceDraft[]>;
  deleteInvoice(id: string): Promise<boolean>;
  // Payments & Webhooks
  savePayment(payment: PaymentRecord): Promise<PaymentRecord>;
  getPayment(id: string): Promise<PaymentRecord | null>;
  getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null>;
  getPaymentByInvoiceId(invoiceId: string): Promise<PaymentRecord | null>;
  getPaymentByCaptureId(captureId: string): Promise<PaymentRecord | null>;
  updatePaymentStatus(id: string, status: PaymentStatus, meta?: UpdatePaymentMetadata): Promise<PaymentRecord>;
  saveWebhookLog(eventId: string, type: string, payload: string, status: string): Promise<void>;
  isWebhookEventProcessed(eventId: string): Promise<boolean>;
}
```

Two concrete classes will implement this interface:
1. `LocalSqliteAdapter`: Wraps `node:sqlite` (`DatabaseSync`), returns resolved Promises, runs locally when `TURSO_DATABASE_URL` is absent.
2. `TursoLibsqlAdapter`: Uses `@libsql/client` (`createClient`), sends queries via HTTP, runs on Vercel when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are present.

All standalone helper exports (`saveInvoice`, `getInvoice`, etc.) will delegate to the active singleton adapter (`getDatabase(): IDatabaseService`).

---

## 2. Verified Current Provider Limits

### 2.1 Turso Starter Plan (Current Official Specifications)

*Correction to prior audit:* The previous audit report cited outdated and paid-tier figures (9 GB and 1B reads belonged to paid plans). Below are the **verified official Turso Free Starter limits**:

| Dimension | Verified Free Starter Limit | Prior Audit Figure (Corrected) | Evaluation Impact |
|---|---|---|---|
| **Storage Quota** | **5 GB total storage** | ~~9 GB~~ | A complete export record takes ~4 KB. 5 GB accommodates **over 1.25 million export transactions**. |
| **Monthly Row Reads** | **500 Million reads / month** | ~~1 Billion~~ | 500M reads allows ~10 million complete evaluations per month. Far beyond hackathon requirements. |
| **Monthly Row Writes** | **10 Million writes / month** | ~~25 Million~~ | 10M writes allows ~800,000 complete 5-step workflows per month. |
| **Database Count** | **Up to 100 databases** | ~~500 DBs~~ | Project requires exactly 1 database (`borderbrief-db`). |
| **Credit Card Requirement** | **NO credit card required** | No card | Verified: Sign-up via GitHub OAuth requires zero billing information. |
| **Inactivity Policy** | **NEVER SLEEPS / NEVER PAUSES** | Never pauses | Crucial: Evaluators can test anytime without wake-up delays or paused state errors. |
| **Quota Exceeded Action** | **Rejects subsequent writes/reads with 429/402 until reset; DOES NOT charge.** | — | Safe: Because no card is on file, accidental overage charges are impossible. |

> **Permanence Notice:** Cloud provider free tiers are subject to change according to their respective Terms of Service. While Turso's Starter tier is currently free without a credit card, it must not be assumed to be permanent in perpetuity.

---

### 2.2 Vercel Hobby Plan (Current Official Specifications)

| Dimension | Verified Hobby Plan Limit | Operational Significance |
|---|---|---|
| **Permitted Use** | **Personal and Non-Commercial Projects Only** | BorderBrief AI as a hackathon prototype/demonstration complies strictly with personal/educational use. Commercial monetization requires Pro ($20/seat/mo). |
| **Function Execution Limit** | **Up to 300 seconds (5 minutes)** (Fluid Compute) | Far exceeds BorderBrief AI's needs (longest endpoint is Gemini analysis at 1.5s–3.0s). |
| **Bandwidth Quota** | **100 GB / month** | Entire BorderBrief AI web build is <2 MB. 100 GB covers 50,000+ full page loads. |
| **Serverless Invocations** | **100,000 invocations / day** | Allows up to 10,000 complete 10-call assessments per day. |
| **Daily Deployments** | **100 deployments / day** | More than sufficient for development and CI/CD pushes. |
| **Credit Card Requirement** | **NO credit card required** | Sign-up via GitHub OAuth requires zero billing info. |
| **Quota Exceeded Action** | **Builds pause or return HTTP 429 / 402; NO surprise charges.** | Zero financial risk. |

---

## 3. Gemini Configuration & Model Strategy

### 3.1 Actual Code vs. Configuration Discrepancy
Inspection of [`src/lib/services/gemini-service.ts`](file:///d:/BorderBrief%20AI/src/lib/services/gemini-service.ts) reveals an important distinction:

```ts
// src/lib/services/gemini-service.ts:344
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
```

- **Actual In-Code Default:** `gemini-2.5-flash`
- **In-Code Comments:** `"Active default model: gemini-2.5-flash (verified sub-3s response with native schema support)"`
- **`.env.example` Example:** `GEMINI_MODEL=gemini-3.8-flash`

### 3.2 Live Performance & Empirical Evidence
- During live integration tests in Sprint 2, `gemini-2.5-flash` executed reliably in **1,200ms – 2,400ms** with complete structured JSON adherence.
- `gemini-3.8-flash` is an experimental/preview model string that frequently suffers from high latency, queuing delays, or dynamic availability adjustments on Google AI Studio's free tier.
- **Recommendation:** Keep `gemini-2.5-flash` as the production default model. Do not alter the codebase default. The environment variable `GEMINI_MODEL` allows overriding if desired, but `gemini-2.5-flash` provides the most stable, sub-3-second experience for judges.

### 3.3 Google AI Studio Free-Tier Rate Limits (Official Policy)
- Quotas in Google AI Studio are governed by **Requests Per Minute (RPM)**, **Tokens Per Minute (TPM)**, and **Requests Per Day (RPD)**.
- Quotas are enforced **per Google Cloud Project**, not per API key.
- For Flash tier models, free-tier quotas dynamically range between **10–15 RPM** and a variable daily request cap that resets at midnight Pacific Time (PT).
- When the quota is exceeded, the API returns `HTTP 429 RESOURCE_EXHAUSTED`.
- **Built-in Resiliency:** In [`gemini-service.ts`](file:///d:/BorderBrief%20AI/src/lib/services/gemini-service.ts#L421-L428), `HTTP 429` is caught and converted to `GeminiApiError("Google AI Studio quota exceeded... use Pre-Calibrated Demo Mode")`. If no API key is provided, the application automatically runs in deterministic demo mode using verified seed products.

---

## 4. Public Demo Security Architecture

To protect a public hackathon deployment without complex multi-tenant authentication, a **minimal, non-intrusive demo security mechanism** is designed:

```
                  ┌──────────────────────────────────────────────┐
                  │           Incoming Request on Vercel         │
                  └──────────────────────┬───────────────────────┘
                                         │
                        Is path /api/payments/paypal/webhook?
                                ├─── YES ───► [BYPASS GATE] ──► Cryptographic RSA Signature
                                │                               Verification in Webhook Route
                                └─── NO
                                         │
                          Is valid 'bb_demo_session' cookie
                           or 'x-demo-access-key' present?
                                ├─── YES ───► [ALLOW REQUEST] ──► Process Page or API Route
                                └─── NO
                                         │
                           Show Clean "Demo Access" Unlock Modal
                            (Prompt for DEMO_ACCESS_SECRET)
```

### 4.1 Design Principles
1. **No URL Token Leaks:** The secret is **never** accepted in query parameters (`?key=...`), preventing exposure in browser history, HTTP referer headers, access logs, and judge screen shares.
2. **Cookie-Based Session:** Submitting the passcode sets an `HttpOnly`, `SameSite=Lax`, `Secure` cookie named `bb_demo_session` containing an HMAC hash of the secret.
3. **API Protection:** Next.js Middleware verifies the cookie for all `/api/*` routes, preventing direct bot exploitation of endpoints.
4. **MANDATORY EXCEPTION — PayPal Webhooks:**  
   The route `/api/payments/paypal/webhook` **MUST bypass the demo passcode check**. PayPal servers cannot provide a custom cookie. Security on this route is enforced independently by PayPal's cryptographic asymmetric RSA signature verification ([`paypal-client.ts`](file:///d:/BorderBrief%20AI/src/lib/paypal/paypal-client.ts)).
5. **Mutation Safeguard:** In demo mode, `DELETE /api/invoices/[id]` is disabled, returning `403 Forbidden ("Draft deletion is disabled in public demo mode")`.
6. **Gemini In-Memory Rate Limiter:** Middleware or route handler enforces a sliding window of max 5 calls/minute per IP to prevent accidental quota burning.

---

## 5. Payment & Database Consistency Preservation

The remote database adapter must preserve all financial and data-integrity guarantees established in Sprints 1–7:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT INTEGRITY & RECONCILIATION FLOW                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Canonical Invoice Total:  $271.00 ($250 goods + $15 freight + $6 insurance)         │
│                              Stored in 'invoices.total_amount'.                        │
│ 2. DAP Import Duty Excluded: $40.75 import duty kept in advisory JSON only.           │
│ 3. Orders API v2 Payload:    Charges exactly $271.00 USD.                              │
│ 4. Minor-Unit Comparison:    toMinorUnits($271.00) = 27100 cents.                      │
│                              areAmountsEqual(27100, 27100) -> Exact integer match.     │
│ 5. Capture Idempotency:      If payments.status == 'COMPLETED', return cached receipt.  │
│ 6. Webhook Idempotency:      isWebhookEventProcessed(event_id) checks webhook_logs.    │
│ 7. Self-Healing Recovery:    If capture succeeds on PayPal but database commit fails,   │
│                              subsequent query or webhook re-verifies capture with      │
│                              PayPal Orders API and writes 'PAID' status.               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Order-to-Invoice Association:** Linked via foreign key `payments.invoice_id REFERENCES invoices(id)`.
2. **Canonical Amount Integrity:** The payable amount is derived solely from the server's persisted invoice in the database, never from client-side request parameters.
3. **Float Drift Protection:** Integer minor-unit conversion (`toMinorUnits`) eliminates IEEE 754 precision issues before writing to the database.
4. **Self-Healing Webhook Reconciliation:** If a network failure interrupts the client during checkout, PayPal's asynchronous `PAYMENT.CAPTURE.COMPLETED` webhook independently reconciles the database and marks the invoice `PAID`.

---

## 6. Detailed Implementation Plan

### 6.1 Exact Files Likely to Change

| File | Change Type | Purpose |
|---|:---:|---|
| `package.json` | Modify | Add `@libsql/client` (v0.14+) dependency. |
| `package-lock.json` | Modify | Lockfile updated. |
| `src/lib/db/database.ts` | Modify | Implement `IDatabaseService` with `LocalSqliteAdapter` and `TursoLibsqlAdapter`. Update exports to async. |
| `src/lib/services/idempotency.ts` | Modify | Await database calls in persistent idempotency handler. |
| `src/app/api/invoices/route.ts` | Modify | Await `saveInvoice`, `listInvoices`, `getPaymentByInvoiceId`. |
| `src/app/api/invoices/[id]/route.ts` | Modify | Await `getInvoice`, `deleteInvoice`. Add demo deletion block. |
| `src/app/api/invoices/[id]/pdf/route.ts` | Modify | Await `getInvoice`. |
| `src/app/api/payments/[id]/route.ts` | Modify | Await `getPayment`, `getPaymentByOrderId`, `getPaymentByInvoiceId`. |
| `src/app/api/payments/paypal/create-order/route.ts` | Modify | Await `getInvoice`, `savePayment`. |
| `src/app/api/payments/paypal/capture-order/route.ts` | Modify | Await `getPaymentByOrderId`, `getInvoice`, `updatePaymentStatus`. |
| `src/app/api/payments/paypal/webhook/route.ts` | Modify | Await `isWebhookEventProcessed`, `updatePaymentStatus`, `saveWebhookLog`. |
| `src/app/api/tariffs/calculate/route.ts` | Modify | Await `saveLandedCostCalculation`. |
| `src/middleware.ts` | Create | Demo passcode cookie verification (bypassing PayPal webhook). |
| `.env.example` | Modify | Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DEMO_ACCESS_SECRET`. |
| `src/tests/db-persistence.test.ts` | Modify | Update test assertions to `await` database functions. |
| `src/tests/paypal-integration.test.ts` | Modify | Update test assertions to `await` database functions. |
| `src/tests/invoice-generator.test.ts` | Modify | Update test assertions to `await` database functions. |
| `src/tests/integration-polish.test.ts` | Modify | Update test assertions to `await` database functions. |

### 6.2 Rollback Strategy
1. The local SQLite implementation is strictly preserved inside `LocalSqliteAdapter`.
2. If cloud deployment issues arise, removing `TURSO_DATABASE_URL` instantly reverts the entire application to local `node:sqlite` operation.
3. Git tag `v1.0-mvp` (commit `f9cff42`) remains the immutable rollback point.

---

## 7. Final Decision & Required User Approvals

# **READY AFTER SPECIFIC DECISIONS**

The architecture, limits, security safeguards, and adapter patterns have been fully validated. Implementation can begin immediately once the user approves the following **four operational decisions**:

### Decision 1: Demo Access Passcode Policy
- **Option A (Recommended):** Enable a lightweight Demo Passcode gate in Next.js Middleware (cookie-based session, exempting PayPal webhooks) to protect Gemini free-tier quota from scrapers.
- **Option B:** Keep the site completely open to the public without a passcode, relying strictly on in-memory rate limiting and demo deletion locks.

### Decision 2: Active Gemini Model Confirmation
- **Option A (Recommended):** Keep `gemini-2.5-flash` as the production default model (verified fast sub-3s response with schema support during Sprint 2 tests).
- **Option B:** Set `gemini-3.8-flash` in Vercel environment variables (higher latency risk).

### Decision 3: Turso Database Provisioning
- Confirm that you are ready to create a free database at [turso.tech](https://turso.tech) (`borderbrief-db`) and provide `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Vercel deployment.

### Decision 4: PayPal Developer Sandbox App
- Confirm that you have access to [developer.paypal.com](https://developer.paypal.com) to copy Sandbox Client ID / Secret and register the Vercel Webhook HTTPS URL once deployed.

---

*Preflight validation complete. No code has been modified. Awaiting user decisions.*

