# NexusTalent Production Release Gate

Status: **Controlled-pilot release gate — product/evidence engineering completion pass in progress**
Repository: vishaltradewinds/Campus-

## Release rule

NexusTalent must not be called production-ready merely because the application builds or is deployed. Release requires every applicable gate below to have evidence.

## Gate 1 — Product
- [x] Three-sided operating model implemented.
- [x] Employer demand/campaign workflow implemented.
- [x] Institution response/activation workflow implemented.
- [x] Student opportunity/consent model implemented.
- [x] Recruitment state model implemented.
- [x] Candidate projection/minimization implemented.
- [x] Product acceptance tests cover every canonical transition (execution evidence still required).
- [x] Career Passport evidence submission/review workflow is implemented end-to-end (execution evidence still required).
- [ ] Commercial product rules are exposed through a production-approved workflow.
- [ ] Mobile UX acceptance pass completed.

## Gate 2 — Security
- [x] Firestore role/ownership rules exist.
- [x] Candidate projections are server-controlled.
- [x] Sensitive workflow mutations are server-authorized.
- [x] Audit events are created for sensitive transitions.
- [x] Direct client mutation paths for recruitment state, evidence and verification are blocked.
- [x] AI is bounded as decision support.
- [ ] Production least-privilege credentials verified.
- [ ] API key restrictions verified.
- [ ] Global rate-limit strategy selected for scale.
- [ ] Monitoring/alerting and security contact operational.
- [ ] Incident/credential-rotation runbook tested.

## Gate 3 — Privacy & employment safeguards
- [x] Consent scopes are represented.
- [x] Data minimization is represented.
- [x] AI hiring safeguards documented.
- [ ] Production privacy notice approved.
- [ ] Retention/deletion schedule approved.
- [ ] Candidate/employer/institution terms approved.
- [ ] Employment/anti-discrimination review completed for deployment jurisdictions.
- [ ] Breach/incident notification procedure approved.

## Gate 4 — Evidence & verification
- [x] Authority for each Career Passport claim type finalized in the engineering baseline.
- [x] Verification lifecycle implemented.
- [x] Evidence lineage can be reconstructed through verification records and immutable audit events.
- [x] Expiry/reverification policy defined where applicable.
- [ ] Dispute/correction process implemented.

## Gate 5 — Reliability
- [x] CI typecheck/unit/build gates exist.
- [x] Firebase emulator authorization tests exist.
- [x] Production server smoke test exists.
- [x] Production container smoke test exists.
- [ ] Load/capacity test completed.
- [ ] Backup/restore test completed.
- [ ] Rollback test completed.
- [ ] Dependency failure behavior tested.

## Gate 6 — Live controlled pilot
- [ ] Google/Firebase authentication works on the live hostname.
- [ ] Controlled employer account verified.
- [ ] Controlled institution account verified.
- [ ] Controlled student account verified.
- [ ] Requirement -> campaign -> call -> consent -> assessment -> offer -> joining flow completed.
- [ ] Consent revocation tested live.
- [ ] Audit reconstruction completed from live test data.
- [ ] No real candidate PII used until the pilot gate is approved.

## Gate 7 — Production operations
- [ ] Production hosting selected.
- [ ] Secrets/quotas configured outside source.
- [ ] Monitoring and alerting active.
- [ ] Support ownership established.
- [ ] SLOs/availability expectations documented.
- [ ] Incident response exercised.
- [ ] Release/rollback runbook approved.

## Final decision

**Current classification: CONTROLLED PILOT / STAGING.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.
