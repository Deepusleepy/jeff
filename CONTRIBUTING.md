# Contributing

Jeff is small by design. Keep changes direct and covered by the closest existing
test.

## Before changing code

- Open an issue for a product or behavior change that needs agreement.
- Never commit API keys, environment files, provider responses, user messages,
  production logs, or screenshots containing private data.
- Read [the implementation reference](docs/FINAL_SPEC.md). Read
  [the safety boundary](docs/SAFETY.md) before touching serious routing or copy.

## Development

Use Node.js 20.18.3 or newer.

```sh
npm test
```

The offline suite must pass before a pull request is ready. Add focused cases
for changed behavior. A bug fix should include a case that would have failed
before the fix when practical.

The live suite is optional and must stay out of automated CI:

```sh
TYPESAFE_API_KEY=... npm run test:live
```

It sends test content to TypeSafe and spends account credits. State the model
and the result in the pull request if you run it. Do not paste provider bodies
or credentials.

## Editing the line bank

`lib/bank.json` currently contains 241 entries: 221 regular and safety lines, 13
dodge lines, and 7 follow-up lines.

- Keep IDs unique.
- Keep visible replies as static bank text. Do not add model-generated reply
  text without an explicit product decision.
- Name the topic in lines that could otherwise win unrelated messages.
- Keep crisis, grief, abuse, self-harm, overdose, and threat lines direct.
- Do not expose sensitive categories in runner-ups.
- Update documented counts when the bank changes.

## Pull requests

Keep each pull request focused. Explain the problem, the chosen behavior, the
tests run, and any checks that remain. Update documentation when configuration,
data flow, public responses, thresholds, or operator responsibilities change.

By contributing, you agree that your contribution may be distributed under the
MIT License.
