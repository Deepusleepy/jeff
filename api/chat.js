// Vercel serverless function (Node runtime): POST /api/chat

import {
  lowEffortReaction,
  runEngineTurn,
  runnerUps,
} from "../lib/engine.js";
import { MODEL } from "../lib/questions.js";

export const LIMITS = Object.freeze({
  messageChars: 500,
  bodyBytes: 4_000,
  historyTurns: 4,
  historyFieldChars: 250,
  bodyTimeoutMs: 5_000,
  upstreamTimeoutMs: 12_000,
  upstreamResponseBytes: 1_000_000,
});

const RATE = Object.freeze({ minuteMs: 60_000, minuteMax: 10, dayMax: 60 });
const REPEAT_RATE = Object.freeze({ windowMs: 60_000, max: 2 });
const hits = new Map();
const repeatHits = new Map();

class PublicError extends Error {
  constructor(status, publicMessage, { code, retryAfter } = {}) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function resetRateLimitsForTests() {
  hits.clear();
  repeatHits.clear();
}

function recentHistoryRepeatCount(message, history, now) {
  const reaction = lowEffortReaction(message);
  if (!reaction) return 0;
  let count = 1;
  for (let index = history.length - 1; index >= 0; index--) {
    const turn = history[index];
    const age = now - turn.at;
    if (
      lowEffortReaction(turn.user)?.key !== reaction.key
      || !Number.isFinite(turn.at)
      || age < 0
      || age >= REPEAT_RATE.windowMs
    ) {
      break;
    }
    count++;
  }
  return count;
}

function repeatRateLimit(ip, message, history) {
  const reaction = lowEffortReaction(message);
  if (!reaction) {
    repeatHits.delete(ip);
    return { limited: false, count: 0 };
  }

  const now = Date.now();
  const previous = repeatHits.get(ip);
  const sameWindow = previous
    && previous.key === reaction.key
    && now - previous.startedAt < REPEAT_RATE.windowMs;
  const count = Math.max(
    sameWindow ? previous.count + 1 : 1,
    recentHistoryRepeatCount(message, history, now),
  );
  const entry = {
    key: reaction.key,
    count,
    startedAt: sameWindow ? previous.startedAt : now,
    lastSeen: now,
  };
  repeatHits.set(ip, entry);

  if (repeatHits.size > 5_000) {
    const oldest = [...repeatHits.entries()]
      .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)
      .slice(0, repeatHits.size - 4_000);
    for (const [key] of oldest) repeatHits.delete(key);
  }

  if (count > REPEAT_RATE.max) {
    const retryAfter = Math.max(
      1,
      Math.ceil((REPEAT_RATE.windowMs - (now - entry.startedAt)) / 1_000),
    );
    return { limited: true, count, retryAfter };
  }
  return { limited: false, count };
}

function rateLimit(ip) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  let entry = hits.get(ip);
  if (!entry) {
    entry = { timestamps: [], count: 0, day, lastSeen: now };
    hits.set(ip, entry);
  }

  if (entry.day !== day) {
    entry.day = day;
    entry.count = 0;
  }
  entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < RATE.minuteMs);
  entry.lastSeen = now;

  if (entry.timestamps.length >= RATE.minuteMax) {
    const retryAfter = Math.max(1, Math.ceil((RATE.minuteMs - (now - entry.timestamps[0])) / 1_000));
    return { limited: true, retryAfter };
  }
  if (entry.count >= RATE.dayMax) {
    const tomorrow = new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000;
    return { limited: true, retryAfter: Math.max(1, Math.ceil((tomorrow - now) / 1_000)) };
  }

  entry.timestamps.push(now);
  entry.count += 1;

  if (hits.size > 5_000) {
    const oldest = [...hits.entries()]
      .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)
      .slice(0, hits.size - 4_000);
    for (const [key] of oldest) hits.delete(key);
  }
  return { limited: false };
}

