# NexusTalent: PostgreSQL transition — 22 November 2026

CEO decision: use Neon instead of Firestore for NexusTalent, with no surprise billing. Target is a single authoritative PostgreSQL database. The existing Firestore database remains the current source until verified cutover. Do not dual-write, duplicate historical data speculatively, delete the source, or change other platforms.

## Provisioned and verified

- Neon organization Free, project nexustalent (rough-butterfly-67822299), branch main (br-rapid-brook-b3bqvuxx), database nexustalent, PostgreSQL 16.16, AWS Singapore, co-located region with Render.
- Fixed 0.25 CU minimum and maximum. Provider controls idle suspension on Free; explicit timeout override was refused, so the provider default was retained. No keepalive, paid plan, paid AI, Realtime, or other optional add-on.
- 1 GiB observed logical size limit. Published current free allowance: 100 CU-hours per project per month; limit/usage and plan must be checked before operation. Free capacity is not a production SLA.
- Migration 001 applied transactionally to the new empty target; all 21 Firestore rule-defined roots represented via a path-keyed JSONB compatibility table. This is a transitional PostgreSQL data model, not proof of complete mapping of existing records.
- Forced RLS; NOLOGIN NOBYPASSRLS runtime group nexustalent_api, no row policies yet. Runtime read/write is deliberately denied. Migration owner bypasses RLS and must NEVER be used as the application credential.
- Synthetic foundation test executed in real Neon PostgreSQL and rolled back; identity mismatch rejected, revision incremented, audit mutation rejected, restricted role saw zero records and insert denied. Post-test count 0, forced RLS true, restricted role true, zero policies. No real student or employer data accessed.
- No credentials retrieved or configured; Render stays on existing deployed revision, auto-deploy disabled. No migration or cutover.

## Implementation sequence

1. Implement a PostgreSQL transaction adapter preserving existing backend atomicity, actor-role checks, idempotency and audit semantics. Use a server-only least-privilege login, not the owner. Translate all trusted mutations and reads. RLS policies must be reviewed and tested with the actual runtime role; keep the database inaccessible otherwise.
2. Replace all direct browser Firestore reads and writes with authenticated, scoped backend APIs (including registration, directories, dashboards, candidate consent, evidence, reporting and admin). Preserve registration atomicity. No browser database credentials or arbitrary collection/query endpoint. Prefer bounded fetches and explicit refresh to always-on polling.
3. Retain Firebase Auth temporarily for identity verification only, preserving existing UID and session claims. Auth is not a second application database. Evaluate Neon Auth separately only if necessary; do not implicitly migrate passwords or bulk identities from the shared Google project.
4. Obtain supported, authorized source-specific historical export and Auth membership evidence. Reconcile full typed snapshots and nested paths, map source types explicitly, quarantine unsupported or mismatched records without silently coercing. The existing Firebase-to-Firebase checker is not a PostgreSQL cutover certificate; implement cross-engine comparison. Review index/path size, JSONB type conversions, unique business relationships and immutable tradeoffs before migration.
5. Verify PostgreSQL integration, rollback, concurrency, role-specific negative tests, privacy/consent, backup/restore, bounded free-tier usage and institutional pilot. Freeze source writes before the one controlled cutover; never activate simultaneous writers. Deploy only after independent review.

References: https://neon.com/blog/neon-free-plan-1-gb-per-project ; https://neon.com/blog/how-to-make-the-most-of-neons-free-plan
## Transaction adapter checkpoint

The server-side PostgreSQL record adapter now reuses the trusted recruitment business operations with serializable transactions, bound SQL, atomic audit insert, and bounded connection/statement limits. Selection is test-only: explicit integration flag, NODE_ENV=test, loopback target, exact database and restricted role. Unknown or premature production selection fails startup; no automatic fallback after PostgreSQL is selected. The initial live target has no row policies, so it remains locked. The disposable PostgreSQL CI uses explicitly labelled fixture policies solely for testing the transaction engine; these policies must never be applied to Neon. Actual actor-scoped RLS and API replacement for all browser Firestore operations are still required. Legacy data remains authoritative until migration, reconciliation and independent cutover acceptance; only then delete the exact obsolete NexusTalent Firestore database and retire its code. Do not delete shared Firebase Auth or other platform resources.
## Scoped read RLS candidate

