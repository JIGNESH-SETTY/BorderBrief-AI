/**
 * BorderBrief AI — SQLite Database Layer (Sprint 4)
 * Built using Node.js native `node:sqlite` (DatabaseSync).
 * Provides persistence for products, classifications, idempotency keys, and landed cost calculations.
 */

import { DatabaseSync } from "node:sqlite";
import { SQL_SCHEMA } from "./schema.ts";
import type { LandedCostCalculationResult } from "../../types/export.ts";
import type { CommercialInvoiceDraft } from "../../types/invoice.ts";
import type { PaymentRecord, PaymentStatus } from "../../types/payment.ts";

let activeDb: DatabaseSync | null = null;
let activeDbPath: string = "";

export class DatabaseConfigurationError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
    this.code = "DATABASE_CONFIGURATION_ERROR";
  }
}

/**
 * Initializes and returns a SQLite database instance.
 * Automatically executes DDL schema tables if they do not exist.
 * Enforces production safety guardrails against ephemeral local file writes (DEF-02).
 */
export function getDb(customPath?: string): DatabaseSync {
  // Production environment guardrail (DEF-02):
  // Writing to a local SQLite file in serverless production (e.g. Vercel) throws EROFS
  // and does not persist across stateless serverless invocations.
  if (process.env.NODE_ENV === "production" && !customPath) {
    const isServerless = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.env.CF_PAGES ||
      process.env.DENO_DEPLOYMENT_ID
    );

    const externalDbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;

    if (isServerless) {
      if (!externalDbUrl) {
        throw new DatabaseConfigurationError(
          "Stateless serverless production (e.g. Vercel, AWS Lambda, Netlify) cannot use local file-based SQLite. The filesystem is read-only (EROFS) and ephemeral. Serverless production requires an external database connection (e.g. Turso/libSQL at ₹0 tier via TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)."
        );
      }
    } else {
      // Stateful VPS / Container deployment:
      // An environment variable alone (BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD) is NOT proof of persistent storage.
      // Must be accompanied by a verified persistent volume mount path via BORDERBRIEF_PERSISTENT_VOLUME_PATH.
      const hasVerifiedVolume =
        process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD === "true" &&
        Boolean(process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH);

      if (!externalDbUrl && !hasVerifiedVolume) {
        throw new DatabaseConfigurationError(
          "Serverless production requires an external database connection (e.g. Turso/libSQL at ₹0 tier via TURSO_DATABASE_URL and TURSO_AUTH_TOKEN). Production database guardrail active: An environment variable alone (BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD) is not proof of persistent storage. To run local SQLite in production, you must explicitly specify a verified persistent volume mount path via BORDERBRIEF_PERSISTENT_VOLUME_PATH in a stateful environment. Otherwise, configure a verified external database connection (TURSO_DATABASE_URL)."
        );
      }
    }
  }

  const dbPath =
    customPath ||
    process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH ||
    process.env.BORDERBRIEF_DB_PATH ||
    "borderbrief.db";

  if (!activeDb || activeDbPath !== dbPath) {
    if (activeDb) {
      try {
        activeDb.close();
      } catch {
        // Ignore close error on re-init
      }
    }
    activeDb = new DatabaseSync(dbPath);
    activeDbPath = dbPath;
    try {
      activeDb.exec("PRAGMA journal_mode = WAL;");
      activeDb.exec("PRAGMA busy_timeout = 10000;");
    } catch {
      // In-memory or restricted environments
    }
    initSchema(activeDb);
  }

  return activeDb;
}

/**
 * Executes all table definitions from SQL_SCHEMA with retry protection for concurrent access.
 */
export function initSchema(db: DatabaseSync): void {
  const execWithRetry = (sql: string, maxAttempts = 10) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        db.exec(sql);
        return;
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.message.includes("database is locked") || err.message.includes("busy")) &&
          attempt < maxAttempts - 1
        ) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
  };

  for (const ddl of Object.values(SQL_SCHEMA)) {
    execWithRetry(ddl);
  }

  // Schema migrations for invoices table
  try {
    execWithRetry("ALTER TABLE invoices ADD COLUMN invoice_data_json TEXT;");
  } catch {
    // Column already exists
  }
  try {
    execWithRetry("ALTER TABLE invoices ADD COLUMN calculation_id TEXT;");
  } catch {
    // Column already exists
  }
}

