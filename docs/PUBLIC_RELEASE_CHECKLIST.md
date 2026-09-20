# Public release checklist

This list separates source publication from operating a public, paid endpoint.
Publishing the source does not require deploying the service.

## Repository

- Confirm that `LICENSE` contains the intended MIT license and copyright name.
- Search the complete Git history, not only the current files, for credentials,
  local paths, private URLs, exported logs, and user data.
- Enable GitHub secret scanning and push protection if the repository plan
  supports them.
- Enable private vulnerability reporting under the repository Security
  settings.
- Add a ruleset for the default branch that requires pull requests and the CI
  workflow. Decide who may bypass it.
- Confirm the issue forms and pull request template match the maintenance plan.
- Check repository description, topics, homepage, and social preview before
  changing visibility.
- Make the repository public only as a separate, deliberate action.

## Credentials and providers

- Use a production TypeSafe key that is separate from local and preview keys.
- Rotate any key that has appeared in logs, screenshots, shell history, Git
  history, or a client-side bundle.
- Store the key only in server-side environment settings.
- Review TypeSafe retention, account access, model version, quotas, and billing
  alerts.
- Review hosting log retention, team access, regional settings, and incident
  alerts.

## Public endpoint

- Add platform-level rate limiting or a gateway quota. The process-memory limit
  in `api/chat.js` is not global.
- Add a spending ceiling or alert that does not depend on application memory.
- Set `ALLOWED_ORIGINS` to the exact production origins. Test an allowed origin,
  an attacker-controlled lookalike origin, and a request without an Origin
  header.
- Confirm the deployed `VERCEL_URL` and custom-domain behavior.
- Verify that oversized, timed-out, malformed, and unsupported requests fail
  without a provider call when expected.
- Check function logs to confirm provider bodies, credentials, and user message
  content are not logged by application code.
- Decide whether direct non-browser clients are allowed. CORS is a browser
  control, not authentication.

## Product checks

- Run `npm test` on the final commit.
- Run `npm run test:live` against the intended model and account. This spends
  credits and sends the test messages to TypeSafe.
- Exercise the complete browser flow on desktop and mobile widths.
- Test keyboard-only use, focus visibility, reduced motion, sidebar dismissal,
  error recovery, reset, and long replies.
- Recheck the committee follow-up and serious follow-ups with actual history.
- Review every crisis, grief, abuse, overdose, self-harm, and threat line.
- Confirm runner-ups never expose sensitive lines.
- Confirm the visible privacy and entertainment notices match the deployed data
  flow.

## Public documentation

- Replace operator-neutral privacy notes with the deployed operator's legal
  privacy notice where required.
- Publish a private contact process for privacy and conduct reports.
- Confirm GitHub private vulnerability reporting is available before directing
  researchers to it.
- Do not claim complete safety, clinical validation, zero hallucinations, no
  logging, or no data retention.
