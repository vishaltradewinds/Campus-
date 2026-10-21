# Module 1: Multi-tenant system core

## Scope and current status

This change introduces a separate PostgreSQL/Prisma control plane and tenant-schema foundation alongside the existing Firebase/Firestore application. It does not migrate or replace production data, provision a live database, or enable production tenant routing by default.

## Components

- `prisma/control-plane/schema.prisma`: tenant registry, global identity mapping, per-university membership, platform role, and platform audit metadata.
- `prisma/tenant/schema.prisma`: university-scoped student profiles, employers, recruiter membership, job requisitions, and applications.
- `prisma/*/migrations/`: initial SQL migrations generated from the checked-in Prisma schemas. Tenant migrations must be applied separately to each provisioned tenant schema.
- `server/tenancy/tenantResolver.ts`: validates direct tenant subdomains against a configured base domain, rejects reserved/nested/unknown/suspended tenants, ignores untrusted forwarded-host headers, and derives schema identifiers only from the control-plane registry.
- `server/tenancy/tenantRegistry.ts`: control-plane registry lookup adapter.
- `server/tenancy/prismaClients.ts`: distinct generated control-plane and tenant Prisma clients, with a bounded tenant-client cache and small default connection pools.
- `server/tenancy/tenantAuthorization.ts`: reusable role/membership authorization middleware. Tenant host resolution is never treated as authorization.
- `src/components/admin/TenantIsolationPanel.tsx`: System Admin UI panel that displays only the server-verified tenant context and authorization outcome.

## Request security contract

1. Configure `TENANT_BASE_DOMAIN` as a bare hostname such as `platform.example.com`.
2. Resolve the direct `<slug>.<TENANT_BASE_DOMAIN>` host from the control-plane registry. The resolver deliberately ignores `X-Forwarded-Host`.
3. Reject unrecognized, reserved, nested, suspended, provisioning, archived, or malformed tenant records.
4. Verify the user's Firebase ID token using the existing authentication middleware.
5. Map the verified Firebase UID to an active `UserIdentity` and require either an explicitly permitted global `SYSTEM_ADMIN` role or an active membership in that tenant with an allowed role.
6. Pass the immutable tenant context to the tenant Prisma client factory. Never accept a schema name from request input.
7. Use separate least-privilege database roles for runtime requests and schema migrations. Runtime application credentials must not create or drop schemas.

## Role model

- `SYSTEM_ADMIN`: global platform role, only accepted by routes that explicitly set `allowSystemAdmin: true`; privileged operations require their own audit and authorization policy.
- `UNIVERSITY_ADMIN`: explicit university membership.
- `RECRUITER`: explicit membership per university; global identity does not imply access to every institution.
- `STUDENT`: explicit university membership.

## Database configuration

- `CONTROL_DATABASE_URL`: PostgreSQL URL for the control plane.
- `TENANT_DATABASE_URL`: PostgreSQL URL used as the tenant database base URL; runtime code sets the `schema` query parameter from the validated tenant registry value.
- `CONTROL_MIGRATION_DATABASE_URL`: privileged control-plane migration URL.
- `TENANT_MIGRATION_DATABASE_URL`: privileged tenant-schema creation and migration URL.
- `TENANT_BASE_DOMAIN`: direct tenant-subdomain suffix.

Do not commit real credentials. No real database URL is included in this change.

## Operator-run tenant provisioning

After both databases and migration credentials are configured, provision a tenant with:

`npm run tenant:provision -- --slug mit --display-name "MIT University"`

The CLI applies control-plane migrations, creates a registry row in `PROVISIONING`, creates the validated tenant schema using the dedicated migration credential, applies the tenant migration, and only then marks the tenant `ACTIVE`. Failures leave the tenant non-active so it cannot be routed. DNS and TLS subdomain routing must be configured separately. Run only one provisioning job per tenant at a time. Runtime database credentials must not have schema-creation or migration privileges.

## Scaling and safety boundaries

- Each Prisma client has its own connection pool. The implementation bounds the cache at 100 tenant clients and defaults each tenant pool to two connections; the hard cap fails closed rather than creating unlimited pools. This is a safety limit, not a scale certification. Benchmark and configure PgBouncer or another verified pooling approach before broad tenant onboarding.
- Tenant schemas must be provisioned and migrated by a controlled administrative process, not from an arbitrary incoming request. Validate identifiers and quote them safely for any DDL.
- The initial migrations are not yet applied to a live PostgreSQL database. Database credentials, tenant schema creation, migration rehearsal, cross-tenant database privilege tests, backup/restore, monitoring, load tests and human release approval remain outstanding.
- The existing application continues to use Firebase/Firestore for its current workflows. Do not claim that existing records have been migrated to PostgreSQL.

