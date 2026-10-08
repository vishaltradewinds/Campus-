# Production Operations Exercise Runbook

## Before enabling production

1. Confirm dedicated least-privilege runtime identity.
2. Confirm Firebase API-key restrictions and authorized domains.
3. Confirm production payment secrets are stored outside source control.
4. Confirm monitored security contact.
5. Confirm production-edge rate limiting.
6. Confirm backup schedule and retention.
7. Confirm rollback target and last-known-good release.

## Reliability exercises

### Load
Run representative employer, institution and student read/write traffic against a non-production environment and record p50/p95/p99 latency, error rate, CPU/memory and Firestore contention.

### Backup / restore
Restore the latest approved Firestore backup into an isolated environment. Verify:
- tenant isolation;
- recruitment state integrity;
- consent state;
- evidence lineage;
- invoice/billing event immutability.

### Rollback
Deploy a known-good artifact, execute health and synthetic journey checks, introduce a controlled application regression in staging, roll back, then verify health and data invariants.

### Dependency failure
Exercise:
- Firebase Auth unavailable;
- Firestore transient failure;
- AI provider unavailable;
- payment provider timeout;
- payment webhook replay;
- malformed payment webhook.

Expected behavior is fail-closed for authorization/payment settlement and deterministic fallback for optional AI assistance.

## Incident / credential rotation

Rotate Firebase/API/payment secrets in a controlled non-production rehearsal, verify old credentials fail, verify new credentials work, and record the operator/time/evidence in the release record.

This runbook is intentionally executable but cannot be marked exercised without the actual runtime environment and operator credentials.
