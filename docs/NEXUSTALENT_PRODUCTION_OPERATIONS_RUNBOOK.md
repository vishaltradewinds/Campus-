# NexusTalent Production Operations & Assurance Runbook

Status: **Production-readiness baseline; execution evidence still required before production declaration**

## 1. Scope

This runbook governs controlled operation after engineering release. It deliberately separates:
- product correctness,
- security/privacy approval,
- deployment,
- live operations.

Deployment is not part of this workstream.

## 2. Release gates

A release candidate is eligible for controlled pilot only when CI, security rules, regression tests, evidence workflow tests, build, and container smoke pass.

Production requires additional operational evidence:
- monitoring and alerting active;
- least-privilege credentials verified;
- secrets/quotas configured;
- backup/restore tested;
- rollback tested;
- capacity/load tested;
- incident response exercised;
- support owner and SLOs approved.

## 3. Observability minimum

Track at minimum:
- request count, latency and error rate by endpoint;
- authentication failures;
- authorization denials;
- recruitment transition failures;
- candidate-projection denials;
- consent changes;
- verification decisions;
- AI failures/fallbacks;
- rate-limit events;
- dependency/service failures.

Security and audit logs must not become an unrestricted analytics store.

## 4. Alert classes

**P0:** suspected unauthorized access, tenant isolation failure, audit integrity failure.

**P1:** sustained API failure, authentication outage, recruitment transition corruption, consent enforcement failure.

**P2:** degraded latency, dependency instability, non-critical workflow failures.

Every P0/P1 event requires an owner, timestamped investigation, containment, evidence preservation, credential review where applicable, and post-incident corrective action.

## 5. Recovery

### Backup/restore
Before production:
1. define Firestore backup/export policy;
2. execute a restore into an isolated test environment;
3. verify tenant boundaries and audit records;
4. record restore duration and data-loss window;
5. approve the result.

### Rollback
Before production:
1. identify last known-good release;
2. execute rollback in a controlled environment;
3. verify health, authentication, rules and critical workflows;
4. verify no duplicate recruitment events;
5. record recovery time.

## 6. Capacity

The load test must exercise:
- authenticated reads;
- requirement/campaign creation;
- calls;
- consent;
- candidate projection;
- stage transitions;
- audit writes.

Measure p50/p95/p99 latency, error rate, concurrency ceiling and recovery after saturation. The production capacity limit must be documented from evidence, not assumed.

## 7. Dependency failure

Test:
- Firebase/API timeout;
- AI provider unavailable;
- invalid AI response;
- Firestore transaction conflict;
- duplicate request;
- network interruption.

Required behavior is fail-safe, deterministic where possible, replay-safe, and never converts failure into positive hiring evidence.

## 8. Incident response

Minimum lifecycle:
**Detect → Triage → Contain → Preserve evidence → Recover → Verify → Notify where legally required → Correct → Post-incident review**

Credential rotation must be tested before production and documented without storing credentials in the repository.

## 9. Support

Production approval must name:
- technical owner;
- security contact;
- product owner;
- privacy/legal escalation owner;
- support response targets.

## 10. Evidence rule

A checkbox is not evidence. Each gate must point to a reproducible test result, configuration record, approval, or incident/recovery exercise.

This runbook does not claim production readiness by itself.
