// Vercel serverless function: POST /api/chat
// Body: { message: string, history?: [{user, jeff}] }
// Returns: { reply, mode, serious, expr, mood, dot, score, beat, alts, nouls, latencyMs }
//
// The TypeSafe API key never leaves this function. The client never sees it.

import { runEngineTurn, runnerUps } from "../lib/engine.js";

const MAX_MESSAGE_CHARS = 500;
const MAX_BODY_CHARS = 4000;
const MAX_HISTORY_TURNS = 4;
const MAX_HISTORY_FIELD_CHARS = 250;

const MODEL = "jev-latest";

// Lightweight per-IP rate limit: 10 requests/min, 60/hour. In-memory, so it
// resets on cold start and is per-instance; it stops casual abuse, not a
// determined botnet. Real protection for the key is the spend cap on the
// TypeSafe account + this being a private demo.
const RATE = { windowMs: 60_000, max: 10, daily: 60 };
const hits = new Map(); // ip -> {timestamps: [], count: 0, day: ""}

function rateLimited(ip) {
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  let h = hits.get(ip);
  if (!h) { h = { timestamps: [], count: 0, day: "" }; hits.set(ip, h); }
  if (h.day !== day) { h.day = day; h.count = 0; }
  h.timestamps = h.timestamps.filter((t) => now - t < RATE.windowMs);
  if (h.timestamps.length >= RATE.max || h.count >= RATE.daily) return true;
  h.timestamps.push(now);
  h.count++;
  // keep the map bounded
  if (hits.size > 5000) hits.clear();
  return false;
}

// Same-origin POSTs may carry no Origin header; allow that. Cross-origin only
// from localhost dev and this project's own Vercel domains.
function corsHeaders(origin) {
  const allowed =
    !origin ||
    /^https:\/\/askjeff(-[a-z0-9]+)?\.[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    /^https:\/\/askjeff\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin);
  // Never reflect a disallowed origin (and never the string "null"): omit ACAO instead.
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export default async function handler(request) {
  const t0 = Date.now();
  const cors = corsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "Slow down" }, 429, cors);

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return json({ error: "Server not configured" }, 500, cors);

  // Reject oversized bodies before parsing anything.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_CHARS) return json({ error: "Payload too large" }, 413, cors);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: "Payload too large" }, 413, cors);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const message = typeof body?.message === "string" ? body.message.slice(0, MAX_MESSAGE_CHARS) : "";
  if (!message.trim()) return json({ error: "Empty message" }, 400, cors);

  // History: last 4 turns, each field hard-capped, plain strings only.
  const history = Array.isArray(body?.history)
    ? body.history
        .slice(-MAX_HISTORY_TURNS)
        .map((h) => ({
          user: String(h?.user ?? "").slice(0, MAX_HISTORY_FIELD_CHARS),
          jeff: String(h?.jeff ?? "").slice(0, MAX_HISTORY_FIELD_CHARS),
        }))
        .filter((h) => h.user && h.jeff)
    : [];

  async function callJev(state, questions) {
    let res;
    try {
      res = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, state, questions }),
      });
    } catch {
      throw new Error("TypeSafe API unreachable");
    }
    if (!res.ok) {
      // Log details server-side; never proxy upstream error bodies to the client.
      const detail = await res.text().catch(() => "");
      console.error(`TypeSafe API ${res.status}: ${detail.slice(0, 300)}`);
      throw new Error(res.status === 429 ? "Rate limited" : `TypeSafe API error ${res.status}`);
    }
    return res.json();
  }

  try {
    const result = await runEngineTurn({ message, history, callJev });
    const { turn, meta, ranked, nouls, safetyNet, latencyMs, tokens } = result;

    return json(
      {
        reply: turn.line.text,
        mode: turn.mode,
        serious: meta.serious,
        expr: meta.expr,
        mood: meta.mood,
        dot: meta.dot,
        score: turn.score != null ? Number(turn.score.toFixed(2)) : null,
        beat: ranked ? Math.max(ranked.length - 1, 0) : null,
        alts: ranked ? runnerUps(ranked, turn.line) : [],
        nouls,
        safetyNet,
        tokens: tokens ?? null,
        latencyMs,
      },
      200,
      cors
    );
  } catch (err) {
    console.error("engine error:", err?.message ?? err);
    const status = err?.message === "Rate limited" ? 429 : 502;
    return json({ error: err?.message ?? "Engine failure" }, status, cors);
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
