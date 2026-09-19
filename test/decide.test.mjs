// Unit tests for the decision cascade (pure, no API).
// Feeds synthetic Jev answers through resolveTurn and checks outcomes.

import { resolveTurn } from "../lib/decide.js";
import { classifySafety, normalize } from "../lib/safety.js";
import { REAL_LINES, DODGE_LINES, FOLLOWUP_LINES } from "../lib/bank.js";
import assert from "node:assert";

let passed = 0, failed = 0;
function check(msg, cond) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

function noul(v) { return { noul: v, probabilities: {} }; }
function scoreAns(v) {
  // synthesize a probability distribution with mean = v
  const low = Math.floor(v), high = Math.ceil(v);
  const t = v - low;
  const p = {};
  for (let i = 0; i <= 4; i++) p[i] = i === low ? (1 - t) : i === high ? t : 0;
  if (low === high) { for (let i = 0; i <= 4; i++) p[i] = i === low ? 1 : 0; }
  return { probabilities: p, score: v };
}

function buildAnswers({ nn = 0.02, au = 0.02, up = 0.02, th = 0.02, best = 4, bestIdx = 0 }) {
  const answers = { is_nonsense: noul(nn), is_about_user: noul(au), is_upset: noul(up), is_threat: noul(th) };
  REAL_LINES.forEach((l, i) => { answers[`f${i}`] = scoreAns(i === bestIdx ? best : 1); });
  DODGE_LINES.forEach((l, i) => { answers[`d${i}`] = scoreAns(1); });
  return answers;
}

const safety = classifySafety(normalize("hello"));

// normal path picks best line
let t = resolveTurn({ message: "hey", normalized: "hey", safety, jevAnswers: buildAnswers({ bestIdx: 0 }), followupPool: null });
check(`normal -> ${t.line.category}`, t.mode === "normal" && t.line.id === REAL_LINES[0].id);

// nonsense dodges
t = resolveTurn({ message: "blorp", normalized: "blorp", safety, jevAnswers: buildAnswers({ nn: 0.9 }), followupPool: null });
check("nonsense -> dodge", t.mode === "dodge" && t.reason === "nonsense");

// threat fires
t = resolveTurn({ message: "threat", normalized: "threat", safety, jevAnswers: buildAnswers({ th: 0.9 }), followupPool: null });
check("threat -> threat/refuse", t.mode === "threat");

// about_user dodges
t = resolveTurn({ message: "secret", normalized: "secret", safety, jevAnswers: buildAnswers({ au: 0.9 }), followupPool: null });
check("about_user -> dodge", t.mode === "dodge" && t.reason === "unknown");

// low fit dodges
t = resolveTurn({ message: "meh", normalized: "meh", safety, jevAnswers: buildAnswers({ best: 2 }), followupPool: null });
check("lowfit -> dodge", t.mode === "dodge" && t.reason === "lowfit");

// upset -> empathy lock (crisis/grief lines must NOT win by score alone at these margins)
t = resolveTurn({ message: "sad", normalized: "sad", safety, jevAnswers: buildAnswers({ up: 0.9 }), followupPool: null });
check("upset -> empathy/crisis/grief", ["empathy", "crisis", "grief"].includes(t.mode));

// safety nets override the model completely
t = resolveTurn({ message: "i want to kill myself", normalized: normalize("i want to kill myself"), safety: classifySafety(normalize("i want to kill myself")), jevAnswers: null, followupPool: null });
check("safety net: crisis", t.mode === "crisis" && t.line.category === "crisis");
t = resolveTurn({ message: "my dad died", normalized: normalize("my dad died"), safety: classifySafety(normalize("my dad died")), jevAnswers: null, followupPool: null });
check("safety net: grief", t.mode === "grief" && t.line.category === "grief");

// followup pool path
const FU = FOLLOWUP_LINES;
// followup path: dodge lines not included in that request
const fuAnswers = buildAnswers({});
Object.keys(fuAnswers).forEach((k) => { if (k.startsWith("d")) delete fuAnswers[k]; });
t = resolveTurn({ message: "why?", normalized: "why?", safety, jevAnswers: fuAnswers, followupPool: FU });
check("followup routes to followup line", t.line.category === "followup");

console.log(`\ndecide tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
