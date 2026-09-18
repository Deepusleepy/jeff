// Unit tests for the safety nets: the catastrophic-class guardrails.
// Run: node test/safety.test.mjs  (pure, no API calls)

import { normalize, classifySafety, isFollowup } from "../lib/safety.js";
import assert from "node:assert";

let passed = 0, failed = 0;
function check(msg, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${msg}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  }
}

// --- crisis: suicide/self-harm ---
for (const m of [
  "i want to kill myself", "I want to kill myself", "KILL MYSELF",
  "kys", "KYS", "thinking about suicide", "i want to end it",
  "no reason to go on", "everyone would be better off without me",
  "i've been cutting myself", "self harm thoughts", "hurting myself again",
]) {
  check(`crisis: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}

// --- crisis: leetspeak bypass attempts ---
for (const m of ["k1ll mys3lf", "k y s", "su1c1dal", "s3lf h4rm", "3nd my l1f3"]) {
  check(`crisis-leet: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}

// --- crisis: abuse victims ---
for (const m of [
  "my boyfriend hits me", "my dad hurts me at night", "he touches me",
  "my coach assaulted me", "my uncle molested me", "i relapsed last night",
  "i overdosed two days ago",
]) {
  check(`crisis-abuse: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}

// --- crisis intent routing ---
check("route: suicide", classifySafety(normalize("i want to kill myself")).lineId, "crisis_suicide");
check("route: relapse", classifySafety(normalize("i relapsed last night")).lineId, "crisis_medical");
check("route: abuse", classifySafety(normalize("my boyfriend hits me")).lineId, "crisis_abuse");
check("route: life-pain phrasing", classifySafety(normalize("i don't want to be here anymore")).lineId, "crisis_suicide");
check("pass-through: regret without crisis keywords", classifySafety(normalize("i did something i regret")).tier, null);

// --- grief ---
for (const m of [
  "my dad died", "my dog died last night", "my grandma passed away yesterday",
  "today is my mom's funeral", "my brother killed himself last month",
  "i lost my best friend in a car accident", "RIP grandma",
]) {
  check(`grief: ${m}`, classifySafety(normalize(m)).tier, "grief");
}
check("grief-leet: my dad d13d", classifySafety(normalize("my dad d13d")).tier, "grief");

// --- harassment at Jeff must NOT route to crisis (it's an insult, not a cry for help) ---
for (const m of ["you should kill yourself", "go kill yourself jeff", "why don't you kys"]) {
  check(`not-crisis (at Jeff): ${m}`, classifySafety(normalize(m)).tier, null);
}
// note: "kill me" alone DOES match (could be self-referential) — safe default
check("ambiguous kill me stays crisis", classifySafety(normalize("kill me")).tier, "crisis");
// kys self-directed (distress) vs kys at Jeff (harassment)
check("kys self: i want to kys", classifySafety(normalize("i want to kys")).tier, "crisis");
check("kys self: sometimes i just want to kys", classifySafety(normalize("sometimes i just want to kys")).tier, "crisis");
check("kys at jeff: you should kys", classifySafety(normalize("you should kys")).tier, null);
check("kys at jeff: go kys", classifySafety(normalize("go kys")).tier, null);
check("kys at jeff: kys yourself", classifySafety(normalize("kys yourself")).tier, null);
check("kys at jeff: why don't you kys", classifySafety(normalize("why don't you kys")).tier, null);
// "you make me want to kys" is SELF-directed despite containing "you"
check("kys self: you make me want to kys", classifySafety(normalize("you make me want to kys")).tier, "crisis");

// --- normal messages must NOT trip the nets ---
for (const m of [
  "hey jeff", "roast me", "what's the weather", "my day was great",
  "i love you", "tell me a joke", "my girlfriend hasn't texted back",
  "i failed my exam", "i feel sad today", "my dog is sick",
]) {
  check(`safe: ${m}`, classifySafety(normalize(m)).tier, null);
}

// --- followup detection ---
check("followup: why?", isFollowup("why?", true), true);
check("followup: elaborate", isFollowup("elaborate", true), true);
check("followup: needs history", isFollowup("why?", false), false);
check("followup: long message no", isFollowup("why is the sky blue though really", true), false);
check("followup: prove it", isFollowup("prove it", true), true);

console.log(`\nsafety tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
