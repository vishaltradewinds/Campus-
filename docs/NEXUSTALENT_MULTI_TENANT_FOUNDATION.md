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

CI follow-up on 2026-10-21: the current branch head `5ab73b638d09d2bfc7abe0611d5cd56858a18843` passed the GitHub Production Gate run `39578982898`, CI run `39578982962`, and Live Staging Smoke run `39578982982`. The Production Gate includes a disposable PostgreSQL 16 service, tenant schema integration test, dependency audit, application build, production-container build, and container smoke test. The staging smoke result is not evidence of a live PostgreSQL tenant migration or a production tenant rollout.

The provisioning CLI now delegates lifecycle decisions to `server/tenancy/provisioningPolicy.ts`: a matching `ACTIVE` tenant is an idempotent no-op; a matching `PROVISIONING` tenant may resume; mismatched schema/host records and other lifecycle states fail closed. `tests/provisioningPolicy.test.ts` covers create, resume, active no-op, identity mismatch, and refusal of non-resumable states. This is unit coverage of the decision policy, not yet an end-to-end failure-injection test of real migrations or recovery after a process/database interruption.

Important limitation: the current PostgreSQL integration test uses the same privileged test credentials for both tenant-scoped Prisma clients. It proves that the schema-scoped queries used in the test return separate rows, but it does not prove database-enforced cross-schema denial under distinct least-privilege runtime credentials. Do not describe this as complete database isolation. No live PostgreSQL database was provisioned or migrated in this session, no real tenant DNS/TLS route was enabled, and no production deployment or certification was performed. The module remains unapproved for production until distinct-runtime-role isolation, provisioning failure recovery, migration/restore rehearsal, and authorized staging database integration are verified.
