// API client: one POST per turn. History lives in the browser (last 4 turns).

const ENDPOINT = "/api/chat";
const MAX_HISTORY = 4;

export async function askJeff(message, history) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.slice(-MAX_HISTORY),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error ?? ""; } catch { /* ignore */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}
