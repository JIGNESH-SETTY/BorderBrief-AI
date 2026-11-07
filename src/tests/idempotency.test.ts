import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  startIdempotentRequest,
  completeIdempotentRequest,
  getIdempotencyRecord,
  failIdempotentRequest,
} from "../lib/services/idempotency.ts";

describe("Serverless-Safe Idempotency Store", () => {
  it("tracks in-progress and completed requests", () => {
    const key = `test-key-${Date.now()}`;
    const started = startIdempotentRequest(key, "/api/products/analyze");
    assert.equal(started, true);

    const record = getIdempotencyRecord(key);
    assert.ok(record);
    assert.equal(record?.status, "IN_PROGRESS");

    // Completing request
    const dummyResponse = { success: true, timestamp: Date.now() };
    completeIdempotentRequest(key, dummyResponse);

    const updated = getIdempotencyRecord(key);
    assert.equal(updated?.status, "COMPLETED");
    assert.equal(JSON.parse(updated?.responseJson || "{}").success, true);
  });

  it("prevents starting duplicate requests with the same active key", () => {
    const key = `duplicate-key-${Date.now()}`;
    const first = startIdempotentRequest(key, "/api/products/analyze");
    assert.equal(first, true);

    const second = startIdempotentRequest(key, "/api/products/analyze");
    assert.equal(second, false);
  });

  it("cleans up failed requests to allow user retry", () => {
    const key = `failed-key-${Date.now()}`;
    startIdempotentRequest(key, "/api/products/analyze");
    failIdempotentRequest(key);

    const record = getIdempotencyRecord(key);
    assert.equal(record, null);
  });
});

