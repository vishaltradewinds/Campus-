# NexusTalent Career Passport Evidence & Verification Specification

Status: **Production-engineering baseline**
Scope: Career Passport evidence, authority, verification lifecycle, lineage, expiry and correction.

## 1. Purpose

The Career Passport is a consent-controlled record of career claims. A claim is never considered verified merely because a value exists in the student record.

The canonical evidence lifecycle is:

**Self-declared → Submitted → Under review → Verified / Rejected → Expired (where applicable)**

## 2. Claim authority

| Claim type | Authoritative reviewer |
|---|---|
| Identity | Approved identity-verification mechanism / platform authority |
| Enrollment | Institution |
| Degree | Institution / authoritative academic source |
| Academic record | Institution / authoritative academic source |
| Skill | Approved assessment/verification authority |
| Project ownership | Student evidence + approved verification authority |
| Internship | Employer/evidence provider |
| Employment | Employer/evidence provider |
| Placement outcome | Employer + student/institution reconciliation |

The reviewer must have authority for the claim type and relationship to the student.

## 3. Evidence record

Every evidence item contains:
- stable evidence ID
- student ID
- claim type and human-readable claim label
- source/authority type
- evidence reference
- submission timestamp
- lifecycle status
- verifier and verification timestamp when reviewed
- expiry/review date where applicable
- review reason
- dispute status

## 4. Verification record

A verification record is separate from the evidence item so that the platform retains the decision lineage.

It records:
- verification ID
- evidence ID
- student ID
- claim type
- authority type
- verifier
- decision
- decision timestamp
- expiry where applicable
- reason
- immutable audit event reference

## 5. Product rules

1. Student-submitted evidence starts as **submitted**.
2. Only an authorized evidence authority may verify/reject a claim.
3. Institution authority is limited to enrollment/degree/academic-record claims for its own students.
4. Employer authority is limited to internship/employment/placement-outcome evidence where the employer is the relevant authority.
5. Unsupported actors cannot create a verification record.
6. Client code cannot directly create or modify evidence or verification records.
7. Candidate projections include only consent-authorized evidence-derived fields.
8. Expired verification must not be displayed as currently verified.
9. Corrections and disputes must preserve the prior evidence/verification lineage.
10. Material verification changes are audit events.

## 6. Privacy

Evidence references may contain sensitive information. The platform must:
- minimize what is stored;
- avoid copying source documents when a durable reference is sufficient;
- apply retention/deletion rules before live production;
- expose evidence to the student and authorized institutional reviewers only;
- never expose unrestricted Career Passport evidence to employers.

## 7. Production acceptance evidence

The engineering gate must demonstrate:
- submission creates a submitted evidence record;
- authorized institution review creates a verification record;
- unauthorized review is rejected;
- client writes are blocked by Firestore rules;
- audit records link verification decisions to the actor and request;
- candidate projection remains consent-scoped.

Legal/privacy approval remains an external release gate and is not implied by these engineering controls.
