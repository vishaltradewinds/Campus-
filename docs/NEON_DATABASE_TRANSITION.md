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