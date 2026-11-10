// token-service.js
// A single-use, expiring token service backed by Redis.

import crypto from "node:crypto";
import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL);

const keyFor = (id) => "token:" + id;

/**
 * Issue a single-use token that expires after ttlSeconds.
 * The random identifier is 128 bits and Redis SET stores the payload and
 * expiration atomically.
 */
export async function issueToken(payload, ttlSeconds) {
  if (payload === undefined) {
    throw new TypeError("payload is required");
  }
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new TypeError("ttlSeconds must be a positive integer");
  }

  const id = crypto.randomBytes(16).toString("hex");
  const value = JSON.stringify(payload);
  if (value === undefined) {
    throw new TypeError("payload must be JSON-serialisable");
  }

  const stored = await redis.set(keyFor(id), value, "EX", ttlSeconds, "NX");
  if (stored !== "OK") {
    throw new Error("Could not issue token");
  }

  return id;
}

/**
 * Consume a token exactly once using Redis GETDEL (one atomic operation).
 */
export async function consumeToken(tokenId) {
  if (typeof tokenId !== "string" || tokenId.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const value = await redis.getdel(keyFor(tokenId));
  if (value === null) {
    return { ok: false, reason: "invalid" };
  }

  try {
    return { ok: true, payload: JSON.parse(value) };
  } catch (err) {
    // The key has already been consumed; malformed stored data is not reusable.
    return { ok: false, reason: "invalid" };
  }
}

// Allow other files to close the connection cleanly (used by test.js).
export function closeRedis() {
  return redis.quit();
}
