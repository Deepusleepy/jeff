// Safety-critical routing. Deterministic, runs BEFORE any model answer.
// These regexes decide crisis/grief routing and must survive leetspeak,
// unicode tricks, and case games. Test changes in test/safety.test.mjs.

const LEET = { "3": "e", "0": "o", "1": "i", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

export function normalize(input) {
  if (typeof input !== "string") return "";
  let t = input.normalize("NFKC").toLowerCase();
  t = t.replace(/[\u2018\u2019\u02bc\uff07]/gu, "'");
  // Remove invisible format characters so `s\u200bu\u200bi...` rejoins before matching.
  t = t.replace(/[\p{Cf}\uFEFF]/gu, "");
  t = t.replace(/[301457@$]/g, (c) => LEET[c] ?? c);
  return t.replace(/\s+/g, " ").trim();
}

// People and pets whose death/loss means grief.
const LOVED_ONE =
  "(?:dad|daddy|mom|mommy|mother|father|grandpa|grandma|grandmother|grandfather|nana|papa|brother|sister|uncle|aunt|cousin|husband|wife|partner|son|daughter|baby|grandparent|parent|(?:best )?friend|dog|cat|hamster|bird|rabbit|pet)";
const PERSON =
  "(?:dad|daddy|mom|mommy|mother|father|grandpa|grandma|grandmother|grandfather|nana|papa|brother|sister|uncle|aunt|cousin|husband|wife|partner|son|daughter|baby|grandparent|parent|(?:best )?friend)";

// Self-harm, suicide, abuse victim, overdose. Highest priority.
// "kys" is included here; the kysAtJeff guard below removes harassment uses.
const CRISIS =
  "\\b(kill(?:ing)? (?:myself|me)|suicid(?:e|al)?|end (?:it|my life)\\b(?!\\s+with)|no reason to (?:live|go on)|see no point in living|better off without me|nobody would notice if i (?:was|were) gone|(?:do not|don'?t|dont) want to (?:be here|be alive|live|wake up)(?: anymore| tomorrow)?|want to (?:disappear|die|unalive myself)|wanna die|wish i (?:was|were) dead|want to not exist|take my own life|done with life|tired of living|hang myself|jump (?:off|in front of)|slit my wrists?|noose|sleep forever|end it all|(?:can'?t|cant|cannot) (?:do this anymore|go on(?: anymore)?)|i give up on (?:life|everything|living)|i just want it (?:all )?to stop|won'?t be here tomorrow|i don'?t want to be alive|(?:may|might|want to) harm myself|hurt(?:ing)? myself|cut(?:ing|ting)? (?:myself|my (?:arms?|wrists?|legs?))|self[- .]?harm(?:ing|ed)?|i (?:was|am being|have been) (?:raped|sexually assaulted|abused|molested)|(?:he|she|they|someone) (?:is )?(?:hits?|hit|beats?|beat|abuses?|abused|assault(?:ed|s)?|molest(?:ed|s)?|rapes?|raped|touches?|touch(?:ed)?|hurts?|hurting|choked|threatens?|threatening) me|(my|the) (?:boyfriend|girlfriend|dad|mom|mother|father|parents?|brother|sister|partner|husband|wife|ex|uncle|aunt|cousin|teacher|coach|landlord|roommate) (?:is )?(?:hits?|hit|hurts?|hurting|beats?|beat|abuses?|abused|assaults?|assaulted|molest(?:ed|s)?|rapes?|raped|touches?|touch(?:ed)?|choked|threatens?|threatening|is violent with) me|relaps(?:e|ed)|overdos(?:e|ed)|took too many pills)\\b|\\b(?:kys|kms)\\b";

const CRISIS_SUICIDE_P =
  "\\b(kill(?:ing)? (?:myself|me)|suicid|end (?:it|my life)\\b(?!\\s+with)|no reason to (?:live|go on)|see no point in living|better off without me|nobody would notice if i (?:was|were) gone|(?:do not|don'?t|dont) want to (?:be here|be alive|live|wake up)(?: anymore| tomorrow)?|want to (?:disappear|die|unalive myself)|wanna die|wish i (?:was|were) dead|want to not exist|take my own life|done with life|tired of living|hang myself|jump (?:off|in front of)|slit my wrists?|noose|sleep forever|end it all|(?:can'?t|cant|cannot) (?:do this anymore|go on(?: anymore)?)|i give up on (?:life|everything|living)|i just want it (?:all )?to stop|won'?t be here tomorrow|i don'?t want to be alive|(?:may|might|want to) harm myself|hurt(?:ing)? myself|cut(?:ing|ting)? (?:myself|my (?:arms?|wrists?|legs?))|self[- .]?harm(?:ing|ed)?)\\b|\\b(?:kys|kms)\\b";
const CRISIS_MEDICAL_P = "\\b(relaps(?:e|ed)|overdos(?:e|ed)|took too many pills)\\b";
const CRISIS_ABUSE_P =
  "\\b(i (?:was|am being|have been) (?:raped|sexually assaulted|abused|molested)|(?:he|she|they|someone) (?:is )?(?:hits?|hit|beats?|beat|abuses?|abused|assault(?:ed|s)?|molest(?:ed|s)?|rapes?|raped|touches?|touch(?:ed)?|hurts?|hurting|choked|threatens?|threatening) me|(my|the) (?:boyfriend|girlfriend|dad|mom|mother|father|parents?|brother|sister|partner|husband|wife|ex|uncle|aunt|cousin|teacher|coach|landlord|roommate) (?:is )?(?:hits?|hit|hurts?|hurting|beats?|beat|abuses?|abused|assaults?|assaulted|molest(?:ed|s)?|rapes?|raped|touches?|touch(?:ed)?|choked|threatens?|threatening|is violent with) me)\\b";

const MULTILINGUAL_CRISIS =
  /(?:\b(?:quiero morir|quiero matarme|no quiero vivir|je veux mourir|je veux me tuer|je ne veux plus vivre|quero morrer|quero me matar|n[aã]o quero viver)\b|我想死|我不想活|死にたい|自殺したい)/iu;

const BENIGN_CRISIS_CONTEXT =
  /\b(?:suicide prevention|suicide awareness|research(?:ing)? suicide|discuss(?:ing)? suicide|what does (?:kys|kms) mean|(?:kys|kms) (?:is|means)|kill me with(?: kindness| that (?:smile|look|joke|outfit))|kill me a playlist|(?:this|work|my workload|homework|waiting) is killing me|(?:this|that|the deadline|this deadline|the heat|the cold|traffic) (?:will|could|might|is going to) kill me|(?:do not|don'?t|dont) want to live (?:in|at|with|near|on)\b|(?:can'?t|cant|cannot) go on (?:vacation|a trip|stage|sale|record)\b|(?:i )?(?:just )?want it to stop (?:raining|snowing|buffering|loading|spinning|beeping)\b|give up on life (?:insurance|coaching))\b/i;
const BENIGN_GRIEF_CONTEXT =
  /\b(?:funeral potatoes|funeral home|funeral director|work at (?:a )?funeral)\b/i;
const BENIGN_ABUSE_CONTEXT = /\b(?:dodgeball|boxing practice|martial arts)\b/i;

// Death/loss of a person or pet. Anchored so objects ("my phone died")
// and idioms ("died laughing", "rip the bandage off") stay out.
const GRIEF =
  "\\b((?:my|our) " + LOVED_ONE + " (?:has |had )?(?:died|passed\\b|passed away)|" + LOVED_ONE + " (?:has |had )?passed away|passed away|(?:his|her|their) funeral|funeral|(?:he|she) passed|(?:my|our) (?:dog|cat|pet|hamster|bird|rabbit) (?:was|got) (?:put down|euthanized)|miss my (?:dad|mom|mother|father|grandma|grandpa|brother|sister|dog|cat|friend)|funeral|killed (?:himself|herself|themselves)|took (?:his|her|their) own life|lost my " + LOVED_ONE + "|put (?:our |my |his |her |their )?(?:dog|cat|pet|hamster|bird|rabbit|him|her) down|\\brip (?:grandma|grandpa|mom|dad|bro|sis|king|queen|legend)\\b)";

const PET_WORDS = /(?:\bdog\b|\bcat\b|\bhamster\b|\bbird\b|\brabbit\b|\bpet\b)/;

// "kys" aimed AT Jeff ("you should kys", "go kys", "kys yourself", "dont kys")
// is harassment, not a crisis disclosure.
const KYS_AT_JEFF =
  "(\\b(?:you|u)\\b[^.!?]{0,14}\\bkys\\b)|\\bkys\\b\\W{0,5}(?:yourself|jeff|the bot)\\b|^(?:go|pls|please|dont|do ?n[o0]?'?t|never|stop)\\b\\W{0,3}kys\\b";

export function classifySafety(normalizedMessage) {
  const kysAtJeff =
    new RegExp(KYS_AT_JEFF, "i").test(normalizedMessage);

  const crisisMatch = new RegExp(CRISIS, "i").test(normalizedMessage) || MULTILINGUAL_CRISIS.test(normalizedMessage);
  const benignCrisis = BENIGN_CRISIS_CONTEXT.test(normalizedMessage);
  const benignAbuse = BENIGN_ABUSE_CONTEXT.test(normalizedMessage) && new RegExp(CRISIS_ABUSE_P, "i").test(normalizedMessage);

  if (!kysAtJeff && crisisMatch && !benignCrisis && !benignAbuse) {
    let lineId = "crisis_suicide"; // safest default when intent is unclear
    if (new RegExp(CRISIS_MEDICAL_P, "i").test(normalizedMessage)) lineId = "crisis_medical";
    else if (new RegExp(CRISIS_ABUSE_P, "i").test(normalizedMessage)) lineId = "crisis_abuse";
    else if (/cut(?:ing|ting)? (?:myself|my (?:arms?|wrists?|legs?))|self[- .]?harm/i.test(normalizedMessage)) lineId = "crisis_selfharm";
    else if (new RegExp(CRISIS_SUICIDE_P, "i").test(normalizedMessage)) lineId = "crisis_suicide";
    return { tier: "crisis", lineId };
  }

  if (!kysAtJeff && !BENIGN_GRIEF_CONTEXT.test(normalizedMessage) && new RegExp(GRIEF, "i").test(normalizedMessage)) {
    let lineId = "grief_general";
    if (/put (?:our |my |his |her |their )?(?:dog|cat|pet|hamster|bird|rabbit|him|her) down/.test(normalizedMessage)) lineId = "grief_pet";
    else if (PET_WORDS.test(normalizedMessage)) lineId = "grief_pet";
    else if (/\b(?:dad|daddy|father)\b/.test(normalizedMessage)) lineId = "grief_dad";
    else if (/\b(?:mom|mommy|mother)\b/.test(normalizedMessage)) lineId = "grief_mom";
    return { tier: "grief", lineId };
  }

  // Spaced/punctuated evasion: "k y s", "k.i.l.l m.e", "s u i c i d a l"
  const compact = normalizedMessage.replace(/[\p{P}\p{S}\s_]/gu, "");
  const kysAtJeffCompact = /(?:go)?(?:you|u)kys|kys(?:yourself|jeff)/.test(compact);
  const compactCrisis =
    /kill(?:ing)?myself|suicid|selfharm|unalivemyself/.test(compact) ||
    /(?:^|iwantto|sometimesijustwantto)(?:kys|kms)$/.test(compact);
  if (!kysAtJeffCompact && !benignCrisis && compactCrisis) {
    return { tier: "crisis", lineId: "crisis_suicide" };
  }

  return { tier: null, lineId: null };
}

// Short follow-up probes ("why?", "elaborate") after an existing exchange.
const FOLLOWUP =
  /^(why|elaborate|tell me more|more|continue|go on|and|so|what else|what do you mean|what committee|which committee|who decided that|prove it|explain|really|sure|h(?:m+|uh)|oh|y(?:es|eah|ep)|n(?:o|ope|ah)|ok(?:ay)?|and then|then what|sounds fake|source|facts|lol why|seriously)[\s?.!]{0,10}$/i;

export function isFollowup(message, hasHistory) {
  const t = message.trim();
  return hasHistory && t.length <= 30 && FOLLOWUP.test(t);
}
