# NexusTalent — Neon production role boundary (23 November 2026)

**Status: HARD HOLD — no live migration, role creation, credential rotation, merge or deployment authorized.**

## Verified inventory (Neon API, read-only)

Canonical project `rough-butterfly-67822299`, branch `br-rapid-brook-b3bqvuxx`, database `nexustalent` (PostgreSQL 16) lists **two roles**:

| Role | Neon API authentication | Interpretation |
| --- | --- | --- |
| `nexustalent_owner` | `password` | Database owner, **not** an application credential |
| `nexustalent_api` | `no_login` | Group/privilege role from foundation migration, **not** a direct login |

The 001–020 migrations define **24 distinct NOLOGIN grant/resolver roles**. The live Neon role API is missing **23** of those. The standalone browser application and its tests use 17 segregated runtime purposes: reader, registrar, demand, institution, consent, assessment, offer, joining, verification, academic, evidence, disclosure, profile, directory, login, session, enrollment. The production role names `nexustalent_app_<purpose>` are a **proposed, unprovisioned naming plan**, not active accounts. All 17 are absent.

## Enforced preflight

- `scripts/check-live-neon-roles.mjs` validates only sanitized provider role metadata; role catalog is derived from the actual 001–020 SQL source and regression-checked against the reviewed role list.
- Blockers: `REQUIRED_SCHEMA_GRANT_ROLES_MISSING`, `RESTRICTED_RUNTIME_LOGINS_MISSING`, `INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED`.
- `scripts/check-neon-cutover.mjs` now also rejects source/destination metadata unless the **live** Neon role inventory matches the complete reviewed catalog and separate SQL grant/RLS audit evidence is present. Synthetic claims or an inventory of two roles fail.
- Both checkers perform zero database operations; role inventories must be supplied as sanitized JSON containing only `name` and `authentication_method`. Do not include passwords, connection strings, identifiers of people or private rows. A passing fabricated JSON fixture is never evidence of provider state.

## Neon elevated-role creation hazard (verified 23 November 2026)

Neon's published [role documentation](https://neon.com/docs/manage/roles) states that roles created through the Console, API, and default CLI role creation inherit `neon_superuser`, which includes capabilities such as `CREATEROLE` and `BYPASSRLS`. Therefore **do not create any of NexusTalent's 17 application login identities with default Neon Console/API/CLI provisioning**, even though a provider role-list response may call the authentication method `password`.

For the required custom table, function and RLS privileges, the reviewed route is PostgreSQL `CREATE ROLE ... LOGIN` with explicit restricted grants, preceded by approval and tested on an isolated database. Generic CLI `--access read_only/read_write` roles are also not substitutes for NexusTalent's 17 individually scoped function and writer permissions. The SQL owner must verify `pg_auth_members` for **all** inherited memberships (including `neon_superuser`, not just names starting with `nexustalent_`), table-owner relationships, `BYPASSRLS`, `FORCE ROW LEVEL SECURITY`, direct DML privileges and function-only boundaries.

`scripts/check-neon-cutover.mjs` now requires `roleProvisioning.method: reviewed-postgresql-sql`, `defaultNeonAdministratorRolesExcluded: true`, and an independent `roleProvisioningDigest` as **additional advisory evidence**, while still returning `automaticCutover: false`. None of these self-reported fields attests to live provisioning or substitutes for the independent SQL query, negative tests and explicit approval. **No role is created or changed by this document or the checker.**

## Approved order of future work — do not execute automatically

