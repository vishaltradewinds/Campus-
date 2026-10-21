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
| `POST /api/tenant/employers` and `POST /api/tenant/admin/employers/:employerId/verify` | Recruiter submits employer details and becomes an initial recruiter member; university admin can verify only a PENDING employer; both actions are transactionally audited | Tenant-local PostgreSQL employer, recruiter membership, and append-only employer audit trail | Add independent verification evidence, duplicate-entity screening, rejection/revocation process, HTTP authorization tests, and live staging validation before production use |
| `POST /api/tenant/recruiter/jobs` and `PATCH /api/tenant/recruiter/jobs/:jobId` | Verified-employer recruiters create drafts, edit drafts, publish, and close requisitions; ownership is checked in the tenant DB and every lifecycle change is transactionally audited | Tenant-local PostgreSQL requisitions and append-only lifecycle audit | HTTP authorization integration tests now cover recruiter create/publish and denial cases; add concurrent transition tests, live staging DB validation, and reviewed employer verification policy before production |
| `GET /api/tenant/recruiter/jobs` | Resolves tenant, verifies Firebase identity, requires RECRUITER membership, and returns only requisitions belonging to employer memberships whose employer is VERIFIED | Tenant-local PostgreSQL employer membership and requisitions | Add HTTP-level authorization tests, authorized live-staging DB validation, and employer verification governance before recruiter write workflows |
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
3. **Student application path:** a first application endpoint now records an explicit consent version and prevents duplicate applications using the database unique constraint, including concurrent duplicate handling. A tenant-local published consent registry and transactionally written application audit event are now implemented; the audit table rejects UPDATE/DELETE at the database layer. Controlled university-admin publication/retirement and student withdrawal endpoints now exist. Remaining gates are live PostgreSQL behavior tests, database-role/privilege verification, institutional privacy/legal review, and operational reconciliation before production use.
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

Validation now includes disposable PostgreSQL integration assertions for append-only triggers and runtime-role restrictions, plus unit tests for policy draft/publish/retire rules. Remaining gates: prove transaction rollback under failure, exercise these admin routes over HTTP with authorization tests, verify production role grants independently, and obtain institution-specific legal/privacy approval of actual consent wording before any real deployment. No consent wording or legal approval is supplied by this engineering change.


## Consent withdrawal implementation checkpoint (2026-10-21)

- Added `POST /api/tenant/consent-withdrawals`, guarded by tenant resolution, Firebase identity verification, rate limiting, and active `STUDENT` membership.
- A student can record withdrawal against a previously published or retired `JOB_APPLICATION` consent version. The withdrawal is durable, append-only, and idempotent; duplicate submissions return the existing withdrawal.
- New applications against a withdrawn version are rejected. Existing applications and their audit records are retained; withdrawal does not silently delete or rewrite historical records.
- The tenant PostgreSQL integration suite now attempts UPDATE/DELETE against withdrawal records and attempts audit-trigger bypass using the restricted runtime role. These assertions run only in disposable CI PostgreSQL, not production.
- Institutional legal/privacy owners must define what withdrawal means for previously submitted applications, lawful retention, employer disclosure, and any deletion or restriction request. This code does not make that legal decision or erase existing application data.
- The current workflow has no student-facing consent UI or a formal re-consent UX. Publishing a new consent version and requiring a fresh affirmative application action is the current technical route for future submissions after withdrawal.


## Consent concurrency hardening checkpoint (2026-10-21)

- Application submission and consent withdrawal now take the same PostgreSQL transaction-scoped advisory lock keyed by the authenticated subject and `JOB_APPLICATION` purpose before checking withdrawal state or recording the withdrawal. This gives concurrent requests a defined serialization point instead of relying only on an application-layer pre-check.
- Added a database partial unique index allowing at most one `PUBLISHED` consent policy per purpose per tenant schema, as defense in depth against concurrent administrators publishing different drafts.
- Unit tests assert that both workflows take the matching lock; disposable PostgreSQL integration tests exercise trigger protection and least-privilege runtime credentials.
- CI and Production Gate passed for the preceding consent batch; these new concurrency changes are a new candidate and require fresh CI, PostgreSQL integration, staging smoke, and Production Gate results before being considered verified.
- Advisory locking assumes all application/withdrawal writes use the intended PostgreSQL runtime path. Direct privileged SQL, alternate services, and production role grants still require independent review. No live production credential or production database has been used for this validation.


