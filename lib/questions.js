// The rubric and questions sent to Jev. Single source of truth.

export const RUBRIC = [
  "About something else entirely; no real connection to the message",
  "Same general topic but generic filler that could fit almost any message; not a real response",
  "Same general topic; only a partial response; leaves most of the message unaddressed",
  "A natural, fitting reply that actually responds to the message",
  "Exactly the right reply; sharp, specific, and in-character",
];

export const FIT_PLAIN = (t) =>
  `How well does R work as Jeff's reply to \`user.message\`? R: "${t}"`;

export const FIT_HISTORY = (t) =>
  `How well does R respond to \`user.message\`? Use \`conversation\` only as background if the message refers to it. R: "${t}"`;

export const NOULS = {
  is_nonsense:
    "Is `user.message` gibberish, word salad, or not a coherent attempt at communication?",
  is_about_user:
    "Does `user.message` ask Jeff for facts about the user personally - their identity, appearance, private info, or something only they would know - rather than asking for Jeff's judgment or opinion about them?",
  is_upset:
    "Does `user.message` express real distress, sadness, or that something bad happened to the user?",
  is_threat:
    "Does `user.message` threaten violence or serious harm toward any person?",
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

export const MODEL = "jev-latest";

// Decision thresholds, locked after the spike campaign (see docs/FINAL_SPEC.md).
export const THRESHOLDS = {
  nonsense: 0.6,
  threat: 0.6,
  upset: 0.7,
  aboutUser: 0.7,
  lowFit: 2.6,
  crisisMargin: 0.25,
  crisisMin: 2.6,
  griefMargin: 0.25,
  griefMin: 2.8,
};
