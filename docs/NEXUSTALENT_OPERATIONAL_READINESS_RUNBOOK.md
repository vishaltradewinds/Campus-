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

### Firebase target alignment

From the exact reviewed candidate checkout in the intended release environment, run:

```sh
node scripts/check-firebase-target.mjs
```

The current production browser build uses the checked-in public Firebase configuration, not the VITE_FIREBASE_* placeholders. This preflight compares that project, database and authentication API key with the backend runtime environment; it rejects emulator configuration and expiring static OAuth credentials. It must not be treated as evidence of cloud IAM permissions or API key restrictions. Record only the result, exact candidate SHA and environment; never include credential values.

If target alignment fails, stop. Do not substitute a Firebase project, create credentials or deploy automatically. Confirm authorized hosting workspace, intended Firebase tenancy and supported durable workload identity before deployment.

### Durable server authentication

Firestore trusted mutations use Google Application Default Credentials with the datastore OAuth scope. The server obtains and refreshes short-lived access tokens through the official Google Auth client; fixed tokens are rejected except in the isolated unit-test project. The browser's ID token is never used as the Firestore service credential.

For a future non-Google host (including Render), validate a supported workload identity configuration. Prefer federation if supported and feasible; otherwise a separately approved dedicated service-account credential can be mounted as a secret file using GOOGLE_APPLICATION_CREDENTIALS. Never put credential JSON in the repository, frontend build, CI logs or chat. Grant only the required Firestore data-plane permissions in the intended project, not project Owner/Editor. Test that permissions outside the intended scope are denied. Actual IAM configuration, token renewal against Google, credential rotation and secret-file access remain unverified until exercised in an authorized environment.

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

## 6a. Historical data and exact candidate evidence

Before any merge or live pilot, use an independently authorized, complete, normalized offline snapshot containing students, campaigns, calls, opportunities, offers and candidateProfiles. Keep the source private and out of GitHub, CI artifacts and chat.

```sh
node scripts/reconcile-recruitment.mjs snapshot.json
```

Exit status 2 means blocking inconsistencies. Review affected records through an authorized data steward; do not invent historical activation counts or backfill consent. Retained stale snapshots require separate access-control and retention review. The synthetic gate passed against 37 restored records across 14 collections; this does not certify the actual historical database.

Prepare an offline evidence JSON for `scripts/check-release-evidence.mjs`, using the exact PR head and canonical GitHub workflow/review metadata, not manually asserted successful results. Record repository, candidateSha, runs, reviews, prAuthor, prReadyForReview, mainProtected, requiredChecksVerified, requiredIndependentReviewVerified, and external evidence entries (status, candidateSha, evidenceUrl, reviewer). The required external keys are exported by the script.

```sh
node scripts/check-release-evidence.mjs evidence.json
```

This checker validates consistency and completeness only. External evidence and reviewer authority require independent confirmation, and the checker never authorizes deployment. Do not merge a candidate merely to obtain a new SHA while Render auto-deploys main. First verify required checks and independent reviewer protection on main, and control hosting auto-deploy separately with the authorized operator.

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