Migration 002 is a review candidate, not applied to live Neon. It creates separate NOLOGIN, NOBYPASSRLS reader and account-role resolver groups. The resolver sees only the bound actor's account and returns its stored role, not a caller-provided role. Its security-definer function has a fixed search path and restricted execute grants. The reader has SELECT only and cannot inherit mutation or resolver privileges. Workspace and career evidence queue queries use a separate read-only serializable transaction, binding the verified actor UID and admin claim transaction-locally. The disposable PostgreSQL CI tests direct SQL denial, admin claim separation and scope reset on rollback. The role can set its own session variables: this is defense in depth behind the trusted server, not a standalone identity provider or protection against compromise of the server database credential. The mutation/registration/assessment/projection transaction adapter still requires its own production-safe access model. CI fixture policies remain disposable only and must never be deployed. No live migration 002, login creation, data copy or cutover authorized by this checkpoint.
## Insert-only registration writer candidate

Migration 003 introduces a separate scoped registrar group for the registration transaction. It cannot update/delete rows or insert recruitment/billing records. The trusted API binds the requested ordinary role, authenticated UID and token email transaction-locally; the database checks actor ownership, role pairing, pending verification and deterministic audit IDs. The adapter inserts without upsert. Companion writes are atomic in the existing server transaction; the policies do not guarantee completeness of an arbitrary direct SQL transaction or validate every business field, and the server credential must stay private. No cloud login or migration activated. Other mutation operations still use the disposable test writer and require further production-safe policies.
## Employer demand writer candidate

Migration 004 isolates CREATE_REQUIREMENT_CAMPAIGN and SEND_CALLS using a dedicated server-only role. The transaction binds authenticated UID, action and request ID; the database resolves the actor role itself, limits reads to own demand records and eligible directory records, prohibits deletion, limits inserts by action and audit identity, and restricts campaign updates to invitation fields and the corresponding count. The adapter does not upsert new demand records; an existing campaign update must affect exactly one row. Direct SQL tests cover cross-tenant access, forged audit IDs, other collections, wrong role, mutation of unrelated fields and context reset. This is defense in depth; exact campaign/call relationships, eligibility, input fields and atomic companion writes remain validated by the trusted backend, not a complete database-only business engine. Other recruitment transitions, commercial and profile mutations still require separate production-safe roles. Migration is CI-only pending review; no live permissions or deployment.

## Institution response and activation writer candidate

Migration 005 introduces a separate institutional writer bound to actor UID, action, call ID and request ID. A restricted resolver derives the linked campaign from the owned call, and opportunity insertion checks verified institutional affiliation and deterministic identity. The adapter uses exact-row updates for existing calls and campaigns and inserts new opportunities and audit records without upsert. Trigger checks constrain response fields, activation counts and the permitted funnel changes. The server still enforces academic criteria, full business rules and atomic companion operations; these policies are not a standalone business engine. Disposable CI exercises direct negative access and real backend workflows. No live migration or credential activation.

## Student consent writer candidate

Migration 006 separates GLOBAL_CONSENT, UPDATE_CONSENT_SCOPE and SUBMIT_CONSENT into a server-only role, using transaction-local actor/action/request and application opportunity context. It permits only own student consent updates, bound opportunity and associated campaign funnel changes, and deterministic audit inserts. New global approvals require an own invitation; additional disclosure scope cannot be granted by global approval. Exact-row updates prevent upserts. Trusted server remains responsible for complete business validation and atomic companion writes. No live activation. Other stage and commercial/profile mutations remain unscoped in disposable tests only.

