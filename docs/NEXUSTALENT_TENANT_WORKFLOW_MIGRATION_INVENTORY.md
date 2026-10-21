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
3. **Student application path:** a first application endpoint now records an explicit consent version and prevents duplicate applications using the database unique constraint, including concurrent duplicate handling. Still add an append-only tenant audit event, define consent text/version governance and withdrawal handling, test live PostgreSQL behavior, and specify operational reconciliation before production use.
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