/**
 * Closes the active database connection (useful for test tear-down).
 */
export function closeDb(): void {
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // Ignore
    }
    activeDb = null;
    activeDbPath = "";
  }
}

// ==========================================
// IDEMPOTENCY PERSISTENCE
// ==========================================

export interface PersistentIdempotencyRecord {
  key: string;
  request_path: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  response_json: string | null;
  created_at: string;
  expires_at: string;
}

export function getIdempotencyKey(key: string, db?: DatabaseSync): PersistentIdempotencyRecord | null {
  const conn = db || getDb();
  const stmt = conn.prepare("SELECT * FROM idempotency_keys WHERE key = ?");
  const row = stmt.get(key) as PersistentIdempotencyRecord | undefined;
  if (!row) return null;

  // Check TTL expiry
  const expiresAtMs = new Date(row.expires_at).getTime();
  if (Date.now() > expiresAtMs) {
    conn.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
    return null;
  }

  return row;
}

export function saveIdempotencyKey(
  key: string,
  requestPath: string,
  ttlSeconds: number = 86400,
  db?: DatabaseSync
): boolean {
  const conn = db || getDb();
  const existing = getIdempotencyKey(key, conn);
  if (existing && (existing.status === "IN_PROGRESS" || existing.status === "COMPLETED")) {
    return false; // Key already taken/active
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  if (existing) {
    // If it was FAILED, overwrite it
    conn.prepare(
      "UPDATE idempotency_keys SET request_path = ?, status = 'IN_PROGRESS', response_json = NULL, expires_at = ? WHERE key = ?"
    ).run(requestPath, expiresAt, key);
  } else {
    conn.prepare(
      "INSERT INTO idempotency_keys (key, request_path, status, response_json, expires_at) VALUES (?, ?, 'IN_PROGRESS', NULL, ?)"
    ).run(key, requestPath, expiresAt);
  }

  return true;
}

export function completeIdempotencyKey(key: string, response: unknown, db?: DatabaseSync): void {
  const conn = db || getDb();
  const responseJson = JSON.stringify(response);
  conn.prepare(
    "UPDATE idempotency_keys SET status = 'COMPLETED', response_json = ? WHERE key = ?"
  ).run(responseJson, key);
}

export function failIdempotencyKey(key: string, db?: DatabaseSync): void {
  const conn = db || getDb();
  conn.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
}

// ==========================================
// PRODUCT PERSISTENCE
// ==========================================

export interface PersistedProduct {
  id: string;
  title: string;
  description?: string;
  item_price: number;
  shipping_cost: number;
  currency?: string;
  quantity?: number;
  image_url?: string;
  created_at?: string;
}

export function saveProduct(product: PersistedProduct, db?: DatabaseSync): void {
  const conn = db || getDb();
  conn.prepare(`
    INSERT INTO products (id, title, description, item_price, shipping_cost, currency, quantity, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      item_price = excluded.item_price,
      shipping_cost = excluded.shipping_cost,
      currency = excluded.currency,
      quantity = excluded.quantity,
      image_url = excluded.image_url
  `).run(
    product.id,
    product.title,
    product.description || "",
    product.item_price,
    product.shipping_cost,
    product.currency || "USD",
    product.quantity ?? 1,
    product.image_url || null
  );
}

export function getProduct(id: string, db?: DatabaseSync): PersistedProduct | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM products WHERE id = ?").get(id) as PersistedProduct | undefined;
  return row || null;
}

// ==========================================
// CLASSIFICATION PERSISTENCE
// ==========================================

export interface PersistedClassification {
  id: string;
  product_id: string;
  suggested_hs6: string;
  suggested_hts10: string;
  hts_description: string;
  general_duty_rate: number;
  confidence_level: string;
  reasoning_text: string;
  is_confirmed_by_user?: number;
  confirmed_at?: string | null;
}

