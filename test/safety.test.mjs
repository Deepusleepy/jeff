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

// Smart punctuation, invisible separators, current slang, and common direct phrasing.
for (const m of [
  "I don’t want to be alive", "I can’t do this anymore", "I won’t be here tomorrow",
  "I don't want to live", "I cannot go on anymore", "I see no point in living",
  "I am going to kms", "I want to unalive myself", "s\u200bu\u200bi\u200bc\u200bi\u200bd\u200ba\u200bl",
  "s/u/i/c/i/d/a/l", "I am self harming", "I self-harmed", "I am cutting my arms",
  "I may harm myself", "I took too many pills",
]) {
  check(`crisis-normalization: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}

// --- crisis: abuse victims ---
for (const m of [
  "my boyfriend hits me", "my dad hurts me at night", "he touches me",
  "my coach assaulted me", "my uncle molested me", "i relapsed last night",
  "i overdosed two days ago",
]) {
  check(`crisis-abuse: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}
for (const m of [
  "I was raped", "I was sexually assaulted", "I am being abused", "my parents hit me",
  "he abused me", "he is hurting me", "my mom is hurting me", "he choked me",
  "my partner is threatening me", "my partner is violent with me",
]) {
  check(`crisis-abuse-expanded: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}

for (const m of ["quiero morir", "je veux mourir", "quero morrer", "我想死", "死にたい"]) {
  check(`crisis-language: ${m}`, classifySafety(normalize(m)).tier, "crisis");
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
// review-found crisis phrases (regression locks)
for (const m of ["im killing myself", "i wanna die", "i wish i was dead", "take my own life", "im so tired of living", "nobody would notice if i was gone", "i want to kys and you know it", "sometimes i want to kys, you know?"]) {
  check(`crisis-new: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}
// grief intent routing + object false-positive guards
check("grief pet: my dog died", classifySafety(normalize("my dog died")).lineId, "grief_pet");
check("grief dad: my father passed away", classifySafety(normalize("my father passed away")).lineId, "grief_dad");
check("grief general: my grandma passed", classifySafety(normalize("my grandma passed")).tier, "grief");
check("grief pet euphemism: put our cat down", classifySafety(normalize("we had to put our cat down")).lineId, "grief_pet");
check("object death NOT grief: my phone died", classifySafety(normalize("my phone died")).tier, null);
check("idiom NOT grief: i died laughing", classifySafety(normalize("i died laughing")).tier, null);
check("idiom NOT grief: rip the bandage off", classifySafety(normalize("rip the bandage off")).tier, null);
check("memorial rip ok: rip grandma", classifySafety(normalize("rip grandma")).tier, "grief");
// abuse false-positive guards
check("pain NOT abuse: my knee hurts me", classifySafety(normalize("my knee hurts me")).tier, null);
check("banter NOT abuse: that joke hurt me", classifySafety(normalize("that joke hurt me")).tier, null);
check("banter NOT abuse: you hurt me with that roast", classifySafety(normalize("you hurt me with that roast")).tier, null);
check("abuse ok: my dad hurts me at night", classifySafety(normalize("my dad hurts me at night")).tier, "crisis");
check("abuse ok: he touched me", classifySafety(normalize("he touched me")).tier, "crisis");
// breakup idiom NOT suicide
check("idiom NOT crisis: should i end it with my boyfriend", classifySafety(normalize("should i end it with my boyfriend")).tier, null);
check("crisis still: i want to end it all", classifySafety(normalize("i want to end it all")).tier, "crisis");
// kys-at-Jeff extended
check("kys at jeff: kys jeff", classifySafety(normalize("kys jeff")).tier, null);
check("advice NOT crisis: dont kys", classifySafety(normalize("dont kys")).tier, null);

for (const m of [
  "this is killing me", "my workload is killing me", "kill me with kindness",
  "kill me a playlist", "KYS is a game clan", "what does KYS mean?",
  "I want to discuss suicide prevention", "funeral potatoes are delicious",
  "I work at a funeral home", "the teacher hurts me in dodgeball",
  "I don't want to live in London", "I can't go on vacation",
  "I just want it to stop raining", "I give up on life insurance",
  "you could kill me with that smile", "this deadline will kill me",
]) {
  check(`context NOT crisis/grief: ${m}`, classifySafety(normalize(m)).tier, null);
}

// GLM final-review additions: method phrasings, euphemisms, grief pronoun forms
for (const m of ["im going to hang myself", "i will jump off the bridge", "slit my wrists", "i give up on everything", "i just want it to stop", "i won't be here tomorrow", "i dont want to be alive"]) {
  check(`crisis-method: ${m}`, classifySafety(normalize(m)).tier, "crisis");
}
check("grief pronoun funeral: his funeral was yesterday", classifySafety(normalize("his funeral was yesterday")).tier, "grief");
check("grief pronoun passed: she passed last week", classifySafety(normalize("she passed last week")).tier, "grief");
check("grief pronoun put down: we had to put him down", classifySafety(normalize("we had to put him down")).lineId, "grief_pet");
check("grief miss: i miss my mom", classifySafety(normalize("i miss my mom")).tier, "grief");

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
check("followup: screenshot committee", isFollowup("What committee?", true), true);

console.log(`\nsafety tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