function configuredOrigins() {
  const origins = new Set(["https://askjeff.vercel.app"]);
  for (const origin of String(process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const value = origin.trim();
    if (value) origins.add(value);
  }
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  return origins;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return configuredOrigins().has(origin);
}

function corsHeaders(origin) {
  if (!origin || !isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function clientIp(req) {
  if (process.env.VERCEL) {
    const forwarded = req.headers["x-vercel-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
    const real = req.headers["x-real-ip"];
    if (typeof real === "string" && real.trim()) return real.trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

async function readBody(req) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > LIMITS.bodyBytes) {
    throw new PublicError(413, "Message payload is too large.", { code: "payload_too_large" });
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    let size = 0;
    const chunks = [];
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new PublicError(408, "Request body timed out.", { code: "request_timeout" }));
    }, LIMITS.bodyTimeoutMs);

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > LIMITS.bodyBytes) {
        finish(reject, new PublicError(413, "Message payload is too large.", { code: "payload_too_large" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish(resolve, Buffer.concat(chunks).toString("utf8")));
    req.on("error", (error) => finish(reject, error));
  });
}

function parseInput(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new PublicError(400, "Invalid JSON body.", { code: "invalid_json" });
  }

  const message = typeof body?.message === "string" ? body.message : "";
  if (!message.trim()) throw new PublicError(400, "Enter a message first.", { code: "empty_message" });
  if ([...message].length > LIMITS.messageChars) {
    throw new PublicError(413, `Messages can be at most ${LIMITS.messageChars} characters.`, {
      code: "message_too_long",
    });
  }

  const history = Array.isArray(body?.history)
    ? body.history
        .slice(-LIMITS.historyTurns)
        .map((item) => ({
          user: String(item?.user ?? "").slice(0, LIMITS.historyFieldChars),
          jeff: String(item?.jeff ?? "").slice(0, LIMITS.historyFieldChars),
          ...(typeof item?.mode === "string" ? { mode: item.mode.slice(0, 40) } : {}),
          ...(Number.isFinite(item?.at) ? { at: item.at } : {}),
        }))
        .filter((item) => item.user && item.jeff)
    : [];

  return { message: message.trim(), history };
}

async function readBoundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMITS.upstreamResponseBytes) {
      await reader.cancel();
      throw new Error("TypeSafe response exceeded the size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function callTypeSafe(apiKey, state, questions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIMITS.upstreamTimeoutMs);
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id") || "unavailable";
      console.error(`TypeSafe request failed: status=${response.status} requestId=${requestId}`);
      if (response.status === 429) {
        throw new PublicError(503, "Jeff is busy. Try again shortly.", {
          code: "upstream_rate_limited",
          retryAfter: 30,
        });
      }
      throw new PublicError(502, "Jeff could not answer right now.", { code: "upstream_error" });
    }
    return await readBoundedJson(response);
  } catch (error) {
    if (error instanceof PublicError) throw error;
    if (error?.name === "AbortError") {
      throw new PublicError(504, "Jeff took too long to answer. Try again.", { code: "upstream_timeout" });
    }
    throw new PublicError(502, "Jeff could not answer right now.", { code: "upstream_unreachable" });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const cors = corsHeaders(origin);
  const send = (payload, status, extraHeaders = {}) => {
    res.statusCode = status;
    for (const [name, value] of Object.entries({ ...cors, ...extraHeaders })) res.setHeader(name, value);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  };

  try {
    if (origin && !isAllowedOrigin(origin)) {
      throw new PublicError(403, "Origin not allowed.", { code: "origin_not_allowed" });
    }
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      for (const [name, value] of Object.entries(cors)) res.setHeader(name, value);
      res.setHeader("Cache-Control", "no-store");
      return res.end();
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      throw new PublicError(405, "Method not allowed.", { code: "method_not_allowed" });
    }

    const contentType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw new PublicError(415, "Content-Type must be application/json.", { code: "unsupported_media_type" });
    }

    const ip = clientIp(req);
    const limit = rateLimit(ip);
    if (limit.limited) {
      throw new PublicError(429, "Slow down. Jeff is napping.", {
        code: "rate_limited",
        retryAfter: limit.retryAfter,
      });
    }

    const { message, history } = parseInput(await readBody(req));
    const repeatLimit = repeatRateLimit(ip, message, history);
    if (repeatLimit.limited) {
      throw new PublicError(429, "You've said that enough. Bring something new in a minute.", {
        code: "repeat_spam",
        retryAfter: repeatLimit.retryAfter,
      });
    }
    const apiKey = process.env.TYPESAFE_API_KEY;
    const result = await runEngineTurn({
      message,
      history,
      repeatCount: repeatLimit.count,
      callJev: (state, questions) => {
        if (!apiKey) {
          throw new PublicError(503, "Jeff is not configured yet.", { code: "not_configured" });
        }
        return callTypeSafe(apiKey, state, questions);
      },
    });
    const { turn, meta, ranked, nouls, safetyNet, latencyMs } = result;

    return send(
      {
        reply: turn.line.text,
        mode: turn.mode,
        serious: meta.serious,
        expr: meta.expr,
        mood: meta.mood,
        dot: meta.dot,
        score: turn.score == null ? null : Number(turn.score.toFixed(2)),
        beat: ranked ? Math.max(ranked.length - 1, 0) : null,
        alts: ranked ? runnerUps(ranked, turn.line, turn.mode) : [],
        nouls,
        safetyNet,
        latencyMs,
      },
      200
    );
  } catch (error) {
    const publicError = error instanceof PublicError
      ? error
      : new PublicError(502, "Jeff could not answer right now.", { code: "engine_failure" });
    if (!(error instanceof PublicError)) console.error("Jeff request failed:", error?.message ?? error);
    const headers = publicError.retryAfter ? { "Retry-After": String(publicError.retryAfter) } : {};
    return send(
      {
        error: publicError.publicMessage,
        code: publicError.code,
        ...(publicError.retryAfter ? { retryAfter: publicError.retryAfter } : {}),
      },
      publicError.status,
      headers
    );
  }
}