1. Obtain source Firestore named-database and Auth inventories with explicit authority; reconcile all intended collections, child records and identity/account roles. Retain the original source unchanged until approved cutover.
2. Obtain independent reviewer approval for migrations 002–020, schema/RLS policy changes, protected rollback, runtime login-role design, privileges, costs and maintenance window.
3. In a disposable, non-production PostgreSQL 16 environment, repeat migrations, negative tenant-isolation tests, GRANT/member privilege tests, session/recovery/admin workflow tests and rollback rehearsal.
4. Only after approval, apply versioned live migrations and provision separate least-privilege login identities. No shared owner password, no privilege escalation, no hardcoded credentials; verify TLS, secret rotation and restrictive egress.
5. Read-only SQL catalog audit must check actual rolcanlogin, rolsuper, rolbypassrls, role membership, table grants, function grants, enforced RLS and no owner inheritance. Neon role listing alone **cannot** establish these.
6. Prepare a genuine production-appropriate standalone runtime: current `server/standaloneRuntime.ts`, auth/cookie routers and `server/postgresRecordStore.ts` explicitly refuse production mode and target only disposable local PostgreSQL. **Do not remove these guards** merely to deploy. Authorize a new audited runtime design separately.
7. Verify source-to-Neon reconciliation, real identity enrollment/admin recovery, independent security acceptance, capacity quotas, cold starts, controlled pilot outcomes and rollback before deployment. Merchant/payment activation remains disabled.

**Cost controls:** existing Neon Free 0.25 CU and one branch; avoid idle keepalive queries, extra database instances, paid upgrades or automatic deployment. Render retains only the intended V2 service after explicit review of V1 external consumers. Separate hosting/deployment approval remains required.

## Inert production connection and SQL-audit engineering checkpoint

The repository now includes a **non-activated**, production-shaped connection planner at `server/productionPostgresRolePlan.ts`. It pins the existing single Neon project/branch/direct-endpoint host and PostgreSQL 16 database; a changed endpoint must be independently reviewed, not silently followed. The planned seventeen `NEXUSTALENT_PROD_<PURPOSE>_URL` bindings must be individually scoped with distinct credentials, match exactly `nexustalent_app_<purpose>`, and use verified TLS with certificate/hostname validation. An owner login, pooled hostname, wrong database, non-5432 port, connection-string SSL override, emulator flag or reused password fails the plan. It caps prospective runtime connections at 18 (reader 2, other scopes 1), sets short idle and connect timeouts, and requests no background keepalive.

**This planner does not import into the active server, open sockets, prove live roles, provision credentials or authorize production mode.** Its sanitized `summary` can be logged; `poolOptions(scope)` contains the actual scoped password and **must only be consumed by a future approved runtime, never logged or persisted**. Current Neon has none of these bindings and therefore cannot pass an operational readiness check. A passing synthetic unit test proves code constraints, not real authentication.

`scripts/audit-production-pg-privileges.mjs` generates a **read-only, catalog-only** SQL statement for an independent reviewer (`node scripts/audit-production-pg-privileges.mjs`). Its output lists expected roles, all direct role memberships (including possible provider-elevated roles), owner membership, PostgreSQL login and privilege flags, and FORCE RLS on `nexustalent.records`. It **never executes** the query. `assessProductionPrivilegeRows` fails closed for missing roles, elevated privileges, extra memberships and absent RLS; even a synthetic passing result is classified as needing external attestation and negative tests. The live database remains untouched.

The production-gate workflow additionally compiles this catalog-only SELECT against the disposable PostgreSQL 16 CI database **after** test migrations 001–020. It must return one row per 17 expected scoped roles and confirm there are zero production-style app logins in that disposable database. This is a SQL syntax and query-shape check only: it neither provisions roles nor asserts that real Neon is ready. CI deliberately does not interpret missing roles as a successful production privilege attestation.

Production deployment additionally requires a separately approved browser-auth/runtime boundary, true role provisioning with restricted grants, owner credential exclusion, independently witnessed SQL and cross-tenant negative tests, live source reconciliation, administrative recovery and backup/rollback, quotas and pilot sign-off. No current CI or unit test substitutes for these approvals.

**Read-only metadata proof is not application readiness.** No claim of production database, RLS, data or authentication parity follows from these findings.

## 23 November — disposable 17-role GRANT and function-boundary rehearsal

A second PostgreSQL 16 CI step exercises the actual **catalog permission topology** after migrations 001–020. `db/neon/tests/production_role_shape_rehearsal.sql` creates exactly 17 passwordless `nexustalent_app_*` roles solely when its PostgreSQL server address is loopback or the narrowly permitted CI Docker bridge subnet, as **postgres**, on **nexustalent_ci**. The GitHub runner connects to the fixture using **127.0.0.1**; inside the container, PostgreSQL reports its private bridge address. Each role inherits only its intended NOLOGIN grant role. The guard runs before any role creation. No such roles, credentials or SQL migrations were applied to Neon.