## Assessment submission writer candidate

Migration 007 scopes ADVANCE_CANDIDATE_STAGE when nextStage is assessment_completed to the authenticated actor, opportunity and request. It restricts changes to assessment stage/evidence metadata and the assessment funnel count. A submission must match the deterministic opportunity-derived ID, student, campaign, employer, template and response hash; it is pending review, insert-only, and cannot self-score or alter offers. Server sharing checks remain authoritative. The trusted server owns atomic companion operations; production remains blocked. Fixed migration 006's malformed negative-test JSON literal without weakening policy.

## Offer progression and acceptance writer candidate

Migration 008 scopes shortlisting, interviewing, offer issuance and student acceptance. The bound opportunity resolves the exact stakeholder and campaign, verifies employer consent before progression, restricts stage and funnel fields, validates deterministic offer identity and INR salary, and prevents a student from rewriting offer terms. No joining or billing permission. The employer-side trusted server can read the exact linked student for consent verification; no browser access to the credential. The server still owns companion-write completeness. Fixed a SQL operator-precedence error in assessment trigger 007; no weakening of authorization. Production remains locked.

## Joining writer candidate

Migration 009 restricts joining confirmation to the exact employer or institution opportunity. It binds placement, offer and campaign updates to the accepted offer, and validates the earned success fee against its salary and deterministic opportunity ID. The fee is an internal accrual only; the role cannot create invoices, mark payments, or invoke a payment provider. Existing fee records on non-joined opportunities block the transition for reconciliation; exact request replay remains read-only. All companion writes still use the trusted server's transaction. No live migration or production role activation.

## Commercial hold and account-read isolation

Commercial campaign estimates use the existing PostgreSQL scoped reader, with fixed authenticated actor, stored role, exact campaign identity and ownership. Missing and foreign campaigns return the same authorization denial. Account lookup also uses the scoped reader. No commercial mutation roles have been created. The inactive invoice creation implementation and webhook mutation implementation were removed; both provider order and webhook endpoints return HTTP 503 COMMERCIAL_HOLD, irrespective of configured provider secrets. Do not acknowledge historical payment events as processed: reconcile any existing provider activity and previously issued records before separate commercial approval. Internal earned success fees remain part of the joining transaction, not invoices or settlements. No source or destination commercial records were deleted, no provider account or live service was changed. Tests cover the hold and read-only estimates.

## Stakeholder verification writer candidate

Migration 010 adds a dedicated, exact-target verification role for employer, institution and student verification. Every profile mutation by a stored super_admin now also requires a server-verified Firebase admin claim, including replay; browser payloads cannot grant this claim. Institutional verification is restricted to the associated student and an empanelled authority. Database triggers restrict changes to verification fields, protect unrelated profile attributes, and require institutional evidence notes. Remaining academic corrections, role changes and evidence mutations still require their own scoped writers. No live migration, credential or deployment.

## Academic correction writer candidate

Migration 011 binds an academic request to the student and a review to the exact correction, verified administrator claim or empanelled institution and its affiliated student. It validates the proposed fields and prior values, prevents direct academic changes and stale approvals, and requires the student snapshot to exactly match the reviewed correction, resetting verification and revoking every previous campaign consent on approval. Historical placement and recruitment records cannot be modified by this role. CI uses synthetic fixtures; actual evidence review remains a human and trusted-server responsibility. No live migration or permission activation. Remaining profile, candidate projection and evidence writes still require scoped authorization.

## Career evidence writer candidate
Migration 012 binds submission, verification and disputes to the exact evidence and authenticated actor. Student submissions cannot be self-certified; only existing institution/employer authority records are supported for new verification, until a separately validated platform/provider source registry exists. Verified evidence linking is limited to its student; source and claim provenance are immutable during review. Admin claim required for review/resolution. No live data or deployment; remaining profile and projection/read scope and migration reconciliation remain release gates.

