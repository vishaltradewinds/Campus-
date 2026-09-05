# NexusTalent Production Readiness Gate

**Current status: NO-GO for unrestricted production PII. STAGING / CONTROLLED PILOT ONLY.**

## Verified in repository
- Backend uses the Cloud Run `PORT` environment variable with a safe local fallback.
- AI endpoints require Firebase authentication and have request-size/rate-limit controls.
- Firestore rules separate authenticated roles and ownership; employers do not directly read private student passports.
- Candidate visibility is intended to use consent-scoped projections.
- Privileged `super_admin` access is no longer based on a hard-coded email allowlist.
- AI matching is advisory and explicitly requires human review.

## Release gates still required
1. Run clean `npm ci`, `npm run lint`, `npm run build`, and `npm run start` in CI.
2. Run Firebase Emulator tests for every sensitive collection and explicit cross-tenant deny cases.
3. Test consent grant, scope reduction, and revocation against `candidateProfiles`.
4. Move sensitive workflow mutations to atomic/transactional operations where concurrent updates can occur.
5. Ensure candidate projection creation is server-authorized and cannot be forged by a student.
6. Constrain recruitment-stage transitions by role and allowed state transitions.
7. Add immutable audit/event records for verification, consent, stage, offer, and placement changes.
8. Minimize/redact PII before sending any profile data to Gemini.
9. Configure Cloud Run ingress, secrets, quotas, logging, alerting, and edge rate limiting.
10. Complete privacy/data-retention and employment-law review for each deployment jurisdiction.

Do not change this status to production-ready until the gates above have evidence in CI/staging.