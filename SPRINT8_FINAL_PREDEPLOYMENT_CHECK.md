# BorderBrief AI — Sprint 8 Final Pre-Deployment Consistency Check

**Date:** November 8, 2026  
**Project:** BorderBrief AI (*"Know the Rules. Know the Cost. Ship with Confidence."*)  
**Corridor:** India ($\text{IN}$) $\rightarrow$ United States ($\text{US}$) Export Trade Corridor  
**Inspection Type:** Strict Read-Only Pre-Deployment Consistency Check  
**Target File:** `SPRINT8_FINAL_PREDEPLOYMENT_CHECK.md`  

---

## Executive Summary

A comprehensive, read-only inspection of the BorderBrief AI codebase and documentation was conducted prior to Git commit and cloud deployment. All five critical areas specified in the audit directive were inspected against source code, unit tests, configuration files, and Git history.

### Summary Scorecard

| Area | Inspection Target | Code Status | Documentation Status | Overall Finding |
| :--- | :--- | :---: | :---: | :---: |
| **1. Wooden Coaster Classification** | Heading 4419 vs 4421 & Ambiguity Guardrail | **PASS** (Zero code regression) | **FAIL** (Report erratum in Sprint 8 report) | **PASS / FIX REQUIRED** |
| **2. Demo Authentication** | Middleware, Webhook Exemption & Session Gate | **PASS** | **PASS** | **PASS** |
| **3. Cloud AI Grounding** | `gemini-2.5-flash`, Quota Handling & Fallback | **PASS** | **PASS** | **PASS** |
| **4. PayPal Deployment Readiness** | Financial Consistency, Webhook ID & Verification | **PASS** | **PASS** | **PASS** |
| **5. Environment Checklist** | 9 Vercel Environment Variables & Local Readiness | **PASS** | **PASS** | **PASS / PENDING CLOUD** |

---

## 1. Wooden Coaster Classification Regression Investigation — CRITICAL

### The Issue Investigated
`SPRINT8_IMPLEMENTATION_REPORT.md` (line 189) stated:
> `- Wooden Coaster (4421.99.98.80) remains strictly at 3.3% General Duty.`

This contradicted the previously approved Sprint 3–4 legal determination where Sheesham (*Dalbergia sissoo*) drink coasters were held to be tableware under **Heading 4419**, with the legal determination between subheading `4419.20` ("Of tropical wood") and `4419.90` ("Other") unresolved, and landed-cost calculation strictly blocked (`UNRESOLVED_AMBIGUITY`, HTTP 422).

### Codebase & Data Inspection

#### A. Seed Product Data (`src/data/seed-products.ts` lines 357–410)
- **Product ID:** `prod-wooden-coasters` ("Hand-Carved Sheesham Wood Coasters Set of 6")
- **Suggested HS6:** `4419.90` (NOT 4421.99)
- **Candidate HTS10:** `4419.90.91.00` ("Tableware and kitchenware, of wood: Other: Other")
- **Base Duty Rate:** 3.2% (NOT 3.3%)
- **Statutory GRI Rationale:** Explicitly invokes GRI 1, GRI 3(b), and GRI 6 under Heading 4419. Cites CBP CROSS precedents **NY N095158**, **NY N240071**, and **NY R04475** establishing that drink coasters are tableware under Heading 4419 and are **excluded from residual basket 4421**.
- **Legal Ambiguity:** Explicitly documents that because Chapter 44 Subheading Note 1 does not govern Heading 4419, and CBP has not issued a binding classification ruling for *Dalbergia sissoo*, the species status between `4419.20.90.00` (tropical) and `4419.90.91.00` (other) is legally unresolved under 19 U.S.C. § 1484.

#### B. Classification Engine (`src/lib/tariff/classification-engine.ts` lines 511–546)
When analyzing Sheesham drink coasters:
- `status`: **`"UNRESOLVED_AMBIGUITY"`**
- `primaryRecord`: **`null`** (strict guardrail: never assigns an arbitrary primary code)
- `alternativeRecords`: `[4419.20.90.00 (3.2%), 4419.90.91.00 (3.2%)]`
- `confidence`: `"LOW"`
- Clarifying questions and missing information are generated.

