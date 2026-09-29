# NexusTalent — Campus Talent Exchange OS

## Product
NexusTalent is a campus talent exchange platform connecting Employers, Institutions, and Students for verified, consent-aware campus hiring.

**Readiness status: STAGING / CONTROLLED PILOT.** The repository contains security hardening, but it is not represented as production-ready until the required security, rules, build, deployment, privacy, and operational gates are actually verified.

## Architecture
**Frontend**: React (Vite, TypeScript, Tailwind CSS)
**Backend API**: Express (Node.js server)
**Database**: Firebase Firestore
**Authentication**: Firebase Authentication
**AI Integration**: Zero-cost AI router — deterministic fallback by default, optional Gemini Free Tier, or local Ollama/open model.

## Local development
1. Clone the repository.
2. Install dependencies with `npm ci`.
3. Create `.env` from `.env.example`.
4. Run `npm run dev`.

## Environment variables
- `GEMINI_API_KEY`: server-side only; never expose it to the browser.
- `FIREBASE_WEB_API_KEY`: Firebase Identity Toolkit API key used by the backend to verify ID tokens.
- `VITE_FIREBASE_API_KEY` and the other `VITE_FIREBASE_*` values: Firebase client configuration.

Never commit real secrets, service-account keys, or production credentials.

## Firebase security
`firestore.rules` provides role- and ownership-based access control. Student private records are not directly readable by employers. Employer candidate views should use consent-scoped candidate projections rather than exposing the complete student passport.

Before production, validate the rules with the Firebase Emulator and automated allow/deny tests, including cross-tenant access attempts and consent revocation.

## Zero-cost AI architecture
AI is cost-gated by design:
- `AI_MODE=fallback` is the default and makes no external model/API calls.
- `AI_MODE=gemini-free` is allowed only when `AI_ZERO_COST_ACK=true` and `GEMINI_API_KEY` is present. Use only a Gemini API project/account configured for the Free Tier; Google documents free input/output tokens and limited model access on its Free tier.
- `AI_MODE=ollama` uses a locally hosted open model and makes no hosted-model API call.
- If the selected model is unavailable or returns invalid JSON, NexusTalent falls back to deterministic, human-review-required behavior.
- No AI feature is permitted to become an autonomous employment decision.

For a strict ₹0 controlled pilot, keep `AI_MODE=fallback` or use `AI_MODE=ollama` on a machine you already own. Gemini Free Tier is an optional zero-API-spend path, but its quota is not unlimited and its availability/pricing rules can change.
## Production gate
Do not label the system production-ready until all of the following are demonstrated in CI/staging:
- clean `npm ci`, lint, build, and start;
- Firebase Emulator security-rule tests;
- consent projection and revocation tests;
- atomic/transactional workflow updates where concurrent writes are possible;
- immutable audit/event records for sensitive workflow changes;
- Cloud Run health/readiness and load testing;
- production secrets and quotas configured outside source control;
- privacy, data-retention, and employment-law review completed for the deployment jurisdictions.

## Health check
`GET /api/health` returns a lightweight service health response. Platform-level readiness, dependency health, and monitoring should be configured separately for production.

## Testing
Run:
```bash
npm ci
npm run lint
npm run build
npm run start
```

Security-rule tests should also be run against the Firebase Emulator before any production release.
