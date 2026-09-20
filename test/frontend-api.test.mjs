import assert from "node:assert/strict";
import { askJeff, JeffApiError, userMessageForError } from "../src/api.js";

const originalFetch = globalThis.fetch;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

await test("sends only four history turns and preserves reply modes", async () => {
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ reply: "Fine.", mode: "normal" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const history = Array.from({ length: 6 }, (_, index) => ({
    user: `u${index}`,
    jeff: `j${index}`,
    mode: index === 5 ? "crisis" : "normal",
  }));
  await askJeff("hello", history);
  assert.equal(body.history.length, 4);
  assert.deepEqual(body.history.at(-1), { user: "u5", jeff: "j5", mode: "crisis" });
});

await test("surfaces rate-limit status and Retry-After", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "Too many requests.",
    code: "rate_limited",
  }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "12" },
  });
  await assert.rejects(
    askJeff("hello", []),
    (error) => error instanceof JeffApiError
      && error.status === 429
      && error.code === "rate_limited"
      && error.retryAfter === 12,
  );
});

await test("rejects a malformed successful response", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ mode: "normal" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(
    askJeff("hello", []),
    (error) => error instanceof JeffApiError && error.code === "invalid_response",
  );
});

await test("returns a useful offline error", async () => {
  const priorNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  assert.equal(userMessageForError(new TypeError("fetch failed")), "You appear to be offline. Reconnect and try again.");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: priorNavigator });
});

globalThis.fetch = originalFetch;
console.log("frontend API: 4 passed");
