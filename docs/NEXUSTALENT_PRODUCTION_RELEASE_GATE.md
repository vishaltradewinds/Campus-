# NexusTalent Production Release Gate

Status: **Controlled-pilot release gate**
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
- [x] Product acceptance tests cover every canonical transition.
- [x] Career Passport evidence submission, review, rejection, expiry/reverification, dispute/correction workflow is implemented end-to-end; authority matrix is documented.
- [x] Deterministic commercial plans/quotes and server-owned billing records are implemented; Razorpay order/webhook integration is implemented.
- [ ] Merchant activation, tax/GST invoice configuration, refund policy and settlement reconciliation are approved and exercised.
- [ ] Mobile UX acceptance pass completed.

## Gate 2 — Security
- [x] Firestore role/ownership rules exist.
- [x] Candidate projections are server-controlled.
- [x] Recruitment workflow collections are server-owned; browser writes cannot bypass trusted transitions.
- [x] Candidate projection reads are consent-gated so revocation blocks future access.
- [x] Sensitive workflow mutations are server-authorized.
- [x] Audit events are created for sensitive transitions.
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
- [x] Authority for each Career Passport claim type documented in the authority matrix.
- [x] Verification lifecycle implemented.
- [x] Evidence lineage can be reconstructed from immutable records.
- [x] Expiry/reverification policy implemented at the evidence state boundary.
- [x] Dispute/correction process implemented.

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


## Evidence state — 2026-10-08 (updated after current-main verification)

### Verified automatically
- Current main release candidate: `0032862eb07bd9d29214c70b2c1fc2a51516c6a6`.
- NexusTalent Production Gate run `37806231255`: **success**.
- Quality-gate job `113411111555`: **success**.
- Typecheck, matching, trusted-backend, commercial, dependency-audit, Firebase/Auth emulator authorization, build, application smoke, production-container build and production-container smoke all passed. GitHub CI run `37806230960` also passed.
- Vercel project `campus` exists and has READY deployments; the latest inspected READY deployment is from the pre-merge hardening branch, not the main merge commit.
- Direct Vercel deployment creation for the main merge commit was rejected by the connected Vercel authorization with HTTP 403; this is an infrastructure/access blocker, not evidence of an application failure.
- The connected Desktop Commander workstation was inspected and remains offline; live device/browser and workstation-dependent release tests therefore have no evidence and remain unchecked.

### Evidence rule
Unchecked gates are not to be converted to `[x]` merely because implementation exists. A gate closes only when its corresponding real-world evidence is produced and attributable to the release candidate.


## Final decision

**Current classification: CONTROLLED PILOT / STAGING.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.


## Execution queue — 2026-10-08

The following actions are the next executable closure sequence. They are intentionally not marked complete until evidence exists.

1. **Hosting access:** resolve the Vercel 403 for the `campus` project using the authorized RupayKG team account/integration; then deploy the exact approved `main` release candidate.
2. **Live pilot:** execute the controlled employer/institution/student workflow on the release candidate using synthetic data only.
3. **Reliability:** perform load/capacity, backup/restore, rollback, and dependency-failure exercises and attach attributable results.
4. **Security operations:** verify production credentials, API restrictions, rate limiting, monitoring, security contact, and credential-rotation procedure.
5. **Privacy/employment:** obtain attributable approvals for notice, retention/deletion, terms, employment safeguards, and incident notification.
6. **Operational ownership:** record support owner, SLO expectations, incident response owner, and release/rollback owner.
7. **Final certification:** change the release classification only after all applicable blocking checkboxes have evidence.

### Current blockers

- Vercel deployment/list access currently returns HTTP 403 for the connected deployment operations.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is offline, so workstation-dependent browser/live tests cannot currently be executed.
