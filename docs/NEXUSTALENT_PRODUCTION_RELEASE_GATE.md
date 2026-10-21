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


## Evidence reconciliation — 2026-10-20 (supersedes older deployment snapshots)

This section records the latest read-only checks and supersedes older claims above where dates or deployment identifiers conflict. It does **not** certify production readiness.

### Current repository and candidate state
- Main baseline checked for this reconciliation: `5cef8fd32477d8dbb166a531858bb739145ccb55`.
- Main's combined-status endpoint returned a Vercel `success` status for that SHA. This endpoint did not return the GitHub Actions CI and Production Gate runs; use the linked Actions runs recorded in the current release tracker for those gate results rather than treating this single status as a complete quality-gate record.
- Security PR #25 (`security/vercel-edge-hsts-20261018`, head `611dbacad8bed3601e1483a48dd605e5b9cb8abe`) is still **open, draft, and unmerged**. Its one-file change adds edge HSTS in `vercel.json`. The PR's stated validation requirements remain open: authorized live response validation, exact alias/deployment mapping, independent review, and release approval. Keep it unmerged until those gates are met.
- The main release tracker remains Issue #15: https://github.com/vishaltradewinds/Campus-/issues/15. The issue is open and identifies production authorization and attributable live operational evidence as blockers.

### Render controlled-staging observations (2026-10-20)
- Canonical service: `nexustalent-zero-cost-v2`, ID `srv-datjr5qd0e5s73cddh9g`, URL https://nexustalent-zero-cost-v2.onrender.com, Free plan, region Singapore, branch `main`, health path `/api/health`, one configured instance. This remains controlled staging only, not approved commercial production hosting.
- Current recorded deployment: `dep-db9src942hec73d24k40`, commit `5cef8fd32477d8dbb166a531858bb739145ccb55`; Render reports its build and deploy succeeded on 2026-10-17.
- Event history returned that successful deployment and no newer service events in the returned page. Absence of events is not evidence of continuous availability.
- The latest metrics query returned only two memory data points (about 128–130 MB, 5 minutes apart); HTTP request count, HTTP latency, instance count, and CPU series were empty. Monitoring/reliability evidence is therefore insufficient to establish SLOs or diagnose earlier intermittent latency/startups.
- Earlier authorized-workstation direct checks returned HTTP 200 for root and `/api/health`, and observed `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and HSTS. CSP was not observed. These earlier spot checks do not substitute for a fresh, repeatable live workflow test or continuous monitoring evidence.

### Vercel access and deployment evidence
- The existing Vercel project identifier remains `prj_QpjLvb7qeZ3mD8BBOhntbcmlWjCi` in team `team_2avT1hjjhqNPLDrMRqio4QE8`. The current project-detail API call returned 404 (project not found in that API context); the recent runtime-error query returned 403 (project inaccessible). Do not retry unchanged, infer the project was deleted, create a duplicate, bypass SSO/protection, or change plan/billing.
- Previously observed alias responses may be cached and do not prove the exact current main SHA is being served from a fresh origin. Production alias-to-deployment mapping and current-origin header validation remain **unverified**.
- Team plan is Hobby; do not use it as commercial production hosting or upgrade/change billing without explicit authorization.

### Required next actions (still open)
1. Resolve existing Vercel project access through the authorized account/team; verify exact deployment SHA, alias mapping, fresh-origin response and all required headers without bypassing SSO.
2. Obtain independent review for PR #25 and validate the candidate against an authorized live endpoint before considering merge.
3. Establish a compliant commercial production hosting route without changing billing or creating duplicate services without authorization.
4. Diagnose Render startup/latency behaviour with attributable logs and populated HTTP/instance metrics; retain it as staging only.
5. Complete authenticated synthetic employer/institution/student journeys, consent revocation, audit reconstruction, privacy/security approvals, dependency-failure, load, backup/restore and rollback tests.
6. Have an authorized repository administrator configure suitable branch protection and required checks; do not self-approve.
7. Issue #15 has been updated with the 2026-10-20 reconciliation and fresh workstation verification; continue using it as the authoritative release tracker.

**Decision remains: CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.** No production promotion, billing/plan change, environment-variable change, protection bypass, or duplicate service creation was performed.


### Fresh alias probe — 2026-10-20 13:20 UTC
- Vercel's deployment inventory now confirms deployment `dpl_GKUDmKFnrWkRKuqtnxbCY4dDJAjb` is `READY`, target `production`, and built from exact main SHA `5cef8fd32477d8dbb166a531858bb739145ccb55`. The three known aliases are mapped to this deployment in Vercel metadata. This improves deployment-mapping evidence but does not establish fresh-origin content.
- Authorized workstation GET to `https://campus-coral-one.vercel.app/` with a unique query and `Cache-Control: no-cache, no-store, max-age=0` returned HTTP 200. The response showed all four headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- However, the same response reported `X-Vercel-Cache: HIT`, `Age: 190299`, and `Last-Modified: Sun, 18 Oct 2026 08:28:49 GMT` despite the unique query and no-cache request. Therefore the response is cached and does **not** prove that the current origin/main deployment served the body or headers freshly.
- The other two aliases, `campus-rupay-kg.vercel.app` and `campus-git-main-rupay-kg.vercel.app`, returned HTTP 302 to Vercel SSO when tested unauthenticated. Headers on those responses belong to the SSO layer, not the app. No SSO bypass was attempted.
- Result: the exact main deployment is READY and Vercel metadata maps aliases to it; fresh-origin response verification and authenticated app workflow validation remain open.


