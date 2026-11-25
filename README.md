# NexusTalent — Campus Talent Exchange OS

## Product
NexusTalent is a campus talent exchange platform connecting Employers, Institutions, and Students for verified, consent-aware campus hiring.

**Readiness status: STAGING / CONTROLLED PILOT.** The repository contains security hardening, but it is not represented as production-ready until the required product, security, privacy, engineering, deployment, and operational gates are actually verified.

## Product design baseline

The authoritative product baseline is:
- `docs/NEXUSTALENT_PRODUCT_PRODUCTION_BLUEPRINT.md` — operating model, lifecycle, Career Passport, evidence/verification, matching, consent, commercial model, UX, analytics, AI boundary, and production gates.
- `docs/NEXUSTALENT_PRODUCTION_RELEASE_GATE.md` — evidence-based release checklist.

Product freeze means new changes must be deliberate, versioned, and checked against these documents. Product design completion does not itself constitute legal approval or production deployment.

## Architecture
**Frontend**: React (Vite, TypeScript, Tailwind CSS)
**Backend API**: Express (Node.js server)
**Database**: Firebase Firestore
**Authentication**: Firebase Authentication
**AI Integration**: External model processing is disabled; manual demand entry and authorized human candidate review are available.

## Local development
1. Clone the repository.
2. Install dependencies with `npm ci`.
3. Create `.env` from `.env.example`.
4. Run `npm run dev`.

## Environment variables
- `FIREBASE_WEB_API_KEY`: Firebase Identity Toolkit API key used by the backend to verify ID tokens.
- `VITE_FIREBASE_API_KEY` and the other `VITE_FIREBASE_*` values: Firebase client configuration.

Never commit real secrets, service-account keys, or production credentials.

## Firebase security
`firestore.rules` provides role- and ownership-based access control. Student private records are not directly readable by employers. Employer candidate views should use consent-scoped candidate projections rather than exposing the complete student passport.

Before production, validate the rules with the Firebase Emulator and automated allow/deny tests, including cross-tenant access attempts and consent revocation.

## AI processing boundary
The hosted and local model forwarding paths are removed from this candidate. Both legacy AI API routes return an authenticated hold response; no provider credentials or mode switches are required. The manual recruitment workflow remains available. Reopening external processing requires documented provider/privacy approval, verified employer authority, job-related input minimization, current consent where applicable, and accountable human review. See `docs/AI_HIRING_POLICY.md`.

## Production gate
Do not label the system production-ready until the release gate is closed with evidence. The gate covers:
- product acceptance and Career Passport/evidence workflows;
- clean `npm ci`, lint, build, and start;
- Firebase Emulator security-rule tests;
- consent projection and revocation tests;
- atomic/transactional workflow updates;
- immutable audit/event records;
- load/reliability testing;
- production secrets and quotas outside source control;
- privacy, data-retention, and employment-law review;
- live controlled-pilot validation;
- monitoring, support, rollback, and incident response.

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