## Verification record (2026-10-21)

- Automated suite: 49 tests passed, zero failures, including tenant resolver and RBAC decision tests.
- TypeScript check: completed without diagnostics.
- Prisma client generation: both control-plane and tenant clients generated successfully.
- Prisma schema validation: both schemas valid.
- Production build: Vite frontend and bundled Express server build succeeded. The existing frontend bundle-size warning remains a performance optimization item, not a build failure.
- Dependency audit: npm audit --audit-level=high reported zero known vulnerabilities after pinning patched deepmerge-ts@8.0.0 and effect@3.20.0 overrides. Prisma generate/validate/build passed with these overrides; re-check them whenever Prisma is upgraded.

CI follow-up on 2026-10-21: commit `0a0bbf82c9a64d78672c62a13c59ac64d5b491dd` passed Production Gate run `39580303455`, CI run `39580303467`, and Live Staging Smoke run `39580303371`. On latest commit `56be83a8e4f27949874c1dd6dbebf22b4c692d58`, CI run `39580704205` passed; Live Staging Smoke run `39580704256` passed; Production Gate run `39580704206` was still running at the time of this update. The Production Gate uses a disposable PostgreSQL 16 service and includes the tenant schema integration test, dependency audit, application build, production-container build, and container smoke test. Staging smoke is a health check and is not evidence of a live PostgreSQL tenant migration or production tenant rollout.

The provisioning CLI now delegates lifecycle decisions to `server/tenancy/provisioningPolicy.ts`: a matching `ACTIVE` tenant is an idempotent no-op; a matching `PROVISIONING` tenant may resume; mismatched schema/host records and other lifecycle states fail closed. `tests/provisioningPolicy.test.ts` covers create, resume, active no-op, identity mismatch, and refusal of non-resumable states. This is unit coverage of the decision policy, not yet an end-to-end failure-injection test of real migrations or recovery after a process/database interruption.

The PostgreSQL integration test now creates two disposable, schema-scoped runtime roles with privileges granted only on their own tenant schema, confirms each role can read its own schema, and asserts that alpha credentials are denied access to beta schema. The test runs only against the disposable PostgreSQL service in CI; its successful result is evidence for the specific tested permission boundary, not a substitute for a review of the full production privilege model. No live PostgreSQL database was provisioned or migrated in this session, no real tenant DNS/TLS route was enabled, and no production deployment or certification was performed. Remaining release gates include real migration failure-injection/recovery, migration/restore rehearsal, authorized staging database integration, broader authorization/concurrency coverage, and independent review.

## Provisioning recovery and tenant isolation update (2026-10-21)

