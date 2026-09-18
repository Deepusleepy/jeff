// Bank shape invariants: catches bad hand-edits before they hit prod.
import { BANK, REAL_LINES, DODGE_LINES, FOLLOWUP_LINES, CRISIS_LINES } from "../lib/bank.js";
import assert from "node:assert";

const ids = new Set();
for (const l of BANK) {
  assert.ok(l.id && l.category && l.text, `line missing fields: ${JSON.stringify(l).slice(0, 80)}`);
  assert.ok(!ids.has(l.id), `duplicate id: ${l.id}`);
  ids.add(l.id);
}
assert.ok(REAL_LINES.length > 150, "real pool too small");
assert.ok(DODGE_LINES.length >= 5, "dodge pool too small");
for (const cat of ["threat", "grief", "empathy", "greeting", "goodbye"]) {
  assert.ok(REAL_LINES.some((l) => l.category === cat), `missing required category: ${cat}`);
}
assert.ok(CRISIS_LINES.length >= 3, "crisis lines missing");
assert.ok(CRISIS_LINES.some((l) => l.id === "crisis_suicide"), "crisis_suicide missing");
assert.ok(FOLLOWUP_LINES.length >= 3, "followup pool too small");
console.log(`bank test: OK (${BANK.length} lines, ${REAL_LINES.length} real, ${DODGE_LINES.length} dodge)`);
