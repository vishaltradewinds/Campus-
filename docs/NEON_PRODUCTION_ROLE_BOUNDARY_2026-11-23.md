# NexusTalent — Neon production role boundary (23 November 2026)

**Status: HARD HOLD — no live migration, role creation, credential rotation, merge or deployment authorized.**

## Verified inventory (Neon API, read-only)

Canonical project `rough-butterfly-67822299`, branch `br-rapid-brook-b3bqvuxx`, database `nexustalent` (PostgreSQL 16) lists **two roles**:

| Role | Neon API authentication | Interpretation |
| --- | --- | --- |
| `nexustalent_owner` | `password` | Database owner, **not** an application credential |
| `nexustalent_api` | `no_login` | Group/privilege role from foundation migration, **not** a direct login |

The 001–019 migrations define **24 distinct NOLOGIN grant/resolver roles**. The live Neon role API is missing **23** of those. The standalone browser application and its tests use 17 segregated runtime purposes: reader, registrar, demand, institution, consent, assessment, offer, joining, verification, academic, evidence, disclosure, profile, directory, login, session, enrollment. The production role names `nexustalent_app_<purpose>` are a **proposed, unprovisioned naming plan**, not active accounts. All 17 are absent.

## Enforced preflight

- `scripts/check-live-neon-roles.mjs` validates only sanitized provider role metadata; role catalog is derived from the actual 001–019 SQL source and regression-checked against the reviewed role list.
- Blockers: `REQUIRED_SCHEMA_GRANT_ROLES_MISSING`, `RESTRICTED_RUNTIME_LOGINS_MISSING`, `INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED`.
- `scripts/check-neon-cutover.mjs` now also rejects source/destination metadata unless the **live** Neon role inventory matches the complete reviewed catalog and separate SQL grant/RLS audit evidence is present. Synthetic claims or an inventory of two roles fail.
- Both checkers perform zero database operations; role inventories must be supplied as sanitized JSON containing only `name` and `authentication_method`. Do not include passwords, connection strings, identifiers of people or private rows. A passing fabricated JSON fixture is never evidence of provider state.

## Approved order of future work — do not execute automatically

1. Obtain source Firestore named-database and Auth inventories with explicit authority; reconcile all intended collections, child records and identity/account roles. Retain the original source unchanged until approved cutover.
2. Obtain independent reviewer approval for migrations 002–019, schema/RLS policy changes, protected rollback, runtime login-role design, privileges, costs and maintenance window.
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

Production deployment additionally requires a separately approved browser-auth/runtime boundary, true role provisioning with restricted grants, owner credential exclusion, independently witnessed SQL and cross-tenant negative tests, live source reconciliation, administrative recovery and backup/rollback, quotas and pilot sign-off. No current CI or unit test substitutes for these approvals.

**Read-only metadata proof is not application readiness.** No claim of production database, RLS, data or authentication parity follows from these findings.
