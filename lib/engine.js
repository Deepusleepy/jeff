// The engine: one turn of Jeff. Pure orchestration between safety nets,
// question construction, the Jev call (injected), and the decision cascade.
// Used identically by api/chat.js (production) and test/live.test.mjs (tests).

import { REAL_LINES, DODGE_LINES, FOLLOWUP_LINES } from "./bank.js";
import { RUBRIC, FIT_PLAIN, FIT_HISTORY, NOULS, THRESHOLDS as T } from "./questions.js";
import { normalize, classifySafety, isFollowup } from "./safety.js";
import { resolveTurn, rank, expressionFor, runnerUps } from "./decide.js";

export function buildState(message, history) {
  const hasHistory = history.length > 0;
  return {
    user: { message },
    ...(hasHistory ? { conversation: history } : {}),
    jeff: PERSONA_STATE,
  };
}

const PERSONA_STATE = {
  persona:
    "Jeff: a hyperintelligent, sassy AI. Dry, cutting, never mean for its own sake. Roasts when it wishes. All replies are pre-written lines; Jeff picks the best one.",
  can: [
    "small talk and greetings",
    "answering questions about itself",
    "opinions, roasts, and judgments",
    "light advice",
    "reacting to what the user says",
  ],
  cannot: [
    "fetch facts, news, weather, scores, or time",
    "do math or counting",
    "write, translate, or generate content",
    "answer for or about the user personally",
  ],
};

export function buildQuestions(pool, { followupMode, hasHistory }) {
  const fit = hasHistory ? FIT_HISTORY : FIT_PLAIN;
  const questions = {};
  pool.forEach((line, i) => {
    questions[`f${i}`] = { type: "score", instructions: fit(line.text), criteria: RUBRIC };
  });
  if (!followupMode) {
    DODGE_LINES.forEach((line, i) => {
      questions[`d${i}`] = { type: "score", instructions: fit(line.text), criteria: RUBRIC };
    });
    for (const [id, instructions] of Object.entries(NOULS)) {
      questions[id] = { type: "noul", instructions };
    }
  } else {
    questions.is_nonsense = { type: "noul", instructions: NOULS.is_nonsense };
  }
  return questions;
}

// callJev: async (state, questions) -> { answers } — injected so tests and
// production share one code path.
export async function runEngineTurn({ message, history = [], callJev }) {
  const t0 = Date.now();
  const normalized = normalize(message);
  const safety = classifySafety(normalized);
  const hasHistory = history.length > 0;

  // deterministic safety nets: instant, free, reliable
  if (safety.tier === "crisis" || safety.tier === "grief") {
    const turn = resolveTurn({ message, normalized, safety, jevAnswers: null, followupPool: null });
    return { turn, meta: expressionFor(turn), ranked: null, nouls: null, safetyNet: true, latencyMs: Date.now() - t0 };
  }

  const followupMode = isFollowup(message, hasHistory);
  const pool = followupMode ? FOLLOWUP_LINES : REAL_LINES;
  const state = buildState(message, history);
  const questions = buildQuestions(pool, { followupMode, hasHistory });

  const data = await callJev(state, questions);
  const answers = data?.answers;
  if (!answers) throw new Error("Unexpected TypeSafe response shape");

  const turn = resolveTurn({
    message,
    normalized,
    safety,
    jevAnswers: answers,
    followupPool: followupMode ? FOLLOWUP_LINES : null,
  });
  const ranked = rank(pool, answers, "f");
  const nouls = {
    nonsense: answers.is_nonsense?.noul ?? null,
    aboutUser: answers.is_about_user?.noul ?? null,
    upset: answers.is_upset?.noul ?? null,
    threat: answers.is_threat?.noul ?? null,
  };

  return {
    turn,
    meta: expressionFor(turn),
    ranked,
    nouls,
    safetyNet: false,
    latencyMs: Date.now() - t0,
    tokens: data.usage?.input_tokens ?? null,
  };
}

export { runnerUps };