## Recruiter read-path checkpoint (2026-10-21)

- Added `GET /api/tenant/recruiter/jobs`, guarded by the tenant resolver, Firebase ID-token verification, rate limiting, and active tenant `RECRUITER` membership.
- The data query scopes requisitions to employer IDs derived from the authenticated subject's `EmployerRecruiter` memberships and requires employer verification status `VERIFIED`. It does not accept employer IDs from request parameters.
- Results are capped at 100 and include aggregate application counts only; candidate-level data is not exposed by this endpoint.
- Unit tests cover multiple employer memberships, duplicate membership rows, no verified employer scope, and missing identity.
- This is a recruiter read-only slice, not the complete employer portal. Employer onboarding and requisition create/edit/publish/close now have initial tenant-scoped implementations with audit trails. Independent legal verification, candidate-level access controls, placement transitions, and live staging database validation remain incomplete.


## Employer onboarding lifecycle checkpoint (2026-10-21)

- Added `POST /api/tenant/employers`, guarded by tenant resolution, Firebase ID-token verification, rate limiting, and active `RECRUITER` membership. It creates a `PENDING` employer, adds the submitting identity as a recruiter member, and records `ONBOARDING_SUBMITTED` in the same transaction.
- Added `POST /api/tenant/admin/employers/:employerId/verify`, guarded by active `UNIVERSITY_ADMIN` membership. It transitions only `PENDING` employers to `VERIFIED` and records the verifying identity in the same transaction. Repeated verification is rejected.
- Added a tenant-local employer audit table and database trigger that rejects UPDATE/DELETE. PostgreSQL integration tests now exercise the append-only behavior, including attempts made using a tenant runtime role.
- Verification is currently an authorized university-admin action, not automated proof that a company is legally registered. The workflow does not yet collect or independently validate CIN/GSTIN, official registry records, delegated authority, or evidence documents; institutions must define and approve that evidence policy. Rejection, suspension/revocation, duplicate-entity review, and reviewer evidence capture remain required before production onboarding.
- These routes implement an initial lifecycle slice only. They do not constitute production employer verification or certification.


## Recruiter requisition lifecycle checkpoint (2026-10-21)

- Added `POST /api/tenant/recruiter/jobs` to create a DRAFT requisition only for a recruiter membership associated with a VERIFIED employer in the current tenant schema.
- Added `PATCH /api/tenant/recruiter/jobs/:jobId` with explicit `edit`, `publish`, and `close` actions. Drafts can be edited; only valid drafts can publish; only published requisitions can close. Published and closed requisitions cannot be edited or reopened by this workflow.
- The ownership/verified-employer check and requisition mutation occur inside a tenant database transaction. Each state change writes an append-only audit event in the same transaction.
- Added a tenant migration and PostgreSQL integration assertions for audit immutability, including runtime-role tampering attempts. Added unit regression tests for ownership, invalid input, transitions, and audit creation.
- The workflow does not yet provide employer legal verification evidence, rejection/suspension, candidate shortlisting, interview scheduling, offer issuance, or hiring-outcome workflows. HTTP-level auth tests and authorized live staging DB tests remain release gates.


## Consent lifecycle race-condition fix (2026-10-21)

- Application submission now acquires a purpose-level consent lifecycle advisory lock inside its transaction and re-reads the exact requested consent version after acquiring that lock. If the policy was retired or replaced after the initial pre-check, the transaction refuses the application.
- Consent publish and retire operations acquire the same purpose-level lock, serializing policy state changes with application consent revalidation. Application submission then acquires the per-student purpose lock shared with withdrawal handling, preserving a consistent lock order.
- Added regression coverage for the policy becoming unavailable between the initial check and the transactional re-check, plus lock assertions for policy publication/retirement.
- The latest code candidate is under fresh CI and production-gate validation. This does not substitute for a production concurrency rehearsal or review of database role grants.