### Render instance-start evidence — 2026-10-20 13:25 UTC
- Render app logs show successful server-start messages from different instance IDs at 2026-10-19 08:30, 09:31, 10:22, 11:31, 12:30, 13:33, and 14:27 UTC, then 2026-10-20 09:49, 11:08, and 13:11 UTC. Each logged `Campus Talent Exchange OS server running on http://0.0.0.0:10000`; no matching error/failed/shutdown/SIGTERM/SIGKILL messages were returned by the queried log filter.
- This establishes repeated instance starts, not the cause. The queried Render service-event feed returned no server-failed, server-restarted, or instance-count-change events; it did return the successful 2026-10-17 deployment. Possible causes such as free-tier suspension, platform replacement, health-check recovery, or scaling remain unproven and must not be asserted without provider telemetry.
- Metrics from 2026-10-20 10:00–13:25 UTC contain CPU/memory samples for multiple instance IDs, while HTTP request, HTTP latency, and instance-count series are empty. Latest instance memory samples are approximately 128–130 MB. These sparse samples do not establish uptime or an SLO. Follow-up should compare per-instance lifecycle events and HTTP request logs with Render's instance history and obtain a supported uptime/alerting signal before any production claim.


### PR #26 check results — 2026-10-20 13:25 UTC
- The documentation-only head `af92b606eb5e85323b2806962a234b76617c087a` has GitHub Actions CI run #295 (`39429591621`) **PASS** and NexusTalent Production Gate run #269 (`39429592296`) **PASS**. Vercel preview status is **success**; the preview deployment is READY. This is validation of the documentation branch only and does not certify the live application or close the production release blocker.
- PR #26 has no submitted human reviews at this check. It is marked ready for review separately; do not merge without required independent review and authorized release decision.


### Follow-up verification — 2026-10-20 13:36 UTC

- Re-queried submitted reviews for PR #26 and PR #25: both returned zero submitted reviews. No independent reviewer has been identified or recorded, so neither PR is eligible for merge on the present evidence.
- Historical checkpoint (2026-10-20 13:36 UTC; not the current PR head): PR #26 was at `7c2c130ca3ba9364fcf305c980808ac2db90ed17`; CI #296 (`39430175843`) and Production Gate #270 (`39430175818`) passed for that SHA only. The preview was a preview deployment, not production. Current-head evidence is recorded in the later reconciliation section and must be verified against live GitHub Actions metadata.
- The previous subsection's PR #26 head and runs #295/#269 describe the prior revision and are historical, not the latest results.
- Main's baseline response-header middleware is unchanged: HSTS is set when the request is HTTPS or the forwarded protocol is HTTPS, and CSP is intentionally deferred pending origin inventory/browser testing. PR #25's edge HSTS change remains open and unreviewed.
- No merge, production promotion, billing/plan change, SSO bypass, or service duplication was performed.

**Decision unchanged: CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.** The immediate repository blocker is independent human review; the wider production blockers remain the authenticated live pilot, fresh-origin verification, approved commercial hosting, operational monitoring/reliability evidence, and required privacy/security/operations approvals.


### Evidence freshness rule for pull-request checks

- CI and NexusTalent Production Gate results are commit-specific. A passing run on a parent SHA is historical evidence only and must never be described as a pass for a newer PR head.
- This document is itself under review in PR #26. Its content cannot reliably record a passing result for the exact same final commit without changing that commit and invalidating the recorded SHA relationship. Therefore, use the live GitHub Actions status linked from PR #26 to verify the exact current head SHA before review or merge; do not treat any run number recorded in an earlier subsection as applying to a later revision.
- The current review state, latest head SHA, and checks are intentionally maintained by GitHub's PR/Actions metadata rather than repeated as a supposedly current snapshot inside this file. Prior dated subsections remain historical evidence.
- The PR's Vercel preview is READY in deployment metadata, but unauthenticated requests redirect to Vercel SSO; this is not an application runtime validation. No bypass was attempted.
- No independent human approval is recorded for PR #25 or PR #26 at this update. No merge or production promotion was performed.

