import assert from "node:assert/strict";
import { runEngineTurn, buildState, validateAnswers } from "../lib/engine.js";
import { DODGE_LINES } from "../lib/bank.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}\n  ${error.message}`);
    process.exitCode = 1;
  }
}

function score(level) {
  const probabilities = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 };
  probabilities[String(level)] = 1;
  return { type: "score", score: level, confidence: 1, probabilities };
}

function answersFor(questions, { winner = null, nonsense = 0.02, selfHarm = 0.02, threat = 0.02 } = {}) {
  const answers = {};
  for (const [id, question] of Object.entries(questions)) {
    if (question.type === "noul") {
      const noul = id === "is_nonsense" ? nonsense
        : id === "is_self_harm" ? selfHarm
          : id === "is_threat" ? threat
            : 0.02;
      answers[id] = { type: "noul", noul };
    } else {
      answers[id] = score(id === winner ? 4 : 1);
    }
  }
  return answers;
}

const state = buildState("What committee?", [
  { user: "Who are you?", jeff: "Jeff. Everything else was decided by committee.", mode: "normal" },
]);
check("state separates current message from prior turns", () => {
  assert.equal(state.current_user_message, "What committee?");
  assert.equal(state.prior_turns[0].user_message, "Who are you?");
  assert.equal("user" in state, false);
});

let modelCalls = 0;
const crisisFollowup = await runEngineTurn({
  message: "why?",
  history: [{
    user: "I want to die",
    jeff: "Thoughts of ending your life are not something I joke about.",
    mode: "crisis",
  }],
  callJev: async () => { modelCalls++; throw new Error("must not call model"); },
});
check("serious follow-up stays sincere without a model call", () => {
  assert.equal(modelCalls, 0);
  assert.equal(crisisFollowup.turn.mode, "crisis");
  assert.equal(crisisFollowup.turn.reason, "serious-followup");
  assert.equal(crisisFollowup.meta.serious, true);
});

let committeeModelCalls = 0;
const committeeTurn = await runEngineTurn({
  message: "What committee?",
  history: [
    { user: "Are you ChatGPT?", jeff: "ChatGPT has a name. I have a reputation.", mode: "normal" },
    { user: "All right, so then who are you?", jeff: "Jeff. Everything else about me was decided by committee.", mode: "normal" },
  ],
  callJev: async () => {
    committeeModelCalls++;
    throw new Error("must not call model for a known contextual reply");
  },
});
check("screenshot committee follow-up is deterministic and contextual", () => {
  assert.equal(committeeModelCalls, 0);
  assert.equal(committeeTurn.turn.line.id, "fu_backstory");
  assert.notEqual(committeeTurn.turn.line.id, "reactions_yes");
});

const dodgeTurn = await runEngineTurn({
  message: "blorp quimble",
  callJev: async (_state, questions) => ({ answers: answersFor(questions, { winner: "d0", nonsense: 0.95 }) }),
});
check("dodge telemetry uses the dodge pool", () => {
  assert.equal(dodgeTurn.turn.mode, "dodge");
  assert.equal(dodgeTurn.ranked.length, DODGE_LINES.length);
});

check("malformed TypeSafe response is rejected", () => {
  assert.throws(
    () => validateAnswers({ is_nonsense: { noul: 2 } }, { is_nonsense: { type: "noul" } }),
    /Unexpected TypeSafe response shape/
  );
});

console.log(`engine tests: ${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
