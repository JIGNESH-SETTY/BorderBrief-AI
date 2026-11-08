import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { SQL_SCHEMA } from "../lib/db/schema.ts";

describe("Sprint 8: Turso Cloud Database Live Suite", () => {
  const isOptedIn = process.env.RUN_LIVE_TURSO_TEST === "true";
  const hasCredentials = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

  it("verifies live Turso cloud connectivity, schema, and atomic batching (opt-in)", async (t) => {
    if (!isOptedIn || !hasCredentials) {
      t.skip(
        "Skipped live Turso test: Set RUN_LIVE_TURSO_TEST=true and configure TURSO_DATABASE_URL/TURSO_AUTH_TOKEN in environment to run live cloud verification."
      );
      return;
    }

    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    // 1. Connectivity test
    const ping = await client.execute("SELECT 1 AS alive;");
    assert.equal(ping.rows[0].alive, 1);

    // 2. Schema tables verification
    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    const existingTables = new Set(tablesRes.rows.map((r) => r.name as string));

    const expectedTables = [
      "products",
      "classifications",
      "landed_cost_calculations",
      "invoices",
      "payments",
      "paypal_orders",
      "webhook_logs",
      "idempotency_keys",
      "tariff_cache",
    ];

    for (const table of expectedTables) {
      assert.ok(existingTables.has(table), `Table ${table} should exist on remote Turso instance`);
    }

    // 3. Atomic Batch CRUD verification
    const testKey = `test_live_key_${Date.now()}`;
    const testPath = "/api/test/turso-live";
    const expiresAt = new Date(Date.now() + 60000).toISOString();

    await client.batch(
      [
        {
          sql: "INSERT OR REPLACE INTO idempotency_keys (key, request_path, status, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?);",
          args: [testKey, testPath, expiresAt],
        },
      ],
      "write"
    );

    const readBack = await client.execute({
      sql: "SELECT key, request_path, status FROM idempotency_keys WHERE key = ?;",
      args: [testKey],
    });

    assert.equal(readBack.rows.length, 1);
    assert.equal(readBack.rows[0].key, testKey);
    assert.equal(readBack.rows[0].request_path, testPath);
    assert.equal(readBack.rows[0].status, "IN_PROGRESS");

    // Cleanup
    await client.execute({
      sql: "DELETE FROM idempotency_keys WHERE key = ?;",
      args: [testKey],
    });

    const verifyClean = await client.execute({
      sql: "SELECT key FROM idempotency_keys WHERE key = ?;",
      args: [testKey],
    });
    assert.equal(verifyClean.rows.length, 0);
  });
});
