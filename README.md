# Jeff

A chatbot that cannot write. Every reply is a pre-written line, picked by
[TypeSafe's Jev](https://docs.typesafe.ai), a model that returns calibrated
judgments instead of generated text. Zero generation, zero hallucination.

Live: https://askjeff.vercel.app (private demo)

## How it works

One turn, one Jev call:

1. Safety nets (deterministic regexes) check for crisis, grief, and harassment
   first. Crisis and grief messages get straight, serious pre-written answers
   with no model call at all.
2. Otherwise every line in the bank (233) is scored against the message in a
   single parallel Jev request, plus four yes/no checks: nonsense, personal
   question, distress, threat.
3. The decision cascade picks the winner: dodge on nonsense or low fit,
   threat/refusal lines on threats, an empathy lock on real distress, and the
   best-scoring line otherwise.
4. The response includes the winner, its score, runner-up lines, and the raw
   noul values, which the UI shows in the "watch him think" sidebar.

Full design and threshold history: [docs/FINAL_SPEC.md](docs/FINAL_SPEC.md).

## Project layout

    index.html          static frontend (no build step)
    styles/main.css     all styling, themeable via data-theme
    src/                frontend modules (entry: src/main.js)
    api/chat.js         Vercel serverless function, holds the API key
    lib/                engine shared by api and tests (bank, safety, decide)
    lib/bank.json       the 233 pre-written lines
    test/               safety + decision unit tests, live API tests
    docs/               design spec

## Run tests

    node test/safety.test.mjs     # deterministic safety nets (no API)
    node test/decide.test.mjs     # decision cascade (no API)
    node test/bank.test.mjs       # bank shape invariants (no API)
    TYPESAFE_API_KEY=... node test/live.test.mjs [--full]   # real API

## Local development

    # any static server from the project root, e.g.
    python3 -m http.server 8642
    # /api/chat needs a function runtime; use `vercel dev` for the full stack.

## Deploy (Vercel)

1. Import the repo, framework preset "Other".
2. Set `TYPESAFE_API_KEY` in project environment variables.
3. Deploy. `vercel.json` carries the security headers; `api/chat.js` is the
   only function.

## Editing the bank

Lines live in `lib/bank.json`. Rules learned the hard way (see spec):

- Put the topic words in the line text. Lines that keep winning contests they
  should lose are super-stimuli; anchor them.
- Crisis and grief lines are straight, never jokes, and anchored to their
  topic so they cannot leak into ordinary sadness.
- After any edit run the three offline test suites.
