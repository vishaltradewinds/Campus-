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

## Evidence state — 2026-10-11

### Verified automatically
- Approved main baseline remains `14a5ae854c3abed4dde891f91cc54c28ca87e19c`; the current security hardening candidate is tracked separately in PR #22, not merged.
- Production Gate #246 passed for PR #22's initial header change at `6d524d1c4b64f217c20f439926566e4780788655`. Production Gate #247 then passed for `083632fcb94b804bc72aded995270d2a2bf10f76`, which extracted the header middleware and added unit tests. These results do not certify a live deployment.
- On current PR #22 head `da160a2f1915c04561c2defe4fd5db70016fa400`, CI #274 passed and live staging health smoke #6 passed. This commit also adds actual Express-app response-header assertions to the production-gate smoke script. At the latest check, no Production Gate run/check was visible for this exact SHA; do not treat the prior gate result as validation of the workflow change.
- Direct HTTP check of `https://nexustalent-zero-cost-v2.onrender.com/` returned HTTP 200, but the observed response lacked `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS, and CSP. This staging deployment has not been updated to PR #22; this finding is an outstanding deployment validation, not a failed runtime test of the PR candidate.
- PR #22 preview `https://campus-git-security-baseline-response-headers-rupay-kg.vercel.app/` redirects to Vercel SSO when accessed without an authorized session. Do not bypass SSO or deployment protection.
- Vercel project `campus` (ID `prj_QpjLvb7qeZ3mD8BBOhntbcmlWjCi`) exists in historical project inventory, but current project/domain reads return 404 and deployment listing returns 403 in the connected tool context. The currently linked project list does not expose `campus`; exact production alias-to-SHA mapping remains unverified.
- Render staging service `nexustalent-zero-cost-v2` remains on the free plan and returns HTTP 200 at the root and health endpoint. The currently observed response headers are not the PR #22 candidate.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is online as of 2026-10-11 08:52 UTC. This restores workstation command access, but it does not substitute for an authorized preview session, live synthetic-user journeys, or operational approvals.

### Evidence rule
Unchecked gates are not to be converted to [x] merely because implementation exists. A gate closes only when its corresponding real-world evidence is produced and attributable to the release candidate.

## Final decision

**Current classification: CONTROLLED PILOT / STAGING.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.

## Execution queue — updated 2026-10-11

1. **Vercel deployment identity/access:** use the authorized Vercel team/account to resolve the HTTP 403 deployment restriction; confirm the exact main SHA is deployed and aliases point to that deployment. Do not change billing/plan, weaken protection, or promote an older build without explicit authorization.
2. **Live pilot:** once the existing preview/production authorization is resolved, execute the controlled employer/institution/student workflow using approved synthetic accounts only.
3. **Reliability:** perform load/capacity, backup/restore, rollback, and dependency-failure exercises and attach attributable results.
4. **Security operations:** verify production credentials, API restrictions, rate limiting, monitoring, security contact, and credential-rotation procedure.
5. **Privacy/employment:** obtain attributable approvals for notice, retention/deletion, terms, employment safeguards, and incident notification.
6. **Operational ownership:** record support owner, SLO expectations, incident response owner, and release/rollback owner.
7. **Final certification:** change the release classification only after all applicable blocking checkboxes have evidence.

### Current blockers
- Vercel production deployment identity/access remains unresolved: a Vercel status check is green, but the deployment-list endpoint returned HTTP 403 and a prior deployment-creation attempt returned HTTP 403. The exact production alias-to-SHA mapping is not verified.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is online, but authorized Vercel preview access remains blocked by SSO; live browser tests still need an authorized session.
- Commercial, privacy/employment, security-operations, reliability, live-pilot, and ownership gates remain unchecked pending attributable real-world evidence and approvals.
