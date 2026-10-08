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


## Canonical transition coverage

### STAGE-01 Consent
Given an invited opportunity
When the student explicitly consents
Then the opportunity becomes consented
And the authoritative campaign consent record is written with the selected scopes
And an immutable audit event exists.

### STAGE-02 Assessment pending
Given a consented opportunity
When the student starts the assessment workflow
Then the opportunity may advance to assessment_pending
And no score is implied by the transition.

### STAGE-03 Assessment completion
Given an assessment_pending opportunity
When the student submits the assessment
Then the opportunity advances to assessment_completed
And no score is considered verified without an authorized scoring result.

### STAGE-04 Shortlist
Given an assessment_completed opportunity
When the employer shortlists the candidate
Then the opportunity advances to shortlisted and the funnel is counted once.

### STAGE-05 Interview
Given a shortlisted opportunity
When the employer starts the interview stage
Then the opportunity advances to interviewing and the transition is audited.

### STAGE-06 Offer
Given an interviewing opportunity
When the employer records an offer
Then the opportunity advances to offered and the offer record/reference is attributable.

### STAGE-07 Acceptance
Given an offered opportunity
When the student accepts
Then the opportunity advances to accepted and the actor/timestamp are auditable.

### STAGE-08 Joining
Given an accepted opportunity
When the employer records joining
Then the opportunity advances to joined and the placement outcome is updated atomically.

### STAGE-09 Invalid transition
Given any opportunity
When an actor attempts to skip a canonical stage or act outside their stakeholder authority
Then the server rejects the transition and does not write a business event.

## Evidence & verification

### EVD-01 Evidence submission
Given an authenticated student
When the student submits a Career Passport evidence item
Then it is stored as submitted and is not marked verified.

### EVD-02 Evidence authority
Given submitted enrollment/degree/academic-record evidence
When the student's institution reviews it
Then a verification record is created and linked to an immutable audit event.

### EVD-03 Unauthorized verification
Given evidence outside an actor's authority
When that actor attempts verification
Then the server rejects the action.

### EVD-04 Evidence client-write protection
Given a browser client
When it attempts to create or modify evidence/verification records directly
Then Firestore denies the mutation.

### EVD-05 Revoked projection
Given a candidate projection that was previously created
When the student revokes campaign consent
Then employer reads of that projection are denied by authorization rules.

These scenarios are release-blocking for the controlled pilot and must be executed with controlled test data; their presence alone is not evidence of a passed live test.
