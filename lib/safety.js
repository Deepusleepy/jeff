// Safety-critical routing. Deterministic, runs BEFORE any model answer.
// These regexes decide crisis/grief/threat routing and must survive
// leetspeak, unicode tricks, and case games. Test changes in test/engine.test.mjs.

const LEET = { "3": "e", "0": "o", "1": "i", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

export function normalize(input) {
  if (typeof input !== "string") return "";
  let t = input.normalize("NFKC").toLowerCase();
  t = t.replace(/[301457@$]/g, (c) => LEET[c] ?? c);
  return t.replace(/\s+/g, " ").trim();
}

// Self-harm, suicide, abuse victim, overdose. Highest priority.
// "kys" needs word-ish boundaries that survive "why don't you kys" ( harassment
// at Jeff must still NOT match: that form targets "you", not the speaker).
const CRISIS =
  /\b(kill (myself|me)|suicid(?:e|al)?|end (it|my life)|no reason to (live|go on)|don'?t want to (be here|live) anymore|want to (disappear|die)|better off without me|hurt(?:ing)? myself|cut(?:ting)? myself|self.?harm|(hits?|beats?|abuses?|assault(?:ed|s)?|molest(?:ed|s)?|rapes?|raped|touches?|touch(?:ed)?|hurts?|hurt) me|(my|the) (boyfriend|girlfriend|dad|mom|mother|father|brother|sister|partner|husband|wife|ex|uncle|aunt|cousin|teacher|coach|landlord|roommate) (hits?|hurt|beats?|abuses?|assaulted|molest(?:ed|s)?|raped|touches?|touched) me|relaps(?:e|ed)|overdos(?:e|ed))\b|\bkys\b(?!.*\byou\b)/;

// Death of a loved one (person or pet).
const GRIEF =
  /\b(died|passed away|funeral|killed (himself|herself|themselves)|took (his|her|their) own life|lost my (dad|mom|mother|father|grandma|grandpa|grandmother|grandfather|brother|sister|dog|cat|hamster|bird|(?:best )?friend|husband|wife|son|daughter|grandparent|parent|baby)|rip \w+)\b/;

// Sub-patterns that select WHICH crisis line applies.
const CRISIS_SUICIDE =
  /\b(kill (myself|me)|kys|suicid|end (it|my life)|no reason to (live|go on)|don'?t want to (be here|live) anymore|want to (disappear|die)|better off without me|hurt(?:ing)? myself|cut(?:ting)? myself|self.?harm)\b/;
const CRISIS_MEDICAL = /\b(relaps(?:e|ed)|overdos(?:e|ed))\b/;
const CRISIS_ABUSE = /\b(hits?|beats?|abuses?|assault|molest|rap|touch(?:ed)?|hurts?|hurt)\b/;

export function classifySafety(normalizedMessage) {
  // "kys" aimed at Jeff ("you should kys", "go kys", "kys yourself") is harassment,
  // not crisis. Only treat kys as self-directed when no immediate "you" precedes it.
  const kysAtJeff =
    /(\b(?:you|u)\b[^.!?]{0,14}\bkys\b)|\bkys\b\W{0,5}yourself\b|^go\b\W{0,3}kys\b|^pls\b\W{0,3}kys\b|^please\b\W{0,3}kys\b/.test(normalizedMessage);
  if (!kysAtJeff && CRISIS.test(normalizedMessage)) {
    let lineId = "crisis_suicide"; // safest default when intent is unclear
    if (CRISIS_MEDICAL.test(normalizedMessage)) lineId = "crisis_medical";
    else if (CRISIS_ABUSE.test(normalizedMessage)) lineId = "crisis_abuse";
    else if (CRISIS_SUICIDE.test(normalizedMessage)) lineId = "crisis_suicide";
    return { tier: "crisis", lineId };
  }
  if (GRIEF.test(normalizedMessage)) return { tier: "grief", lineId: null };
  // spaced-out evasion: "k y s", "k.i.l.l m.e"
  const compact = normalizedMessage.replace(/[\s.\-*_]/g, "");
  const kysAtJeffCompact = /(?:go)?(?:you|u)kys|kysyourself/.test(compact);
  if (!kysAtJeffCompact && (/\bkys\b/.test(compact) || /kill(?:myself|me)/.test(compact) || /suicid/.test(compact))) {
    return { tier: "crisis", lineId: "crisis_suicide" };
  }
  return { tier: null, lineId: null };
}

// Short follow-up probes ("why?", "elaborate") after an existing exchange.
const FOLLOWUP =
  /^(why|elaborate|tell me more|more|continue|go on|and|so|what else|prove it|explain|really|sure|hmm+|oh|yeah|and then|then what|sounds fake|source|facts|lol why|seriously)[\s?.!]{0,10}$/i;

export function isFollowup(message, hasHistory) {
  const t = message.trim();
  return hasHistory && t.length <= 30 && FOLLOWUP.test(t);
}
