# NexusTalent Product & Production Blueprint

Status: **Product design baseline — frozen for production engineering**
Version: 1.0
Repository: vishaltradewinds/Campus-
Scope: Product behavior, operating model, evidence, matching, consent, commercial model, UX, measurement, and production release gates.

## 1. Product North Star

NexusTalent is a three-sided campus talent exchange operating system connecting Employers, Institutions, and Students around **verified demand, verified talent, explicit consent, measurable hiring outcomes, and institutional feedback**.

The product is not a job-board clone. Its core unit is a **Recruitment Campaign** that moves a verified employer requirement through institutions and consented students to a measurable joining outcome.

North Star metric:
**Successful verified joins per active qualified employer requirement.**

The primary value loop is:

Employer demand -> eligibility/matching -> institution call -> institution response -> student opportunity -> student consent -> assessment -> shortlist -> interview -> offer -> acceptance -> joining -> outcome -> reputation/learning.

## 2. Stakeholder Operating Model

### Employer
Owns legitimate hiring demand and hiring decisions.
- Maintain verified employer identity.
- Create job requirements.
- Define eligibility, locations, compensation, joining window, assessment and selection process.
- Discover institutions and eligible candidate pools.
- Send Calls for Talent.
- Review only authorized candidate evidence.
- Conduct human assessment/interviews.
- Record offer, acceptance and joining outcomes.
- Cannot bypass consent or tenant boundaries.

### Institution
Acts as the institutional talent gateway.
- Maintain institution identity and empanelment.
- Verify enrolled/student records within its authority.
- Maintain batch/branch supply inventory.
- Receive and respond to employer Calls for Talent.
- Activate eligible students for a campaign.
- Publish aggregate availability.
- Maintain placement-policy configuration.
- Record institutional outcomes and evidence.
- Cannot disclose private student data merely because a demand exists.

### Student
Owns their career identity and consent.
- Create and maintain a Career Passport.
- Submit evidence and verification requests.
- Control opportunity-specific consent.
- Choose data-sharing scopes.
- Complete assessments/interviews.
- Accept/decline opportunities and offers.
- Review privacy/visibility settings.
- Revoke future sharing where supported by the applicable workflow.

### Platform
Provides neutral infrastructure.
- Identity and access control.
- Evidence/verification state.
- Matching and discovery.
- Consent enforcement.
- Workflow orchestration.
- Audit trail.
- Analytics and reputation.
- AI decision support with human accountability.
- Abuse/fraud controls.
- Does not become the employment decision-maker.

## 3. Canonical Lifecycle

1. Employer onboarding and verification.
2. Institution onboarding and empanelment.
3. Student onboarding and identity/evidence capture.
4. Employer creates Requirement.
5. Platform validates Requirement completeness.
6. Requirement becomes a Campaign.
7. Platform calculates institution eligibility/matches.
8. Employer targets institutions.
9. Calls for Talent are dispatched.
10. Institution accepts/declines/counters.
11. Institution activates eligible students.
12. Platform creates student opportunities.
13. Student reviews opportunity.
14. Student explicitly consents and selects permitted sharing scopes.
15. Platform creates a minimized candidate projection.
16. Employer assesses/shortlists.
17. Employer interviews using human scorecards.
18. Employer issues offer.
19. Student accepts/declines.
20. Joining is recorded.
21. Outcome is reconciled.
22. Institutional/employer performance metrics update.
23. Evidence and audit records remain reconstructable subject to retention policy.

Every transition must be authorized, auditable, replay-safe where applicable, and attributable to an actor.

## 4. Canonical Product Objects

- User
- Employer
- Institution
- Student Career Passport
- Evidence Item
- Verification Record
- Hiring Requirement
- Recruitment Campaign
- Institution Match
- Call for Talent
- Student Opportunity
- Consent Record
- Candidate Projection
- Assessment
- Interview Scorecard
- Offer
- Placement Outcome
- Reputation Record
- Audit Event
- Commercial Plan
- Quote/Invoice/Success Fee Record

The existing TypeScript types and Firestore collections remain the implementation baseline; additions must preserve tenant isolation and auditability. The detailed engineering contract is in `docs/NEXUSTALENT_CAREER_PASSPORT_EVIDENCE_SPEC.md`.

## 5. Career Passport

The Career Passport is the student's canonical, consent-controlled career evidence record.

