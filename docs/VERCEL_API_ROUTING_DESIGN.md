# NexusTalent Vercel API routing — proposed change

Status: **Draft / requires review; not deployed or production-certified.**

## Evidence and intent

On 2026-10-24, live checks observed the Vercel alias `campus-coral-one.vercel.app/api/health` returning 404 and a preview `/api/health` returning frontend HTML. Direct `https://nexustalent-zero-cost-v2.onrender.com/api/health` returned HTTP 200 JSON on a successful retry. The frontend uses same-origin `/api/...` calls, while the existing `vercel.json` had no API rewrite.

This proposed routing rule proxies `/api/*` only when the incoming host is exactly `campus-coral-one.vercel.app` to the observed Render service origin. It deliberately does **not** route Vercel preview hosts to that service, because preview mutations must not be sent to production data.

## Limitations and required release checks

- The Vercel `campus` project and domain mapping could not be inspected through the currently authorized Vercel connector. Confirm that the alias is attached to this project before merge.
- Confirm the Render service is the approved API target for the controlled pilot and that its data/environment is appropriate for the alias.
- This exact-host rule will not cover any other production/custom domains. Add them only after ownership and intended environment are verified.
- Preview deployments remain intentionally unconnected; they need a separately provisioned staging API and host/environment routing before end-to-end preview tests can pass.
- Test the Vercel preview deployment after the rule is available: `/api/health` must return JSON with status 200 on the production alias. Test a known authenticated route, an unknown `/api/*` route (404 JSON from the PR #34 backend change), and a frontend client-side route (HTML). Do not test mutating endpoints with real user data.
- Validate ingress/client-IP attribution, rate limiting, security headers/CSP, monitoring, rollback and human approval before any production release.

## Safety

This is a draft configuration proposal only. No Vercel project settings, aliases, secrets, deployments, billing, or production data were changed by this commit. Production certification remains OFF.