## Current candidate verification posture (2026-10-21)

- Latest code changes are on branch `feat/nexustalent-multitenant-foundation`; PR #29 remains draft and unmerged.
- Staging smoke verifies the public health endpoint only. It does not prove live tenant DB routing, tenant isolation, or migrated workflow correctness.
- Production certification remains OFF. The remaining program includes the unported legacy Firestore workflows, official employer verification evidence and rejection/revocation, candidate shortlisting/interviews/offers, institution-approved privacy/legal policy, production tenant provisioning and routing, data migration/reconciliation, backup/restore and rollback rehearsal, load/concurrency/security tests, monitoring, and explicit human release approval.


## Recruiter candidate decision batch (2026-10-21)

- Added `PATCH /api/tenant/recruiter/jobs/:jobId/applications/:applicationId/decision`, protected by tenant resolution, Firebase ID-token verification, rate limiting, and active `RECRUITER` membership.
- The service verifies the requisition exists in the resolved tenant, then verifies the authenticated recruiter is a member of the requisition's verified employer. Application ID and requisition ID must match; caller-supplied employer ownership is not trusted.
- Only `APPLIED` applications can transition to `SHORTLISTED` or `REJECTED`. A conditional database update prevents stale concurrent decisions; application state change and append-only audit event are written in one transaction.
- Added service tests for employer/requisition scoping, allowed and invalid transitions, stale update conflicts, and audit creation; added HTTP integration tests for active recruiter authorization, student denial, inactive membership/identity denial, unknown host, and missing authentication.
- This is not a full placement workflow. Candidate access/listing, interview scheduling, assessments, offer issuance, hiring outcomes, employer review/appeal, and student notification remain unimplemented. Human/institutional policy must define rejection retention and candidate communication before production use.


## Privacy-minimized recruiter application list (2026-10-21)

- Added `GET /api/tenant/recruiter/jobs/:jobId/applications`, guarded by tenant resolution, Firebase identity verification, rate limiting, and active `RECRUITER` membership.
- The handler verifies that the recruiter is associated with the requisition's `VERIFIED` employer in the resolved tenant. The query is scoped to that requisition, sorted newest-first, and capped at 100 records.
- The response deliberately exposes only application ID, application status, application timestamp, and consent version. It omits student subject, contact details, and profile fields until the institution approves the candidate-disclosure policy and the platform implements the required data-access controls.
- Added service and HTTP integration tests for tenant/employer scope, denial paths, result cap/query shape, and omission of direct student identity fields.
- This enables the recruiter decision workflow to discover application IDs without opening broader candidate PII access. It is not a substitute for institution-approved disclosure, retention, access logging, and student communication policies.


## Interview scheduling batch (2026-10-21)

- Added tenant-local `application_interviews` and append-only `application_interview_audit_events` tables, including foreign keys, indexes, duration/mode/status constraints, unique request IDs, audit immutability, and a database guard against deleting interview records.
- Recruiters can schedule interviews only for shortlisted applications belonging to requisitions owned by their verified employer membership. Scheduling validates future time, duration, mode, and required online join URL or in-person location. A request ID provides idempotent retries and detects conflicting reuse.
- Recruiters can cancel scheduled interviews; status changes use conditional updates and append an audit event in the same transaction. Interview history is not deleted.
- Students have a tenant-scoped `GET /api/tenant/students/me/interviews` endpoint that returns only scheduled interviews associated with their authenticated subject, including employer/job display labels and joining/location details.
- Added unit tests, HTTP integration tests for tenant/role boundaries, and disposable PostgreSQL assertions for audit immutability and interview deletion protection.
- Operational limitations remain: no email/SMS/calendar delivery, student accept/decline, rescheduling workflow, interviewer roster, time-zone UX, conflict detection, or institution-approved interview retention/notice policy. The current endpoint stores a schedule; it does not prove that an invitation was delivered or accepted.


## Employer decision and revocation controls (2026-10-21)