Sections:
- Identity
- Institution affiliation
- Education
- Academic results
- Skills
- Projects
- Internships/experience
- Assessments
- Preferences
- Availability
- Verification status
- Opportunity history
- Consent history
- Placement outcomes

Every material claim should carry an evidence/verification state:

Self-declared -> Submitted -> Under review -> Verified / Rejected / Expired

Verification is not implied by data presence.

Employers must receive a minimized Candidate Projection, never an unrestricted student passport.

## 6. Evidence & Verification Model

Authority must match claim type.

| Claim | Primary evidence authority |
|---|---|
| Identity | Approved identity-verification mechanism |
| Enrollment | Institution/authoritative academic source |
| Degree/academic record | Institution/authoritative academic source |
| Skill | Assessment or recognized verification source |
| Project ownership | Student + repository/project evidence |
| Internship | Employer/evidence provider |
| Employment | Employer/evidence provider |
| Placement | Employer + student/institution reconciliation |
| Outcome | Employer/institution/student reconciliation |

Verification records must contain:
- subject
- claim type
- source
- evidence reference
- verifier
- status
- verified timestamp
- expiry/review date where relevant
- rejection/review reason
- audit reference

No UI badge may imply verification without a corresponding authoritative verification state.

## 7. Matching Rules

Matching is decision support, not an employment decision.

The candidate/institution fit model should remain decomposable:
- Eligibility gate
- Skill match
- Academic match
- Preference/location match
- Availability/joining fit
- Assessment evidence
- Verified evidence quality

A recommendation must be explainable as positive and missing alignment factors.

Hard eligibility failures must not be hidden by a high soft-match score.

AI may provide rationale or normalization but cannot:
- infer protected/sensitive traits;
- invent evidence;
- convert missing data into positive evidence;
- make the final hiring decision;
- be the sole basis for rejection, compensation, or selection.

Human reviewers remain accountable.

## 8. Consent & Visibility

Consent is opportunity-specific unless the student explicitly chooses a broader supported permission.

Minimum scopes:
- academicDataShared
- skillBenchmarksShared
- projectReposShared
- contactInfoShared

Visibility states:
1. Not targeted
2. Targeted/invited
3. Opportunity visible to student
4. Consented with selected scopes
5. Candidate projection available
6. Interview-stage data
7. Offer-stage data
8. Joined/outcome record

Rules:
- Institutional eligibility does not equal student consent.
- Employer demand does not authorize student disclosure.
- Consent must be attributable to the student actor.
- Projection must be regenerated/revalidated against current consent.
- Revocation must block future unauthorized access.
- Audit records must capture material consent changes.

## 9. Recruitment State Machine

Canonical opportunity stages:

invited -> consented -> assessment_pending -> assessment_completed -> shortlisted -> interviewing -> offered -> accepted -> joined

Alternative terminal states:
- declined
- rejected

Invalid transitions must be rejected server-side.

Each stage change must:
- identify actor;
- validate role/ownership;
- validate current state;
- validate campaign/opportunity relationship;
- write the state change atomically where concurrency can occur;
- create an audit event;
- be replay-safe where the request has an idempotency key.

## 10. Institution Reputation

Reputation must describe observed outcomes, not popularity.

Initial measures:
- eligible sample
- applicant count
- offer rate
- joining rate
- skill/evidence accuracy
- benchmark score
- notable strengths

Production rules:
- do not publish tiny-sample rankings as authoritative;
- show sample size and measurement period;
- separate verified outcomes from self-reported outcomes;
- apply time windows/decay;
- prevent a single employer/student from dominating the score;
- allow correction/dispute workflows;
- retain the evidence lineage behind material scores.

## 11. Commercial Product

Core monetization unit is employer-side recruitment value.

Potential commercial products:
- Employer recruitment campaign
- Verified talent access
- Assessment/verification services
- Enterprise recruitment workflow
- Institutional placement operations
- Institutional analytics/reporting

Students should not be required to pay to exercise fundamental consent or access their own career identity.

Commercial rules must never override:
- consent
- privacy
- eligibility
- security
- human hiring accountability

Any success-fee calculation must be deterministic, attributable to a campaign/outcome, and protected against duplicate charging. The engineering baseline now records deterministic campaign quotes and joining success-fee outcomes; payment collection, tax and final commercial terms remain separate approval gates.