export function saveClassification(classification: PersistedClassification, db?: DatabaseSync): void {
  const conn = db || getDb();
  conn.prepare(`
    INSERT INTO classifications (
      id, product_id, suggested_hs6, suggested_hts10, hts_description,
      general_duty_rate, confidence_level, reasoning_text, is_confirmed_by_user, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      suggested_hs6 = excluded.suggested_hs6,
      suggested_hts10 = excluded.suggested_hts10,
      hts_description = excluded.hts_description,
      general_duty_rate = excluded.general_duty_rate,
      confidence_level = excluded.confidence_level,
      reasoning_text = excluded.reasoning_text,
      is_confirmed_by_user = excluded.is_confirmed_by_user,
      confirmed_at = excluded.confirmed_at
  `).run(
    classification.id,
    classification.product_id,
    classification.suggested_hs6,
    classification.suggested_hts10,
    classification.hts_description,
    classification.general_duty_rate,
    classification.confidence_level,
    classification.reasoning_text,
    classification.is_confirmed_by_user ?? 0,
    classification.confirmed_at || null
  );
}

export function getClassification(id: string, db?: DatabaseSync): PersistedClassification | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM classifications WHERE id = ?").get(id) as PersistedClassification | undefined;
  return row || null;
}

// ==========================================
// LANDED COST CALCULATION PERSISTENCE
// ==========================================

export interface PersistedLandedCost {
  id: string;
  product_id: string;
  classification_id: string | null;
  dutiable_value: number;
  duty_amount: number;
  mpf_amount: number;
  hmf_amount: number;
  shipping_amount: number;
  total_landed_cost: number;
  is_section_321_eligible: number;
  calculation_breakdown_json: string;
  tariff_revision_stamp: string;
  created_at: string;
}

