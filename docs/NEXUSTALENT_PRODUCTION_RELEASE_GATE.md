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

## Evidence state — 2026-10-09

### Verified automatically
- Current main release candidate: `c81194a5d175f28838ab055ed246373a989886a4` (match-insights terminal-response fix).
- GitHub CI run #266 passed: dependency install, typecheck, matching regression tests including parser tests, trusted-backend tests, commercial tests, and production build.
- Production Gate run #240 passed: Firestore/Auth emulator authorization, typecheck, regression suites, dependency audit, app smoke start, production container build and container smoke.
- GitHub combined commit status currently reports Vercel **success** for this SHA, target: `https://vercel.com/rupay-kg/campus/6JvVVBHuf6YDHDyQ14ShBU8BTC5a`. This status alone does not prove that the current main SHA is deployed to the production alias; the deployment API listing returned HTTP 403 during the latest check, so production deployment identity/alias could not be independently confirmed.
- Render staging service `nexustalent-zero-cost-v2` (`https://nexustalent-zero-cost-v2.onrender.com`) reports deployment `dep-db490lpsrm7s738dp8n0` as `live` for this commit. Startup logs show the service URL and successful start. Direct post-deploy HTTP health response and request logs were not observed in this check. This is staging evidence, not production certification; the service uses the free plan.
- Historical Vercel project `campus` exists (project ID `prj_QpjLvb7qeZ3mD8BBOhntbcmlWjCi`) under team `RupayKG`. A prior attempt to create a deployment for the approved main candidate returned HTTP 403 due to production-deployment permission/build-rate restriction. Do not create a duplicate project or bypass deployment protection.
- Desktop Commander workstation `DESKTOP-AGPFFLB` remains offline in the latest recorded inspection; live browser/device tests and workstation-dependent reliability exercises have no evidence and remain unchecked.

### Evidence rule
Unchecked gates are not to be converted to [x] merely because implementation exists. A gate closes only when its corresponding real-world evidence is produced and attributable to the release candidate.

## Final decision

**Current classification: CONTROLLED PILOT / STAGING.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.

## Execution queue — updated 2026-10-09

1. **Vercel deployment identity/access:** use the authorized Vercel team/account to resolve the HTTP 403 deployment restriction; confirm the exact main SHA is deployed and aliases point to that deployment. Do not change billing/plan, weaken protection, or promote an older build without explicit authorization.
2. **Live pilot:** once an authorized live hostname is available, execute the controlled employer/institution/student workflow using synthetic data only.
3. **Reliability:** perform load/capacity, backup/restore, rollback, and dependency-failure exercises and attach attributable results.
4. **Security operations:** verify production credentials, API restrictions, rate limiting, monitoring, security contact, and credential-rotation procedure.
5. **Privacy/employment:** obtain attributable approvals for notice, retention/deletion, terms, employment safeguards, and incident notification.
6. **Operational ownership:** record support owner, SLO expectations, incident response owner, and release/rollback owner.
7. **Final certification:** change the release classification only after all applicable blocking checkboxes have evidence.

### Current blockers
- Vercel production deployment identity/access remains unresolved: a Vercel status check is green, but the deployment-list endpoint returned HTTP 403 and a prior deployment-creation attempt returned HTTP 403. The exact production alias-to-SHA mapping is not verified.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is reported offline, so workstation-dependent browser/live tests cannot currently be executed.
- Commercial, privacy/employment, security-operations, reliability, live-pilot, and ownership gates remain unchecked pending attributable real-world evidence and approvals.
