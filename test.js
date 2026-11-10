// test.js
// Prove that a token can be consumed at most once under concurrency.

import assert from "node:assert/strict";
import { issueToken, consumeToken, closeRedis } from "./token-service.js";

async function main() {
  try {
    const id = await issueToken({ userId: 42 }, 60);
    console.log("issued token:", id);

    // All five requests are started together. Redis GETDEL makes the consume
    // operation atomic, so exactly one request can receive the stored value.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => consumeToken(id))
    );

    const winners = results.filter((result) => result.ok).length;
    console.log("winners:", winners);
    assert.equal(winners, 1, "A token must be consumed exactly once");

    const winner = results.find((result) => result.ok);
    assert.deepEqual(winner.payload, { userId: 42 });
    console.log("PASS: token was single-use.");
  } finally {
    await closeRedis();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
