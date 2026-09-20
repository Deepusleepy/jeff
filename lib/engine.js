// The engine: one turn of Jeff. Pure orchestration between safety nets,
// question construction, the Jev call (injected), and the decision cascade.
// Used identically by api/chat.js (production) and test/live.test.mjs (tests).

import { REAL_LINES, DODGE_LINES, FOLLOWUP_LINES } from "./bank.js";
import { RUBRIC, FIT_PLAIN, FIT_HISTORY, NOULS, PERSONA } from "./questions.js";
import { normalize, classifySafety, isFollowup } from "./safety.js";
import { resolveTurn, rank, expressionFor, runnerUps } from "./decide.js";

export function buildState(message, history) {
  const hasHistory = history.length > 0;
  return {
    current_user_message: message,
    ...(hasHistory
      ? {
          prior_turns: history.map(({ user, jeff, mode }) => ({
            user_message: user,
            jeff_reply: jeff,
            ...(mode ? { reply_mode: mode } : {}),
          })),
        }
      : {}),
    jeff: PERSONA,
  };
}

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

function validateProbability(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateAnswers(answers, questions) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("Unexpected TypeSafe response shape");
  }
  for (const [id, question] of Object.entries(questions)) {
    const answer = answers[id];
    if (!answer || typeof answer !== "object") throw new Error("Unexpected TypeSafe response shape");
    if (question.type === "noul") {
      if (!validateProbability(answer.noul)) throw new Error("Unexpected TypeSafe response shape");
      continue;
    }
    const probabilities = answer.probabilities;
    if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) {
      throw new Error("Unexpected TypeSafe response shape");
    }
    let sum = 0;
    for (let level = 0; level < question.criteria.length; level++) {
      const probability = probabilities[String(level)];
      if (!validateProbability(probability)) throw new Error("Unexpected TypeSafe response shape");
      sum += probability;
    }
    if (Math.abs(sum - 1) > 0.02) throw new Error("Unexpected TypeSafe response shape");
  }
}

const SERIOUS_MODES = new Set(["crisis", "grief", "threat", "empathy"]);

export function recentSeriousMode(history) {
  const last = history.at(-1);
  if (!last) return null;
  if (SERIOUS_MODES.has(last.mode)) return last.mode;

  const priorSafety = classifySafety(normalize(last.user));
  if (priorSafety.tier === "crisis" || priorSafety.tier === "grief") return priorSafety.tier;

  const priorLine = REAL_LINES.find((line) => line.text === last.jeff);
  return priorLine && SERIOUS_MODES.has(priorLine.category) ? priorLine.category : null;
}

function seriousFollowupTurn(mode) {
  const id = `${mode}_followup`;
  const line = REAL_LINES.find((candidate) => candidate.id === id)
    ?? REAL_LINES.find((candidate) => candidate.id === "empathy_followup");
  return { mode, reason: "serious-followup", line, score: null };
}

function contextualFollowupTurn(message, history) {
  const last = history.at(-1);
  if (!last) return null;

  const priorLine = REAL_LINES.find((line) => line.text === last.jeff);
  const priorReply = normalize(last.jeff);
  const current = normalize(message).replace(/[?.!]+$/g, "").trim();
  if (
    (priorLine?.id === "identity_your_name" || priorReply.includes("decided by committee"))
    && /^(?:what|which) committee$|^who decided (?:that|it)$/.test(current)
  ) {
    const line = FOLLOWUP_LINES.find((candidate) => candidate.id === "fu_backstory");
    if (line) return { mode: "normal", reason: "context-followup", line, score: null };
  }
  return null;
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

  const seriousMode = recentSeriousMode(history);
  const looksLikeFollowup = isFollowup(message, hasHistory);
  if (looksLikeFollowup && seriousMode) {
    const turn = seriousFollowupTurn(seriousMode);
    return { turn, meta: expressionFor(turn), ranked: null, nouls: null, safetyNet: true, latencyMs: Date.now() - t0 };
  }


  if (looksLikeFollowup) {
    const contextualTurn = contextualFollowupTurn(message, history);
    if (contextualTurn) {
      return {
        turn: contextualTurn,
        meta: expressionFor(contextualTurn),
        ranked: null,
        nouls: null,
        safetyNet: false,
        latencyMs: Date.now() - t0,
      };
    }
  }

  const followupMode = looksLikeFollowup;
  const pool = followupMode ? FOLLOWUP_LINES : REAL_LINES;
  const state = buildState(message, history);
  const questions = buildQuestions(pool, { followupMode, hasHistory });

  const data = await callJev(state, questions);
  const answers = data?.answers;
  validateAnswers(answers, questions);

  const turn = resolveTurn({
    message,
    normalized,
    safety,
    jevAnswers: answers,
    followupPool: followupMode ? FOLLOWUP_LINES : null,
  });
  const ranked = turn.mode === "dodge"
    ? rank(DODGE_LINES, answers, "d")
    : rank(pool, answers, "f");
  const nouls = {
    nonsense: answers.is_nonsense?.noul ?? null,
    aboutUser: answers.is_about_user?.noul ?? null,
    upset: answers.is_upset?.noul ?? null,
    selfHarm: answers.is_self_harm?.noul ?? null,
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
