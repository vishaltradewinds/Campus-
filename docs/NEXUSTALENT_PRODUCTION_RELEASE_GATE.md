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

## Evidence state — 2026-10-16

### Verified automatically
- Approved main baseline remains `14a5ae854c3abed4dde891f91cc54c28ca87e19c`; PR #22 remains a separate, unmerged security-hardening candidate.
- Current PR #22 head checked: `f8b3cd59cfa806339bd6aea3c26b72f0e98899d9`. GitHub CI run #277 passed; Production Gate run #251 passed; live staging smoke run #9 passed.
- Production Gate #251 validates the built candidate app's baseline headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and HTTPS-only `Strict-Transport-Security: max-age=31536000`. It also passed the configured emulator authorization tests, dependency audit, build, and production-container build/smoke. These are candidate/automated checks, not proof that the live service is running this candidate.
- Live staging smoke run #9 only checks the public `/api/health` endpoint. It does not test security headers or browser workflows.
- Render service `nexustalent-zero-cost-v2` remains on the Free plan, auto-deploys from `main`, and is still serving deployment `dep-db492n942hec73ca1p5g` at approved main SHA `14a5ae854c3abed4dde891f91cc54c28ca87e19c`. PR #22 has not been deployed to this service. The prior direct HTTP observation found the baseline headers absent on the live staging response; candidate headers must be verified on an authorized staging candidate before merge/deployment.
- PR #22 has no submitted reviews or inline review threads at this check. Its preview `https://campus-git-security-baseline-response-headers-rupay-kg.vercel.app/` requires an authorized Vercel SSO session; do not bypass SSO or deployment protection.
- The connected Vercel project/deployment APIs still do not expose the historical `campus` project in the active team context (project/domain reads previously returned 404 and deployment listing 403). Exact production alias-to-SHA mapping remains unverified.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is currently offline (last seen 26 hours ago). No desktop browser validation was performed in this check.

### Evidence rule
Unchecked gates are not to be converted to [x] merely because implementation exists. A gate closes only when its corresponding real-world evidence is produced and attributable to the release candidate.

## Final decision

**Current classification: CONTROLLED PILOT / STAGING.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.

## Execution queue — updated 2026-10-16

1. **Vercel deployment identity/access:** use the authorized Vercel team/account to resolve the HTTP 403 deployment restriction; confirm the exact main SHA is deployed and aliases point to that deployment. Do not change billing/plan, weaken protection, or promote an older build without explicit authorization.
2. **Live pilot:** once the existing preview/production authorization is resolved, execute the controlled employer/institution/student workflow using approved synthetic accounts only.
3. **Reliability:** perform load/capacity, backup/restore, rollback, and dependency-failure exercises and attach attributable results.
4. **Security operations:** verify production credentials, API restrictions, rate limiting, monitoring, security contact, and credential-rotation procedure.
5. **Privacy/employment:** obtain attributable approvals for notice, retention/deletion, terms, employment safeguards, and incident notification.
6. **Operational ownership:** record support owner, SLO expectations, incident response owner, and release/rollback owner.
7. **Final certification:** change the release classification only after all applicable blocking checkboxes have evidence.

### Current blockers
- Vercel production deployment identity/access remains unresolved: a Vercel status check is green, but the deployment-list endpoint returned HTTP 403 and a prior deployment-creation attempt returned HTTP 403. The exact production alias-to-SHA mapping is not verified.
- Desktop Commander workstation `DESKTOP-AGPFFLB` is offline, and authorized Vercel preview access remains blocked by SSO; live browser tests still need an authorized session.
- Commercial, privacy/employment, security-operations, reliability, live-pilot, and ownership gates remain unchecked pending attributable real-world evidence and approvals.
