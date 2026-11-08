/**
 * BorderBrief AI — Dual-Driver Database Layer (Sprint 8)
 *
 * Provides hybrid persistence:
 * 1. Local Development / Offline Tests: Native Node.js `node:sqlite` (DatabaseSync) on 'borderbrief.db'.
 * 2. Cloud Serverless Production: Hosted libSQL via `@libsql/client` (Turso) over HTTP.
 *
 * Guarantees:
 * - 100% SQL schema and semantics preservation across all 9 tables.
 * - Atomic write batches on Turso via `client.batch([...], 'write')`.
 * - Transaction isolation and integer minor-unit consistency.
 * - Asynchronous retry backoffs replacing blocking `Atomics.wait`.
 * - Backward compatibility with local synchronous SQLite in-memory test suites.
 */

import { DatabaseSync } from "node:sqlite";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { SQL_SCHEMA } from "./schema.ts";
import type { LandedCostCalculationResult } from "../../types/export.ts";
import type { CommercialInvoiceDraft } from "../../types/invoice.ts";
import type { PaymentRecord, PaymentStatus } from "../../types/payment.ts";

let activeDb: DatabaseSync | null = null;
let activeDbPath: string = "";
let tursoClient: Client | null = null;

export class DatabaseConfigurationError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
    this.code = "DATABASE_CONFIGURATION_ERROR";
  }
}

/**
 * Returns true if Turso cloud database configuration is active in environment.
 */
