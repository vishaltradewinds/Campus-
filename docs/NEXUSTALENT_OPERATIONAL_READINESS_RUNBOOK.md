# NexusTalent Operational Readiness Runbook

## Purpose

This runbook defines the evidence-first procedure for moving NexusTalent from controlled-pilot/staging to an approved live pilot and, later, production. It does not substitute implementation or approval evidence.

## Release candidate

Record the exact Git commit SHA, CI gate run, deployment ID/URL, environment, operator, and timestamp before each exercise.

## 1. Pre-flight

- Confirm the release candidate is the intended `main` commit.
- Confirm the NexusTalent Production Gate is green for that commit.
- Confirm Firebase/Auth and Firestore configuration belongs to the intended environment.
- Confirm no real candidate PII is present in test data.
- Confirm secrets are injected outside source control.
- Confirm an owner is assigned for support, security incident response, and release rollback.

## 2. Live pilot acceptance

Create only controlled test identities:

1. Employer
2. Institution
3. Student

Execute and record:

`requirement -> campaign -> call -> consent -> assessment -> offer -> joining`

Also execute:

- consent revocation followed by a candidate projection access attempt;
- candidate evidence correction/dispute;
- audit reconstruction of the complete recruitment journey;
- employer rejection path;
- assessment evidence authorization;
- offer record creation and ownership checks.

Capture timestamps, IDs, expected result, observed result, and screenshots/log references. Do not enter real candidate PII until the pilot gate is explicitly approved.

## 3. Reliability exercises

### Load/capacity

Run a controlled load test against a non-production environment first. Record:

- concurrent users/requests;
- duration;
- p50/p95/p99 latency;
- error rate;
- CPU/memory;
- database read/write pressure;
- rate-limit behavior;
- recovery after the test.

Define pass/fail thresholds before execution. A script existing is not evidence that the load gate passed.

### Backup/restore

1. Establish a known test dataset.
2. Capture the applicable Firebase/Firestore backup/export evidence.
3. Restore into an isolated test environment.
4. Verify record counts, ownership, consent state, audit lineage, and critical workflow state.
5. Record RPO/RTO observed.
6. Preserve the restore evidence.

Do not restore over live production data during the first exercise.

### Rollback

1. Identify the last known-good deployment.
2. Deploy the release candidate.
3. Exercise rollback using the hosting provider's supported mechanism.
4. Verify health endpoint and critical read/write paths.
5. Record rollback time and resulting deployment ID.
6. Confirm database/schema compatibility.

### Dependency failure

Exercise controlled failure of external dependencies such as authentication, payment/webhook, AI provider, or other required service. Verify the platform fails closed where authorization/evidence is concerned, surfaces an actionable error, and does not create partial authoritative state.

## 4. Security operations

Before live pilot approval, verify:

- production least-privilege credentials;
- Firebase/API key restrictions;
- rate-limit strategy;
- monitoring and alerting;
- security contact;
- incident/credential-rotation procedure.

Never paste production secrets into GitHub issues, commits, chat, or client-side source.

## 5. Privacy and employment safeguards

Obtain attributable approval/evidence for:

- privacy notice;
- retention/deletion schedule;
- candidate/employer/institution terms;
- deployment-jurisdiction employment and anti-discrimination review;
- breach/incident notification procedure.

The platform's AI outputs remain decision support and must not be treated as an autonomous hiring decision.

## 6. Deployment access blocker protocol

If hosting access returns HTTP 401/403:

1. Record the exact project, account/team, operation, timestamp, and request/error ID.
2. Do not disable deployment protection merely to force release.
3. Verify the authenticated account and team.
4. Verify the repository/project linkage and deployment target.
5. Use the hosting provider's authorized CLI/integration only when the operator has the required permission.
6. Re-run the deployment after access is corrected.
7. Attach the resulting deployment ID and smoke-test evidence to the release gate.

An access failure is an infrastructure gate failure, not an application-quality failure.

## 7. Final evidence packet

For each release candidate preserve:

- Git commit SHA;
- CI run/job IDs;
- deployment ID and URL;
- configuration/secrets verification record (without secret values);
- pilot test results;
- load/capacity results;
- backup/restore results;
- rollback results;
- dependency-failure results;
- security/privacy/legal approvals;
- incident/support ownership;
- final release decision.

Only then may the release classification be changed.
