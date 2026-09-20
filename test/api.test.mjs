import assert from "node:assert/strict";
import { Readable } from "node:stream";
import handler, { LIMITS, resetRateLimitsForTests } from "../api/chat.js";

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    resetRateLimitsForTests();
    await fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}\n  ${error.stack ?? error.message}`);
  }
}

function request({
  method = "POST",
  body = JSON.stringify({ message: "hello" }),
  headers = {},
  remoteAddress = "127.0.0.1",
} = {}) {
  const req = Readable.from(body == null ? [] : [Buffer.from(body)]);
  req.method = method;
  req.headers = {
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
    ...headers,
  };
  req.socket = { remoteAddress };
  return req;
}

function response() {
  const headers = new Map();
  let resolveEnded;
  const ended = new Promise((resolve) => { resolveEnded = resolve; });
  const res = {
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(chunk = "") {
      this.body += chunk == null ? "" : String(chunk);
      resolveEnded();
    },
    headers,
    ended,
  };
  return res;
}

async function invoke(options) {
  const req = request(options);
  const res = response();
  await handler(req, res);
  await res.ended;
  return {
    req,
    res,
    json: res.body ? JSON.parse(res.body) : null,
  };
}

function score(level) {
  const probabilities = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 };
  probabilities[String(level)] = 1;
  return { type: "score", score: level, confidence: 1, probabilities };
}

function successfulTypeSafeResponse(urlOrInit, maybeInit) {
  const init = maybeInit ?? urlOrInit;
  const payload = JSON.parse(init.body);
  const answers = {};
  let fitIndex = 0;
  for (const [id, question] of Object.entries(payload.questions)) {
    if (question.type === "noul") {
      answers[id] = { type: "noul", noul: 0.01 };
    } else {
      answers[id] = score(fitIndex++ === 0 ? 4 : 3);
    }
  }
  return new Response(JSON.stringify({
    answers,
    usage: { input_tokens: 123, output_tokens: 456 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  VERCEL: process.env.VERCEL,
  VERCEL_URL: process.env.VERCEL_URL,
};

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnv)) setEnv(name, value);
  globalThis.fetch = originalFetch;
}

try {
  setEnv("TYPESAFE_API_KEY", "test-key");
  setEnv("ALLOWED_ORIGINS", undefined);
  setEnv("VERCEL", undefined);
  setEnv("VERCEL_URL", undefined);

  await check("OPTIONS returns an uncacheable empty preflight response", async () => {
    const { res, json } = await invoke({
      method: "OPTIONS",
      body: null,
      headers: { origin: "http://localhost:4173" },
    });
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, "");
    assert.equal(json, null);
    assert.equal(res.getHeader("access-control-allow-origin"), "http://localhost:4173");
    assert.equal(res.getHeader("access-control-allow-methods"), "POST, OPTIONS");
    assert.equal(res.getHeader("cache-control"), "no-store");
  });

  await check("non-POST methods are rejected without calling upstream", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ method: "GET", body: null });
    assert.equal(res.statusCode, 405);
    assert.deepEqual(json, { error: "Method not allowed.", code: "method_not_allowed" });
    assert.equal(res.getHeader("cache-control"), "no-store");
    assert.equal(calls, 0);
  });

  await check("non-JSON content is rejected before reading or calling upstream", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ headers: { "content-type": "text/plain" } });
    assert.equal(res.statusCode, 415);
    assert.equal(json.code, "unsupported_media_type");
    assert.equal(calls, 0);
  });

  await check("JSON with a charset parameter remains accepted", async () => {
    globalThis.fetch = successfulTypeSafeResponse;
    const { res } = await invoke({
      headers: { "content-type": "application/json; charset=UTF-8" },
      remoteAddress: "charset-ip",
    });
    assert.equal(res.statusCode, 200);
  });

  await check("a JSON lookalike media type is rejected", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ headers: { "content-type": "application/jsonp" } });
    assert.equal(res.statusCode, 415);
    assert.equal(json.code, "unsupported_media_type");
    assert.equal(calls, 0);
  });

  await check("an unlisted origin is rejected without CORS permission", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ headers: { origin: "https://askjeff.vercel.app.attacker.example" } });
    assert.equal(res.statusCode, 403);
    assert.equal(json.code, "origin_not_allowed");
    assert.equal(res.getHeader("access-control-allow-origin"), undefined);
    assert.equal(res.getHeader("cache-control"), "no-store");
    assert.equal(calls, 0);
  });

  await check("the canonical origin and configured exact origins receive CORS permission", async () => {
    globalThis.fetch = successfulTypeSafeResponse;
    setEnv("ALLOWED_ORIGINS", "https://preview.example, https://other.example");
    for (const origin of ["https://askjeff.vercel.app", "https://preview.example"]) {
      const { res } = await invoke({ headers: { origin }, remoteAddress: `${origin}-ip` });
      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeader("access-control-allow-origin"), origin);
      assert.equal(res.getHeader("vary"), "Origin");
    }
    setEnv("ALLOWED_ORIGINS", undefined);
  });

  await check("malformed JSON gets a stable client error without upstream work", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ body: "{nope" });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(json, { error: "Invalid JSON body.", code: "invalid_json" });
    assert.equal(calls, 0);
  });

  await check("blank messages are rejected without upstream work", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ body: JSON.stringify({ message: "   " }) });
    assert.equal(res.statusCode, 400);
    assert.equal(json.code, "empty_message");
    assert.equal(calls, 0);
  });

  await check("messages over the character limit are rejected rather than truncated", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const message = "x".repeat(LIMITS.messageChars + 1);
    const { res, json } = await invoke({ body: JSON.stringify({ message }) });
    assert.equal(res.statusCode, 413);
    assert.equal(json.code, "message_too_long");
    assert.match(json.error, /500 characters/);
    assert.equal(calls, 0);
  });

  await check("a declared body over the byte limit is rejected before upstream work", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({
      headers: { "content-length": String(LIMITS.bodyBytes + 1) },
    });
    assert.equal(res.statusCode, 413);
    assert.equal(json.code, "payload_too_large");
    assert.equal(calls, 0);
  });

  await check("an actually oversized streamed body is rejected even without Content-Length", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke({ body: "x".repeat(LIMITS.bodyBytes + 1) });
    assert.equal(res.statusCode, 413);
    assert.equal(json.code, "payload_too_large");
    assert.equal(calls, 0);
  });

  await check("a stalled request body receives an uncacheable timeout response", async () => {
    const req = new Readable({ read() {} });
    req.method = "POST";
    req.headers = { "content-type": "application/json" };
    req.socket = { remoteAddress: "stalled-body-ip" };
    const res = response();
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = (callback) => {
      queueMicrotask(callback);
      return Symbol("test-timer");
    };
    globalThis.clearTimeout = () => {};
    try {
      await handler(req, res);
      await res.ended;
      assert.equal(res.statusCode, 408);
      assert.equal(JSON.parse(res.body).code, "request_timeout");
      assert.equal(res.getHeader("cache-control"), "no-store");
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      req.destroy();
    }
  });

  await check("missing server configuration returns a stable uncacheable error", async () => {
    setEnv("TYPESAFE_API_KEY", undefined);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const { res, json } = await invoke();
    assert.equal(res.statusCode, 503);
    assert.deepEqual(json, { error: "Jeff is not configured yet.", code: "not_configured" });
    assert.equal(res.getHeader("cache-control"), "no-store");
    assert.equal(calls, 0);
    setEnv("TYPESAFE_API_KEY", "test-key");
  });

  await check("deterministic crisis safety replies remain available without provider configuration", async () => {
    setEnv("TYPESAFE_API_KEY", undefined);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    try {
      const { res, json } = await invoke({
        body: JSON.stringify({ message: "I want to die" }),
        remoteAddress: "crisis-safety-ip",
      });
      assert.equal(res.statusCode, 200);
      assert.equal(json.mode, "crisis");
      assert.equal(json.serious, true);
      assert.equal(json.safetyNet, true);
      assert.deepEqual(json.alts, []);
      assert.equal(calls, 0);
    } finally {
      setEnv("TYPESAFE_API_KEY", "test-key");
    }
  });

  await check("the committee follow-up is resolved locally with API history", async () => {
    setEnv("TYPESAFE_API_KEY", undefined);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    try {
      const { res, json } = await invoke({
        body: JSON.stringify({
          message: "What committee?",
          history: [{
            user: "All right, so then who are you?",
            jeff: "Jeff. One syllable. I picked it myself. Everything else about me was decided by committee.",
            mode: "normal",
          }],
        }),
        remoteAddress: "committee-followup-ip",
      });
      assert.equal(res.statusCode, 200);
      assert.equal(json.reply, "There is no committee. I was being dramatic. You caught me.");
      assert.equal(json.mode, "normal");
      assert.equal(json.safetyNet, false);
      assert.equal(calls, 0);
    } finally {
      setEnv("TYPESAFE_API_KEY", "test-key");
    }
  });

  await check("short reactions are resolved locally and repeated filler is cooled down", async () => {
    setEnv("TYPESAFE_API_KEY", undefined);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unexpected"); };
    const remoteAddress = "repeat-filler-ip";
    const originalDateNow = Date.now;
    let now = Date.parse("2030-01-02T12:00:00.000Z");
    Date.now = () => now;
    try {
      const first = await invoke({
        body: JSON.stringify({ message: "lol" }),
        remoteAddress,
      });
      assert.equal(first.res.statusCode, 200);
      assert.equal(first.json.reply, "Glad one of us is entertained.");
      assert.deepEqual(first.json.alts, []);

      const second = await invoke({
        body: JSON.stringify({
          message: "lol",
          history: [{ user: "lol", jeff: first.json.reply, mode: "normal" }],
        }),
        remoteAddress,
      });
      assert.equal(second.res.statusCode, 200);
      assert.match(second.json.reply, /credits/i);
      assert.deepEqual(second.json.alts, []);

      const third = await invoke({
        body: JSON.stringify({ message: "lol" }),
        remoteAddress,
      });
      assert.equal(third.res.statusCode, 429);
      assert.equal(third.json.code, "repeat_spam");
      assert.equal(Number(third.res.getHeader("retry-after")), third.json.retryAfter);
      assert.ok(third.json.retryAfter >= 1 && third.json.retryAfter <= 60);

      now += 60_001;
      const afterCooldown = await invoke({
        body: JSON.stringify({ message: "lol" }),
        remoteAddress,
      });
      assert.equal(afterCooldown.res.statusCode, 200);
      assert.equal(afterCooldown.json.reply, "Glad one of us is entertained.");

      const coldInvocation = await invoke({
        body: JSON.stringify({
          message: "bruh",
          history: [
            { user: "bruh", jeff: "Bruh received.", mode: "normal", at: now - 2_000 },
            { user: "bruh", jeff: "Still bruh.", mode: "normal", at: now - 1_000 },
          ],
        }),
        remoteAddress: "cold-repeat-ip",
      });
      assert.equal(coldInvocation.res.statusCode, 429);
      assert.equal(coldInvocation.json.code, "repeat_spam");
      assert.equal(calls, 0);
    } finally {
      Date.now = originalDateNow;
      setEnv("TYPESAFE_API_KEY", "test-key");
    }
  });

  await check("successful replies expose fit-based alternatives but not provider token usage", async () => {
    let upstreamPayload;
    globalThis.fetch = async (_url, init) => {
      upstreamPayload = JSON.parse(init.body);
      return successfulTypeSafeResponse(init);
    };
    const history = Array.from({ length: LIMITS.historyTurns + 2 }, (_, index) => ({
      user: `user-${index}`,
      jeff: `jeff-${index}`,
      mode: "normal",
    }));
    const { res, json } = await invoke({ body: JSON.stringify({ message: "hello", history }) });
    assert.equal(res.statusCode, 200);
    assert.equal(typeof json.reply, "string");
    assert.equal(json.mode, "normal");
    assert.equal("tokens" in json, false);
    assert.ok(json.alts.length > 0);
    assert.equal(typeof json.alts[0].fit, "number");
    assert.equal("p" in json.alts[0], false);
    assert.equal(upstreamPayload.state.prior_turns.length, LIMITS.historyTurns);
    assert.equal(upstreamPayload.state.prior_turns[0].user_message, "user-2");
    assert.equal(res.getHeader("cache-control"), "no-store");
  });

  await check("raw X-Forwarded-For cannot evade local rate limiting", async () => {
    setEnv("VERCEL", undefined);
    globalThis.fetch = successfulTypeSafeResponse;
    for (let index = 0; index < 10; index++) {
      const { res } = await invoke({
        headers: { "x-forwarded-for": `198.51.100.${index}` },
        remoteAddress: "203.0.113.8",
      });
      assert.equal(res.statusCode, 200);
    }
    const { res, json } = await invoke({
      headers: { "x-forwarded-for": "198.51.100.250" },
      remoteAddress: "203.0.113.8",
    });
    assert.equal(res.statusCode, 429);
    assert.equal(json.code, "rate_limited");
    assert.equal(Number(res.getHeader("retry-after")), json.retryAfter);
    assert.ok(json.retryAfter >= 1 && json.retryAfter <= 60);
    assert.equal(res.getHeader("cache-control"), "no-store");
  });

  await check("the daily limit applies even when requests are spaced beyond the minute window", async () => {
    const originalDateNow = Date.now;
    let now = Date.parse("2030-01-02T12:00:00.000Z");
    Date.now = () => now;
    globalThis.fetch = successfulTypeSafeResponse;
    try {
      for (let batch = 0; batch < 6; batch++) {
        for (let index = 0; index < 10; index++) {
          const { res } = await invoke({ remoteAddress: "daily-limit-ip" });
          assert.equal(res.statusCode, 200);
        }
        now += 60_001;
      }
      const { res, json } = await invoke({ remoteAddress: "daily-limit-ip" });
      assert.equal(res.statusCode, 429);
      assert.equal(json.code, "rate_limited");
      assert.ok(json.retryAfter > 60);
      assert.equal(Number(res.getHeader("retry-after")), json.retryAfter);
    } finally {
      Date.now = originalDateNow;
    }
  });

  await check("upstream rate limiting is translated without exposing its response body", async () => {
    globalThis.fetch = async () => new Response("provider secret diagnostics", {
      status: 429,
      headers: { "x-request-id": "request-123" },
    });
    const logged = [];
    const originalConsoleError = console.error;
    console.error = (...args) => logged.push(args.join(" "));
    try {
      const { res, json } = await invoke({ remoteAddress: "upstream-rate-ip" });
      assert.equal(res.statusCode, 503);
      assert.deepEqual(json, {
        error: "Jeff is busy. Try again shortly.",
        code: "upstream_rate_limited",
        retryAfter: 30,
      });
      assert.equal(res.getHeader("retry-after"), "30");
      assert.doesNotMatch(JSON.stringify(json), /provider secret diagnostics/);
      assert.doesNotMatch(logged.join("\n"), /provider secret diagnostics/);
      assert.match(logged.join("\n"), /status=429/);
    } finally {
      console.error = originalConsoleError;
    }
  });

  await check("an upstream abort becomes a stable timeout error", async () => {
    globalThis.fetch = async () => {
      const error = new Error("private timeout detail");
      error.name = "AbortError";
      throw error;
    };
    const { res, json } = await invoke({ remoteAddress: "timeout-ip" });
    assert.equal(res.statusCode, 504);
    assert.deepEqual(json, {
      error: "Jeff took too long to answer. Try again.",
      code: "upstream_timeout",
    });
    assert.doesNotMatch(JSON.stringify(json), /private timeout detail/);
  });

  await check("an oversized upstream response is rejected without reflecting its body", async () => {
    const marker = "private-provider-body";
    globalThis.fetch = async () => new Response(
      marker + "x".repeat(LIMITS.upstreamResponseBytes + 1),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    const { res, json } = await invoke({ remoteAddress: "oversized-upstream-ip" });
    assert.equal(res.statusCode, 502);
    assert.equal(json.code, "upstream_unreachable");
    assert.doesNotMatch(JSON.stringify(json), new RegExp(marker));
  });

  await check("malformed upstream data fails closed with a generic response", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ answers: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const logged = [];
    const originalConsoleError = console.error;
    console.error = (...args) => logged.push(args.join(" "));
    try {
      const { res, json } = await invoke({ remoteAddress: "malformed-upstream-ip" });
      assert.equal(res.statusCode, 502);
      assert.deepEqual(json, {
        error: "Jeff could not answer right now.",
        code: "engine_failure",
      });
      assert.doesNotMatch(JSON.stringify(json), /Unexpected TypeSafe response shape/);
      assert.match(logged.join("\n"), /Unexpected TypeSafe response shape/);
    } finally {
      console.error = originalConsoleError;
    }
  });
} finally {
  restoreEnvironment();
  resetRateLimitsForTests();
}

console.log(`api tests: ${passed} passed`);
if (failed) process.exitCode = 1;