## Candidate disclosure scope
Migration 013 adds a dedicated server-only disclosure role and a NOLOGIN resolver with a fixed security-definer function. It derives exact campaign/student/opportunity authorization from current invitation-bound consent and validates the assessment binding and response hash before permitting assessment reads. Assessment transactions are read-only; candidate snapshots are full replacements under a fixed key with current scope checks and immutable audit insertion. The resolver has SELECT access to the five context collections under transaction context; its credential is never provisioned or granted to the application. The trusted API continues to construct the projected values and enforce replay and expiry. This is a CI candidate, not deployment. Remaining profile and authoritative migration gates are retained.

## Remaining ordinary profile mutations
Migration 014 scopes all remaining profile actions, including independent-candidate creation. Admin role changes cannot promote/demote super_admin or modify self; changes conflicting with existing stakeholder profiles require reconciliation. Institution availability requires empanelment and bounded records. Unknown PostgreSQL profile/recruitment actions fail closed rather than using general writer. Trusted recruitment account check uses the existing scoped reader. Registration directory is the remaining known general-purpose read path and must be isolated before removing the CI-only broad runtime role from the application. No live data changes.

## Elimination of general-purpose application access
Migration 015 introduces a registration-directory function-only role. Its NOLOGIN resolver sees only empanelled institutions and emits ID/name/code; the API login cannot SELECT raw records or invoke the general role resolver. The application no longer creates the broad PostgreSQL fixture store or can begin an unscoped PostgreSQL transaction. Scoped transaction operations use the already-open transaction's client, regardless of which scoped pool created it. Integration CI imports the backend with the broad fixture URL absent, then restores it solely for synthetic setup/assertions. More than 100 directory entries fail closed pending pagination. Production mode remains blocked; actual historical export, typed reconciliation, role grants, cutover validation and independent review remain necessary. No database or hosting changes.

## Offline cross-engine content reconciliation

The read-only scripts/reconcile-postgres.mjs compares an authorized Firestore REST snapshot against an independently exported PostgreSQL snapshot with format nexustalent-postgres-snapshot-v1, all 21 collection names in collections, and records containing document_path and payload. It reports counts only. JSON-compatible scalars, arrays and maps are compared after deterministic key ordering; safe integers and finite doubles share JSON numeric semantics. Unsafe integers, negative zero, special doubles, timestamps, references, bytes, geopoints, nested document paths and unknown roots block cutover rather than being silently converted. No source or target connection, import, identity verification, completeness attestation or cutover authorization is performed. Independent extraction must preserve numeric precision and verify inventory, identities, constraints and snapshot provenance. This is a content check, not a replacement for the release gate.

## Offline import preflight

Run node scripts/validate-postgres-import.mjs authorized-snapshot.json before any rehearsal. The validator reuses the typed conversion rules, checks principal and stakeholder path identity against migration 001, and rejects payloads above a conservative 1 MiB rehearsal limit. It outputs counts only and cannot authorize or perform an import. Unsupported types remain blocked pending field-specific mapping and evidence; no source extraction or production data access was performed. Independent source completeness, business relationship checks, actual PostgreSQL constraints and transactional rollback must still be verified.

## Disposable import transaction rehearsal

CI executes db/neon/tests/import_rehearsal.sql immediately after foundation migration and before fixture grants. It requires the empty nexustalent_ci database and postgres CI identity. Synthetic student, institution and employer records exercise identity constraints, an explicit affiliation join, duplicate rejection, atomic failure of a multi-row insert, and full rollback to zero records. This is not a production importer or full relationship validation. Local Docker daemon was unavailable; actual execution requires CI evidence. No live data or database changes.

## Stakeholder relationship import gate

Offline preflight now checks institutional affiliations where present, campaign employers and institutional targets, call stakeholders, recruitment path identity and the existing six-collection recruitment reconciliation controls (opportunities, offers, consent and projections). Findings are aggregate counts only. Independent candidates without an affiliation are permitted. This is not complete referential integrity or authenticated runtime acceptance; source completeness, all other collection links and CI remain separate gates.