#### C. Tariff Store (`src/lib/tariff/authoritative-store.ts` lines 230–235, 964–995)
- Line 230: Explicitly excludes tableware, kitchenware, and drink coasters from Heading 4421 by operation of GRI 1.
- Line 986: *"Heading 4421 is a residual basket provision for 'other articles of wood'. Articles specifically described in earlier Chapter 44 headings—such as tableware and kitchenware under Heading 4419 (including drink coasters)—are excluded from Heading 4421 by operation of GRI 1."*

#### D. Landed-Cost Calculation Engine (`src/lib/tariff/landed-cost-engine.ts` lines 1109–1116)
```typescript
if (request.classificationStatus === "UNRESOLVED_AMBIGUITY") {
  throw new LandedCostCalculationError(
    `Classification ambiguity for "${request.productTitle}" is unresolved. An authoritative landed-cost calculation cannot be generated when the tariff classification is ambiguous.`,
    "CLASSIFICATION_AMBIGUITY_UNRESOLVED",
    422,
    { productTitle: request.productTitle, status: "BLOCKED" }
  );
}
```
Landed-cost calculations for ambiguous classifications are strictly **BLOCKED** with HTTP 422.

#### E. Test Suites (`src/tests/classification-engine.test.ts` & `src/tests/authoritative-store.test.ts`)
- `classification-engine.test.ts` lines 375–406:
  - `assert.notEqual(oakResult.primaryCandidate?.hts10, "4421.99.98.80", "Coasters must not fall into basket 4421");`
  - `assert.notEqual(teakResult.primaryCandidate?.hts10, "4421.99.98.80", "Coasters must not fall into basket 4421");`
- `classification-engine.test.ts` lines 408–422:
  - Asserts Sheesham wood coasters produce `UNRESOLVED_AMBIGUITY` with `primaryCandidate === null`.
- `authoritative-store.test.ts` line 286:
  - `assert.equal(coasterBasketCheck.isSuitable, false, "4421 must reject drink coasters because they belong under 4419");`
- `calculate-route.test.ts` lines 136–150:
  - Asserts HTTP 422 is strictly returned when `classificationStatus: "UNRESOLVED_AMBIGUITY"`.

#### F. Git Diff Against Approved Baseline
`git diff origin/main -- src/lib/tariff/ src/data/seed-products.ts` returned **0 differences**. No tariff logic, seed data, or classification rules were modified during Sprint 8.

### Finding & Recommendation
- **Application Code:** **PASS** (Zero code regression. Sheesham coasters remain strictly `UNRESOLVED_AMBIGUITY` under Heading 4419 with landed cost calculation blocked).
- **Sprint 8 Implementation Report:** **FAIL / ERRATUM** (Line 189 in `SPRINT8_IMPLEMENTATION_REPORT.md` carried over an erroneous bullet point from Sprint 7 audit text).
- **Specific Fix Required:** Correct line 189 of `SPRINT8_IMPLEMENTATION_REPORT.md` to reflect the actual codebase:
  - *Replace:* `Wooden Coaster (4421.99.98.80) remains strictly at 3.3% General Duty.`
  - *With:* `Sheesham Wood Coasters classify under Heading 4419 (competing between 4419.20.90.00 and 4419.90.91.00 @ 3.2%), strictly producing UNRESOLVED_AMBIGUITY with landed-cost calculation BLOCKED (HTTP 422).`

---

## 2. Demo Authentication Inspection