- Commit `59e106d54d6e237ecd960035e6ebd5dcd9cf0f88` adds a database-backed provisioning interruption/retry check to the disposable PostgreSQL integration test. The test persists a tenant in `PROVISIONING`, injects a migration interruption, verifies the persisted state remains non-active, retries with the tenant migration, and verifies activation occurs only after the migration succeeds.
- `server/tenancy/provisioningLifecycle.ts` centralizes the required order: schema preparation, migration, then activation. The operator CLI uses this sequence. `tests/provisioningLifecycle.test.ts` covers ordering, schema failure, migration failure, and retry behavior.
- PostgreSQL runtime-role integration checks both directions of cross-schema access denial: alpha credentials cannot read beta, and beta credentials cannot read alpha. These roles and schemas exist only in the disposable CI PostgreSQL service.
- For commit `59e106d54d6e237ecd960035e6ebd5dcd9cf0f88`, CI run [39584571845](https://github.com/vishaltradewinds/Campus-/actions/runs/39584571845), Live Staging Smoke run [39584571868](https://github.com/vishaltradewinds/Campus-/actions/runs/39584571868), and Production Gate run [39584571678](https://github.com/vishaltradewinds/Campus-/actions/runs/39584571678) completed successfully. The Production Gate includes TypeScript checks, regression tests, PostgreSQL integration, dependency audit, Firestore/Auth emulator tests, app build and smoke start, container build, and container smoke test.
- This is automated evidence from disposable CI infrastructure. It does not establish successful recovery from a real production database outage, a live staging database migration/restore rehearsal, production-grade operational monitoring, load/concurrency readiness, or independent certification. Production Certification remains OFF; PR #29 remains unmerged, and no production tenant routing was enabled.


## Current-head verification and route integration review (2026-10-21 16:30 IST)

- Current reviewed head: `766866fa51cb52ae282205517f809addd2653917`. CI run [39588061178](https://github.com/vishaltradewinds/Campus-/actions/runs/39588061178) passed, including TypeScript checks, regression suites, and production build.
- Production Gate run [39588061155](https://github.com/vishaltradewinds/Campus-/actions/runs/39588061155) passed, including PostgreSQL tenant-schema integration, database-backed provisioning interruption/retry, bidirectional runtime-role cross-schema denial, dependency audit, Firestore/Auth emulator tests, build, app smoke, production-container build, and container smoke.
- Live Staging Smoke run [39588061204](https://github.com/vishaltradewinds/Campus-/actions/runs/39588061204) passed. This is a health smoke, not a live PostgreSQL migration or tenant-data route test.
- The latest route review found that `/api/tenant/context` is currently the only Express route wired to `createTenantResolver` and `requireTenantAuthorization`. This is an intentionally limited foundation endpoint. Existing placement, student, recruiter, and commercial workflows have not been migrated to tenant-schema PostgreSQL access and must not be represented as fully multi-tenant yet.
- The slug boundary regression now enforces the 56-character maximum required by the `tenant_` schema prefix under PostgreSQL's 63-byte identifier limit. Boundary tests verify 56 characters map to 63 characters and 57 characters are rejected.
- PR #29 remains open, draft, and unmerged. No production database was provisioned or migrated, no tenant DNS/TLS routing was enabled, and Production Certification remains OFF.

## Remaining gates before a real multi-university release

1. Independent code/security review of the full diff and authorization call sites.
2. Authorized staging PostgreSQL provisioning using separately controlled runtime and migration credentials; verify TLS, grants, secrets handling, migration order, and rollback.
3. Exercise end-to-end tenant-scoped data routes with authenticated users and active/inactive memberships; test revocation races, host mismatch, and tenant context propagation across every relevant route.
4. Rehearse backup/restore and interrupted migration recovery against a disposable staging-equivalent environment; capture recovery evidence.
5. Validate pool sizing, cache lifecycle/eviction, database connection ceilings, rate limiting, audit trails, metrics, alerting, and concurrent load before increasing tenant count.
6. Complete university data migration and reconciliation plans before any existing records are moved. Require explicit human approval for release and keep production tenant routing disabled until all gates are signed off.


## Tenant student-profile route implementation (2026-10-21)

- Added `GET /api/tenant/students/me` in `server.ts`. It uses the tenant hostname resolver, Firebase identity verification, and requires an active `STUDENT` membership for the resolved university before reading data.
- Extracted the database query to `server/tenancy/studentProfile.ts` so the tenant client context and authenticated Firebase UID are explicit inputs. The query uses `where: { userSubject: identity.uid }` and selects only the profile fields required by the route.
- Added `tests/tenantStudentProfile.test.ts` and included it in the main test script. The tests verify the tenant context is passed to the client factory, the authenticated subject scopes the query, only an explicit field selection is returned, missing profiles remain not-found, and blank identity subjects are rejected.
- Implementation commits: `b3a64909998fb417684c6c8f1e5816ce4f52bc93` (route), `60c774a10603855329ffac78518899123d4480be` (query helper), `3b9696ebdb2a671b43ea50d466858ccebfaae4b1` (tests), `9c1ac55d5dc069e99c35b96ed44c7904246cbdd5` (route uses helper), `93d0b6b6699994b281a219ca747a4d85513c0924` (test script).
- Before these latest changes, CI #347 and Production Gate #321 had passed for commit `b3a64909998fb417684c6c8f1e5816ce4f52bc93`; Live Staging Smoke #46 passed. The query-helper/test follow-up commits require fresh checks against the latest PR head. Do not treat earlier run results as validation of the final follow-up commits.
- This is a first tenant-scoped student read route, not migration of all placement workflows. Live PostgreSQL staging integration, HTTP-level authentication/membership tests, revocation-race coverage, data migration/reconciliation, monitoring/load validation, independent review, and human release approval remain outstanding. PR #29 stays draft; production tenant routing and certification remain OFF.


## Student endpoint HTTP integration coverage

`GET /api/tenant/students/me` uses the extracted `createTenantStudentProfileHandler` and is covered by `tests/tenantStudentHttp.integration.test.ts`, which exercises an actual local HTTP server with the production tenant resolver, production authorization middleware, injected test control-plane data, and an injected profile lookup. It checks active membership, cross-university denial, invited/suspended/revoked membership denial, inactive identity, missing bearer token, unknown tenant host, missing profile, and a simulated database outage. The control-plane client dependency is injectable for deterministic tests; production still uses the real Prisma client. This test does not prove live staging PostgreSQL tenant isolation or external Firebase token verification, which remain separate gates.
