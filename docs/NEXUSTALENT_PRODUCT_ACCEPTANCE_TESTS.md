# NexusTalent Product Acceptance Tests

These are the canonical acceptance scenarios for the frozen product baseline.

## Employer

### EMP-01 Verified employer creates demand
Given an authenticated employer owner
When a complete requirement is submitted
Then a requirement and campaign are created atomically
And the employer owns both records
And an audit event exists.

### EMP-02 Incomplete demand is rejected
Given a requirement missing a mandatory hiring field
When the employer submits it
Then the platform rejects the request
And no active campaign is created.

### EMP-03 Employer cannot bypass consent
Given a student opportunity without consent
When an employer attempts candidate projection access
Then access is denied.

### EMP-04 Employer can advance only valid stages
Given a candidate at a known recruitment stage
When an employer requests a valid next transition
Then the transition succeeds and is audited.
When an invalid transition is requested
Then it is rejected.

## Institution

### INST-01 Institution receives only targeted calls
Given an institution account
When calls are queried
Then only calls targeted to that institution are returned.

### INST-02 Institution verifies its students
Given an institution owner
When a student belonging to that institution is reviewed
Then institution-authorized verification can be recorded
And the student remains under platform authorization rules.

### INST-03 Institution cannot expose unrelated students
Given a student belonging to another institution
When an institution queries that student's private record
Then access is denied.

## Student

### STU-01 Student sees own Career Passport
Given an authenticated student
When the student opens the passport
Then the student can view and manage their own authorized career data.

### STU-02 Student receives an opportunity
Given a campaign targets the student's institution and the institution activates the student
Then the student receives an opportunity for that campaign.

### STU-03 Consent is explicit
Given an opportunity is invited
When the student has not consented
Then employer candidate projection access remains blocked.
When the student consents
Then only the selected consent scopes are exposed.

### STU-04 Consent scope is enforced
Given consent for academic data but not contact information
When the employer receives the candidate projection
Then academic data may be included
And contact information is excluded.

### STU-05 Revocation blocks future access
Given an existing consent
When the student revokes it
Then subsequent projection access is denied or reduced according to the current authorization state
And the revocation is audited.

### STU-06 Assessment does not fabricate a score
Given a student submits an assessment
Then the platform records completion
And no score is presented as verified unless an authorized scoring process has produced it.

### STU-07 Offer acceptance is attributable
Given a valid offer
When the student accepts
Then the opportunity transitions according to the state machine
And the actor and timestamp are auditable.

## Platform integrity

### INT-01 Replay safety
Given a mutation with requestId X
When the same mutation is submitted again with requestId X
Then it does not create a duplicate business event.

### INT-02 Tenant isolation
Given two unrelated tenants
When tenant A requests tenant B's private recruitment data
Then access is denied.

### INT-03 AI fallback
Given AI is unavailable or returns invalid output
Then the workflow falls back to deterministic human-review-required behavior
And AI failure is never treated as positive candidate evidence.

### INT-04 Audit reconstruction
Given a completed recruitment journey
Then an authorized auditor can reconstruct the material transitions from audit records without relying on client-side history.

## UX

### UX-01 Mobile first action
On a phone-sized viewport, each primary stakeholder workflow presents one clear next action without requiring desktop-only controls.

### UX-02 Consent comprehension
Before consent submission, the student can see the employer, role, purpose, data scopes, and effect of approval in plain language.

### UX-03 Verification clarity
Every verification badge states a meaningful status and does not imply verification merely because data exists.

## Commercial

### COM-01 Deterministic charging
Given a billable campaign/outcome
When the commercial rule is evaluated twice for the same business event
Then the result is identical and duplicate charging is prevented.

### COM-02 Commercial rules cannot override privacy
No commercial event may grant access to candidate data that the student's authorization does not permit.

## Release evidence

A scenario is not considered passed merely because a component renders. Evidence must include the relevant API/database/security behavior for the scenario. Production release requires all blocking scenarios to be demonstrated in controlled test data.

## Candidate privacy / ranking leakage

### PAT-PRIV-01 — No candidate-derived ranking signal before explicit campaign consent
**Given** a candidate has no explicit approved consent for an employer campaign  
**When** candidate matching is evaluated in any client-side product path  
**Then** candidate-specific fit score, matched skills, missing skills, academic/location fit signals, contact data, projects, internships, and other candidate-derived ranking signals are not exposed; the result remains visibility-restricted until consent is explicitly approved.

### PAT-EVID-01 — Accreditation and placement reporting is evidence-backed
**Given** an institution has not supplied verified records for an accreditation or placement metric  
**When** the institution opens or exports the accreditation report  
**Then** the product shows the metric as unavailable/not recorded and never substitutes demo numbers, invented outcomes, or named recruiters.