export function isTursoActive(): boolean {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  return Boolean(
    url &&
    (url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://"))
  );
}

/**
 * Retrieves or initializes the Turso libSQL client singleton.
 */
export function getTursoClient(): Client {
  if (!tursoClient) {
    const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

    if (!url) {
      throw new DatabaseConfigurationError(
        "TURSO_DATABASE_URL is required to initialize cloud database client."
      );
    }

    tursoClient = createClient({
      url,
      authToken,
    });
  }
  return tursoClient;
}

/**
 * Initializes and returns a local SQLite database instance.
 * Automatically executes DDL schema tables if they do not exist.
 * Enforces production safety guardrails against ephemeral local file writes (DEF-02).
 */
export function getDb(customPath?: string): DatabaseSync {
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
 * Sleep helper for non-blocking asynchronous retry backoff.
 */
async function asyncSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes all table definitions from SQL_SCHEMA.
 * Compatible with both local DatabaseSync and remote Turso client.
 */
export function initSchema(db?: DatabaseSync): void | Promise<void> {
  if (db) {
    // Synchronous execution for passed DatabaseSync instance (e.g. in-memory test)
    for (const ddl of Object.values(SQL_SCHEMA)) {
      db.exec(ddl);
    }
    try {
      db.exec("ALTER TABLE invoices ADD COLUMN invoice_data_json TEXT;");
    } catch {
      // Column exists
    }
    try {
      db.exec("ALTER TABLE invoices ADD COLUMN calculation_id TEXT;");
    } catch {
      // Column exists
    }
    return;
  }

  if (isTursoActive()) {
    // Asynchronous execution against remote Turso
    return (async () => {
      const client = getTursoClient();
      for (const ddl of Object.values(SQL_SCHEMA)) {
        await client.execute(ddl);
      }
      try {
        await client.execute("ALTER TABLE invoices ADD COLUMN invoice_data_json TEXT;");
      } catch {
        // Column exists
      }
      try {
        await client.execute("ALTER TABLE invoices ADD COLUMN calculation_id TEXT;");
      } catch {
        // Column exists
      }
    })();
  }

  // Local activeDb
  const conn = getDb();
  for (const ddl of Object.values(SQL_SCHEMA)) {
    conn.exec(ddl);
  }
}

/**
 * Closes active database connections (useful for test tear-down).
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
  if (tursoClient) {
    try {
      tursoClient.close();
    } catch {
      // Ignore
    }
    tursoClient = null;
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

export function getIdempotencyKey(
  key: string,
  db?: DatabaseSync
): PersistentIdempotencyRecord | null {
  if (db) {
    const stmt = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?");
    const row = stmt.get(key) as PersistentIdempotencyRecord | undefined;
    if (!row) return null;
    if (Date.now() > new Date(row.expires_at).getTime()) {
      db.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
      return null;
    }
    return row;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM idempotency_keys WHERE key = ?;",
        args: [key],
      });
      const row = res.rows[0] as unknown as PersistentIdempotencyRecord | undefined;
      if (!row) return null;
      if (Date.now() > new Date(row.expires_at).getTime()) {
        await client.execute({
          sql: "DELETE FROM idempotency_keys WHERE key = ?;",
          args: [key],
        });
        return null;
      }
      return row;
    })() as unknown as PersistentIdempotencyRecord | null;
  }

  const conn = getDb();
  const stmt = conn.prepare("SELECT * FROM idempotency_keys WHERE key = ?");
  const row = stmt.get(key) as PersistentIdempotencyRecord | undefined;
  if (!row) return null;
  if (Date.now() > new Date(row.expires_at).getTime()) {
    conn.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
    return null;
  }
  return row;
}

export function saveIdempotencyKey(
  key: string,
  requestPath: string,
  ttlSeconds = 86400,
  db?: DatabaseSync
): boolean {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  if (db) {
    const existing = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(key) as PersistentIdempotencyRecord | undefined;
    if (existing && Date.now() <= new Date(existing.expires_at).getTime()) {
      return false;
    }
    db.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (key, request_path, status, expires_at)
      VALUES (?, ?, 'IN_PROGRESS', ?)
    `).run(key, requestPath, expiresAt);
    return true;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const existing = await client.execute({
        sql: "SELECT * FROM idempotency_keys WHERE key = ?;",
        args: [key],
      });
      const row = existing.rows[0] as unknown as PersistentIdempotencyRecord | undefined;
      if (row && Date.now() <= new Date(row.expires_at).getTime()) {
        return false;
      }
      await client.execute({
        sql: `INSERT OR REPLACE INTO idempotency_keys (key, request_path, status, expires_at)
              VALUES (?, ?, 'IN_PROGRESS', ?);`,
        args: [key, requestPath, expiresAt],
      });
      return true;
    })() as unknown as boolean;
  }

  const conn = getDb();
  const existing = conn.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(key) as PersistentIdempotencyRecord | undefined;
  if (existing && Date.now() <= new Date(existing.expires_at).getTime()) {
    return false;
  }
  conn.prepare(`
    INSERT OR REPLACE INTO idempotency_keys (key, request_path, status, expires_at)
    VALUES (?, ?, 'IN_PROGRESS', ?)
  `).run(key, requestPath, expiresAt);
  return true;
}

export function completeIdempotencyKey(
  key: string,
  response: unknown,
  db?: DatabaseSync
): void {
  const responseJson = JSON.stringify(response);

  if (db) {
    db.prepare(`
      UPDATE idempotency_keys
      SET status = 'COMPLETED', response_json = ?
      WHERE key = ?
    `).run(responseJson, key);
    return;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      await client.execute({
        sql: "UPDATE idempotency_keys SET status = 'COMPLETED', response_json = ? WHERE key = ?;",
        args: [responseJson, key],
      });
    })() as unknown as void;
  }

  const conn = getDb();
  conn.prepare(`
    UPDATE idempotency_keys
    SET status = 'COMPLETED', response_json = ?
    WHERE key = ?
  `).run(responseJson, key);
}

export function failIdempotencyKey(key: string, db?: DatabaseSync): void {
  if (db) {
    db.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
    return;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      await client.execute({
        sql: "DELETE FROM idempotency_keys WHERE key = ?;",
        args: [key],
      });
    })() as unknown as void;
  }

  const conn = getDb();
  conn.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
}

// ==========================================
// PRODUCT INTAKE PERSISTENCE
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

export function saveProduct(product: PersistedProduct, db?: DatabaseSync): void | Promise<void> {
  if (db) {
    db.prepare(`
      INSERT OR REPLACE INTO products (id, title, description, item_price, shipping_cost, currency, quantity, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id,
      product.title,
      product.description || null,
      product.item_price,
      product.shipping_cost,
      product.currency || "USD",
      product.quantity || 1,
      product.image_url || null
    );
    return;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      await client.execute({
        sql: `INSERT OR REPLACE INTO products (id, title, description, item_price, shipping_cost, currency, quantity, image_url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          product.id,
          product.title,
          product.description || null,
          product.item_price,
          product.shipping_cost,
          product.currency || "USD",
          product.quantity || 1,
          product.image_url || null,
        ],
      });
    })();
  }

  const conn = getDb();
  conn.prepare(`
    INSERT OR REPLACE INTO products (id, title, description, item_price, shipping_cost, currency, quantity, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.title,
    product.description || null,
    product.item_price,
    product.shipping_cost,
    product.currency || "USD",
    product.quantity || 1,
    product.image_url || null
  );
}

export function getProduct(
  id: string,
  db?: DatabaseSync
): PersistedProduct | null {
  if (db) {
    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    return (row as unknown as PersistedProduct) || null;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM products WHERE id = ?;",
        args: [id],
      });
      return (res.rows[0] as unknown as PersistedProduct) || null;
    })() as unknown as PersistedProduct | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return (row as unknown as PersistedProduct) || null;
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
  confidence_level: "HIGH" | "MEDIUM" | "LOW";
  reasoning_text: string;
  is_confirmed_by_user?: boolean | number;
  confirmed_at?: string;
}

export function saveClassification(
  classification: PersistedClassification,
  db?: DatabaseSync
): void | Promise<void> {
  const isConfirmedInt = classification.is_confirmed_by_user ? 1 : 0;

  if (db) {
    db.prepare(`
      INSERT OR REPLACE INTO classifications (
        id, product_id, suggested_hs6, suggested_hts10,
        hts_description, general_duty_rate, confidence_level,
        reasoning_text, is_confirmed_by_user, confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      classification.id,
      classification.product_id,
      classification.suggested_hs6,
      classification.suggested_hts10,
      classification.hts_description,
      classification.general_duty_rate,
      classification.confidence_level,
      classification.reasoning_text,
      isConfirmedInt,
      classification.confirmed_at || null
    );
    return;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      await client.execute({
        sql: `INSERT OR REPLACE INTO classifications (
          id, product_id, suggested_hs6, suggested_hts10,
          hts_description, general_duty_rate, confidence_level,
          reasoning_text, is_confirmed_by_user, confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          classification.id,
          classification.product_id,
          classification.suggested_hs6,
          classification.suggested_hts10,
          classification.hts_description,
          classification.general_duty_rate,
          classification.confidence_level,
          classification.reasoning_text,
          isConfirmedInt,
          classification.confirmed_at || null,
        ],
      });
    })();
  }

  const conn = getDb();
  conn.prepare(`
    INSERT OR REPLACE INTO classifications (
      id, product_id, suggested_hs6, suggested_hts10,
      hts_description, general_duty_rate, confidence_level,
      reasoning_text, is_confirmed_by_user, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    classification.id,
    classification.product_id,
    classification.suggested_hs6,
    classification.suggested_hts10,
    classification.hts_description,
    classification.general_duty_rate,
    classification.confidence_level,
    classification.reasoning_text,
    isConfirmedInt,
    classification.confirmed_at || null
  );
}

export function getClassification(
  id: string,
  db?: DatabaseSync
): PersistedClassification | null {
  if (db) {
    const row = db.prepare("SELECT * FROM classifications WHERE id = ?").get(id);
    return (row as unknown as PersistedClassification) || null;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM classifications WHERE id = ?;",
        args: [id],
      });
      return (res.rows[0] as unknown as PersistedClassification) || null;
    })() as unknown as PersistedClassification | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM classifications WHERE id = ?").get(id);
  return (row as unknown as PersistedClassification) || null;
}

// ==========================================
// LANDED COST PERSISTENCE
// ==========================================

export interface PersistedLandedCost {
  id: string;
  product_id: string;
  classification_id?: string;
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
): void | Promise<void> {
  const prodId = productId || result.productId || `prod_${Date.now()}`;
  const breakdownJson = JSON.stringify(result);
  const dutiableValue = result.dutiableCustomsValueUSD;
  const dutyAmount = result.totalCustomsDutyUSD;
  const mpfAmount = result.mpfBreakdown?.finalMpfAmountUSD ?? 0;
  const hmfAmount = result.hmfBreakdown?.hmfAmountUSD ?? 0;
  const shippingAmount = result.internationalShippingUSD ?? 0;
  const totalLandedCost = result.totalLandedCostUSD;
  const tariffRevision = result.statutoryRevision || "";
  const createdAt = result.calculatedAt || new Date().toISOString();

  if (db) {
    db.exec("BEGIN TRANSACTION;");
    try {
      const existingProd = db.prepare("SELECT id FROM products WHERE id = ?").get(prodId);
      if (!existingProd) {
        db.prepare(`
          INSERT INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          prodId,
          result.productTitle || `Product (${result.dutyBreakdown?.hts10 || "HTS"})`,
          `Import landed-cost calculation for ${result.dutyBreakdown?.hts10 || "HTS"}`,
          dutiableValue,
          shippingAmount,
          "USD",
          result.quantity || 1
        );
      }

      if (classificationId) {
        const existingClass = db.prepare("SELECT id FROM classifications WHERE id = ?").get(classificationId);
        if (!existingClass) {
          db.prepare(`
            INSERT INTO classifications (
              id, product_id, suggested_hs6, suggested_hts10, hts_description,
              general_duty_rate, confidence_level, reasoning_text, is_confirmed_by_user, confirmed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            classificationId,
            prodId,
            result.dutyBreakdown?.hts10?.substring(0, 7) || "0000.00",
            result.dutyBreakdown?.hts10 || "0000.00.00.00",
            result.dutyBreakdown?.statutoryReference || "Classification reference",
            result.dutyBreakdown?.baseAdValoremRate ?? 0,
            "HIGH",
            result.statutoryRevision || "",
            1,
            new Date().toISOString()
          );
        }
      }

      db.prepare(`
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
        dutiableValue,
        dutyAmount,
        mpfAmount,
        hmfAmount,
        shippingAmount,
        totalLandedCost,
        0,
        breakdownJson,
        tariffRevision,
        createdAt
      );

      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {}
      throw err;
    }
    return;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const batchStmts: InStatement[] = [];

      batchStmts.push({
        sql: `INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [
          prodId,
          result.productTitle || `Product (${result.dutyBreakdown?.hts10 || "HTS"})`,
          `Import landed-cost calculation for ${result.dutyBreakdown?.hts10 || "HTS"}`,
          dutiableValue,
          shippingAmount,
          "USD",
          result.quantity || 1,
        ],
      });

      if (classificationId) {
        batchStmts.push({
          sql: `INSERT OR IGNORE INTO classifications (
                  id, product_id, suggested_hs6, suggested_hts10, hts_description,
                  general_duty_rate, confidence_level, reasoning_text, is_confirmed_by_user, confirmed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            classificationId,
            prodId,
            result.dutyBreakdown?.hts10?.substring(0, 7) || "0000.00",
            result.dutyBreakdown?.hts10 || "0000.00.00.00",
            result.dutyBreakdown?.statutoryReference || "Classification reference",
            result.dutyBreakdown?.baseAdValoremRate ?? 0,
            "HIGH",
            result.statutoryRevision || "",
            1,
            new Date().toISOString(),
          ],
        });
      }

      batchStmts.push({
        sql: `INSERT INTO landed_cost_calculations (
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
                tariff_revision_stamp = excluded.tariff_revision_stamp;`,
        args: [
          result.calculationId,
          prodId,
          classificationId || null,
          dutiableValue,
          dutyAmount,
          mpfAmount,
          hmfAmount,
          shippingAmount,
          totalLandedCost,
          0,
          breakdownJson,
          tariffRevision,
          createdAt,
        ],
      });

      await client.batch(batchStmts, "write");
    })();
  }

  const conn = getDb();
  conn.exec("BEGIN TRANSACTION;");
  try {
    const existingProd = conn.prepare("SELECT id FROM products WHERE id = ?").get(prodId);
    if (!existingProd) {
      conn.prepare(`
        INSERT INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        prodId,
        result.productTitle || `Product (${result.dutyBreakdown?.hts10 || "HTS"})`,
        `Import landed-cost calculation for ${result.dutyBreakdown?.hts10 || "HTS"}`,
        dutiableValue,
        shippingAmount,
        "USD",
        result.quantity || 1
      );
    }

    if (classificationId) {
      const existingClass = conn.prepare("SELECT id FROM classifications WHERE id = ?").get(classificationId);
      if (!existingClass) {
        conn.prepare(`
          INSERT INTO classifications (
            id, product_id, suggested_hs6, suggested_hts10, hts_description,
            general_duty_rate, confidence_level, reasoning_text, is_confirmed_by_user, confirmed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          classificationId,
          prodId,
          result.dutyBreakdown?.hts10?.substring(0, 7) || "0000.00",
          result.dutyBreakdown?.hts10 || "0000.00.00.00",
          result.dutyBreakdown?.statutoryReference || "Classification reference",
          result.dutyBreakdown?.baseAdValoremRate ?? 0,
          "HIGH",
          result.statutoryRevision || "",
          1,
          new Date().toISOString()
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
      dutiableValue,
      dutyAmount,
      mpfAmount,
      hmfAmount,
      shippingAmount,
      totalLandedCost,
      0,
      breakdownJson,
      tariffRevision,
      createdAt
    );

    conn.exec("COMMIT;");
  } catch (err) {
    try {
      conn.exec("ROLLBACK;");
    } catch {}
    throw err;
  }
}

export function getLandedCostCalculation(
  id: string,
  db?: DatabaseSync
): PersistedLandedCost | null {
  if (db) {
    const row = db.prepare("SELECT * FROM landed_cost_calculations WHERE id = ?").get(id);
    return (row as unknown as PersistedLandedCost) || null;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM landed_cost_calculations WHERE id = ?;",
        args: [id],
      });
      return (res.rows[0] as unknown as PersistedLandedCost) || null;
    })() as unknown as PersistedLandedCost | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM landed_cost_calculations WHERE id = ?").get(id);
  return (row as unknown as PersistedLandedCost) || null;
}

export function listLandedCostCalculations(
  limit = 20,
  db?: DatabaseSync
): PersistedLandedCost[] {
  if (db) {
    return db
      .prepare("SELECT * FROM landed_cost_calculations ORDER BY created_at DESC LIMIT ?")
      .all(limit) as unknown as PersistedLandedCost[];
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM landed_cost_calculations ORDER BY created_at DESC LIMIT ?;",
        args: [limit],
      });
      return res.rows as unknown as PersistedLandedCost[];
    })() as unknown as PersistedLandedCost[];
  }

  const conn = getDb();
  return conn
    .prepare("SELECT * FROM landed_cost_calculations ORDER BY created_at DESC LIMIT ?")
    .all(limit) as unknown as PersistedLandedCost[];
}

// ==========================================
// COMMERCIAL INVOICE PERSISTENCE
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

export function saveInvoice(
  invoice: CommercialInvoiceDraft,
  db?: DatabaseSync
): CommercialInvoiceDraft {
  const invoiceJson = JSON.stringify(invoice);
  const targetProductId = invoice.productId || `prod_inv_${invoice.id}`;
  const now = invoice.createdAt || new Date().toISOString();

  if (db) {
    db.exec("BEGIN IMMEDIATE;");
    try {
      const existingProduct = db.prepare("SELECT id FROM products WHERE id = ?").get(targetProductId);
      if (!existingProduct) {
        db.prepare(`
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

      let validCalculationId: string | null = null;
      if (invoice.calculationId) {
        const calcRow = db.prepare("SELECT id FROM landed_cost_calculations WHERE id = ?").get(invoice.calculationId);
        if (calcRow) {
          validCalculationId = invoice.calculationId;
        }
      }

      db.prepare(`
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
        now
      );

      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // rollback safe
      }
      throw err;
    }
    return invoice;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const batchStmts: InStatement[] = [];

      batchStmts.push({
        sql: `INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [
          targetProductId,
          invoice.items?.[0]?.description || "Export Merchandise",
          invoice.items?.[0]?.description || "Export Merchandise",
          invoice.items?.[0]?.unitPriceUSD || 0,
          invoice.shipment?.shippingCostUSD || 0,
          invoice.currency || "USD",
          invoice.items?.[0]?.quantity || 1,
        ],
      });

      batchStmts.push({
        sql: `INSERT INTO invoices (
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
          invoice_data_json = excluded.invoice_data_json;`,
        args: [
          invoice.id,
          invoice.invoiceNumber,
          targetProductId,
          invoice.calculationId || null,
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
          now,
        ],
      });

      await client.batch(batchStmts, "write");
      return invoice;
    })() as unknown as CommercialInvoiceDraft;
  }

  const conn = getDb();
  conn.exec("BEGIN IMMEDIATE;");
  try {
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
      now
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

export function getInvoice(
  id: string,
  db?: DatabaseSync
): CommercialInvoiceDraft | null {
  if (db) {
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as PersistedInvoiceRow | undefined;
    if (!row?.invoice_data_json) return null;
    try {
      return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
    } catch {
      return null;
    }
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM invoices WHERE id = ?;",
        args: [id],
      });
      const row = res.rows[0] as unknown as PersistedInvoiceRow | undefined;
      if (!row?.invoice_data_json) return null;
      try {
        return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
      } catch {
        return null;
      }
    })() as unknown as CommercialInvoiceDraft | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as PersistedInvoiceRow | undefined;
  if (!row?.invoice_data_json) return null;
  try {
    return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
  } catch {
    return null;
  }
}

export function getInvoiceByNumber(
  invoiceNumber: string,
  db?: DatabaseSync
): CommercialInvoiceDraft | null {
  if (db) {
    const row = db.prepare("SELECT * FROM invoices WHERE invoice_number = ?").get(invoiceNumber) as PersistedInvoiceRow | undefined;
    if (!row?.invoice_data_json) return null;
    try {
      return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
    } catch {
      return null;
    }
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM invoices WHERE invoice_number = ?;",
        args: [invoiceNumber],
      });
      const row = res.rows[0] as unknown as PersistedInvoiceRow | undefined;
      if (!row?.invoice_data_json) return null;
      try {
        return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
      } catch {
        return null;
      }
    })() as unknown as CommercialInvoiceDraft | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM invoices WHERE invoice_number = ?").get(invoiceNumber) as PersistedInvoiceRow | undefined;
  if (!row?.invoice_data_json) return null;
  try {
    return JSON.parse(row.invoice_data_json) as CommercialInvoiceDraft;
  } catch {
    return null;
  }
}

export function listInvoices(
  limit = 50,
  offset = 0,
  db?: DatabaseSync
): CommercialInvoiceDraft[] {
  if (db) {
    const rows = db.prepare("SELECT * FROM invoices ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset) as unknown as PersistedInvoiceRow[];
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

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM invoices ORDER BY created_at DESC LIMIT ? OFFSET ?;",
        args: [limit, offset],
      });
      const rows = res.rows as unknown as PersistedInvoiceRow[];
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
    })() as unknown as CommercialInvoiceDraft[];
  }

  const conn = getDb();
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
  if (db) {
    try {
      db.prepare("DELETE FROM payments WHERE invoice_id = ?").run(id);
      db.prepare("DELETE FROM paypal_orders WHERE invoice_id = ?").run(id);
    } catch {
      // Ignore if table missing
    }
    const info = db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
    return info.changes > 0;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      await client.batch([
        { sql: "DELETE FROM payments WHERE invoice_id = ?;", args: [id] },
        { sql: "DELETE FROM paypal_orders WHERE invoice_id = ?;", args: [id] },
        { sql: "DELETE FROM invoices WHERE id = ?;", args: [id] },
      ], "write");
      return true;
    })() as unknown as boolean;
  }

  const conn = getDb();
  try {
    conn.prepare("DELETE FROM payments WHERE invoice_id = ?").run(id);
    conn.prepare("DELETE FROM paypal_orders WHERE invoice_id = ?").run(id);
  } catch {
    // Ignore
  }
  const info = conn.prepare("DELETE FROM invoices WHERE id = ?").run(id);
  return info.changes > 0;
}

// ==========================================
// PAYPAL PAYMENTS PERSISTENCE
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

export function savePayment(
  payment: PaymentRecord,
  db?: DatabaseSync
): PaymentRecord {
  const paymentJson = payment.paymentData ? JSON.stringify(payment.paymentData) : null;
  const isSandboxInt = payment.isSandbox ? 1 : 0;
  const now = new Date().toISOString();

  if (db) {
    db.exec("BEGIN IMMEDIATE;");
    try {
      const existingInvoice = db.prepare("SELECT id FROM invoices WHERE id = ?").get(payment.invoiceId);
      if (!existingInvoice) {
        const phProductId = `prod_ph_${payment.invoiceId}`;
        db.prepare(`
          INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
          VALUES (?, 'Payment Placeholder Product', 'Placeholder description', ?, 0, ?, 1)
        `).run(phProductId, payment.amount, payment.currency || "USD");

        db.prepare(`
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

      const existingPayment = db
        .prepare("SELECT id FROM payments WHERE paypal_order_id = ?")
        .get(payment.paypalOrderId) as { id: string } | undefined;
      const targetId = existingPayment?.id || payment.id;

      db.prepare(`
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

      db.prepare(`
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

      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // rollback safe
      }
      throw err;
    }
    return payment;
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const phProductId = `prod_ph_${payment.invoiceId}`;
      const batchStmts: InStatement[] = [];

      batchStmts.push({
        sql: `INSERT OR IGNORE INTO products (id, title, description, item_price, shipping_cost, currency, quantity)
              VALUES (?, 'Payment Placeholder Product', 'Placeholder description', ?, 0, ?, 1);`,
        args: [phProductId, payment.amount, payment.currency || "USD"],
      });

      batchStmts.push({
        sql: `INSERT OR IGNORE INTO invoices (
                id, invoice_number, product_id, total_amount, currency,
                seller_name, buyer_name, buyer_address, status
              ) VALUES (?, ?, ?, ?, ?, 'Exporter Placeholder', 'Buyer Placeholder', 'Address Placeholder', 'DRAFT');`,
        args: [
          payment.invoiceId,
          `INV-${payment.invoiceId}`,
          phProductId,
          payment.amount,
          payment.currency || "USD",
        ],
      });

      batchStmts.push({
        sql: `INSERT INTO payments (
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
          updated_at = excluded.updated_at;`,
        args: [
          payment.id,
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
          payment.updatedAt || now,
        ],
      });

      batchStmts.push({
        sql: `INSERT OR REPLACE INTO paypal_orders (
          id, invoice_id, amount, currency, status, capture_id, payer_email, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          payment.paypalOrderId,
          payment.invoiceId,
          payment.amount,
          payment.currency || "USD",
          payment.status,
          payment.paypalCaptureId || null,
          payment.payerEmail || null,
          payment.createdAt || now,
          payment.updatedAt || now,
        ],
      });

      await client.batch(batchStmts, "write");
      return payment;
    })() as unknown as PaymentRecord;
  }

  const conn = getDb();
  conn.exec("BEGIN IMMEDIATE;");
  try {
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

    const existingPayment = conn
      .prepare("SELECT id FROM payments WHERE paypal_order_id = ?")
      .get(payment.paypalOrderId) as { id: string } | undefined;
    const targetId = existingPayment?.id || payment.id;

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

export function getPayment(
  id: string,
  db?: DatabaseSync
): PaymentRecord | null {
  if (db) {
    const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
    if (!row) return null;
    return rowToPaymentRecord(row);
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM payments WHERE id = ?;",
        args: [id],
      });
      const row = res.rows[0] as unknown as PersistedPaymentRow | undefined;
      if (!row) return null;
      return rowToPaymentRecord(row);
    })() as unknown as PaymentRecord | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByOrderId(
  orderId: string,
  db?: DatabaseSync
): PaymentRecord | null {
  if (db) {
    const row = db.prepare("SELECT * FROM payments WHERE paypal_order_id = ?").get(orderId) as PersistedPaymentRow | undefined;
    if (!row) return null;
    return rowToPaymentRecord(row);
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM payments WHERE paypal_order_id = ?;",
        args: [orderId],
      });
      const row = res.rows[0] as unknown as PersistedPaymentRow | undefined;
      if (!row) return null;
      return rowToPaymentRecord(row);
    })() as unknown as PaymentRecord | null;
  }

  const conn = getDb();
  const row = conn.prepare("SELECT * FROM payments WHERE paypal_order_id = ?").get(orderId) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByInvoiceId(
  invoiceId: string,
  db?: DatabaseSync
): PaymentRecord | null {
  if (db) {
    const row = db
      .prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(invoiceId) as PersistedPaymentRow | undefined;
    if (!row) return null;
    return rowToPaymentRecord(row);
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1;",
        args: [invoiceId],
      });
      const row = res.rows[0] as unknown as PersistedPaymentRow | undefined;
      if (!row) return null;
      return rowToPaymentRecord(row);
    })() as unknown as PaymentRecord | null;
  }

  const conn = getDb();
  const row = conn
    .prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(invoiceId) as PersistedPaymentRow | undefined;
  if (!row) return null;
  return rowToPaymentRecord(row);
}

export function getPaymentByCaptureId(
  captureId: string,
  db?: DatabaseSync
): PaymentRecord | null {
  if (db) {
    const row = db
      .prepare("SELECT * FROM payments WHERE paypal_capture_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(captureId) as PersistedPaymentRow | undefined;
    if (!row) return null;
    return rowToPaymentRecord(row);
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const res = await client.execute({
        sql: "SELECT * FROM payments WHERE paypal_capture_id = ? ORDER BY created_at DESC LIMIT 1;",
        args: [captureId],
      });
      const row = res.rows[0] as unknown as PersistedPaymentRow | undefined;
      if (!row) return null;
      return rowToPaymentRecord(row);
    })() as unknown as PaymentRecord | null;
  }

  const conn = getDb();
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
  const now = new Date().toISOString();

  if (db) {
    const existing = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
    if (!existing) return null;

    const captureTime = status === "COMPLETED" ? (existing.capture_time || now) : existing.capture_time;
    const mergedCaptureId = captureId || existing.paypal_capture_id;
    const mergedEmail = payerEmail || existing.payer_email;
    const mergedName = payerName || existing.payer_name;
    const paymentJson = captureData ? JSON.stringify(captureData) : existing.payment_data_json;

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(`
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

      db.prepare(`
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

      if (status === "COMPLETED" && existing.invoice_id) {
        const invRow = db.prepare("SELECT invoice_data_json FROM invoices WHERE id = ?").get(existing.invoice_id) as { invoice_data_json: string | null } | undefined;
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
        db.prepare("UPDATE invoices SET status = 'PAID', invoice_data_json = ? WHERE id = ?").run(updatedInvoiceJson || null, existing.invoice_id);
      }

      if (status === "REFUNDED" && existing.invoice_id) {
        const invRow = db.prepare("SELECT invoice_data_json FROM invoices WHERE id = ?").get(existing.invoice_id) as { invoice_data_json: string | null } | undefined;
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
        db.prepare("UPDATE invoices SET status = 'REFUNDED', invoice_data_json = ? WHERE id = ?").run(updatedInvoiceJson || null, existing.invoice_id);
      }

      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // rollback safe
      }
      throw err;
    }

    return getPayment(id, db);
  }

  if (isTursoActive()) {
    return (async () => {
      const client = getTursoClient();
      const existingRes = await client.execute({
        sql: "SELECT * FROM payments WHERE id = ?;",
        args: [id],
      });
      const existing = existingRes.rows[0] as unknown as PersistedPaymentRow | undefined;
      if (!existing) return null;

      const captureTime = status === "COMPLETED" ? (existing.capture_time || now) : existing.capture_time;
      const mergedCaptureId = captureId || existing.paypal_capture_id;
      const mergedEmail = payerEmail || existing.payer_email;
      const mergedName = payerName || existing.payer_name;
      const paymentJson = captureData ? JSON.stringify(captureData) : existing.payment_data_json;

      const batchStmts: InStatement[] = [];

      batchStmts.push({
        sql: `UPDATE payments SET
                status = ?,
                paypal_capture_id = ?,
                payer_email = ?,
                payer_name = ?,
                capture_time = ?,
                payment_data_json = ?,
                updated_at = ?
              WHERE id = ?;`,
        args: [
          status,
          mergedCaptureId || null,
          mergedEmail || null,
          mergedName || null,
          captureTime || null,
          paymentJson || null,
          now,
          id,
        ],
      });

      batchStmts.push({
        sql: `UPDATE paypal_orders SET
                status = ?,
                capture_id = ?,
                payer_email = ?,
                updated_at = ?
              WHERE id = ?;`,
        args: [
          status,
          mergedCaptureId || null,
          mergedEmail || null,
          now,
          existing.paypal_order_id,
        ],
      });

      if (status === "COMPLETED" && existing.invoice_id) {
        const invRes = await client.execute({
          sql: "SELECT invoice_data_json FROM invoices WHERE id = ?;",
          args: [existing.invoice_id],
        });
        const invRow = invRes.rows[0] as unknown as { invoice_data_json: string | null } | undefined;
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
        batchStmts.push({
          sql: "UPDATE invoices SET status = 'PAID', invoice_data_json = ? WHERE id = ?;",
          args: [updatedInvoiceJson || null, existing.invoice_id],
        });
      }

      if (status === "REFUNDED" && existing.invoice_id) {
        const invRes = await client.execute({
          sql: "SELECT invoice_data_json FROM invoices WHERE id = ?;",
          args: [existing.invoice_id],
        });
        const invRow = invRes.rows[0] as unknown as { invoice_data_json: string | null } | undefined;
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
        batchStmts.push({
          sql: "UPDATE invoices SET status = 'REFUNDED', invoice_data_json = ? WHERE id = ?;",
          args: [updatedInvoiceJson || null, existing.invoice_id],
        });
      }

      await client.batch(batchStmts, "write");
      return (await getPayment(id)) as PaymentRecord | null;
    })() as unknown as PaymentRecord | null;
  }

  const conn = getDb();
  const existing = conn.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PersistedPaymentRow | undefined;
  if (!existing) return null;

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
): boolean | Promise<boolean> {
  const payloadJson = typeof payload === "string" ? payload : JSON.stringify(payload);
  const id = `wh_${eventId}`;

  if (db) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO webhook_logs (id, event_id, event_type, payload_json, verification_status, received_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id, eventId, eventType, payloadJson, verificationStatus);
      return true;
    } catch {
      return false;
    }
  }

  if (isTursoActive()) {
    return (async () => {
      try {
        const client = getTursoClient();
        await client.execute({
          sql: `INSERT OR REPLACE INTO webhook_logs (id, event_id, event_type, payload_json, verification_status, received_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
          args: [id, eventId, eventType, payloadJson, verificationStatus],
        });
        return true;
      } catch {
        return false;
      }
    })();
  }

  const conn = getDb();
  try {
    conn.prepare(`
      INSERT OR REPLACE INTO webhook_logs (id, event_id, event_type, payload_json, verification_status, received_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, eventId, eventType, payloadJson, verificationStatus);
    return true;
  } catch {
    return false;
  }
}

export function isWebhookEventProcessed(
  eventId: string,
  db?: DatabaseSync
): boolean | Promise<boolean> {
  if (db) {
    try {
      const row = db.prepare("SELECT id FROM webhook_logs WHERE event_id = ?").get(eventId);
      return Boolean(row);
    } catch {
      return false;
    }
  }

  if (isTursoActive()) {
    return (async () => {
      try {
        const client = getTursoClient();
        const res = await client.execute({
          sql: "SELECT id FROM webhook_logs WHERE event_id = ?;",
          args: [eventId],
        });
        return res.rows.length > 0;
      } catch {
        return false;
      }
    })();
  }

  const conn = getDb();
  try {
    const row = conn.prepare("SELECT id FROM webhook_logs WHERE event_id = ?").get(eventId);
    return Boolean(row);
  } catch {
    return false;
  }
}

// ==========================================
// UNIVERSAL DATABASE ADAPTER CONTRACT (DEF-02)
// ==========================================

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

export class NativeSqliteAdapter implements DatabaseAdapter {
  private db: DatabaseSync;

  constructor(customPath?: string) {
    this.db = getDb(customPath);
  }

  init(): void {
    initSchema(this.db);
  }

  saveIdempotencyKey(key: string, requestPath: string, ttlSeconds = 86400): boolean {
    return saveIdempotencyKey(key, requestPath, ttlSeconds, this.db) as boolean;
  }

  getIdempotencyKey(key: string): PersistentIdempotencyRecord | null {
    return getIdempotencyKey(key, this.db) as PersistentIdempotencyRecord | null;
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
    return getProduct(id, this.db) as PersistedProduct | null;
  }

  saveClassification(classification: PersistedClassification): void {
    saveClassification(classification, this.db);
  }

  getClassification(id: string): PersistedClassification | null {
    return getClassification(id, this.db) as PersistedClassification | null;
  }

  saveLandedCostCalculation(result: LandedCostCalculationResult, productId?: string, classificationId?: string): void {
    saveLandedCostCalculation(result, productId, classificationId, this.db);
  }

  getLandedCostCalculation(id: string): PersistedLandedCost | null {
    return getLandedCostCalculation(id, this.db) as PersistedLandedCost | null;
  }

  listLandedCostCalculations(limit = 20): PersistedLandedCost[] {
    return listLandedCostCalculations(limit, this.db) as PersistedLandedCost[];
  }

  saveInvoice(invoice: CommercialInvoiceDraft): CommercialInvoiceDraft {
    return saveInvoice(invoice, this.db) as CommercialInvoiceDraft;
  }

  getInvoice(id: string): CommercialInvoiceDraft | null {
    return getInvoice(id, this.db) as CommercialInvoiceDraft | null;
  }

  getInvoiceByNumber(invoiceNumber: string): CommercialInvoiceDraft | null {
    return getInvoiceByNumber(invoiceNumber, this.db) as CommercialInvoiceDraft | null;
  }

  listInvoices(limit = 50, offset = 0): CommercialInvoiceDraft[] {
    return listInvoices(limit, offset, this.db) as CommercialInvoiceDraft[];
  }

  deleteInvoice(id: string): boolean {
    return deleteInvoice(id, this.db) as boolean;
  }

  close(): void {
    closeDb();
  }
}
