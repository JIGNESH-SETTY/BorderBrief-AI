/**
 * BorderBrief AI — SQLite Database Persistence Test Suite (Sprint 4)
 * Tests schema initialization, idempotency lifecycle, and landed-cost persistence.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  initSchema,
  saveIdempotencyKey,
  getIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  saveProduct,
  getProduct,
  saveClassification,
  getClassification,
  saveLandedCostCalculation,
  getLandedCostCalculation,
  listLandedCostCalculations,
  getDb,
  closeDb,
  DatabaseConfigurationError,
  NativeSqliteAdapter,
} from "../lib/db/database.ts";
import { calculateLandedCost } from "../lib/tariff/landed-cost-engine.ts";
import type { LandedCostCalculationRequest } from "../types/export.ts";

describe("SQLite Database Layer (Sprint 4)", () => {
  it("initializes all 8 schema tables in an in-memory database", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    const tables = memDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    assert.ok(tableNames.includes("idempotency_keys"));
    assert.ok(tableNames.includes("products"));
    assert.ok(tableNames.includes("classifications"));
    assert.ok(tableNames.includes("tariff_cache"));
    assert.ok(tableNames.includes("landed_cost_calculations"));
    assert.ok(tableNames.includes("invoices"));
    assert.ok(tableNames.includes("paypal_orders"));
    assert.ok(tableNames.includes("webhook_logs"));
    memDb.close();
  });

  it("manages the persistent idempotency lifecycle", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    const key = "test-idem-key-123";
    const path = "/api/tariffs/calculate";

    // 1. Save IN_PROGRESS
    const saved = saveIdempotencyKey(key, path, 3600, memDb);
    assert.equal(saved, true);

    // 2. Reject duplicate
    const dup = saveIdempotencyKey(key, path, 3600, memDb);
    assert.equal(dup, false);

    // 3. Fetch record
    const record = getIdempotencyKey(key, memDb);
    assert.ok(record);
    assert.equal(record?.status, "IN_PROGRESS");
    assert.equal(record?.request_path, path);

    // 4. Complete
    const dummyPayload = { calculationId: "calc_test", totalLandedCostUSD: 125.5 };
    completeIdempotencyKey(key, dummyPayload, memDb);

    const updated = getIdempotencyKey(key, memDb);
    assert.equal(updated?.status, "COMPLETED");
    assert.equal(JSON.parse(updated?.response_json || "{}").totalLandedCostUSD, 125.5);

    // 5. Fail / cleanup
    failIdempotencyKey(key, memDb);
    const deleted = getIdempotencyKey(key, memDb);
    assert.equal(deleted, null);

    memDb.close();
  });

  it("persists product drafts and classifications", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    // Save product
    saveProduct(
      {
        id: "prod_cotton_tote",
        title: "Handcrafted Cotton Canvas Tote Bag",
        description: "100% natural cotton canvas tote",
        item_price: 25.0,
        shipping_cost: 10.0,
        currency: "USD",
        quantity: 2,
      },
      memDb
    );

    const prod = getProduct("prod_cotton_tote", memDb);
    assert.ok(prod);
    assert.equal(prod?.title, "Handcrafted Cotton Canvas Tote Bag");
    assert.equal(prod?.item_price, 25.0);

    // Save classification
    saveClassification(
      {
        id: "class_tote_001",
        product_id: "prod_cotton_tote",
        suggested_hs6: "4202.92",
        suggested_hts10: "4202.92.15.00",
        hts_description: "Cotton tote bags",
        general_duty_rate: 6.3,
        confidence_level: "HIGH",
        reasoning_text: "USITC 2026 Rev 22",
        is_confirmed_by_user: 1,
      },
      memDb
    );

    const classRec = getClassification("class_tote_001", memDb);
    assert.ok(classRec);
    assert.equal(classRec?.suggested_hts10, "4202.92.15.00");
    assert.equal(classRec?.general_duty_rate, 6.3);

    memDb.close();
  });

  it("persists landed cost calculations and auto-links parent product", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 230.0, // 200 + 30
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const result = calculateLandedCost(req);

    // Persist result
    saveLandedCostCalculation(result, "prod_calc_test_01", undefined, memDb);

    // Retrieve by ID
    const saved = getLandedCostCalculation(result.calculationId, memDb);
    assert.ok(saved);
    assert.equal(saved?.dutiable_value, 200.0);
    assert.equal(saved?.shipping_amount, 30.0);
    assert.equal(saved?.total_landed_cost, result.totalLandedCostUSD);

    // List records
    const list = listLandedCostCalculations(10, memDb);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, result.calculationId);

    memDb.close();
  });

  it("DEF-03: enforces atomic transaction rollback when write fails, preventing orphan records", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    // Drop the calculations table so that saveLandedCostCalculation fails AFTER saving the product
    memDb.exec("DROP TABLE landed_cost_calculations");

    const req: LandedCostCalculationRequest = {
      productTitle: "Test Orphan Prevention Product",
      hts10: "4202.92.15.00",
      quantity: 1,
      unitPriceUSD: 50.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 50.0,
        internationalShippingDeductionUSD: 0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const result = calculateLandedCost(req);
    const orphanCheckId = "prod_orphan_check_999";

    // Attempting to save should throw an error because landed_cost_calculations table was dropped
    assert.throws(
      () => saveLandedCostCalculation(result, orphanCheckId, undefined, memDb),
      (err: Error) => {
        assert.ok(err.message.includes("no such table: landed_cost_calculations"));
        return true;
      }
    );

    // Verify that due to ROLLBACK, the product was NOT committed (no orphan product)
    const productAfterRollback = getProduct(orphanCheckId, memDb);
    assert.equal(productAfterRollback, null, "Orphan product must NOT exist after transaction rollback");

    memDb.close();
  });

  it("DEF-03: idempotently updates calculation on conflict without duplicating records", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    const req: LandedCostCalculationRequest = {
      productTitle: "Handcrafted Cotton Canvas Tote Bag",
      hts10: "4202.92.15.00",
      quantity: 10,
      unitPriceUSD: 20.0,
      originCountry: "IN",
      destinationCountry: "US",
      transportationMode: "AIR_CARGO",
      valuation: {
        grossInvoicePriceUSD: 230.0,
        internationalShippingDeductionUSD: 30.0,
        isShippingDocumented: true,
        areRelatedParties: false,
        hasAssistsOrRoyalties: false,
        valuationBasis: "TRANSACTION_VALUE",
        valuationStatus: "TRANSACTION_VALUE_DOCUMENTED",
      },
    };

    const result = calculateLandedCost(req);

    // Save initial
    saveLandedCostCalculation(result, "prod_idem_test", undefined, memDb);
    const firstSave = getLandedCostCalculation(result.calculationId, memDb);
    assert.ok(firstSave);

    // Re-save same calculation (simulating webhook / duplicate idempotent request)
    assert.doesNotThrow(() => {
      saveLandedCostCalculation(result, "prod_idem_test", undefined, memDb);
    });

    const list = listLandedCostCalculations(10, memDb);
    assert.equal(list.length, 1, "Must maintain exactly 1 calculation record (no duplicate)");

    memDb.close();
  });

  it("DEF-02: throws DatabaseConfigurationError in production when external DB is unconfigured", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalTurso = process.env.TURSO_DATABASE_URL;
    const originalOverride = process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD;
    const originalVolume = process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH;
    const originalVercel = process.env.VERCEL;

    try {
      closeDb();
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.TURSO_DATABASE_URL;
      delete process.env.DATABASE_URL;
      delete process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD;
      delete process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH;
      delete process.env.VERCEL;

      // 1. Standard production without external DB throws
      assert.throws(
        () => getDb(),
        (err: Error) => {
          assert.ok(err instanceof DatabaseConfigurationError);
          assert.equal(err.code, "DATABASE_CONFIGURATION_ERROR");
          assert.ok(err.message.includes("Serverless production requires an external database"));
          return true;
        }
      );

      // 2. An environment variable alone (BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD) is NOT sufficient without volume path
      process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD = "true";
      assert.throws(
        () => getDb(),
        (err: Error) => {
          assert.ok(err instanceof DatabaseConfigurationError);
          assert.equal(err.code, "DATABASE_CONFIGURATION_ERROR");
          assert.ok(err.message.includes("BORDERBRIEF_PERSISTENT_VOLUME_PATH"));
          return true;
        }
      );

      // 3. Explicit container volume mount path permits local SQLite in non-serverless container
      process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH = ":memory:";
      const dbWithVolume = getDb();
      assert.ok(dbWithVolume);
      closeDb();

      // 4. Serverless platform (VERCEL) strictly rejects local SQLite even with volume flags
      process.env.VERCEL = "1";
      assert.throws(
        () => getDb(),
        (err: Error) => {
          assert.ok(err instanceof DatabaseConfigurationError);
          assert.equal(err.code, "DATABASE_CONFIGURATION_ERROR");
          assert.ok(err.message.includes("Stateless serverless production"));
          return true;
        }
      );
      delete process.env.VERCEL;

      // 5. Explicit customPath (e.g. for unit test isolations) bypasses production guardrail
      const dbWithCustom = getDb("borderbrief-override.db");
      assert.ok(dbWithCustom);
      closeDb();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      if (originalTurso) process.env.TURSO_DATABASE_URL = originalTurso;
      if (originalOverride) {
        process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD = originalOverride;
      } else {
        delete process.env.BORDERBRIEF_ALLOW_LOCAL_SQLITE_IN_PROD;
      }
      if (originalVolume) {
        process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH = originalVolume;
      } else {
        delete process.env.BORDERBRIEF_PERSISTENT_VOLUME_PATH;
      }
      if (originalVercel) {
        process.env.VERCEL = originalVercel;
      } else {
        delete process.env.VERCEL;
      }
      closeDb();
    }
  });

  it("DEF-02: NativeSqliteAdapter implements DatabaseAdapter interface correctly", () => {
    const memDb = new DatabaseSync(":memory:");
    initSchema(memDb);

    const adapter = new NativeSqliteAdapter(":memory:");
    adapter.init();

    adapter.saveProduct({
      id: "prod_adapter_test",
      title: "Adapter Test Product",
      item_price: 99.0,
      shipping_cost: 15.0,
    });

    const retrieved = adapter.getProduct("prod_adapter_test");
    assert.ok(retrieved);
    assert.equal(retrieved?.title, "Adapter Test Product");
    assert.equal(retrieved?.item_price, 99.0);

    adapter.close();
    memDb.close();
  });
});