**Release decision remains CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.**


### Historical verification note — 2026-10-20 (not current-head evidence)

At the time of this historical check, PR #26 head `35bbbb98be18a0e2f3b470ef300cf0402fee2349` had CI #301 and NexusTalent Production Gate #275 passing for that SHA. PR #25 head `611dbacad8bed3601e1483a48dd605e5b9cb8abe` had CI #287 and Production Gate #261 passing for that SHA. These run results are historical and must not be attributed to later commits.

For the current PR #26 head, use only live GitHub pull-request and Actions metadata to match the exact current head SHA to its CI and Production Gate runs. This document does not assert that any run listed in a dated subsection applies to the current head. Automated review is not independent human approval; live application verification and all production gates remain open. Production certification remains OFF.


### Render staging telemetry follow-up — 2026-10-20 18:47 UTC

- Workspace access was explicitly confirmed for Render workspace `My Workspace` (`tea-dakh7k142hec73aj2kr0`). Read-only queries were run against service `nexustalent-zero-cost-v2` (`srv-datjr5qd0e5s73cddh9g`).
- The seven-day metrics query (2026-10-13 18:47Z to 2026-10-20 18:47Z) returned **empty** time series for HTTP request count, HTTP latency, instance count and CPU usage. Memory telemetry was sparse and split across multiple instance IDs; the newest returned sample was approximately 130.4 MB at 2026-10-20 13:30Z. The previous 62-minute metrics query also returned empty series for all queried metrics.
- Read-only request-log query and error/warning-level query for 2026-10-17 through 2026-10-20 returned no records. Application-log query returned repeated successful startup messages on changing instance IDs, including 2026-10-20 13:41:58Z; no causal failure/shutdown signal was established. This pattern alone does not prove a crash, free-tier suspension, or health-check restart.
- Render service metadata still reports the Free plan, one configured instance, auto-deploy from `main`, and latest successful deployment on 2026-10-17 at commit `5cef8fd32477d8dbb166a531858bb739145ccb55`. It is not a deployment of the current documentation PR and does not certify current application behaviour.
- The public endpoint probe through the available web fetch channel was inaccessible, so no HTTP status/body/header result is claimed from that attempt.
- **Outcome:** telemetry/observability gate remains **BLOCKED / INSUFFICIENT EVIDENCE**. Before production, obtain a supported health/uptime signal, attributable request/latency metrics, and instance lifecycle diagnostics; then run controlled synthetic workflows and failure/recovery tests. Do not infer an uptime SLO from empty metrics or startup logs.



### Render staging diagnostics refresh — 2026-10-20 18:52 UTC

- A fresh read-only 24-hour query (2026-10-19 18:51Z to 2026-10-20 18:51Z) again returned empty series for HTTP request count, HTTP latency and instance count. CPU and memory samples were sparse and distributed across four instance IDs; this is insufficient to calculate availability, request latency, capacity or SLOs.
- The warning/error/fatal log query and request-log query returned no records for this 24-hour window. Treat this as missing telemetry, not evidence that no failures or user-visible errors occurred.
- Application logs recorded successful startup sequences on instance IDs ending `x87kv` at 09:49 UTC, `fhgg7` at 11:08 UTC, `c8ss2` at 13:11 UTC, and `nv5pd` at 13:41 UTC on 2026-10-20. The queried seven-day event feed only exposed the successful 2026-10-17 deployment; it supplied no matching failure/restart explanation. Cause remains **unknown**.
- Service metadata confirms Free plan, not suspended, one configured instance, auto-deploy from `main`, health path `/api/health`, and latest deployment still on main SHA `5cef8fd32477d8dbb166a531858bb739145ccb55`. No service configuration or deployment was changed.
- Desktop Commander workstation `DESKTOP-AGPFFLB` was confirmed **online on 2026-10-21**. Render workspace access is available, so Render telemetry queries can be run independently of Vercel or workstation status. The remaining Render diagnosis gap is missing provider lifecycle events and empty HTTP request/latency/instance-count series; successful startup logs alone do not identify why instances changed. Separately, current connected Vercel scope still does not grant access to the existing Campus project's protected preview/deployment details, so fresh-origin response/header validation and authenticated synthetic user journeys remain blocked by authorized Vercel access.
- **Actionable conclusion:** improve/restore supported monitoring and obtain instance lifecycle evidence before asserting reliability. Do not mark the reliability gate complete based on startup messages or empty metrics.

