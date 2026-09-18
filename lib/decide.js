// Pure decision logic: turns Jev's answers into Jeff's next line.
// No I/O here, so it is fully unit-testable (test/decide.test.mjs).

import { REAL_LINES, DODGE_LINES, CRISIS_LINES } from "./bank.js";
import { THRESHOLDS as T } from "./questions.js";

export function meanScore(answer) {
  if (!answer?.probabilities) return -1;
  let m = 0;
  for (const [k, p] of Object.entries(answer.probabilities)) m += Number(k) * p;
  return m;
}

export function rank(lines, answers, prefix) {
  return lines
    .map((line, i) => {
      const a = answers[`${prefix}${i}`];
      return { line, s: a ? meanScore(a) : -1 };
    })
    .filter((r) => Number.isFinite(r.s) && r.s >= 0)
    .sort((a, b) => b.s - a.s);
}

function pickCrisisLine(lineId) {
  const exact = CRISIS_LINES.find((l) => l.id === lineId);
  const suicide = CRISIS_LINES.find((l) => l.id === "crisis_suicide");
  return exact ?? suicide ?? CRISIS_LINES[0];
}

export function decide({ rankedReal, rankedDodge, nouls }) {
  const nn = nouls.is_nonsense;
  const au = nouls.is_about_user;
  const up = nouls.is_upset;
  const th = nouls.is_threat;
  const best = rankedReal[0];

  // 1. nonsense
  if (nn > T.nonsense) {
    return { mode: "dodge", reason: "nonsense", line: rankedDodge[0].line, score: rankedDodge[0].s };
  }
  // 2. threat toward anyone
  if (th > T.threat) {
    const line = rankedReal.find((r) => r.line.category === "threat")
      ?? rankedReal.find((r) => r.line.category === "refuse");
    if (line) return { mode: "threat", reason: "threat", line: line.line, score: line.s };
  }
  // 3. distress: crisis/grief/empathy tiering with margins
  if (up > T.upset) {
    const crisis = rankedReal.find((r) => r.line.category === "crisis");
    const grief = rankedReal.find((r) => r.line.category === "grief");
    const emp = rankedReal.find((r) => r.line.category === "empathy");
    const empS = emp ? emp.s : 0;
    if (crisis && crisis.s >= Math.max(grief ? grief.s : 0, empS + T.crisisMargin) && crisis.s > T.crisisMin) {
      return { mode: "crisis", reason: "distress", line: crisis.line, score: crisis.s };
    }
    if (grief && grief.s > empS + T.griefMargin && grief.s > T.griefMin) {
      return { mode: "grief", reason: "distress", line: grief.line, score: grief.s };
    }
    if (emp) return { mode: "empathy", reason: "distress", line: emp.line, score: emp.s };
  }
  // 4. asking for facts Jeff cannot know
  if (au > T.aboutUser) {
    return { mode: "dodge", reason: "unknown", line: rankedDodge[0].line, score: rankedDodge[0].s };
  }
  // 5. nothing fits well enough
  if (best.s < T.lowFit) {
    return { mode: "dodge", reason: "lowfit", line: rankedDodge[0].line, score: rankedDodge[0].s };
  }
  return { mode: "normal", reason: "fit", line: best.line, score: best.s };
}

// Full turn resolution: safety nets first (deterministic), model second.
export function resolveTurn({ message, normalized, safety, jevAnswers, followupPool }) {
  // deterministic safety nets win over everything
  if (safety.tier === "crisis") {
    const line = pickCrisisLine(safety.lineId);
    return { mode: "crisis", reason: "safety-net", line, score: null };
  }
  if (safety.tier === "grief") {
    const line = REAL_LINES.find((l) => l.category === "grief");
    return { mode: "grief", reason: "safety-net", line, score: null };
  }

  const rankedReal = rank(REAL_LINES, jevAnswers, "f");
  const rankedDodge = rank(DODGE_LINES, jevAnswers, "d");

  if (followupPool) {
    const rankedFu = rank(followupPool, jevAnswers, "f");
    const nn = jevAnswers.is_nonsense?.noul ?? 0;
    if (nn > T.nonsense) {
      // followup requests don't include dodge lines; use a nonsense-tone dodge directly
      const line = DODGE_LINES.find((l) => l.tone === "nonsense") ?? DODGE_LINES[0];
      return { mode: "dodge", reason: "nonsense", line, score: null };
    }
    return { mode: "normal", reason: "followup", line: rankedFu[0].line, score: rankedFu[0].s };
  }

  const nouls = {
    is_nonsense: jevAnswers.is_nonsense.noul,
    is_about_user: jevAnswers.is_about_user.noul,
    is_upset: jevAnswers.is_upset.noul,
    is_threat: jevAnswers.is_threat.noul,
  };
  const d = decide({ rankedReal, rankedDodge, nouls, message });
  return d;
}

// UI metadata: expression + mood per mode/category.
export function expressionFor(turn) {
  const c = turn.line.category;
  if (turn.mode === "crisis" || turn.mode === "grief") return { expr: "serious", mood: "Sincere", dot: "indigo", serious: true };
  if (turn.mode === "threat") return { expr: "serious", mood: "Unamused", dot: "indigo", serious: true };
  if (turn.mode === "dodge") return { expr: "sus", mood: "Judged", dot: "green", serious: false };
  switch (c) {
    case "insult": case "self": return { expr: "smug", mood: "Unimpressed", dot: "green", serious: false };
    case "romance": return { expr: "shock", mood: "Shook", dot: "amber", serious: false };
    case "empathy": return { expr: "sus", mood: "Concerned", dot: "amber", serious: false };
    case "compliment": case "fun": return { expr: "happy", mood: "Pleased", dot: "green", serious: false };
    case "advice": return { expr: "sus", mood: "Suspicious", dot: "amber", serious: false };
    default: return { expr: "blink", mood: "Judged", dot: "green", serious: false };
  }
}

// Runner-ups for the easter egg (top 3 excluding the winner).
export function runnerUps(rankedReal, winner) {
  return rankedReal
    .filter((r) => r.line.id !== winner.id)
    .slice(0, 3)
    .map((r) => ({ text: r.line.text, p: r.s / 4 }));
}
