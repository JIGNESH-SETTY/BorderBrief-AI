/**
 * BorderBrief AI — Master Database Schema Definitions (Sprint 1)
 * Plain TypeScript DDL strings and column contracts for local SQLite persistence.
 * Exactly 8 operational & audit tables defined.
 * Designed to avoid heavy ORM dependencies until persistence binding is required.
 */

export const SQL_SCHEMA = {
  // Table 1: Serverless-Safe Request Idempotency
  createIdempotencyKeysTable: `
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      request_path TEXT NOT NULL,
      status TEXT NOT NULL, -- 'IN_PROGRESS', 'COMPLETED', 'FAILED'
      response_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
  `,

  // Table 2: Product Intake Drafts & Metadata
  createProductsTable: `
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      item_price REAL NOT NULL, -- Seller product price; customs transaction value assessed under 19 U.S.C. § 1401a subject to transaction examination
      shipping_cost REAL NOT NULL, -- International shipment costs tracked separately under 19 U.S.C. § 1401a(b)(4)(A)
      currency TEXT DEFAULT 'USD',
      quantity INTEGER DEFAULT 1,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  // Table 3: Grounded HTS Classifications & Explanations
  createClassificationsTable: `
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
  `,

  // Table 4: Official Tariff Cache & Revision Baseline
  createTariffCacheTable: `
    CREATE TABLE IF NOT EXISTS tariff_cache (
      hts_code TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      general_duty_rate REAL NOT NULL,
      special_rates_text TEXT,
      units_of_quantity TEXT,
      tariff_revision TEXT NOT NULL, -- Baseline: 'USITC 2026 HTS Rev 22 (Oct 30, 2026)'
      statutory_effective_from TEXT NOT NULL, -- e.g., '2026-01-01'
      statutory_effective_to TEXT, -- NULL if currently active
      chapter_99_notes TEXT, -- Trade remedies, Section 301, Section 232 or other applicable measures
      source_authority TEXT DEFAULT 'USITC',
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verification_status TEXT NOT NULL -- 'LIVE_STATUTORY_CONFIRMED', 'CACHED_BASELINE_UNCONFIRMED'
    );
  `,

  // Table 5: Deterministic Landed Cost Calculations
  createLandedCostTable: `
    CREATE TABLE IF NOT EXISTS landed_cost_calculations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      classification_id TEXT REFERENCES classifications(id),
      dutiable_value REAL NOT NULL, -- Assessed under 19 U.S.C. § 1401a transaction value principles (excluding international shipment costs under § 1401a(b)(4)(A))
      duty_amount REAL NOT NULL,
      mpf_amount REAL NOT NULL,
      hmf_amount REAL NOT NULL,
      shipping_amount REAL NOT NULL,
      total_landed_cost REAL NOT NULL,
      is_section_321_eligible INTEGER DEFAULT 0, -- General de minimis suspended Aug 29, 2025; retained for limited exceptions
      calculation_breakdown_json TEXT NOT NULL,
      tariff_revision_stamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  // Table 6: Export Commercial Invoice Drafts
  createInvoicesTable: `
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      product_id TEXT REFERENCES products(id),
      calculation_id TEXT REFERENCES landed_cost_calculations(id),
      seller_name TEXT NOT NULL,
      seller_iec TEXT, -- DGFT Importer-Exporter Code
      seller_gstin TEXT,
      seller_lut_arn TEXT, -- GST Letter of Undertaking ARN
      buyer_name TEXT NOT NULL,
      buyer_address TEXT NOT NULL,
      buyer_country TEXT DEFAULT 'US',
      total_amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'ISSUED', 'PAID'
      invoice_data_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  // Table 7: PayPal Orders API v2 Tracking (Sprint 1 Baseline)
  createPaypalOrdersTable: `
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
  `,

  // Table 8: Cryptographic PayPal Webhook Audit Logs
  createWebhookLogsTable: `
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      verification_status TEXT NOT NULL, -- 'VERIFIED', 'FAILED'
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  // Table 9: PayPal Payments Full Lifecycle Audit (Sprint 6)
  createPaymentsTable: `
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, -- Internal payment ID (pay_...)
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      paypal_order_id TEXT UNIQUE NOT NULL,
      paypal_capture_id TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL, -- 'CREATED', 'PENDING_APPROVAL', 'APPROVED', 'CAPTURE_PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'
      is_sandbox INTEGER NOT NULL DEFAULT 1, -- 1 = Sandbox, 0 = Live (Sprint 6 strictly Sandbox)
      payer_email TEXT,
      payer_name TEXT,
      capture_time TEXT,
      last_webhook_event_id TEXT,
      payment_data_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
};
