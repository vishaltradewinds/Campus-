# Firestore Rules Notes

The rules deliberately avoid treating client-side redaction as authorization.

- Employers can read only verified public employer records or records they own.
- Institutions can read only empanelled public institution records or records they own.
- Employers cannot read `/students` directly.
- Candidate profiles are scoped to the owning employer/student.
- Requirements, campaigns, calls, and opportunities are tenant-scoped.
- Students may update only a narrow opportunity transition field set.
- Verification fields are protected from ordinary owner mutation.
- `super_admin` must come from the Firebase Authentication custom claim; a client-editable user document role is not sufficient for privileged access.

These rules require Emulator tests before production deployment, especially for collection queries because Firestore evaluates whether the query can be satisfied under the rule set.