## Identity provider separation

The HTTP authentication boundary now returns a provider-neutral verified principal including server-derived administrator authority. Explicit unknown provider modes fail startup; Firebase remains the only enabled adapter until a replacement passes identity, sign-in, revocation, role and recovery acceptance. Existing account API clients use a structural token interface. No authentication migration or new provider provisioned; browser sign-in and legacy data paths still use Firebase. Six local identity tests passed; local full typecheck is blocked by missing pg dependency in the workstation install. CI remains mandatory.

## PostgreSQL session identity foundation

Migration 016 introduces a separate identity schema in the same PostgreSQL database. A function-only reader resolves SHA-256 hashes of canonical opaque 256-bit session tokens and denies expired, revoked and disabled principals. The resolver cannot write or own application records; direct session and principal access is denied to the reader. Admin authority is stored separately from ordinary roles. The TypeScript adapter remains unwired pending a safe runtime connection gate, credential issuance, sign-in, browser session handling, logout and recovery. No live schema or provider activation. Nine targeted local identity tests passed; disposable PostgreSQL SQL tests are wired into CI and pending execution.

## Credential and session issuance candidate

Migration 017 introduces a function-only credential login role for ordinary pre-provisioned principals, with salted scrypt hashes, conditional session issuance and revocation. The adapter uses 256-bit random opaque session tokens, stores only digests and performs dummy verification for missing credentials. Administrator password login is deliberately blocked. The trusted login service can retrieve individual password hashes and issue sessions; compromise of its database credential is therefore a privileged security event. This is not a public registration, recovery, rate-limited HTTP login or browser integration. Concurrency, bounded hashing resource usage, credential recovery and revocation on credential change require further validation. 13 targeted local tests passed; SQL checks await CI. No live migration or provider activation.

## Standalone authentication HTTP rehearsal

The isolated login/logout router is test-only, loopback-restricted and rejects browser origins. It includes bounded process-local IP and account rate limits and caps concurrent login operations at two. It returns no-store responses and does not claim logout success when revocation is unconfirmed. It is exercised through real loopback HTTP with an injected synthetic credential service, not mounted in the production server. Sixteen targeted authentication tests passed locally. End-to-end PostgreSQL wiring, browser cookie/CSRF controls, distributed rate limits and recovery are still required. No new infrastructure or production deployment.

## PostgreSQL HTTP identity integration

The disposable CI now provisions separate restricted login and session-reader credentials and runs real loopback HTTP login, session validation, logout, disabled-account denial and fixture cleanup against PostgreSQL. It checks direct-table denial and cross-role function denial. The test refuses non-loopback URLs, non-CI database names and unexpected roles. Production server mounting remains disabled. Actual execution pending CI; no live data, role or database changes.

## Controlled identity enrollment

Migration 018 adds single-use expiring enrollment grants for pre-authorized ordinary identities. Transactional grant consumption creates the principal and salted credential together; duplicate identities and grant replay fail closed. The enrollment role cannot read raw grants or elevate administrators. Grant issuance and delivery, account recovery, public enrollment and stakeholder binding remain unimplemented. Three targeted local adapter tests passed; disposable SQL verification pending. No production activation.

## Browser identity interface

Candidate projection, career evidence and trusted recruitment/profile mutation clients now depend on a common provider-neutral identity interface. The active implementation remains the legacy Firebase adapter. The token accessor rejects lost or changed identities during asynchronous request preparation. Three targeted tests passed. Sign-in screens, AuthContext, browser session lifecycle and standalone provider activation remain pending; no production behavior switch.

## Browser lifecycle separation

AuthContext now consumes the provider-neutral identity lifecycle for subscription and logout, with Firebase confined to the legacy adapter. Three client identity regression tests passed. Full CI and standalone lifecycle implementation remain required; no live switch.

## Interactive authentication separation