The new `--disposable-sql-json` mode wraps the existing read-only catalog query in a JSON aggregation; `--verify-disposable` checks 17 actual disposable role rows. It must reject owner membership, excessive or provider-elevated memberships, `BYPASSRLS`, unsafe table permissions, missing inherited grants, missing function privileges and missing `FORCE ROW LEVEL SECURITY`. **Its only acceptable residual blocker is `PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED`.** It never silently relabels the disposable database as the production database. Test output states `DISPOSABLE_REHEARSAL_PASSED_NOT_PRODUCTION_READY`.

This is not independent evidence about live Neon: the guarded fixture, the production SQL auditor and real-source reconciliation still require separate review, role provisioning, negative access tests and release authorization. Production and cutover remain HOLD.

## 24 November consolidated acceptance checkpoint

Candidate d0294a21f00bb81a5b198d9e6b5daeb8547550c2 passed all four workflows (CI 45343613802, authenticated acceptance 45343613745, production gate 45343613747, staging smoke 45343613801). Production gate job 138272802736 passed the disposable PostgreSQL migration and restricted transactions, 17-role audit rehearsal, Chromium virtual WebAuthn, full HTTPS stakeholder journey, dependency security audit and production container build. No physical passkey, source inventory, provider privilege attestation, live credentials or production release was verified. In-memory passkey acceptance and rolled-back SQL persistence rehearsals are separate from a production authenticator and must never be mounted by removing test guards.

Subsequent candidate changes remove unsupported administrator marketplace estimates and unsupported accreditation/verification labels. Signed assertion-to-restricted-review integration replaces the earlier synthetic proof in the disposable PostgreSQL HTTP acceptance path; principal invalidation must also invalidate unused challenges. These changes require fresh exact-SHA validation. The metadata gate requires all 17 actual production catalog rows and candidate-bound administrator authentication/revocation evidence digests; the fields are advisory inputs and not independent proof. Current live inventory must be refreshed before an authorized cutover, and Firestore remains the source of authority until reconciliation and formal disposition. No new services or paid plan changes are required for this batch.

## Workspace capacity and pagination

Registration directory pagination uses a fixed 100-record page. Exact candidate dd735946d04b15f998962c71ebf50e2d18334414 passed all four workflows, including actual disposable PostgreSQL HTTPS browser navigation across more than 100 institutions, selection and registration. The cookie transport permits only the two named pagination GET routes with allowlisted parameters; the server independently authorizes all access.

Workspace pagination uses 50-record pages and server-derived role filters, current account/profile checks, ordered cursors and existing student offer validation. Pages are separate read transactions, not complete snapshots or authoritative totals. The fallback permits browsing above the original complete-workspace limits. Selected student application, decline and offer acceptance, institution invitation response and employer interview progression use existing audited transactions. Student applications require current employer-specific consent. Assessment, consent management, activation, full matching, offer issuance and other aggregate-dependent operations still require the existing complete-workspace path.

Candidate 55d1fb886238d478df8ed11fdc17fabe862983d1 passed CI, staging smoke, authenticated acceptance (on retry following runner system-package installation failure), disposable PostgreSQL restricted transactions and restoration rehearsal. Its production gate browser acceptance remained pending at this checkpoint. Do not represent this candidate as fully validated.

The isolated database optimization successor aligns fixed ownership expressions with existing indexes and batches offer lookup using exact bound keys under the scoped read-only transaction. It adds negative cross-student read tests and compares full-workspace and paginated offer summaries. These optimizations require fresh exact-SHA CI and real PostgreSQL browser validation; no performance benchmark or live database readiness is implied. No new index migration, role, database, or paid service is introduced. Wider deployment requires measured representative workload capacity and separately approved scalable workflow design. Production and source cutover remain HOLD.
