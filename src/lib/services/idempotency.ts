/**
 * BorderBrief AI — Hybrid Idempotency Store (Sprint 4)
 *
 * Provides in-memory request deduplication paired with persistent atomic SQLite storage
 * using the `idempotency_keys` table defined in `src/lib/db/schema.ts`.
 *
 * Ensures:
 * 1. Ultra-fast sub-millisecond in-process deduplication.
 * 2. Multi-request persistence and survival across process restarts.
 */

import {
  getIdempotencyKey as getDbIdempotencyKey,
  saveIdempotencyKey as saveDbIdempotencyKey,
  completeIdempotencyKey as completeDbIdempotencyKey,
  failIdempotencyKey as failDbIdempotencyKey,
} from "../db/database.ts";

export interface IdempotencyRecord {
  key: string;
  requestPath: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  responseJson?: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory cache for fast sub-millisecond deduplication during local development
const inMemoryCache = new Map<string, IdempotencyRecord>();
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Checks if an idempotency key exists (in-memory or persistent SQLite) and is still valid.
 */
export function getIdempotencyRecord(key: string): IdempotencyRecord | null {
  if (!key) return null;

  // 1. Check in-memory cache first
  const memoryRecord = inMemoryCache.get(key);
  if (memoryRecord) {
    if (Date.now() > memoryRecord.expiresAt) {
      inMemoryCache.delete(key);
    } else {
      return memoryRecord;
    }
  }

  // 2. Fall back to SQLite persistent storage
  try {
    const dbRecord = getDbIdempotencyKey(key);
    if (dbRecord) {
      const record: IdempotencyRecord = {
        key: dbRecord.key,
        requestPath: dbRecord.request_path,
        status: dbRecord.status,
        responseJson: dbRecord.response_json || undefined,
        createdAt: new Date(dbRecord.created_at).getTime(),
        expiresAt: new Date(dbRecord.expires_at).getTime(),
      };
      inMemoryCache.set(key, record);
      return record;
    }
  } catch {
    // If DB check fails, rely on memory cache
  }

  return null;
}

/**
 * Marks an idempotency key as in-progress across both in-memory and SQLite storage.
 */
export function startIdempotentRequest(key: string, requestPath: string): boolean {
  if (!key) return false;

  const existing = getIdempotencyRecord(key);
  if (existing && (existing.status === "IN_PROGRESS" || existing.status === "COMPLETED")) {
    return false; // Key already taken
  }

  inMemoryCache.set(key, {
    key,
    requestPath,
    status: "IN_PROGRESS",
    createdAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  });

  try {
    saveDbIdempotencyKey(key, requestPath, Math.floor(DEFAULT_TTL_MS / 1000));
  } catch {
    // Graceful fallback to in-memory if DB is unavailable
  }

  return true;
}

/**
 * Stores the completed response for an idempotency key.
 */
export function completeIdempotentRequest(key: string, response: unknown): void {
  if (!key) return;

  const responseJson = JSON.stringify(response);

  const record = inMemoryCache.get(key);
  if (record) {
    record.status = "COMPLETED";
    record.responseJson = responseJson;
  } else {
    inMemoryCache.set(key, {
      key,
      requestPath: "/api/products/analyze",
      status: "COMPLETED",
      responseJson,
      createdAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    });
  }

  try {
    completeDbIdempotencyKey(key, response);
  } catch {
    // In-memory already recorded
  }
}

/**
 * Clears failed request state so user can retry.
 */
export function failIdempotentRequest(key: string): void {
  if (!key) return;
  inMemoryCache.delete(key);

  try {
    failDbIdempotencyKey(key);
  } catch {
    // Ignore
  }
}

/**
 * Resets the in-memory cache (primarily used in test suites).
 */
export function clearIdempotencyCache(): void {
  inMemoryCache.clear();
}
