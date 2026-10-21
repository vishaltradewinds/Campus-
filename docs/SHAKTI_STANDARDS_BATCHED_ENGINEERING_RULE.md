# Shakti Standards — Batched Engineering Execution Rule

**Status:** Mandatory standing rule for all AllianceVentures projects and all engineering work governed by Shakti Standards.

## Rule

Implement the complete planned scope in coherent, dependency-aware batches before treating repeated full CI runs as the normal feedback loop. Do not stop after each small edit to report progress or trigger the entire remote pipeline again and again. Build a complete implementation inventory, then deliver the agreed scope, and verify it at meaningful checkpoints.

This rule changes execution efficiency; it does **not** weaken quality, safety, compliance, or release gates.

## Required workflow

1. **Discover reality and scope.** Inspect the actual repository, current branch/commit, system architecture, existing behavior, user objective, evidence, applicable statutory/regulatory requirements, dependencies, constraints, and operational context. Do not infer unseen state.
2. **Inventory the complete work.** Break the objective into deliverable requirements, dependencies, affected files/components, migrations, security controls, integration points, tests, evidence, external prerequisites, and explicit non-applicability decisions.
3. **Plan coherent batches.** Group changes by dependency and outcome. Prefer completing related implementation, documentation, and tests together. Use targeted type-checks/tests during development when they materially reduce risk; avoid repeatedly running the full remote CI pipeline after each trivial edit.
4. **Implement the planned scope.** Complete the in-scope code, configuration, migrations, tests, documentation, runbooks, observability, and recovery behavior before declaring implementation complete. Do not silently narrow the objective.
5. **Verify at meaningful checkpoints.** Run targeted checks as needed, then the full relevant suite: type-check/lint, regression tests, integration tests, tenant/data-isolation tests, security/dependency checks, production build, container/startup smoke tests, and authorized staging validation where available. Test actual behavior, not merely endpoint health.
6. **Fix failures by root cause.** Review logs and evidence, group related defects, correct the underlying causes, and rerun affected checks. Then rerun the full required suite on the final candidate commit. Never report a pass based on a previous commit.
7. **Record evidence and limitations.** Record commit SHA, exact workflow runs, results, test coverage boundaries, known gaps, and external dependencies. Distinguish implementation complete, verification passed, staging validated, and production certified.
8. **Release only through Shakti gates.** Keep production release/certification blocked until all applicable technical, operational, security, legal/regulatory, data migration, recovery, independent-review, and human-approval gates pass. If an external prerequisite blocks a step, complete all safe and independent work first, then document the specific blocker.
9. **Report at milestones.** Report completed batches with evidence and the next meaningful milestone. Do not create the impression that each commit or passing health check means the whole platform is complete.

## Fast-fail exception

Immediate targeted checks are required when a change could compromise security, data isolation, integrity, privacy, destructive operations, migration safety, or regulatory correctness. These checks may occur before the batch is complete to prevent compounding a serious defect. They do not replace final full-suite verification.

## Completion definitions

- **Implementation complete:** all planned in-scope changes, tests, documentation, and operational artifacts have been authored.
- **Verification passed:** the final candidate commit passed the required automated and manual checks; results must identify that exact commit.
- **Staging validated:** the intended integrated behavior was exercised in an authorized staging environment with relevant evidence. A public health endpoint alone is not sufficient.
- **Production certified:** all applicable Shakti gates and explicit approvals are satisfied. Passing CI alone is not certification.

## Universal principle

**One Shakti Standard. Many project-specific operating systems.** Apply this execution rule universally, while keeping controls, evidence, architecture, and test depth specific to each project and risk profile.