### Verification Results

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **`/demo-login` accessible without auth** | Explicitly exempt in [`src/middleware.ts`](file:///d:/BorderBrief%20AI/src/middleware.ts#L33-L38) before cookie validation. | **PASS** |
| **`/api/demo/auth` accepts POST without auth** | Explicitly exempt in [`src/middleware.ts`](file:///d:/BorderBrief%20AI/src/middleware.ts#L35); accepts `{ passcode: string }` and issues HttpOnly cookie. | **PASS** |
| **Protected frontend & API routes** | Middleware intercepts all matching routes; unauthenticated API calls return HTTP 401 (`DEMO_ACCESS_REQUIRED`); browser requests redirect to `/demo-login?returnTo=...`. | **PASS** |
| **PayPal Webhook strictly exempt** | [`src/middleware.ts`](file:///d:/BorderBrief%20AI/src/middleware.ts#L28-L30) unconditionally exempts `/api/payments/paypal/webhook` as Step 1. | **PASS** |
| **Cryptographic Webhook verification mandatory** | [`src/app/api/payments/paypal/webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts#L66-L125) enforces transmission headers, configured `PAYPAL_WEBHOOK_ID`, and live PayPal signature verification. | **PASS** |
| **Invalid & expired cookies rejected** | Validated via `constantTimeEqual` against SHA-256 HMAC of secret; cookies set with `maxAge: 7 * 24 * 60 * 60` and `HttpOnly; SameSite=Lax`. | **PASS** |
| **Missing `DEMO_ACCESS_SECRET` behaviour** | When unset or empty, `isDemoGateActive()` returns `false`, middleware bypasses authentication, and full access is permitted for local development. | **PASS** |

### Finding: **PASS**

---

## 3. Cloud AI Product Understanding Inspection

### Verification Results

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Default Model** | `process.env.GEMINI_MODEL || "gemini-2.5-flash"` in [`src/lib/services/gemini-service.ts`](file:///d:/BorderBrief%20AI/src/lib/services/gemini-service.ts#L344). | **PASS** |
| **Server-Side API Key** | `GEMINI_API_KEY` is read strictly inside server-side route handlers and services. It lacks `NEXT_PUBLIC_` prefix and is never exposed in client bundles. | **PASS** |
| **Quota Exhaustion (HTTP 429)** | In [`gemini-service.ts`](file:///d:/BorderBrief%20AI/src/lib/services/gemini-service.ts#L421-L427), HTTP 429 throws `GeminiApiError(..., 429, "RATE_LIMIT_EXCEEDED")`. Handled in `/api/products/analyze` with HTTP 429. It is **never** silently masked as a seed-product response. | **PASS** |
| **Missing API Key Fallback** | Missing or dummy key triggers `getDemoAnalysis(input, "NO_API_KEY")`. Sets `is_demo_mode: true`, `demo_reason: "NO_API_KEY"`, and honest analysis warnings. | **PASS** |
| **Relevance Threshold Safeguard** | `MIN_DEMO_MATCH_THRESHOLD = 2` ensures queries below threshold produce an unclassified baseline (`demo-unclassified-fallback`) and **never** default to cotton bags. | **PASS** |

### Finding: **PASS**

---

## 4. PayPal Deployment Readiness Inspection

### Verification Results

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Canonical Seller Invoice Consistency** | Incoterms 2020 DAP financial separation maintained. `invoice.invoiceTotalUSD` (seller receivable: subtotal + freight + insurance) is canonical across: <br>1. `createPayPalOrder(invoice)` order creation.<br>2. `capture-order` amount validation via `areAmountsEqual(capturedAmount, invoice.invoiceTotalUSD)`.<br>3. `webhook` amount validation via `areAmountsEqual(numericAmount, invoice.invoiceTotalUSD)`. | **PASS** |
| **Empty `PAYPAL_WEBHOOK_ID` Handling** | In [`webhook/route.ts`](file:///d:/BorderBrief%20AI/src/app/api/payments/paypal/webhook/route.ts#L94-L107), if `PAYPAL_WEBHOOK_ID` is empty/missing, the route logs `FAILED` in `webhook_logs` and returns HTTP 503 (`WEBHOOK_ID_MISSING`) without crashing or bypassing verification. | **PASS** |
| **Signature Bypass Prevention** | Webhook verification cannot be bypassed: missing headers return 400, missing webhook ID returns 503, invalid signature returns 401. | **PASS** |
| **Missing Credentials Safety** | When PayPal credentials are missing, order creation, capture, and webhooks return HTTP 503 (`PAYPAL_NOT_CONFIGURED`). No invoice is ever marked `PAID`. | **PASS** |
| **Live Sandbox Transactions Status** | End-to-end sandbox checkout with real buyer sandbox credentials on a live public domain remains explicitly marked **PENDING CLOUD DEPLOYMENT** (requires live HTTPS webhook URL). | **PASS** |

### Finding: **PASS**

---

## 5. Deployment Environment Checklist

### Environment Variables Matrix (Vercel & Local)

| Variable Name | Purpose | Local `.env.local` Status | Vercel Deployment Action | Secret Level |
| :--- | :--- | :---: | :---: | :---: |
| `TURSO_DATABASE_URL` | Turso remote database URL (`libsql://...`) | **CONFIGURED** | Copy to Vercel Environment | Secret |
| `TURSO_AUTH_TOKEN` | Read & Write authentication token | **CONFIGURED** | Copy to Vercel Environment | **High Secret** |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox REST App Client ID | **CONFIGURED** | Copy to Vercel Environment | Config |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox REST App Client Secret | **CONFIGURED** | Copy to Vercel Environment | **High Secret** |
| `PAYPAL_BASE_URL` | PayPal REST API endpoint | **CONFIGURED** (`https://api-m.sandbox.paypal.com`) | Copy to Vercel Environment | Standard |
| `PAYPAL_WEBHOOK_ID` | Registered PayPal Webhook ID | **EMPTY (PENDING)** | Register webhook in PayPal Dashboard after domain is live, then add ID to Vercel | Config |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key | **EMPTY (DEMO FALLBACK)** | Add Google AI Studio API key to Vercel for live multimodal extraction | **High Secret** |
| `DEMO_ACCESS_SECRET` | Passcode for evaluator access gate | **EMPTY (GATE OPEN)** | Set strong evaluator passcode on Vercel to activate demo gate | Secret |
| `NEXT_PUBLIC_APP_URL` | Canonical public application URL | **UNSET (DEFAULTS TO HOST)** | Set to assigned Vercel URL (e.g. `https://borderbrief-ai.vercel.app`) | Standard |

### Finding: **PASS / PENDING POST-DEPLOYMENT CONFIGURATION**

---

## 6. Pre-Deployment Action Plan

To ensure absolute consistency before committing to Git and initiating Vercel deployment:

1. **Specific Fix 1 (Documentation):**
   - In [`SPRINT8_IMPLEMENTATION_REPORT.md`](file:///d:/BorderBrief%20AI/SPRINT8_IMPLEMENTATION_REPORT.md), update line 189 to replace the erroneous `Wooden Coaster (4421.99.98.80)` entry with the authoritative Sprint 3–4 Sheesham coaster status (`4419.90.91.00` vs `4419.20.90.00`, `UNRESOLVED_AMBIGUITY`, landed cost calculation blocked).

2. **Git Commit Preparation:**
   - Verify working directory: 15 modified files, 9 untracked files.
   - Verify `.env.local` remains ignored by Git (`git check-ignore .env.local` exits with code 0).
   - Stage and commit with clean conventional message: `feat(sprint-8): cloud database migration, demo gatekeeper & deployment preparation`.

3. **Cloud Deployment (Vercel):**
   - Link repository to Vercel.
   - Inject the 8 environment variables (excluding `PAYPAL_WEBHOOK_ID`).
   - Trigger build and deployment.
   - Copy assigned Vercel domain and register PayPal Webhook URL: `https://<domain>/api/payments/paypal/webhook`.
   - Update `PAYPAL_WEBHOOK_ID` in Vercel environment variables.

---

## 7. Final Verdict

```
=============================================================================
             FINAL VERDICT: READY AFTER SPECIFIC FIXES
=============================================================================
```

### Verdict Justification:
- **Codebase Integrity:** The actual source code, database architecture, security middleware, PayPal client, Gemini service, and tariff engine are **100% compliant and ready**. No application source code changes are required.
- **Specific Fix Required:** Update line 189 in `SPRINT8_IMPLEMENTATION_REPORT.md` to remove the documentation erratum claiming HTS `4421.99.98.80` @ 3.3% and restore the accurate statement of Sheesham wooden coasters' approved `UNRESOLVED_AMBIGUITY` / `BLOCKED` status under Heading 4419.
- Once that single report edit is applied, the repository is **READY FOR GIT COMMIT**.