export function saveLandedCostCalculation(
  result: LandedCostCalculationResult,
  productId?: string,
  classificationId?: string,
  db?: DatabaseSync
): void {
  const conn = db || getDb();
  const prodId = productId || result.productId || `prod_${result.calculationId.replace("calc_", "")}`;

  // Wrap all related writes in an atomic SQLite transaction (DEF-03)
  conn.exec("BEGIN TRANSACTION");
  try {
    // Ensure parent product exists in database to satisfy foreign key relationships
    const existingProd = getProduct(prodId, conn);
    if (!existingProd) {
      saveProduct(
        {
          id: prodId,
          title: result.productTitle,
          item_price: result.unitPriceUSD * result.quantity,
          shipping_cost: result.internationalShippingUSD,
          currency: "USD",
          quantity: result.quantity,
        },
        conn
      );
    }

    // Ensure parent classification exists if classificationId is provided
    if (classificationId) {
      const existingClass = getClassification(classificationId, conn);
      if (!existingClass) {
        saveClassification(
          {
            id: classificationId,
            product_id: prodId,
            suggested_hs6: result.dutyBreakdown.hts10.substring(0, 7),
            suggested_hts10: result.dutyBreakdown.hts10,
            hts_description: result.dutyBreakdown.statutoryReference,
            general_duty_rate: result.dutyBreakdown.baseAdValoremRate,
            confidence_level: "HIGH",
            reasoning_text: result.statutoryRevision,
            is_confirmed_by_user: 1,
            confirmed_at: new Date().toISOString(),
          },
          conn
        );
      }
    }

    conn.prepare(`
      INSERT INTO landed_cost_calculations (
        id, product_id, classification_id, dutiable_value, duty_amount,
        mpf_amount, hmf_amount, shipping_amount, total_landed_cost,
        is_section_321_eligible, calculation_breakdown_json, tariff_revision_stamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        dutiable_value = excluded.dutiable_value,
        duty_amount = excluded.duty_amount,
        mpf_amount = excluded.mpf_amount,
        hmf_amount = excluded.hmf_amount,
        shipping_amount = excluded.shipping_amount,
        total_landed_cost = excluded.total_landed_cost,
        is_section_321_eligible = excluded.is_section_321_eligible,
        calculation_breakdown_json = excluded.calculation_breakdown_json,
        tariff_revision_stamp = excluded.tariff_revision_stamp
    `).run(
      result.calculationId,
      prodId,
      classificationId || null,
      result.dutiableCustomsValueUSD,
      result.totalCustomsDutyUSD,
      result.mpfBreakdown.finalMpfAmountUSD,
      result.hmfBreakdown.hmfAmountUSD,
      result.internationalShippingUSD,
      result.totalLandedCostUSD,
      0, // General de minimis suspended Aug 29, 2025
      JSON.stringify(result),
      result.statutoryRevision,
      result.calculatedAt
    );

    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export function getLandedCostCalculation(id: string, db?: DatabaseSync): PersistedLandedCost | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM landed_cost_calculations WHERE id = ?").get(id) as
    | PersistedLandedCost
    | undefined;
  return row || null;
}

export function listLandedCostCalculations(limit: number = 20, db?: DatabaseSync): PersistedLandedCost[] {
  const conn = db || getDb();
  const rows = conn.prepare(
    "SELECT * FROM landed_cost_calculations ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as unknown as PersistedLandedCost[];
  return rows;
}

// ==========================================
// UNIVERSAL DATABASE ADAPTER CONTRACT (DEF-02)
// ==========================================

/**
 * Universal Database Adapter Interface (DEF-02)
 * Decouples the application layer from specific persistence engines.
 * Enables zero-budget serverless deployment via Turso/libSQL while
 * retaining zero-dependency local development via native `node:sqlite`.
 */
export interface DatabaseAdapter {
  init(): Promise<void> | void;
  saveIdempotencyKey(key: string, requestPath: string, ttlSeconds?: number): Promise<boolean> | boolean;
  getIdempotencyKey(key: string): Promise<PersistentIdempotencyRecord | null> | PersistentIdempotencyRecord | null;
  completeIdempotencyKey(key: string, response: unknown): Promise<void> | void;
  failIdempotencyKey(key: string): Promise<void> | void;
  saveProduct(product: PersistedProduct): Promise<void> | void;
  getProduct(id: string): Promise<PersistedProduct | null> | PersistedProduct | null;
  saveClassification(classification: PersistedClassification): Promise<void> | void;
  getClassification(id: string): Promise<PersistedClassification | null> | PersistedClassification | null;
  saveLandedCostCalculation(result: LandedCostCalculationResult, productId?: string, classificationId?: string): Promise<void> | void;
  getLandedCostCalculation(id: string): Promise<PersistedLandedCost | null> | PersistedLandedCost | null;
  listLandedCostCalculations(limit?: number): Promise<PersistedLandedCost[]> | PersistedLandedCost[];
  close(): Promise<void> | void;
}

/**
 * Native Node.js SQLite Adapter implementing DatabaseAdapter.
 * Used for local development and self-hosted environments.
 */
export class NativeSqliteAdapter implements DatabaseAdapter {
  private db: DatabaseSync;

  constructor(customPath?: string) {
    this.db = getDb(customPath);
  }

  init(): void {
    initSchema(this.db);
  }

  saveIdempotencyKey(key: string, requestPath: string, ttlSeconds = 86400): boolean {
    return saveIdempotencyKey(key, requestPath, ttlSeconds, this.db);
  }

  getIdempotencyKey(key: string): PersistentIdempotencyRecord | null {
    return getIdempotencyKey(key, this.db);
  }

  completeIdempotencyKey(key: string, response: unknown): void {
    completeIdempotencyKey(key, response, this.db);
  }

  failIdempotencyKey(key: string): void {
    failIdempotencyKey(key, this.db);
  }

  saveProduct(product: PersistedProduct): void {
    saveProduct(product, this.db);
  }

  getProduct(id: string): PersistedProduct | null {
    return getProduct(id, this.db);
  }

  saveClassification(classification: PersistedClassification): void {
    saveClassification(classification, this.db);
  }

  getClassification(id: string): PersistedClassification | null {
    return getClassification(id, this.db);
  }

  saveLandedCostCalculation(result: LandedCostCalculationResult, productId?: string, classificationId?: string): void {
    saveLandedCostCalculation(result, productId, classificationId, this.db);
  }

  getLandedCostCalculation(id: string): PersistedLandedCost | null {
    return getLandedCostCalculation(id, this.db);
  }

  listLandedCostCalculations(limit = 20): PersistedLandedCost[] {
    return listLandedCostCalculations(limit, this.db);
  }

  saveInvoice(invoice: CommercialInvoiceDraft): CommercialInvoiceDraft {
    return saveInvoice(invoice, this.db);
  }

  getInvoice(id: string): CommercialInvoiceDraft | null {
    return getInvoice(id, this.db);
  }

  getInvoiceByNumber(invoiceNumber: string): CommercialInvoiceDraft | null {
    return getInvoiceByNumber(invoiceNumber, this.db);
  }

  listInvoices(limit = 50, offset = 0): CommercialInvoiceDraft[] {
    return listInvoices(limit, offset, this.db);
  }

  deleteInvoice(id: string): boolean {
    return deleteInvoice(id, this.db);
  }

  close(): void {
    closeDb();
  }
}

// ==========================================
// COMMERCIAL INVOICE PERSISTENCE (Sprint 5)
// ==========================================

export interface PersistedInvoiceRow {
  id: string;
  invoice_number: string;
  product_id: string | null;
  calculation_id: string | null;
  seller_name: string;
  seller_iec: string | null;
  seller_gstin: string | null;
  seller_lut_arn: string | null;
  buyer_name: string;
  buyer_address: string;
  buyer_country: string;
  total_amount: number;
  currency: string;
  status: string;
  invoice_data_json: string | null;
  created_at: string;
}

export function saveInvoice(invoice: CommercialInvoiceDraft, db?: DatabaseSync): CommercialInvoiceDraft {
  const conn = db || getDb();
  const invoiceJson = JSON.stringify(invoice);

  const targetProductId = invoice.productId || `prod_inv_${invoice.id}`;

  // Atomic database transaction ensuring all related records commit together
  conn.exec("BEGIN IMMEDIATE;");
  try {
    // Ensure foreign key constraint on products(id) is satisfied
    const existingProduct = conn.prepare("SELECT id FROM products WHERE id = ?").get(targetProductId);
    if (!existingProduct) {
      conn.prepare(`
        INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetProductId,
        invoice.items?.[0]?.description || "Export Merchandise",
        invoice.items?.[0]?.description || "Export Merchandise",
        invoice.items?.[0]?.unitPriceUSD || 0,
        invoice.shipment?.shippingCostUSD || 0,
        invoice.currency || "USD",
        invoice.items?.[0]?.quantity || 1
      );
    }

    // Validate calculationId foreign key
    let validCalculationId: string | null = null;
    if (invoice.calculationId) {
      const calcRow = conn.prepare("SELECT id FROM landed_cost_calculations WHERE id = ?").get(invoice.calculationId);
      if (calcRow) {
        validCalculationId = invoice.calculationId;
      }
    }

    conn.prepare(`
      INSERT INTO invoices (
        id, invoice_number, product_id, calculation_id,
        seller_name, seller_iec, seller_gstin, seller_lut_arn,
        buyer_name, buyer_address, buyer_country,
        total_amount, currency, status, invoice_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        invoice_number = excluded.invoice_number,
        product_id = excluded.product_id,
        calculation_id = excluded.calculation_id,
        seller_name = excluded.seller_name,
        seller_iec = excluded.seller_iec,
        seller_gstin = excluded.seller_gstin,
        seller_lut_arn = excluded.seller_lut_arn,
        buyer_name = excluded.buyer_name,
        buyer_address = excluded.buyer_address,
        buyer_country = excluded.buyer_country,
        total_amount = excluded.total_amount,
        currency = excluded.currency,
        status = excluded.status,
        invoice_data_json = excluded.invoice_data_json
    `).run(
      invoice.id,
      invoice.invoiceNumber,
      targetProductId,
      validCalculationId,
      invoice.seller.businessName,
      invoice.seller.iecNumber || null,
      invoice.seller.gstin || null,
      invoice.seller.lutArn || null,
      invoice.buyer.name,
      invoice.buyer.address,
      invoice.buyer.country || "US",
      invoice.invoiceTotalUSD,
      invoice.currency || "USD",
      invoice.status || "DRAFT",
      invoiceJson,
      invoice.createdAt || new Date().toISOString()
    );

    conn.exec("COMMIT;");
  } catch (err) {
    try {
      conn.exec("ROLLBACK;");
    } catch {
      // rollback safe
    }
    throw err;
  }

  return invoice;
}

export function getInvoice(id: string, db?: DatabaseSync): CommercialInvoiceDraft | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as PersistedInvoiceRow | undefined;
  if (!row) return null;
  if (row.invoice_data_json) {
    try {
      return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
    } catch {
      // Fallback
    }
  }
  return null;
}

export function getInvoiceByNumber(invoiceNumber: string, db?: DatabaseSync): CommercialInvoiceDraft | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM invoices WHERE invoice_number = ?").get(invoiceNumber) as PersistedInvoiceRow | undefined;
  if (!row) return null;
  if (row.invoice_data_json) {
    try {
      return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
    } catch {
      // Fallback
    }
  }
  return null;
}

export function listInvoices(limit = 50, offset = 0, db?: DatabaseSync): CommercialInvoiceDraft[] {
  const conn = db || getDb();
  const rows = conn.prepare("SELECT * FROM invoices ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset) as unknown as PersistedInvoiceRow[];
  const results: CommercialInvoiceDraft[] = [];
  for (const r of rows) {
    if (r.invoice_data_json) {
      try {
        results.push(JSON.parse(r.invoice_data_json) as CommercialInvoiceDraft);
      } catch {
        // Skip corrupt row
      }
    }
  }
  return results;
}

export function deleteInvoice(id: string, db?: DatabaseSync): boolean {
  const conn = db || getDb();
  try {
    conn.prepare("DELETE FROM payments WHERE invoice_id = ?").run(id);
    conn.prepare("DELETE FROM paypal_orders WHERE invoice_id = ?").run(id);
  } catch {
    // Ignore if table missing or record absent
  }
  const info = conn.prepare("DELETE FROM invoices WHERE id = ?").run(id);
  return info.changes > 0;
}

// ==========================================
// PAYPAL PAYMENTS PERSISTENCE (Sprint 6)
// ==========================================

export interface PersistedPaymentRow {
  id: string;
  invoice_id: string;
  paypal_order_id: string;
  paypal_capture_id: string | null;
  amount: number;
  currency: string;
  status: string;
  is_sandbox: number;
  payer_email: string | null;
  payer_name: string | null;
  capture_time: string | null;
  last_webhook_event_id: string | null;
  payment_data_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPaymentRecord(row: PersistedPaymentRow): PaymentRecord {
  let paymentData: Record<string, unknown> | undefined;
  if (row.payment_data_json) {
    try {
      paymentData = JSON.parse(row.payment_data_json);
    } catch {
      // fallback
    }
  }

  return {
    id: row.id,
    invoiceId: row.invoice_id,
    paypalOrderId: row.paypal_order_id,
    paypalCaptureId: row.paypal_capture_id || undefined,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as PaymentStatus,
    isSandbox: Boolean(row.is_sandbox),
    payerEmail: row.payer_email || undefined,
    payerName: row.payer_name || undefined,
    captureTime: row.capture_time || undefined,
    lastWebhookEventId: row.last_webhook_event_id || undefined,
    paymentData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function savePayment(payment: PaymentRecord, db?: DatabaseSync): PaymentRecord {
  const conn = db || getDb();
  const paymentJson = payment.paymentData ? JSON.stringify(payment.paymentData) : null;
  const isSandboxInt = payment.isSandbox ? 1 : 0;
  const now = new Date().toISOString();

  conn.exec("BEGIN IMMEDIATE;");
  try {
    // Ensure referenced invoice exists to satisfy foreign key constraint
    const existingInvoice = conn.prepare("SELECT id FROM invoices WHERE id = ?").get(payment.invoiceId);
    if (!existingInvoice) {
      const phProductId = `prod_ph_${payment.invoiceId}`;
      conn.prepare(`
        INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
        VALUES (?, 'Payment Placeholder Product', 'Placeholder description', ?, 0, ?, 1)
      `).run(phProductId, payment.amount, payment.currency || "USD");

      conn.prepare(`
        INSERT OR IGNORE INTO invoices (
          id, invoice_number, product_id, total_amount, currency,
          seller_name, buyer_name, buyer_address, status
        )
        VALUES (?, ?, ?, ?, ?, 'Exporter Placeholder', 'Buyer Placeholder', 'Address Placeholder', 'DRAFT')
      `).run(
        payment.invoiceId,
        `INV-${payment.invoiceId}`,
        phProductId,
        payment.amount,
        payment.currency || "USD"
      );
    }

    // Resolve target internal payment ID if order already exists
    const existingPayment = conn
      .prepare("SELECT id FROM payments WHERE paypal_order_id = ?")
      .get(payment.paypalOrderId) as { id: string } | undefined;
    const targetId = existingPayment?.id || payment.id;

    // 1. Insert into master payments table
    conn.prepare(`
      INSERT INTO payments (
        id, invoice_id, paypal_order_id, paypal_capture_id,
        amount, currency, status, is_sandbox,
        payer_email, payer_name, capture_time, last_webhook_event_id,
        payment_data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        invoice_id = excluded.invoice_id,
        paypal_order_id = excluded.paypal_order_id,
        paypal_capture_id = excluded.paypal_capture_id,
        amount = excluded.amount,
        currency = excluded.currency,
        status = excluded.status,
        is_sandbox = excluded.is_sandbox,
        payer_email = excluded.payer_email,
        payer_name = excluded.payer_name,
        capture_time = excluded.capture_time,
        last_webhook_event_id = excluded.last_webhook_event_id,
        payment_data_json = excluded.payment_data_json,
        updated_at = excluded.updated_at
    `).run(
      targetId,
      payment.invoiceId,
      payment.paypalOrderId,
      payment.paypalCaptureId || null,
      payment.amount,
      payment.currency || "USD",
      payment.status,
      isSandboxInt,
      payment.payerEmail || null,
      payment.payerName || null,
      payment.captureTime || null,
      payment.lastWebhookEventId || null,
      paymentJson,
      payment.createdAt || now,
      payment.updatedAt || now
    );

    // 2. Synchronize legacy paypal_orders table for baseline compatibility
    conn.prepare(`
      INSERT OR REPLACE INTO paypal_orders (
        id, invoice_id, amount, currency, status, capture_id, payer_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment.paypalOrderId,
      payment.invoiceId,
      payment.amount,
      payment.currency || "USD",
      payment.status,
      payment.paypalCaptureId || null,
      payment.payerEmail || null,
      payment.createdAt || now,
      payment.updatedAt || now
    );

    conn.exec("COMMIT;");
  } catch (err) {
    try {
      conn.exec("ROLLBACK;");
    } catch {
      // rollback safe
    }
    throw err;
  }

  return payment;
}

export function getPayment(id: string, db?: DatabaseSync): PaymentRecord | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByOrderId(orderId: string, db?: DatabaseSync): PaymentRecord | null {
  const conn = db || getDb();
  const row = conn.prepare("SELECT * FROM payments WHERE paypal_order_id = ?").get(orderId) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByInvoiceId(invoiceId: string, db?: DatabaseSync): PaymentRecord | null {
  const conn = db || getDb();
  const row = conn
    .prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(invoiceId) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByCaptureId(captureId: string, db?: DatabaseSync): PaymentRecord | null {
  const conn = db || getDb();
  const row = conn
    .prepare("SELECT * FROM payments WHERE paypal_capture_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(captureId) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  captureId?: string,
  payerEmail?: string,
  payerName?: string,
  captureData?: Record<string, unknown>,
  db?: DatabaseSync
): PaymentRecord | null {
  const conn = db || getDb();
  const existing = conn.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  const captureTime = status === "COMPLETED" ? (existing.capture_time || now) : existing.capture_time;
  const mergedCaptureId = captureId || existing.paypal_capture_id;
  const mergedEmail = payerEmail || existing.payer_email;
  const mergedName = payerName || existing.payer_name;
  const paymentJson = captureData ? JSON.stringify(captureData) : existing.payment_data_json;

  conn.exec("BEGIN IMMEDIATE;");
  try {
    conn.prepare(`
      UPDATE payments SET
        status = ?,
        paypal_capture_id = ?,
        payer_email = ?,
        payer_name = ?,
        capture_time = ?,
        payment_data_json = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      mergedCaptureId || null,
      mergedEmail || null,
      mergedName || null,
      captureTime || null,
      paymentJson || null,
      now,
      id
    );

    // Sync paypal_orders
    conn.prepare(`
      UPDATE paypal_orders SET
        status = ?,
        capture_id = ?,
        payer_email = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      mergedCaptureId || null,
      mergedEmail || null,
      now,
      existing.paypal_order_id
    );

    // If completed, update associated invoice status to 'PAID'
    if (status === "COMPLETED" && existing.invoice_id) {
      const invRow = conn.prepare("SELECT invoice_data_json FROM invoices WHERE id = ?").get(existing.invoice_id) as { invoice_data_json: string | null } | undefined;
      let updatedInvoiceJson = invRow?.invoice_data_json;
      if (updatedInvoiceJson) {
        try {
          const parsed = JSON.parse(updatedInvoiceJson);
          parsed.status = "PAID";
          parsed.updatedAt = now;
          updatedInvoiceJson = JSON.stringify(parsed);
        } catch {
          // ignore
        }
      }
      conn.prepare("UPDATE invoices SET status = 'PAID', invoice_data_json = ? WHERE id = ?").run(updatedInvoiceJson || null, existing.invoice_id);
    }

    // If refunded, update associated invoice status to 'REFUNDED' with audit note
    if (status === "REFUNDED" && existing.invoice_id) {
      const invRow = conn.prepare("SELECT invoice_data_json FROM invoices WHERE id = ?").get(existing.invoice_id) as { invoice_data_json: string | null } | undefined;
      let updatedInvoiceJson = invRow?.invoice_data_json;
      if (updatedInvoiceJson) {
        try {
          const parsed = JSON.parse(updatedInvoiceJson);
          parsed.status = "REFUNDED";
          parsed.updatedAt = now;
          parsed.refundInfo = {
            refundedAt: now,
            captureId: mergedCaptureId,
            reason: "PayPal Sandbox payment refunded",
          };
          updatedInvoiceJson = JSON.stringify(parsed);
        } catch {
          // ignore
        }
      }
      conn.prepare("UPDATE invoices SET status = 'REFUNDED', invoice_data_json = ? WHERE id = ?").run(updatedInvoiceJson || null, existing.invoice_id);
    }

    conn.exec("COMMIT;");
  } catch (err) {
    try {
      conn.exec("ROLLBACK;");
    } catch {
      // rollback safe
    }
    throw err;
  }

  return getPayment(id, conn);
}

export function saveWebhookLog(
  eventId: string,
  eventType: string,
  payload: unknown,
  verificationStatus: "VERIFIED" | "FAILED",
  db?: DatabaseSync
): boolean {
  const conn = db || getDb();
  try {
    const payloadJson = typeof payload === "string" ? payload : JSON.stringify(payload);
    const id = `wh_${eventId}`;
    conn.prepare(`
      INSERT OR REPLACE INTO webhook_logs (id, event_id, event_type, payload_json, verification_status, received_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, eventId, eventType, payloadJson, verificationStatus);
    return true;
  } catch {
    return false;
  }
}

export function isWebhookEventProcessed(eventId: string, db?: DatabaseSync): boolean {
  const conn = db || getDb();
  try {
    const row = conn.prepare("SELECT id FROM webhook_logs WHERE event_id = ?").get(eventId);
    return Boolean(row);
  } catch {
    return false;
  }
}
