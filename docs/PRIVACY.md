# Privacy and data flow

This document describes what the checked-in Jeff application does with user
data. It is an implementation note, not a legal privacy policy. Anyone who
operates a public copy must review the policies and retention settings of their
hosting and TypeSafe accounts.

## Data sent on each turn

The browser sends these fields to `/api/chat`:

- the current message, limited to 500 Unicode code points
- up to four recent exchanges
- the reply mode for a prior exchange when the browser has it

The API trims each prior user message and Jeff reply to 250 characters before
building the provider request.

Most turns send the following data from the server to TypeSafe:

- the current message
- the recent exchanges described above
- Jeff's fixed persona and capability description
- the scoring rubric
- the candidate lines from `lib/bank.json`

Deterministic crisis and grief matches do not call TypeSafe. A short follow-up
to a recognized serious exchange can also stay local.

## Storage in this application

The browser keeps the conversation in page memory and does not intentionally
persist it. Resetting the conversation or starting a new page load clears the
application's in-memory copy. Jeff stores the selected theme in `localStorage`
and stores whether the power-on animation has run in `sessionStorage`. Neither
value contains message text.

The checked-in server code has no conversation database. It keeps recent
request timestamps and daily counts in process memory under a client-address
key for rate limiting. That map can live until the serverless instance stops.

These facts do not mean that a deployment has no logs. The browser, network,
hosting provider, function runtime, and TypeSafe may process or retain request
content, IP addresses, timestamps, headers, error details, or account telemetry.
Their behavior depends on the operator's configuration and provider terms.

## What users should not send

Do not submit passwords, API keys, financial details, private health records,
precise location, or other sensitive personal information. Recent messages may
be repeated in later provider requests as conversation context.

## Operator checklist

Before offering Jeff as a public service:

- document the deployed hosting and model providers
- review provider retention, training, and regional-processing settings
- set log retention to the minimum needed for operations
- restrict who can read function and provider logs
- redact message content from new logs and error reporting
- publish a privacy notice appropriate to the operator and its users
- provide a contact or process for privacy requests

The repository does not supply legal text for a specific operator or
jurisdiction.
