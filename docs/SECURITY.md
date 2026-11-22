# Security Baseline

## Authentication
All privileged operations must derive identity from Firebase Authentication. Client-supplied UID, email, or role is not a trust boundary.

## Authorization
Firestore rules enforce tenant ownership and role boundaries. Super-admin access is based on the Firebase custom claim `role=super_admin`.

## Candidate privacy
Employers must not read the complete `students` passport collection. Candidate projections must contain only fields explicitly authorized by the student's campaign consent scopes.

## AI
External model forwarding is disabled. Legacy AI endpoints fail closed. Manual authorized review remains available; any future AI decision support requires provider/privacy approval and human review and must not infer protected or sensitive characteristics.

## Secrets
Server credentials and payment secrets must remain in the deployment secret manager/environment and must never be committed to source control.

## Incident response
Production deployments must have audit logging, monitoring, alerting, credential rotation, rollback, and a documented process for unauthorized data access.