The sign-in and stakeholder registration screen now invokes the legacy provider through the shared interactive identity adapter, rather than importing Firebase authentication directly. Existing email and Google sign-in behavior is preserved; Firebase-specific error handling and actual provider activation still require replacement. Three client identity regressions passed; full browser acceptance remains required. No live change.

## Browser session contract

Added an unmounted browser session reader for the proposed same-origin cookie-backed session endpoint. It accepts only non-secret principal metadata, rejects unexpected privilege or token fields, disallows redirects and caching, and differentiates anonymous from unavailable. Six targeted client tests passed. The endpoint, cookie issuance, CSRF protection, session lifecycle and protected API integration remain pending. No live switch.

## Browser cookie HTTP rehearsal

The test-only browser auth router verifies loopback origin, rejects cross-origin mutations and bearer credentials, uses a host-only Secure HttpOnly SameSite=Strict session cookie, and exposes only principal metadata. Five targeted tests passed using actual loopback HTTP with synthetic identity services and explicit cookie forwarding. Browser HTTPS enforcement, PostgreSQL integration, production mounting and protected stakeholder API cookie acceptance remain unverified. No live change.

## PostgreSQL browser cookie acceptance

Expanded the disposable PostgreSQL HTTP integration to exercise browser login, session metadata, origin rejection, logout and persisted revocation with restricted database roles. The local five browser contract/router tests passed. The new PostgreSQL integration requires CI; it forwards cookies explicitly and is not a real browser HTTPS test. No production change.


## 22 November — consolidated standalone recruitment and onboarding checkpoint

The disposable PostgreSQL browser run 45036650659 verified actual student, institution and employer dashboard journeys: demand, invitation, institution response, student activation, consent-gated application, assessment submission, scoped assessment disclosure, human shortlisting, interview, authoritative offer issuance/review/acceptance and confirmed joining. It checked the placement, funnel and single internal earned success-fee record, not payment collection. The full workflow remained red because onboarding institution selection timed out after recruitment passed. Migration 019 scopes offer record reads to the owning student; the server derives the displayed offer terms in the workspace response and does not store a duplicate on the opportunity. New onboarding changes add an explicit accessible institution selector and directory retry. Restricted PostgreSQL tests previously passed on this run; new code requires new evidence.

Invitation redemption remains an isolated test-only browser route using the existing single-use enrollment grant and restricted enrollment role. A grant binds an ordinary identity to a pre-authorized email, not a stakeholder role. Redemption creates credentials, never a session or administrator; explicit sign-in and validated registration are separate operations. New browser cases exercise enrollment plus registration for students, institutions and employers and reject replay. The unit cases check cross-origin and extra-field denial, no automatic session, and failures. All invitation credentials and authorized grant setup are disposable CI fixtures only.

Release HOLD: invitation issuance/delivery and account recovery have not been approved or implemented for production; admin activation, independently authorized source inventory/reconciliation and cutover, live runtime selection, operational security and hosting acceptance remain open. No live Neon migration, Firestore deletion, payment activation, deployment or paid resource was introduced. PR #39 is the single review candidate; avoid independently merging its derived work branch.


## Operational runtime and request efficiency

The independent Vite build has its own HTML entry and rejects Firebase modules in emitted chunks. The disposable HTTPS runtime uses the same stakeholder route handlers as the legacy application, explicit loopback test gates, secure cookie authentication, a same-origin CSP, response security headers and no-store API responses. The shared workspace endpoint is intentionally limited to 20 requests per minute per IP; browser acceptance uses spaced synthetic actor journeys and never raises that limit. This is not a production capacity estimate. The browser run for db54e10 remains an independent verification checkpoint.

