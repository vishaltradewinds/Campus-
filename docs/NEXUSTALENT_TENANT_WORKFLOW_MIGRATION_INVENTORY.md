# NexusTalent — Tenant Workflow Migration Inventory

**Status:** Engineering plan; not a production certification.
**Branch:** `feat/nexustalent-multitenant-foundation`
**Governing standard:** [Shakti Standards batched engineering execution rule](./SHAKTI_STANDARDS_BATCHED_ENGINEERING_RULE.md)

## Verified current API surface

Inspection of `server.ts` shows these explicit application routes at the current checkpoint:

| Route | Current behavior / dependency | Tenant-aware PostgreSQL status | Migration requirement |
|---|---|---|---|
| `GET /api/tenant/context` | Resolves tenant host, verifies Firebase identity, checks membership | Control-plane tenant context only | Retain; expand tests as shared middleware evolves |
| `GET /api/tenant/students/me` | Resolves tenant, verifies identity, requires STUDENT membership, reads the authenticated student's profile | First tenant-scoped student read | Retain; add authorized live-staging integration |
| `GET /api/tenant/jobs` | Resolves tenant, verifies identity, requires STUDENT membership, lists published open jobs filtered by profile graduation year/programme | First tenant-scoped student discovery workflow | Verify eligibility semantics, add HTTP-level tests and authorized live-staging database validation |
| `POST /api/tenant/consent-withdrawals` | Resolves tenant, verifies Firebase identity, requires STUDENT membership, records an append-only withdrawal against a previously published consent version; new applications using that version are blocked | Tenant-local PostgreSQL withdrawal ledger | Test route-level student authorization, idempotency, database trigger enforcement, and the institution’s handling of already-submitted applications |
| `POST /api/tenant/admin/consent-policies` and `/:policyId/publish`, `/:policyId/retire` | Requires active UNIVERSITY_ADMIN membership; draft, independent publication, and retirement are audited | Tenant-local PostgreSQL consent registry and append-only audit | Test route-level authorization and database trigger enforcement |
| `POST /api/tenant/jobs/:jobId/applications` | Resolves tenant, verifies identity, requires STUDENT membership, validates profile/job eligibility and job window, records consent version, prevents duplicate applications | First tenant-scoped student write workflow | Add live staging integration, application audit-event model, and operational idempotency/reconciliation policy |
| `POST /api/candidate-projections` | Existing trusted backend / Firestore workflow | Not migrated | Design tenant-aware consent and employer/campaign boundaries before porting |
| `POST /api/career-evidence` | Existing trusted backend / Firestore workflow | Not migrated | Define evidence lineage, authority, dispute, and audit mapping before porting |
| `POST /api/recruitment/transitions` | Existing trusted backend / Firestore workflow | Not migrated | Map the transition state machine, actor roles, idempotency, and audit trail |
| `POST /api/profile/mutations` | Existing trusted backend / Firestore workflow | Not migrated | Map action-by-action ownership/role policy and data model |
| `POST /api/commercial/razorpay/order` | Commercial campaign/order flow | Not migrated to tenant schema | Preserve payment integrity and explicitly define tenant ownership before migration |
| `POST /api/commercial/razorpay/webhook` | Payment provider webhook | Not migrated to tenant schema | Preserve signature verification, idempotency, and reconciliation |
| `POST /api/gemini/parse-demand` | AI demand parsing | Not tenant-scoped | Define tenant authorization, data handling, quotas, and retention before accepting institutional data |
| `POST /api/gemini/match-insights` | AI matching insights | Not tenant-scoped | Define consent, tenant boundary, model-provider disclosure, and audit requirements |
| `GET /api/health` | Public health endpoint | Not applicable | Keep minimal; health success is not tenant-readiness evidence |
| `GET *` | Frontend fallback | Not applicable | Keep routing behavior separate from API authorization |

This inventory reflects explicit Express route registrations in the reviewed server file; it does not claim every frontend action or Firestore access path has been exhaustively mapped. A full client call-site and data-flow audit remains required before any legacy path is considered migrated.

## Required migration order

1. **Foundation and evidence:** finish Module 1 resolver, authorization, client lifecycle, schema isolation, provisioning lifecycle, audit design, and HTTP integration coverage.
2. **Student read path:** validate profile reads against authorized staging PostgreSQL; then add tenant-scoped job discovery using the checked-in schema and explicit eligibility rules.
3. **Student application path:** a first application endpoint now records an explicit consent version and prevents duplicate applications using the database unique constraint, including concurrent duplicate handling. A tenant-local published consent registry and transactionally written application audit event are now implemented; the audit table rejects UPDATE/DELETE at the database layer. Still add the controlled administrative publication workflow, consent withdrawal handling, live PostgreSQL behavior tests, database-role/privilege verification, and operational reconciliation before production use.
4. **Employer/recruiter path:** define employer ownership and recruiter membership per tenant; enforce tenant membership on requisition creation and lifecycle changes.
5. **Placement transitions and evidence:** migrate state transitions and career evidence only after authoritative-source, dispute, expiry, privacy, and audit invariants are specified and covered.
6. **Commercial and AI boundaries:** establish explicit tenant ownership, data minimization, payment reconciliation, webhook idempotency, model-provider policy, quotas, and audit controls before migrating these workflows.
7. **Data migration and coexistence:** create per-entity migration/reconciliation plans, immutable source references, duplicate handling, rollback strategy, and a defined dual-read/write cutover policy. Do not silently dual-write.
8. **Release assurance:** independent review, live authorized staging database rehearsal, migration/restore and failure-injection tests, rate/connection/load testing, monitoring/alerting, security/privacy/compliance sign-off, and explicit human approval.

