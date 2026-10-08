# Career Passport Evidence Authority Matrix

This is the product authority boundary. A claim becomes verified only after the source authority has been established and an authorized platform reviewer records the verification decision.

| Claim type | Preferred authority | Required provenance | Expiry/reverification |
|---|---|---|---|
| identity | Platform / legally authorized identity source | source reference and evidence record | As required by source/policy |
| institution | Institution | institution ID and supporting record | Reverify when institutional status changes |
| education | Institution / awarding authority | institution/source ID and evidence | Reverify when policy requires |
| skill | Institution, employer, assessment provider or platform assessment | authoritative source + evidence | Skill-specific |
| project | Institution / employer / platform review | project evidence and reviewer | Reverify when evidence changes |
| internship | Employer / institution | employer or institution reference | Date-bounded |
| assessment | Assessment provider / platform | assessment ID and authorized score | Assessment-specific |
| employment_outcome | Employer | verified employer reference and joining/outcome record | Reverify on correction/dispute |

## Mandatory controls

1. Student submissions start as submitted; they cannot self-verify.
2. Verified requires non-student provenance.
3. Expired evidence cannot be used as current verified evidence.
4. Reverification creates a new review event while retaining lineage.
5. Rejection requires a reason.
6. Students may dispute evidence; disputes do not erase historical records.
7. Review and dispute resolution are authorized operations and are audit-recorded.
8. Matching/projection must use only current verified evidence.
9. Platform UI must distinguish self-declared, submitted, under-review, verified, rejected and expired states.
10. Legal policy may impose stricter authority or retention requirements for a jurisdiction.

This is an engineering authority matrix and not legal advice.
