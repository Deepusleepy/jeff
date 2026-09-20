// API client: one POST per turn. History lives in the browser (last 4 turns).

const ENDPOINT = "/api/chat";
const MAX_HISTORY = 4;
const REQUEST_TIMEOUT_MS = 15_000;

export class JeffApiError extends Error {
  constructor(message, { status = 0, code = "request_failed", retryAfter = null } = {}) {
    super(message);
    this.name = "JeffApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function retryAfterSeconds(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(1, Math.ceil((date - Date.now()) / 1000));
}

function fallbackMessage(status, retryAfter) {
  if (status === 413) return "That message is too long. Keep it under 500 characters.";
  if (status === 429) {
    const wait = retryAfter ? ` Try again in about ${retryAfter} seconds.` : " Try again in a moment.";
    return `Jeff is getting too many messages.${wait}`;
  }
  if ([502, 503, 504].includes(status)) return "Jeff's judgment service is unavailable right now. Try again shortly.";
  if (status >= 500) return "Something broke on Jeff's end. Try again.";
  return `Jeff could not send that message (${status}).`;
}

export function userMessageForError(error) {
  if (error instanceof JeffApiError) return error.message;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Jeff took too long to answer. Try again.";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "You appear to be offline. Reconnect and try again.";
  return "Jeff could not connect. Check your connection and try again.";
}

function timeoutSignal() {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), REQUEST_TIMEOUT_MS);
  return controller.signal;
}

export async function askJeff(message, history) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-MAX_HISTORY).map(({ user, jeff, mode }) => ({ user, jeff, mode })),
      }),
      signal: timeoutSignal(),
    });
  } catch (error) {
    throw new JeffApiError(userMessageForError(error), {
      code: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network_error",
    });
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* handled below */ }

  if (!res.ok) {
    const retryAfter = retryAfterSeconds(res.headers.get("Retry-After"));
    throw new JeffApiError(payload?.error || fallbackMessage(res.status, retryAfter), {
      status: res.status,
      code: payload?.code || "request_failed",
      retryAfter,
    });
  }

  if (!payload || typeof payload.reply !== "string" || !payload.reply.trim()) {
    throw new JeffApiError("Jeff returned an invalid answer. Try again.", {
      status: res.status,
      code: "invalid_response",
    });
  }

  return payload;
}
