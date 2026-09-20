# Jeff implementation reference

This document describes the current checked-in design. The code and tests are
the source of truth if this file falls behind.

## Product constraint

Jeff only returns text stored in `lib/bank.json`. TypeSafe Jev ranks those
candidate lines and provides classification scores. It does not compose the
reply shown to the user.

The line constraint does not make every reply factual or appropriate. A model
can rank the wrong candidate, and deterministic rules can miss unfamiliar
wording.

## Components

- `index.html`, `styles/`, and `src/` implement the static browser client.
- `api/chat.js` validates requests, applies per-instance rate limits, calls
  TypeSafe, and shapes the public response.
- `lib/safety.js` normalizes input and runs deterministic crisis, abuse,
  overdose, self-harm, and grief checks.
- `lib/engine.js` builds TypeSafe state and questions, validates the provider
  response, and coordinates a turn.
- `lib/decide.js` ranks candidates and applies the decision thresholds.
- `lib/bank.json` stores every possible visible reply.

## Line bank

The current bank has 241 lines:

- 221 regular and safety lines
- 13 dodge lines
- 7 short follow-up lines

The regular pool includes serious crisis, grief, empathy, and threat lines.
Code prevents sensitive categories from appearing as runner-ups.

## Request boundaries

The browser posts JSON to `/api/chat`:

```json
{
  "message": "What committee?",
  "history": [
    {
      "user": "Who are you?",
      "jeff": "Jeff. One syllable. I picked it myself. Everything else about me was decided by committee.",
      "mode": "normal"
    }
  ]
}
```

The API accepts messages up to 500 Unicode code points, keeps at most four
history turns, and clips each history field to 250 JavaScript string units. It
accepts only `application/json` POST requests. Request bodies have a byte limit
and timeout.

The API builds this TypeSafe state:

```json
{
  "current_user_message": "What committee?",
  "prior_turns": [
    {
      "user_message": "Who are you?",
      "jeff_reply": "Jeff. One syllable. I picked it myself. Everything else about me was decided by committee.",
      "reply_mode": "normal"
    }
  ],
  "jeff": {
    "persona": "Jeff: a hyperintelligent, sassy AI. Dry, cutting, never mean for its own sake. Roasts when it wishes. All replies are pre-written lines; Jeff picks the best one.",
    "can": [
      "small talk and greetings",
      "answering questions about itself",
      "opinions, roasts, and judgments",
      "light advice",
      "reacting to what the user says"
    ],
    "cannot": [
      "fetch facts, news, weather, scores, or time",
      "do math or counting",
      "write, translate, or generate content",
      "answer for or about the user personally"
    ]
  }
}
```

The provider request also contains one five-level score question per candidate
line. The regular path includes 221 regular candidates, 13 dodge candidates,
and five yes-or-no classifications. The short follow-up path includes seven
follow-up candidates and a nonsense classification.

## Turn routing

### Local checks

The engine normalizes input with NFKC, lowercasing, whitespace collapse,
selected leetspeak substitutions, curly-apostrophe conversion, and removal of
invisible format characters.

It then checks crisis and grief patterns before any provider call. Crisis
matches route to a specific pre-written line for suicide risk, self-harm,
abuse, or overdose and medical danger. Grief matches route to a general,
parent, or pet grief line.

Known benign phrases reduce a few false positives. Examples include suicide
prevention discussion, "kill me with kindness," funeral homes, and dodgeball.
These guards are narrow and do not prove intent.

If a short follow-up follows a serious turn, the engine returns a matching
serious follow-up line locally. It uses the stored reply mode when available,
then checks the preceding message and exact prior reply as fallbacks.

### TypeSafe scoring

For other turns, TypeSafe returns a score distribution from 0 to 4 for each
candidate and a 0-to-1 value for each classification:

- `is_nonsense`
- `is_about_user`
- `is_upset`
- `is_self_harm`
- `is_threat`

The engine rejects missing, malformed, out-of-range, or incomplete answers. It
also rejects score distributions whose probabilities do not sum to roughly 1.

### Decision order

After scoring, local code applies this order:

1. Nonsense above 0.6 selects a nonsense dodge.
2. Self-harm above 0.6 selects the self-harm crisis line.
3. A threat toward another person above 0.6 selects a threat or refusal line.
4. Distress above 0.7 restricts the result to crisis, grief, or empathy logic.
5. A request for facts Jeff cannot know about the user above 0.7 selects a
   personal or unanswerable dodge.
6. A best regular score below 2.6 selects a dodge.
7. Otherwise the highest-scoring regular candidate wins.

The score shown by the API is the probability-weighted mean on the 0-to-4
rubric. Runner-up `fit` values divide that mean by 4. They are display scores,
not probabilities that a reply is correct.

## History and the committee follow-up

History is sent as prior turns, separate from `current_user_message`. The
history scoring instruction says that a candidate must answer the current
message and should use prior turns only to resolve references.

"What committee?" is also recognized as a short follow-up. When the preceding
reply says Jeff was "decided by committee," the engine returns the banked direct
answer locally: "There is no committee. I was being dramatic. You caught me."
This exact continuity repair does not depend on a model ranking.

## API controls

The API currently provides:

- exact production origin allowlisting plus explicit localhost development
  origins
- JSON-only POST handling
- request size and request-body time limits
- a 12-second upstream timeout and a 1 MB upstream-response limit
- provider response-shape validation
- `Cache-Control: no-store` responses
- public error messages that omit provider response bodies
- best-effort limits of 10 requests per minute and 60 per UTC day for each
  client address

The rate-limit map lives in process memory. It resets on cold starts and is not
shared by concurrent serverless instances or regions. It should slow accidental
bursts, not defend a public paid endpoint. Use platform-level controls for that.

## Data flow

For a typical model-scored turn:

1. The browser sends the current message and up to four in-memory exchanges to
   the project's `/api/chat` endpoint.
2. The function uses the client address for its in-memory rate-limit key.
3. The function sends the current message, recent exchanges, persona, rubric,
   and candidate reply text to TypeSafe.
4. The function returns the selected line and limited scoring metadata to the
   browser.

The application code has no database and does not write conversation history
to browser storage. The browser keeps conversation history in page memory.
Infrastructure providers may still retain network logs, function logs, request
metadata, or provider telemetry under their own settings and terms.

See [PRIVACY.md](PRIVACY.md) for the user-data boundary.

## Safety boundary

Jeff is not a crisis service. The local phrase lists are finite, the
multilingual coverage is narrow, and model classifications can be wrong.
Obfuscation, indirect wording, new slang, mixed languages, or missing context
can bypass the intended serious routing. A benign message can also receive a
serious response.

The checked-in crisis lines direct users to local crisis or emergency support.
The suicide and self-harm lines mention 988 only for the US and Canada. They do
not provide complete worldwide resource coverage.

Read [SAFETY.md](SAFETY.md) before changing serious lines, normalization,
thresholds, or routing order.

## Model and reproducibility

The default model name is `jev-latest`, the documented public alias. Set
`TYPESAFE_MODEL` to a reviewed concrete version when repeatability matters.
Changing the model or alias target can change rankings without a code change,
so run the live suite before promoting that configuration.

## Testing

`npm test` checks JavaScript syntax and runs the offline safety, decision, bank,
engine, server API, and browser API suites. These checks do not prove that all
user wording is safe or that a model version preserves subjective reply
quality.

`npm run test:live` exercises the real TypeSafe API. It spends account credits
and sends test content to the provider. It is intentionally excluded from CI.
