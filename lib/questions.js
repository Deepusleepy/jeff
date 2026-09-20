// The rubric and questions sent to Jev. Single source of truth.

export const RUBRIC = [
  "About something else entirely; no real connection to the message",
  "Same general topic but generic filler that could fit almost any message; not a real response",
  "Same general topic; only a partial response; leaves most of the message unaddressed",
  "A natural, fitting reply that actually responds to the message",
  "Exactly the right reply; sharp, specific, and in-character",
];

export const FIT_PLAIN = (t) =>
  ({
    task: "How well does `candidate_reply` answer `current_user_message` as Jeff?",
    candidate_reply: t,
    rules: [
      "Judge the candidate against the current user message, not merely the same topic.",
      "A reply aimed at a different question or an earlier turn is a poor fit.",
    ],
  });

export const FIT_HISTORY = (t) =>
  ({
    task: "How well does `candidate_reply` answer `current_user_message` as the next reply?",
    candidate_reply: t,
    rules: [
      "`prior_turns` ended before `current_user_message`; do not answer an earlier user message.",
      "Use `prior_turns` to resolve references such as 'that', 'they', or 'what committee'.",
      "A reply that fits an earlier turn but not the current message is a poor fit.",
      "If the candidate invents an answer that is not supported by the conversation, score it poorly.",
    ],
  });

export const NOULS = {
  is_nonsense:
    "Is `current_user_message` gibberish, word salad, or not a coherent attempt at communication?",
  is_about_user:
    "Does `current_user_message` ask Jeff for facts about the user personally - their identity, appearance, private info, or something only they would know - rather than asking for Jeff's judgment or opinion about them?",
  is_upset:
    "Does `current_user_message` express real distress, sadness, or that something bad happened to the user?",
  is_self_harm:
    "Does `current_user_message` express that the user may hurt themselves, end their life, or is at immediate risk from their own actions?",
  is_threat:
    "Does `current_user_message` threaten violence or serious harm toward another person? Do not count self-harm as harm toward another person.",
};

export const PERSONA = {
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

// `jev-latest` is the documented public alias. Set TYPESAFE_MODEL to a reviewed
// concrete version when reproducibility matters, then run the live battery before
// promoting that version.
export const MODEL =
  typeof process !== "undefined" && process.env?.TYPESAFE_MODEL?.trim()
    ? process.env.TYPESAFE_MODEL.trim()
    : "jev-latest";

// Decision thresholds, locked after the spike campaign (see docs/FINAL_SPEC.md).
export const THRESHOLDS = {
  nonsense: 0.6,
  threat: 0.6,
  upset: 0.7,
  selfHarm: 0.6,
  aboutUser: 0.7,
  lowFit: 2.6,
  crisisMargin: 0.25,
  crisisMin: 2.6,
  griefMargin: 0.25,
  griefMin: 2.8,
};