The efficiency candidate removes redundant initial account/workspace reads, coalesces focus-triggered reads, discards in-flight snapshots superseded by successful mutations, and prevents a disposed identity from applying results. It guards response body decoding against session changes and honors caller cancellation. Mutation confirmations must be valid JSON with a boolean replay status; an ambiguous response is not displayed as success. Regression tests cover these boundaries. It is a candidate, not verified production behavior. The Neon-specific metadata gate requires exact database identity, migration and scope evidence, independent review, source disposition and cost limits. The checker never connects to or writes a database. Live credentials, identity recovery/admin authorization, source inventory, provider quotas and final activation remain blocked.


## Free infrastructure operating budget — 22 November 2026

Read-only Neon metadata confirms organization plan free, PostgreSQL 16, one branch/main, one idle read-write compute fixed at 0.25 CU, one nexustalent database and branch logical size 31,481,856 bytes. Restore-history setting is six hours. No compute was started and no resources or billing settings changed. Project lifetime counters are not a verified monthly billing report. Neon publishes 100 CU-hours/month and 1 GB per project, subject to account limits (https://neon.com/blog/neon-free-plan-1-gb-per-project). Proposed internal guard reserves 20%: at most 80 CU-hours (320 active hours at 0.25 CU) and 800 million projected storage bytes, plus account storage headroom. Keep-alives, paid external APIs, automatic upgrades and payment activation remain prohibited. Run `node scripts/check-operating-budget.mjs reviewed-forecast.json` with current provider evidence, never fabricated usage. Render workspace selection, single service, deployment controls, monthly metering, cold-start and quota exhaustion behavior remain unverified. This offline gate performs no provisioning, payment or deployment, and a within-budget prognosis is not a production SLA.


## Hosting consolidation audit — 22 November 2026

Provider metadata confirms two Free Render web services of the canonical repository in Singapore, one instance each, auto-deploy off and PR previews disabled. The checked-in staging smoke test references only nexustalent-zero-cost-v2 (srv-datjr5qd0e5s73cddh9g), which has the /api/health health check. Retain it as the intended single host. The older nexustalent-zero-cost (srv-datjqppsrm7s7390aaj0) is a retirement candidate, not approved for deletion. Both currently reference the older live commit 887b287b1e4f8e1ba9c763076198d0f1bd5e5e15. The seven-day HTTP and instance metrics queries returned empty series; missing telemetry is not proof of zero traffic or absence of external dependencies. Repository reference scan found no active application link to the older hostname, but cannot establish that external integrations or bookmarks are absent. No service was suspended, deleted, redeployed or reconfigured. Retirement requires complete dependency review, explicit owner approval, preserved rollback reference and independently verified provider removal. The read-only hosting checker now blocks both a remaining legacy service and unverified disappearance. The single-host budget gate stays on HOLD. Production cutover remains a separate decision.


## 23 November 2026 — free-plan idle compute and CI efficiency

Neon Free has a five-minute idle scale-to-zero timeout. The Neon API `suspend_timeout_seconds: 0` represents the provider default, **not** a disabled timeout; `-1` is the disabled state (disallowed by the budget gate). Official references: https://neon.com/docs/introduction/scale-to-zero and https://github.com/neondatabase/ai-rules/blob/main/ai-rules/neon-api-projects.mdc . The offline budget checker now requires exact metadata `neon.suspendTimeoutSeconds: 0` together with independently reviewed Free-plan evidence. No provider configuration or paid plan was changed. Static process-health checks must never open a database connection or keep the database awake.

The disposable HTTPS PostgreSQL browser suite previously slept 61 seconds between nine synthetic actor sessions to avoid the fixed-window rate limiter. A test-only deterministic clock now advances the existing 60-second fixed windows between actors without any physical wait. Both the authentication and shared stakeholder API limiters use the same clock **only** inside `createStandaloneRuntime`, which already refuses non-test mode and non-loopback HTTPS. Tests prove the unchanged 20/minute stakeholder API, 30/minute auth IP and 5/minute login-account limits still deny excess requests and reset only at a window boundary. This improves test throughput, not production capacity; real clock and distributed-rate-limit operational checks remain separate release gates. Production and live Neon remain HOLD.
