# Jeff

Jeff is a chatbot whose visible replies come from a checked-in line bank. It
uses [TypeSafe Jev](https://docs.typesafe.ai) to rank candidate replies and
classify the current message. The model does not write Jeff's reply.

That design limits the output to reviewed text. It does not guarantee that
Jeff will choose the right line or understand the message correctly.

## How a turn works

1. Local safety rules check the normalized message for crisis and grief
   phrases. A match returns a serious line without calling TypeSafe.
2. A short follow-up to a serious exchange also returns a serious line without
   a model call.
3. Other messages go to the serverless API. The API sends the current message,
   up to four recent turns, Jeff's persona, and the candidate lines to TypeSafe.
4. TypeSafe scores the candidates and classifies nonsense, personal questions,
   distress, self-harm, and threats toward other people.
5. Local decision code applies the safety and fit thresholds, then returns one
   line from the bank.

The bank currently contains 241 lines: 221 regular and safety lines, 13 dodge
lines, and 7 short follow-up lines. See
[the implementation reference](docs/FINAL_SPEC.md) for the routing details.

## Project layout

```text
index.html          Static frontend
styles/main.css     Layout, themes, and responsive styles
src/                Browser modules
api/chat.js         Vercel function and TypeSafe client
lib/                Line bank, safety rules, scoring questions, and decisions
test/               Offline unit tests and opt-in live tests
docs/               Implementation, privacy, safety, and release notes
```

## Requirements

- Node.js 20.18.3 or newer
- A TypeSafe API key for real responses
- A function runtime for `/api/chat`, such as Vercel's local development server

Copy `.env.example` to `.env.local` and set the key there. Do not put secrets in
client-side JavaScript or commit an environment file.

```dotenv
TYPESAFE_API_KEY=your_key_here
```

Configuration:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | Yes | Server-side credential for TypeSafe |
| `TYPESAFE_MODEL` | No | Model name. Defaults to the documented `jev-latest` alias |
| `ALLOWED_ORIGINS` | No | Comma-separated exact origins added to the API allowlist |

Localhost origins with an explicit port are allowed during development. The API
also allows `https://askjeff.vercel.app` and the current `VERCEL_URL` when that
environment variable is present.

## Run and test

Use a static server for frontend-only work. Use a function runtime to exercise
the complete flow.

```sh
python3 -m http.server 8642
# or, for the frontend and /api/chat together
vercel dev
```

The default test command is offline and does not use a TypeSafe key or account
credits.

```sh
npm test
```

The live suite sends its test messages and scoring questions to TypeSafe. It
makes a paid API request for each case that is not handled locally. Run it only
when you intend to spend account credits.

```sh
TYPESAFE_API_KEY=... npm run test:live
```

## Privacy and safety

Do not enter secrets, credentials, or sensitive personal information. The
browser sends the current message and up to four recent exchanges to this
project's API. Most turns are then sent to TypeSafe for scoring. Hosting and
provider infrastructure may keep its own logs or telemetry.

Jeff is an entertainment project, not an emergency, medical, mental-health, or
legal service. Its safety routing uses finite rules plus model classifications
and can miss or misclassify messages. See [privacy](docs/PRIVACY.md) and
[safety](docs/SAFETY.md) for the exact boundaries.

## Public deployment

The function has a best-effort in-memory limit of 10 requests per minute and 60
per UTC day for each client address. Serverless instances do not share that
memory, and a restart clears it. This is not a global abuse or cost control.
Before exposing the endpoint publicly, add platform-level rate limits, spending
alerts, and an upstream quota. Complete the
[public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md) as well.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing the bank or safety
routing. Report security problems through the private process in
[SECURITY.md](SECURITY.md).

## License

Jeff is available under the [MIT License](LICENSE).
