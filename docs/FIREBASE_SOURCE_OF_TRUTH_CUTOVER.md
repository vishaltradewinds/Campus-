# Firebase source-of-truth decision — 22 November 2026

HOLD. Existing AI Studio Starter Tier Firebase project remains authoritative; no alternate live database, no paid plan, no data export or migration authorized.

Official references:
- https://docs.cloud.google.com/docs/starter-tier — current managed project conversion requires linked billing; user-managed projects can use some services without billing.
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans — Spark no-cost plan.
- https://firebase.google.com/docs/firestore/manage-data/move-data — managed Firestore migration requires billing.
- https://firebase.google.com/docs/cli/auth — authentication import/export requires access and preserves identity only if properly configured.

Preferred no-billing contingency: a user-managed Spark project with one default Firestore database and a dedicated authorized runtime identity. This is a proposed target, not a provisioned resource. Do not create it as a parallel live database. First establish lawful source access, complete inventory and authorized export capability. Billing-free API-based transfer is not yet verified; managed export/import is not a zero-billing route. No default/admin credential workaround. If source access or complete Auth transfer is unavailable, remain on HOLD rather than lose user identities or data.

Cutover sequence:
1. Establish independent data stewardship, authorized source access, full collection/subcollection inventory, Auth providers, UIDs/roles, configuration and pricing/quota feasibility. Do not expose PII or password hashes.
2. Obtain owner approval and verify a dedicated least-privilege target runtime identity. Rehearse with synthetic records and tests, never write to live source.
3. Freeze all source writes (browser, backend and AI Studio), isolate destination from public access, capture a complete consistent approved snapshot, retain recovery evidence.
4. Compare typed document content hashes using canonical relative paths (exclude project resource prefixes only after explicitly mapping references; preserve field types, all subcollections, arrays and document IDs). Compare UID and authentication identity/provider manifests separately. Include explicit empty collections and any additional collections. Use identical canonicalization independently verified at both sides; never commit private manifests or raw records.
5. Run offline reconciliation, validate rules/indexes, least-privilege runtime, identity sign-in, roles, revoked consent, audit trails, backups and rollback. Run node scripts/check-database-cutover.mjs metadata.json. The script checks metadata only; never treats boolean declarations as operational proof.
6. Approve a single controlled switch of browser configuration and backend environment, confirm no dual writes, keep previous source read-only for controlled rollback under approved retention. Production remains blocked until pilot and other release gates pass.

In-place conversion could preserve existing resources, but requires billing linkage and explicit owner authorization. Do not assume a Spark downgrade after conversion, or billing-enabled usage at zero cost.