# BorderBrief AI — Database Architecture & Decisions (Sprint 1)

**Status:** Documented Architecture Baseline  
**Environment:** Local Development (SQLite Baseline: `borderbrief.db`)  
**Table Count:** Exactly 8 tables (7 Operational Tables + 1 Security/Webhook Audit Table)  
**Policy:** Zero Unnecessary Database Dependencies in Sprint 1; Cloud Deployment Deferred

---

## 1. Database Architecture Decisions

In strict accordance with Sprint 1 guidelines:
1. **Local Development Uses SQLite:** 
   - A single file (`borderbrief.db`) provides immediate, zero-latency persistence on the local developer machine.
   - Requires zero background services, zero Docker containers, zero external database credentials, and zero cloud accounts.
   - Ensures hackathon evaluators can clone and run the application locally without database setup.
2. **Cloud Database Deployment is Intentionally Deferred:**
   - Premature cloud database provisioning (e.g. Supabase, Turso cloud, AWS RDS) introduces unnecessary network latency, credentials management, and connection failure points during initial UI/UX and feature prototyping.
   - When serverless deployment (e.g. Vercel) is required in later sprints, the database layer can connect to a serverless-safe provider (such as Turso libSQL over HTTP) using standard environment variables without altering table schemas.
3. **Zero Unnecessary Runtime Dependencies in Sprint 1:**
   - In Sprint 1, we avoid installing heavy ORM engines or native C++ binaries prematurely.
   - The database schema is fully defined in standard SQL DDL in [`src/lib/db/schema.ts`](./schema.ts) and ready for binding when state persistence is activated in Sprint 2.

---

## 2. Master Schema Entity-Relationship Map & Exact 8-Table Inventory

```
[ products ]
    │
    ├── 1:N ──► [ classifications ] (Grounded HTS codes)
    │                  │
    ├── 1:N ──► [ landed_cost_calculations ] (19 U.S.C. § 1401a transaction value math)
    │
    └── 1:N ──► [ invoices ] (Commercial Invoice drafts under GST LUT)
                       │
                       └── 1:1 ──► [ paypal_orders ] (PayPal Orders API v2)

[ tariff_cache ] (USITC 2026 HTS Rev 22 baseline, Chapter 99 provisions, revision stamping)
[ idempotency_keys ] (Serverless-safe atomic request deduplication)
[ webhook_logs ] (Cryptographic PayPal webhook verification audit trail)
```

### Complete Inventory of All 8 Tables

| # | Table Name | Category | Primary Purpose |
| :-: | :--- | :--- | :--- |
| **1** | `idempotency_keys` | Operational | Atomic deduplication of mutation requests; prevents duplicate order/payment creation in serverless environments. |
| **2** | `products` | Operational | Stores seller product information drafts, item selling prices, and separate international shipping estimates. |
| **3** | `classifications` | Operational | Stores AI-assisted candidate HTS codes, rationale, user confirmation status, and confidence levels. |
| **4** | `tariff_cache` | Operational | Caches official USITC tariff schedule entries (USITC 2026 HTS Rev 22 baseline, Oct 30, 2026), Chapter 99 notes, and effective dates. |
| **5** | `landed_cost_calculations` | Operational | Stores deterministic calculations under 19 U.S.C. § 1401a transaction value principles, applicable duties, and MPF. |
| **6** | `invoices` | Operational | Stores commercial export invoice drafts containing Indian GST LUT and DGFT IEC declarations. |
| **7** | `paypal_orders` | Operational | Manages PayPal Orders API v2 lifecycles, approval states, capture tokens, and payment metadata. |
| **8** | `webhook_logs` | Security & Audit | Records inbound PayPal webhook payloads with cryptographic signature verification status to prevent replay attacks. |

---

## 3. Schema Definitions

See [`schema.ts`](./schema.ts) for complete table DDL strings and column specifications.
