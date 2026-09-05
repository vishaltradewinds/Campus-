# Privacy & Employment Safeguards

## Candidate consent
Candidate data is not projected to an employer or institution through the browser's direct Firestore writes. Candidate projection is a server-side operation that re-checks the authenticated actor, campaign relationship, student relationship, and explicit campaign consent before writing.

Consent is scope-specific:
- academicDataShared
- skillBenchmarksShared
- projectReposShared
- contactInfoShared

Only approved scopes are copied into a candidate projection. Contact coordinates are excluded unless `contactInfoShared` is true.

## Data minimization
The projection contains only recruitment-relevant identity and the fields authorized by the current consent snapshot. Unverified skill evidence is not copied into the verified-skills projection.

## Auditability
Trusted projection operations create a deterministic audit event in `auditEvents`. Client users cannot create, update, or delete audit events through Firestore Security Rules. The production server must run with a dedicated least-privilege Cloud Run service account that can access Firestore; server client libraries use IAM rather than client Security Rules.

## Employment decisions
AI scores, explanations, and recommendations are decision-support only. They must not be the sole basis for hiring, rejection, compensation, or other employment decisions. Human reviewers remain accountable and must inspect job-relevant evidence.

The system must not infer protected or sensitive personal characteristics. AI fallback or failure states must never be represented as positive candidate evidence.

## Retention and deletion
Production policy must define retention periods for candidate profiles, consent records, opportunities, and audit events by jurisdiction. Deletion requests must remove or irreversibly anonymize personal data where legally required, while preserving only the minimum audit information required by applicable law.

## Legal release gate
Before production launch, the operator must complete jurisdiction-specific legal review covering privacy notice, consent language, candidate/employer terms, data retention/deletion, cross-border transfers, employment and anti-discrimination requirements, and incident/breach notification obligations.

This document is an engineering control baseline, not legal advice.
