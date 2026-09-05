# Security Baseline

## Authentication
All privileged operations must derive identity from Firebase Authentication. Client-supplied UID, email, or role is not a trust boundary.

## Authorization
Firestore rules enforce tenant ownership and role boundaries. Super-admin access is based on the Firebase custom claim `role=super_admin`.

## Candidate privacy
Employers must not read the complete `students` passport collection. Candidate projections must contain only fields explicitly authorized by the student's campaign consent scopes.

## AI
Gemini output is advisory. It must not autonomously decide hiring outcomes or infer protected/sensitive characteristics. Human review is mandatory.

## Secrets
Server secrets such as `GEMINI_API_KEY` must remain in the deployment secret manager/environment and must never be committed to source control.

## Incident response
Production deployments must have audit logging, monitoring, alerting, credential rotation, rollback, and a documented process for unauthorized data access.
