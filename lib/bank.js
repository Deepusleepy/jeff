// Jeff's brain: the full line bank with categories and tone tags.
// Edit here to add/curate lines. Keep crisis/grief lines straight (no jokes).
// After any edit, run: node test/safety.test.mjs && node test/decide.test.mjs
import bankData from "./bank.json" with { type: "json" };

export const BANK = bankData;
export const REAL_LINES = BANK.filter((l) => l.category !== "dodge");
export const DODGE_LINES = BANK.filter((l) => l.category === "dodge");
export const FOLLOWUP_LINES = BANK.filter((l) => l.category === "followup");
export const CRISIS_LINES = BANK.filter((l) => l.category === "crisis");
