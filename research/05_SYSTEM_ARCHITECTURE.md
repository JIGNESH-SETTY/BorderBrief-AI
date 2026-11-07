# 05 — Technical System Architecture & Specification: BorderBrief AI

**Document ID:** BB-RES-005 (Revision 4 — Final Audit Corrections)  
**Research Date:** November 6, 2026  
**System Pattern:** Full-Stack Cloud-First Monolith (Next.js 16 App Router + TypeScript)  
**Cloud AI Tier:** Google AI Studio (`gemini-3.8-flash`)  
**Persistence Pattern:** Dual-Mode SQLite/libSQL (`file:borderbrief.db` for local dev; hosted Turso Free Starter 5 GB / 100 DBs over HTTP for Vercel serverless)  
**Idempotency Architecture:** Serverless-Safe Persistent Idempotency via Database Transactions  
**Tariff Freshness Policy:** Statutory Revision & Effective Date Boundary Checks (Never Blind Time-Based Trust)  
**Operational Connectivity Notice:** Offline local development does **NOT** mean offline application functionality. The application executes locally without local AI servers, but requires internet connectivity to query Google AI Studio, the USITC API, and PayPal Sandbox.  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Architectural Options Comparison

Before finalizing the technical blueprint, two realistic architectural topologies were evaluated:

### Option 1: Unified Next.js 16 Cloud-First Monolith (RECOMMENDED)
- **Stack:** Next.js 16 (React 19, TypeScript, Turbopack), Next.js Route Handlers, SQLite/libSQL via `@libsql/client` and Drizzle ORM, Tailwind CSS + shadcn/ui.
- **AI Integration:** Direct HTTPS API calls to Google AI Studio (`gemini-3.8-flash`) with calibrated 15s multimodal timeouts.
- **Persistence Handling:**
  - *Localhost:* `DATABASE_URL="file:borderbrief.db"` — zero cloud setup, zero latency, runs offline.
  - *Vercel Serverless:* `DATABASE_URL="libsql://[db].turso.io"` — connects over HTTP to Turso Free Starter (5 GB storage, 100 databases), solving Vercel's ephemeral stateless filesystem limitations.
- **Trade-offs:**
  - *Pros:* Single repository, zero CORS friction, shared TypeScript types, sub-millisecond local queries, clean serverless transition.
  - *Cons:* External AI calls require active internet connection.

### Option 2: Decoupled Multi-Service (Next.js + Python FastAPI + PostgreSQL)
- **Stack:** Next.js Frontend + Python FastAPI microservice + PostgreSQL / Supabase.
- **Trade-offs:**
  - *Pros:* Standard Python environment.
  - *Cons:* Requires managing 3 separate processes, increases host memory consumption, and Supabase free tier pauses after 7 days of inactivity.

### Architecture Verdict
**Option 1 (Unified Next.js 16 Cloud-First Monolith)** is unequivocally superior. It delivers maximum reliability, instant responsiveness, zero infrastructure cost, and simplest review for hackathon evaluators.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client Browser (Exporters & US Buyers)"]
        UI["Next.js 16 Responsive UI (Tailwind CSS + shadcn/ui)"]
        PP_SDK["PayPal JS SDK Buttons (@paypal/react-paypal-js)"]
        PDF_Viewer["Client-Side PDF Previewer (@react-pdf/renderer)"]
    end

    subgraph Server["Next.js 16 Server Runtime (Localhost / Vercel Serverless)"]
        Router["Next.js 16 App Router (/api Route Handlers)"]
        
        subgraph SecurityPipeline["Inbound Security & Pre-Processing"]
            MagicCheck["Magic Bytes & Size Validation (<= 4MB)"]
            EXIFStrip["Server-Side EXIF Metadata Stripping (APP1/Chunks)"]
            DataMin["Data Minimization Gateway (PII Blacklist)"]
        end

        subgraph Services["Core Business Logic Modules"]
            AIService["Cloud AI Orchestration Service\n(gemini-3.8-flash, 15s Timeout, Jittered Retries)"]
            TariffEngine["USITC Tariff Data Layer\n(Revision Stamp & Statutory Date Boundary Checks)"]
            CostCalc["Deterministic Landed-Cost Engine\n(19 U.S.C. § 1401a Math)"]
            DocGen["Commercial Invoice Builder\n(CBIC LUT + DGFT Stamp)"]
            PPService["PayPal Integration Service\n(Orders API v2 & Webhook Verifier)"]
        end

        subgraph DB["Dual-Mode Persistence Layer (@libsql/client)"]
            Drizzle["Drizzle ORM / Query Builder"]
            LocalDB[("Local Dev:\nfile:borderbrief.db")]
            CloudDB[("Vercel Serverless:\nHosted Turso Free 5GB over HTTP")]
            IdempotencyTable["idempotency_keys Table\n(Serverless-Safe Deduplication)"]
        end
    end

    subgraph External["External Cloud APIs (Strictly Zero-Cost Tiers)"]
        GeminiAPI["Primary Cloud AI:\nGoogle AI Studio (gemini-3.8-flash)"]
        USITC_API["USITC HTS REST API\n(https://hts.usitc.gov/reststop)"]
        PayPal_Sandbox["PayPal Sandbox API\n(https://api-m.sandbox.paypal.com)"]
    end

    %% Client to Server
    UI -->|HTTP Requests with X-Idempotency-Key| Router
    PP_SDK -->|Client-side Approval Event| Router
    PDF_Viewer -->|Blob Request| Router

    %% Pre-Processing Pipeline
    Router --> MagicCheck
    MagicCheck --> EXIFStrip
    EXIFStrip --> DataMin
    DataMin --> AIService

    %% Router to Services
    Router --> TariffEngine
    Router --> CostCalc
    Router --> DocGen
    Router --> PPService

    %% Services to External Cloud APIs
    AIService -->|Multimodal Query (15s Timeout)| GeminiAPI
    TariffEngine -->|Search & Statutory Rates| USITC_API
    PPService -->|Create & Capture Orders| PayPal_Sandbox
    PayPal_Sandbox -->|Webhook Events| Router

    %% Services to Persistence
    Router --> Drizzle
    Drizzle --> IdempotencyTable
    Drizzle -->|If localhost| LocalDB
    Drizzle -->|If Vercel cloud| CloudDB