## 12. UX Principles

Mobile-first, simple, fast, trustworthy.

The product should expose:
- one primary action per workflow stage;
- clear actor ownership;
- plain-language consent;
- visible verification status;
- clear next step;
- recoverable errors;
- meaningful empty states;
- accessible controls;
- minimal data entry through progressive disclosure.

Power-user analytics may be deep, but the first-time experience must not look like an enterprise control panel.

Student experience priority:
Understand -> Decide -> Consent -> Act

Employer priority:
Demand -> Discover -> Contact -> Evaluate -> Hire

Institution priority:
Verify -> Respond -> Activate -> Place -> Measure

## 13. Analytics

North Star:
**Successful verified joins per active qualified employer requirement.**

Core funnel:
- requirements created
- qualified requirements
- institutions targeted
- calls accepted
- students activated
- opportunities created
- consents
- assessments completed
- interviews
- offers
- accepted offers
- joins

Quality metrics:
- time to first qualified candidate
- fill rate
- consent rate
- offer-to-join rate
- 30/90-day retention where lawfully measurable
- employer repeat demand
- institution response rate
- verification accuracy
- candidate experience
- dispute/reversal rate

Every metric needs a definition, owner, source of truth, time window and calculation rule.

## 14. Production Data Principles

- Tenant ownership is authoritative.
- Client-side hiding is never authorization.
- Minimize candidate projections.
- Separate identity, evidence, workflow and analytics concerns.
- Preserve lineage from outcome back to opportunity, campaign and evidence.
- Use deterministic IDs where replay protection is required.
- Never store secrets in client code/source.
- Define retention/deletion before production release.
- Treat audit records as security evidence, not as an unrestricted analytics store.

## 15. AI Product Boundary

AI is an assistive service.

Permitted:
- parsing employer demand
- summarizing job requirements
- explaining match factors
- drafting non-binding recruiter assistance
- identifying missing information
- deterministic/fallback assistance

Not permitted:
- autonomous hiring
- hidden candidate ranking based on protected traits
- fabricated credentials
- irreversible candidate rejection
- compensation decisions without accountable human process

Every AI-assisted workflow must have a deterministic fallback.

## 16. Production Readiness Gates

### Product gate
- operating model frozen
- journeys mapped
- state transitions frozen
- roles/permissions frozen
- consent model frozen
- verification model frozen
- commercial model defined
- metrics defined
- UX acceptance criteria defined

### Engineering gate
- lint/typecheck
- unit tests
- security-rule tests
- transaction/replay tests
- build/start smoke
- container smoke
- dependency security audit
- regression suite

### Security gate
- least privilege
- secrets outside source
- tenant isolation
- candidate projection enforcement
- auditability
- rate limiting
- monitoring/alerting
- incident response
- credential rotation
- backup/recovery

### Legal/compliance gate
- privacy notice
- consent language
- terms
- retention/deletion
- employment/anti-discrimination review
- incident/breach process
- jurisdiction/cross-border assessment where applicable

### Operational gate
- monitoring
- SLO/availability expectations
- support ownership
- rollback
- backup/restore test
- capacity/load test
- production runbook

### Pilot gate
- controlled test employers
- controlled institutions
- synthetic/test student data first
- end-to-end campaign
- consent/revocation test
- offer/join reconciliation
- audit reconstruction
- measured outcomes

## 17. Definition of Product Complete

NexusTalent Product Design is considered complete when:
1. This blueprint is the authoritative product baseline.
2. All implemented workflows conform to the lifecycle and state rules.
3. Product rules have explicit acceptance tests.
4. The Career Passport and evidence model are implemented consistently.
5. Consent/visibility behavior is demonstrably enforced.
6. Commercial rules are deterministic.
7. Metrics have source-of-truth definitions.
8. UX acceptance criteria are tested on mobile and desktop.
9. No critical product ambiguity remains for the controlled pilot.
10. Deviations are recorded as explicit change requests rather than silently implemented.

Product complete does not mean legally cleared or production deployed. Those are separate Shakti gates.

## 18. Change Control

After product freeze:
- product changes require a versioned change record;
- security/privacy-impacting changes require the relevant gate to be rerun;
- schema changes require migration and rollback consideration;
- changes affecting consent or hiring decisions require explicit product/legal review.

This document is the baseline against which subsequent engineering and deployment work should be checked.