## Shakti execution rule

Implement related requirements in coherent batches, run targeted checks when they materially reduce risk, and run the full required suite at meaningful checkpoints against the exact final candidate commit. Fix failures by root cause. Never treat a passing build or health endpoint as proof of full platform readiness. Production routing and certification remain blocked until all applicable gates pass.

## Known hard boundaries

- Existing trusted backend flows still use Firebase/Firestore. This foundation does not migrate their data or behavior automatically.
- The current HTTP integration tests use injected identity/profile dependencies; they do not prove external Firebase token verification against a live service or live staging PostgreSQL behavior.
- CI PostgreSQL integration uses disposable test infrastructure. It does not prove production credentials, TLS, tenant provisioning, backup/restore, or load capacity.
- PR #29 remains draft and unmerged until implementation, verification, review, and approval gates are satisfied.


## Student application implementation checkpoint (2026-10-21)

- Added `POST /api/tenant/jobs/:jobId/applications`, guarded by tenant host resolution, Firebase identity verification, and active `STUDENT` membership.
- The service validates the student profile, job publication/closing window, graduation-year/programme eligibility, and a non-empty bounded consent-version identifier before creating an application.
- Duplicate applications are returned idempotently. The unique constraint on `(requisition_id, student_subject)` is relied on for race safety; a concurrent uniqueness conflict is re-read and returns the existing application.
- Added `tests/tenantStudentApplications.test.ts` to cover creation, duplicate replay, ineligibility, closed/unpublished jobs, missing profile, invalid consent/subject, and a simulated unique-constraint race.
- **Explicit limitation:** the current tenant schema does not yet contain an append-only application audit-event table, formal consent text/version registry, or consent withdrawal workflow. Those are required before enterprise production release; this endpoint is an engineering increment, not production certification.


## Consent registry and application audit batch (2026-10-21)

- Added tenant-local `application_consent_policies` with purpose, version, full consent content, content hash, publication status, effective time, and retirement time.
- New applications now require a matching `JOB_APPLICATION` policy that is `PUBLISHED`, effective, and not retired. An arbitrary client-supplied version is no longer accepted.
- Application creation and `APPLICATION_SUBMITTED` audit-event creation execute inside one PostgreSQL transaction. The event records the authenticated actor, application ID, consent version/hash, tenant ID, requisition ID, and timestamp.
- Added `job_application_audit_events` with database trigger protection against UPDATE and DELETE. The runtime code exposes no audit mutation endpoint.
- **Still not production-ready:** there is no controlled admin UI/API for publishing and retiring consent versions, no consent withdrawal workflow, and no staging test yet proving trigger enforcement and transaction rollback against PostgreSQL. Consent wording and legal basis must be reviewed and approved by the responsible institution; no legal text has been invented or approved by this engineering change.
- Deployment must apply the migration to each tenant schema through the authorized migration identity and verify that runtime database grants cannot bypass the append-only guard. The migration has not been applied to production.


## Controlled consent administration batch (2026-10-21)

New university-admin endpoints:
- `POST /api/tenant/admin/consent-policies` — create a tenant-local draft with version, content, and effective time. Content is SHA-256 hashed server-side.
- `POST /api/tenant/admin/consent-policies/:policyId/publish` — publish only an effective draft; a different university administrator must publish it from the one who created it. A prior published policy for the same purpose is retired in the same transaction.
- `POST /api/tenant/admin/consent-policies/:policyId/retire` — retire a published policy.

All routes require Firebase identity verification and an active `UNIVERSITY_ADMIN` membership. Policy lifecycle actions are recorded in a dedicated append-only audit table. Draft creation plus its audit event and publication/retirement plus their audit events are transactional. Database triggers reject update/delete on audit records and prevent consent policy content, version, purpose, effective time, or creator from being altered; policy deletion is rejected. Publication actor is recorded separately.

Remaining validation gates: execute the migration in disposable PostgreSQL integration tests; prove transaction rollback and trigger enforcement; verify runtime-role privileges cannot disable triggers or bypass append-only semantics; exercise routes over HTTP with authorization tests; and obtain institution-specific legal/privacy approval of the actual consent wording before any real deployment. No consent wording or legal approval is supplied by this engineering change.


## Consent withdrawal implementation checkpoint (2026-10-21)

- Added `POST /api/tenant/consent-withdrawals`, guarded by tenant resolution, Firebase identity verification, rate limiting, and active `STUDENT` membership.
- A student can record withdrawal against a previously published or retired `JOB_APPLICATION` consent version. The withdrawal is durable, append-only, and idempotent; duplicate submissions return the existing withdrawal.
- New applications against a withdrawn version are rejected. Existing applications and their audit records are retained; withdrawal does not silently delete or rewrite historical records.
- The tenant PostgreSQL integration suite now attempts UPDATE/DELETE against withdrawal records and attempts audit-trigger bypass using the restricted runtime role. These assertions run only in disposable CI PostgreSQL, not production.
- Institutional legal/privacy owners must define what withdrawal means for previously submitted applications, lawful retention, employer disclosure, and any deletion or restriction request. This code does not make that legal decision or erase existing application data.
- The current workflow has no student-facing consent UI or a formal re-consent UX. Publishing a new consent version and requiring a fresh affirmative application action is the current technical route for future submissions after withdrawal.