```

---

## 3. Serverless-Safe Idempotency Architecture

In-memory deduplication (e.g. `Map` or `Set`) fails completely in serverless environments because state is destroyed upon container cold starts and cannot be shared across concurrent Lambda microVMs.

BorderBrief AI implements **Serverless-Safe Persistent Idempotency**:
1. Every client submission sends a unique UUID in `X-Idempotency-Key`.
2. The server executes an atomic database insert into `idempotency_keys`:
   ```sql
   INSERT INTO idempotency_keys (key, request_path, status, expires_at)
   VALUES (?, ?, 'IN_PROGRESS', datetime('now', '+60 seconds'))
   ON CONFLICT (key) DO NOTHING;
   ```
3. If an existing record is found:
   - If `status === 'IN_PROGRESS'`: Returns HTTP `409 Conflict` (`"Request is already in progress. Please wait."`).
   - If `status === 'COMPLETED'`: Instantly returns the cached response with `X-Cache: IDEMPOTENT_HIT`.
4. When the external operation completes, the record is updated to `COMPLETED` along with `response_json`.

---

## 4. Tariff Freshness Architecture: Revision & Statutory Date Validation

**A naive "30-day cache age" is legally dangerous in international trade compliance.** A 5-day-old cache is legally invalid if a new Presidential Proclamation or interim tariff revision was enacted yesterday.

BorderBrief AI governs customs data via **Statutory Boundary Rules**:

```
[ Incoming Tariff Query ]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│  1. Check Statutory Effective Date Range               │
│     Is statutory_effective_from <= CurrentDate         │
│     AND (effective_to IS NULL OR >= CurrentDate)?      │
└────────────────────────────────────────────────────────┘
            │
      [ If Valid ]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│  2. Check USITC Revision Identifier                    │
│     Does cached revision match current USITC Edition?  │
│     (e.g., '2026 Basic Edition / Rev 1')               │
└────────────────────────────────────────────────────────┘
            │
            ├──────────────────────────┬──────────────────────────┐
            ▼                          ▼                          ▼
[ Live API Query Succeeded ]  [ Live API Timed Out ]      [ Outdated Revision / Date ]
  Status:                      Status:                     Status:
  LIVE_STATUTORY_CONFIRMED     CACHED_BASELINE_UNCONFIRMED SUPERSEDED_OR_EXPIRED
  Badge: Emerald (Live)        Badge: Amber Warning        Action:
                               Banner: "Baseline only.     Block automatic calculation.
                               Verify before customs."     Require live re-fetch.
