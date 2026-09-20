# Security policy

## Supported version

Security fixes are made on the default branch. Older commits and third-party
deployments may not receive fixes.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/Deepusleepy/jeff/security/advisories/new).
Do not include exploit details, credentials, private user data, or an unpatched
vulnerability in a public issue.

If GitHub does not show the private reporting form, do not publish the details.
The repository must enable private vulnerability reporting before public
release. No security email address is currently published.

Include the affected revision, impact, reproduction steps, and any suggested
fix. Remove real credentials and personal data from the report. The project
does not promise a response or fix deadline.

## In scope

- exposure of `TYPESAFE_API_KEY` or other server credentials
- origin, request-validation, or rate-limit bypasses that increase paid API use
- injection or browser vulnerabilities in user messages or provider responses
- leakage of conversation content through application logs or responses
- bypasses that expose crisis, grief, threat, abuse, or self-harm lines as
  ordinary runner-ups
- dependency or deployment configuration flaws in this repository

Model quality disagreements and missed jokes are not security problems. A
repeatable safety-routing failure may still be important. Report it privately
when public details could put users at risk.

## Deployment responsibility

The built-in rate limit lives in serverless process memory. Operators must add
global abuse controls, provider quotas, spending alerts, access restrictions,
and log-retention settings suitable for their deployment.