### Fresh follow-up — 2026-10-21 07:15 UTC

- Rechecked GitHub Actions metadata for PR #26 head `dc38b895a6b434460037fbb91a5b01afed3ac72e`: CI run #304 (`39475853770`) and NexusTalent Production Gate run #278 (`39475853975`) both completed successfully. These results apply to that exact documentation PR commit only; they do not validate the live app or close real-world release gates.
- Rechecked Render workspace `My Workspace` and service `nexustalent-zero-cost-v2`. Logs show successful server startup messages at 2026-10-20 09:49, 11:08, 13:11 and 13:41 UTC on four different instance IDs. The service-event query for the subsequent investigation window returned no lifecycle events. HTTP request-count, latency and instance-count metrics were empty; CPU/memory data was sparse. Cause of instance changes remains **unknown** and no uptime/SLO conclusion is supported.
- The workstation is online, and Render diagnostics are accessible. This removes workstation/Render access as the stated cause of the telemetry investigation being blocked; missing lifecycle telemetry remains the specific diagnostic gap. Vercel project/preview authorization is a separate blocker for fresh-origin header verification and authenticated browser journeys.
- No service configuration, environment variables, deployment, billing, production alias, or protection settings were changed. No SSO bypass was attempted.

**Release decision unchanged: CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.**

### Fresh security and hosting reconciliation — 2026-10-21 07:36 UTC

This section supersedes earlier statements where later evidence changes the status. It does not certify production readiness.

- **Vite security gate:** PR #28 (`security/vite-high-audit-20261021`) pinned both direct Vite declarations to `6.4.5` and refreshed `package-lock.json`. Local `npm audit --audit-level=high` returned `found 0 vulnerabilities`. GitHub CI run #309 (`39562868800`) passed typecheck, matching regression tests, trusted backend regression tests, commercial regression tests, and production build. NexusTalent Production Gate #283 (`39562868812`) passed dependency audit, Firestore/Auth emulator authorization tests, application smoke start, build, and production-container smoke test. PR #28 was squash-merged as `887b287b1e4f8e1ba9c763076198d0f1bd5e5e15`. This proves the automated candidate gate passed; it does not close human review or real-world release gates.
- **Local Windows install caveat:** `npm ci` did not complete locally because Windows returned `ENOENT` and `EPERM` while npm was cleaning/recreating `node_modules`. Do not report local clean-install success. The GitHub CI and Production Gate install steps did pass on the PR candidate.
- **Render staging:** service `nexustalent-zero-cost-v2` (`srv-datjr5qd0e5s73cddh9g`) remains Free, Singapore region, auto-deploying `main`, health path `/api/health`, one configured instance, not suspended. Latest recorded successful deployment at this check is still `dep-db9src942hec73d24k40` on SHA `5cef8fd32477d8dbb166a531858bb739145ccb55` from 2026-10-17; confirm a post-merge deployment before treating the new main SHA as live. Metrics from 2026-10-21 06:30–07:35 UTC returned CPU and memory points (latest memory about 76.6 MB), but HTTP request count, latency and instance-count series were empty. These metrics do not establish uptime, user traffic, or an SLO.
- **Vercel project scope improved but remains incomplete:** the authorized project-list and project-detail calls now return existing project `campus`, ID `prj_QpjLvb7qeZ3mD8BBOhntbcmlWjCi`, under team `RupayKG` (`team_2avT1hjjhqNPLDrMRqio4QE8`, Hobby plan). Project metadata reports latest deployment `dpl_7Z2YYC8Cgj7fEZPXgxW3L1HpZyrZ` in `READY` state, but `target` is null and `live` is false. Direct deployment-detail lookup returned 404 and deployment inventory returned 403. Therefore exact deployed SHA, alias-to-deployment mapping, and fresh-origin response remain unverified. SSO protection is enabled for all deployments except custom domains; no bypass was attempted. Do not create a duplicate project or change billing/plan.
- **Still-open production gates:** independent human review and authorized release decision; fresh-origin verification of required headers; authenticated synthetic employer/institution/student journeys including consent revocation and audit reconstruction; branch protection/required checks (main previously reported `protected: false`); approved commercial hosting; load/capacity, backup/restore, rollback and dependency-failure tests; privacy/employment/security approvals; operational support, SLO and incident-response ownership. No production promotion or billing/protection changes were made.

**Decision remains: CONTROLLED PILOT / STAGING — PRODUCTION CERTIFICATION OFF.**
