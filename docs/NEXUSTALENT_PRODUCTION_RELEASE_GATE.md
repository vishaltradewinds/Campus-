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

## Evidence state — 2026-10-17

### Verified automatically and by read-only live checks

- Approved main baseline remains `14a5ae854c3abed4dde891f91cc54c28ca87e19c`. PR #22 remains open and unmerged; current candidate head at the start of this evidence update is `cc582332831cd4379adf151605abd05df7bd106f`.
- Current-head PR checks previously passed: CI #278 (https://github.com/vishaltradewinds/Campus-/actions/runs/38879244419), Production Gate #252 (https://github.com/vishaltradewinds/Campus-/actions/runs/38879244608), and Live Staging Smoke #10 (https://github.com/vishaltradewinds/Campus-/actions/runs/38879244325). These checks predate this documentation-only update; verify the new head's checks before considering the PR ready.
- Production Gate #252 validates the built candidate app's `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and HTTPS-only `Strict-Transport-Security: max-age=31536000`. Candidate-runtime assertions are not proof that the live host serves this candidate.
- Desktop Commander workstation `DESKTOP-AGPFFLB` was reachable at 2026-10-17 09:47 UTC. Read-only HTTP requests were run from that workstation:
  - Render root `https://nexustalent-zero-cost-v2.onrender.com/`: HTTP 200; `Last-Modified: Fri, 09 Oct 2026 07:02:10 GMT`. No `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS, or CSP was observed in the response.
  - Render `/api/health`: HTTP 200, body `{"status":"ok","timestamp":"2026-10-17T09:07:11.131Z"}`. No baseline security headers were observed.
  - Vercel alias `https://campus-coral-one.vercel.app/`: HTTP 200, HSTS present (`max-age=63072000; includeSubDomains; preload`), but `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options` were not present in that response. `Age: 9` and a recent `Last-Modified` were observed; served source SHA and alias-to-deployment mapping remain unverified.
  - PR preview `https://campus-git-security-baseline-response-headers-rupay-kg.vercel.app/`: HTTP 302 to Vercel SSO. This response is the SSO layer, not the candidate app. No SSO or deployment-protection bypass was attempted.
- Render service `nexustalent-zero-cost-v2` remains Free, auto-deploys `main`, and its recorded deployment `dep-db492n942hec73ca1p5g` uses main SHA `14a5ae854c3abed4dde891f91cc54c28ca87e19c`. PR #22 has not been proven live on this service. The queried Render event list, warning/error logs, 5xx request logs, and HTTP metrics returned no entries; empty query results do not prove continuous uptime.
- Vercel team `RupayKG` remains on Hobby and its connected Git deployment context exposes only `rupaykg-aistudio`. Historical `campus` project detail and deployment inventory remain inaccessible through the connected team context (404 and 403 respectively). Do not create a duplicate project, change billing/plan, bypass SSO, or promote an unverified deployment.
- PR #22 has no independent submitted reviews or inline review threads. GitHub's main branch metadata reports `protected: false`; an authorized repository administrator must review and establish appropriate branch protection and required checks. No suitable independent reviewer identity has been established through the available authorized interface.
- A workstation-only temporary clone was checked out at the exact PR head. `npm ci` with npm 10.9.4 succeeded and reported zero vulnerabilities; after installing the same Firestore rules test harness used by CI, TypeScript checking passed and the local unit suite passed 39/39 tests, including the three security-header tests. The Windows production build did not complete because the install omitted the platform-specific optional package `@rollup/rollup-win32-x64-msvc`; the configured GitHub Linux CI and Production Gate build steps passed on this PR candidate. No repository lockfile was changed. Treat the local Windows build result as an environment/package-resolution limitation, not as a passing local build or a CI failure.

### Evidence rule

Unchecked gates are not to be converted to [x] merely because implementation exists. A gate closes only when its corresponding real-world evidence is produced and attributable to the release candidate.

## Final decision

**Current classification: CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.**

A production declaration requires all blocking unchecked gates to be closed with evidence. This gate is intentionally stricter than a successful deployment.

## Execution queue — updated 2026-10-17

1. **PR #22 review and candidate validation:** obtain independent human review. Then use an authorized Vercel session or an approved staging route to test the candidate's live headers and login, OAuth/popups, assets, and core workflows. Do not bypass SSO.
2. **Branch governance:** an authorized repository administrator should enable appropriate main-branch protection and require verified CI/Production Gate checks. Confirm the exact check names before enforcing rules; do not self-approve.
3. **Hosting access:** resolve Vercel project/deployment access through the authorized account, establish the exact deployed SHA and alias mapping, and select compliant commercial hosting before production use. Do not change billing/plan or create a duplicate project without explicit authorization.
4. **Live pilot:** once access is approved, execute the controlled employer/institution/student workflow using approved synthetic accounts only.
5. **Reliability:** perform load/capacity, backup/restore, rollback, and dependency-failure exercises and attach attributable results.
6. **Security operations:** verify production credentials, API restrictions, rate limiting, monitoring, security contact, and credential-rotation procedure.
7. **Privacy/employment:** obtain attributable approvals for notice, retention/deletion, terms, employment safeguards, and incident notification.
8. **Operational ownership:** record support owner, SLO expectations, incident response owner, and release/rollback owner.
9. **Final certification:** change the release classification only after all applicable blocking checkboxes have evidence.

### Current blockers

- PR #22 has no independent human review; authorized preview/browser validation is still blocked by Vercel SSO.
- Live staging and the accessible Vercel alias do not yet demonstrate the full baseline security-header set on the current candidate.
- Main reports `protected: false`; appropriate branch protection/required checks need authorized admin action.
- Vercel project/deployment access and exact production alias-to-SHA mapping remain unresolved. The connected team is Hobby; no plan/billing mutation or duplicate project was created.
- Commercial hosting, privacy/employment, security-operations, reliability, live-pilot, and operational ownership gates remain unchecked pending attributable evidence and approvals.
