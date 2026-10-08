# Privacy & Employment Safeguards

## Candidate consent

Candidate data is not projected to an employer or institution through browser-controlled writes. Candidate projection is server-side and re-checks actor, campaign relationship, student relationship, and explicit campaign consent.

Consent is scope-specific:
- academicDataShared
- skillBenchmarksShared
- projectReposShared
- contactInfoShared

## Career Passport evidence

Evidence has a controlled lifecycle:
`submitted -> under_review -> verified/rejected`, with `verified -> expired` and `expired -> under_review` for re-verification.

Verified evidence requires authoritative provenance and a current, non-expired validity window. Evidence lineage is updated on each review action. Students can open disputes; authorized reviewers resolve disputes without deleting the historical evidence record.

Candidate projections expose only currently verified, non-expired evidence relevant to an approved consent scope.

## Data minimization

The projection contains only recruitment-relevant identity and fields authorized by the current consent snapshot. Unverified or expired evidence is not treated as verified evidence.

## Auditability

Trusted evidence, projection, recruitment and commercial operations create immutable audit/billing events. Clients cannot create, update or delete audit events through Firestore Security Rules.

## Employment decisions

AI scores and explanations are decision-support only. They must not be the sole basis for hiring, rejection, compensation or other employment decisions. Human reviewers remain accountable and must inspect job-relevant evidence.

The system must not infer protected or sensitive personal characteristics. AI failure must never become positive candidate evidence.

## Retention and deletion

Production policy must define retention periods for candidate profiles, consent records, opportunities, evidence, disputes and audit events by jurisdiction. Deletion requests must remove or irreversibly anonymize personal data where legally required while preserving only the minimum lawful audit record.

## Legal release gate

Before production launch, the operator must complete jurisdiction-specific legal review covering privacy notice, consent language, candidate/employer terms, data retention/deletion, cross-border transfers, employment and anti-discrimination requirements, and incident/breach notification obligations.

This document is an engineering control baseline, not legal advice.