- Added university-admin-only `POST /api/tenant/admin/employers/:employerId/reject`, `/suspend`, and `/revoke` routes. Rejection is permitted only from PENDING; suspension only from VERIFIED; revocation from VERIFIED or SUSPENDED. Each transition uses a conditional database update so stale concurrent decisions fail closed.
- A bounded reason and evidence reference are required and stored in the append-only employer audit event. The reference is recorded evidence metadata; the service does not claim to verify an external company registry or independently validate the evidence.
- Employer verification now also uses a conditional PENDING -> VERIFIED update. This reduces the chance of conflicting status changes from racing requests.
- Added unit tests for status transitions, invalid state changes, evidence metadata, and input validation, plus HTTP integration tests for admin-only access and tenant/authentication denial paths.
- Production still requires an institution-approved evidence policy, authoritative-source verification, duplicate-entity screening, independent review, and operational handling of appeal/reinstatement. The new routes are controls, not proof that a company is legally valid.


## Offer issuance and student response batch (2026-10-21)

- Added tenant-local `application_offers` and append-only `application_offer_audit_events`, including foreign keys, unique request IDs, expiry/status/response constraints, immutable audit triggers, and a database guard against deleting offer records.
- A verified-employer recruiter can issue an offer only to an application in `SHORTLISTED` state. Offer issuance and the application transition to `OFFERED` are transactional; both offer and application audit trails are written together. Request IDs provide idempotent retries and reject conflicting reuse.
- The authenticated student can list only their own offers and accept or decline an unexpired offer. Response and application state transitions are conditional and transactional; expiry is recorded when a student attempts to respond to an expired offer. Duplicate same-decision responses are idempotent.
- The platform stores an employer-provided offer reference and document reference. It does not draft, sign, validate, or legally execute the offer document, and it does not assert that an offer was delivered outside the platform.
- Added unit tests, HTTP role/tenant integration tests, and disposable PostgreSQL assertions for audit immutability and offer deletion protection.
- Recruiters can now withdraw an issued offer with a bounded reason; the offer and application states plus both audit trails update transactionally. Remaining operational/legal requirements include employer offer-authority policy, candidate disclosure/retention approval, offer reissue, scheduled expiry processing, notifications and delivery receipts, electronic signature integration if required, and joining/outcome reconciliation. Acceptance recorded here is a platform response event, not a cryptographic signature or independent legal validation.


## Joining outcome and placement evidence (2026-10-21)

- Added nullable joining-outcome fields to tenant job applications and a database check constraint: `JOINED` requires a joining date, timestamp, recording actor, and reason; `NOT_JOINED` requires actor/timestamp/reason and forbids a joining date. Other application states must not carry final outcome fields.
- A recruiter can record `JOINED` or `NOT_JOINED` only for an application in `OFFER_ACCEPTED`, and only if they belong to the requisition's verified employer in the resolved tenant. A bounded reason is mandatory; `JOINED` also requires a non-future date.
- The conditional status update and append-only application audit event are written in one transaction. A database-backed integration assertion verifies that a JOINED status without outcome evidence is rejected.
- This records an employer-reported outcome; it does not independently verify employment or government placement statistics. Pan-India reporting still requires institution-approved definitions, evidence standards, deduplication, and reconciliation with authoritative placement records.

## Student application status view (2026-10-21)

- Added `GET /api/tenant/students/me/applications`, protected by tenant resolution, Firebase identity verification, rate limiting, and active `STUDENT` tenant membership.
- The query is scoped exclusively to the authenticated Firebase subject within the resolved tenant schema, requires a tenant-local student profile, sorts newest-first, and caps results at 100.
- The response exposes the student's own application status, application timestamp, consent version, recorded joining outcome/reason if present, and job/employer display labels. It does not expose other students' data or recruiter-only application lists.
- Added regression tests for subject scoping, no-profile behavior, result cap/query shape, and avoiding direct subject identifiers in the response.
- This is a backend API slice; the student UI, end-to-end browser validation, institutional disclosure/retention policy, and live staging tenant-database validation remain release gates.