```

---

## 5. REST API Specification

### 5.1 Product & Cloud AI Endpoints

#### `POST /api/products/analyze`
- **Purpose:** Ingests product text and uploaded image, validates magic bytes, strips EXIF server-side, and calls Gemini 3.8 Flash.
- **Headers:**
  - `Content-Type: multipart/form-data`
  - `X-Idempotency-Key: <UUID>`
- **Request Body (Multipart):**
  - `title`: string (e.g., "Handmade Cotton Tote Bag")
  - `description`: string
  - `image`: File (JPEG, PNG, WebP $\le$ 4MB)
  - `price_fob`: number (USD)
  - `shipping_cost`: number (USD)
  - `origin_country`: "IN"
  - `destination_country`: "US"
- **Response (200 OK):**
  ```json
  {
    "productId": "prod_01j7xyz...",
    "features": {
      "material": "100% Woven Cotton",
      "category": "Bags and Handbags",
      "construction": "Woven Canvas"
    },
    "candidateClassifications": [
      {
        "htsCode": "4202.92.15.00",
        "description": "Travel, sports and similar bags with outer surface of cotton",
        "confidence": "HIGH",
        "rationale": "Outer surface is predominantly woven cotton; fits Chapter 4202 specifications.",
        "statutoryGeneralRate": "6.3%"
      }
    ],
    "clarificationNeeded": false,
    "clarificationQuestions": [],
    "aiProvider": "GOOGLE_GEMINI_3_8_FLASH",
    "structuralValidation": "VALID_JSON_SCHEMA",
    "note": "AI suggestion requires human review and confirmation before calculation."
  }
  ```

#### `POST /api/tariffs/lookup`
- **Purpose:** Fetches statutory tariff rates directly from USITC HTS REST API with statutory revision date verification.
- **Query Params:** `?code=4202.92.15.00`
- **Response (200 OK):**
  ```json
  {
    "htsCode": "4202.92.15.00",
    "description": "Of cotton (369)",
    "generalRateStr": "6.3%",
    "generalRateDecimal": 0.063,
    "specialRates": "Free (A,AU,BH...)",
    "indiaEligibleSpecial": false,
    "effectiveDutyRate": 0.063,
    "units": ["No.", "kg"],
    "source": "USITC_REST_API",
    "tariffRevision": "2026 Basic Edition / Rev 1",
    "effectiveDate": "2026-01-01",
    "verificationStatus": "LIVE_STATUTORY_CONFIRMED"
  }
  ```

---

## 6. Database Schema Specification (Drizzle ORM / libSQL)

```sql
-- 1. Serverless-Safe Idempotency
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    request_path TEXT NOT NULL,
    status TEXT NOT NULL, -- 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    response_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- 2. Products and Assessment Ingestion
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    fob_price REAL NOT NULL,
    shipping_cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    quantity INTEGER DEFAULT 1,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. HS Classification Intelligence
CREATE TABLE IF NOT EXISTS classifications (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    suggested_hs6 TEXT NOT NULL,
    suggested_hts10 TEXT NOT NULL,
    hts_description TEXT NOT NULL,
    general_duty_rate REAL NOT NULL,
    confidence_level TEXT NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    reasoning_text TEXT NOT NULL,
    is_confirmed_by_user INTEGER DEFAULT 0, -- 0 = false, 1 = true
    confirmed_at DATETIME
);

-- 4. Statutory Tariff Schedule & Revision Tracking
CREATE TABLE IF NOT EXISTS tariff_cache (
    hts_code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    general_duty_rate REAL NOT NULL,
    special_rates_text TEXT,
    units_of_quantity TEXT,
    tariff_revision TEXT NOT NULL, -- e.g., '2026 Basic Edition / Rev 1'
    statutory_effective_from TEXT NOT NULL, -- e.g., '2026-01-01'
    statutory_effective_to TEXT, -- NULL if currently active
    source_authority TEXT DEFAULT 'USITC',
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verification_status TEXT NOT NULL -- 'LIVE_STATUTORY_CONFIRMED', 'CACHED_BASELINE_UNCONFIRMED'
);

-- 5. Deterministic Landed Cost Calculations
CREATE TABLE IF NOT EXISTS landed_cost_calculations (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    classification_id TEXT REFERENCES classifications(id),
    dutiable_value REAL NOT NULL,
    duty_amount REAL NOT NULL,
    mpf_amount REAL NOT NULL,
    hmf_amount REAL NOT NULL,
    shipping_amount REAL NOT NULL,
    total_landed_cost REAL NOT NULL,
    is_section_321_eligible INTEGER DEFAULT 0,
    calculation_breakdown_json TEXT NOT NULL,
    tariff_revision_stamp TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Export Commercial Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id),
    seller_name TEXT NOT NULL,
    seller_iec TEXT,
    seller_gstin TEXT,
    seller_lut_arn TEXT,
    buyer_name TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    buyer_country TEXT DEFAULT 'US',
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'ISSUED', 'PAID'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. PayPal Orders and Payments
CREATE TABLE IF NOT EXISTS paypal_orders (
    id TEXT PRIMARY KEY, -- PayPal Order ID
    invoice_id TEXT REFERENCES invoices(id),
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, -- 'CREATED', 'APPROVED', 'COMPLETED', 'FAILED'
    capture_id TEXT,
    payer_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit & Webhook Logs
CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    verification_status TEXT NOT NULL, -- 'VERIFIED', 'FAILED'
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
