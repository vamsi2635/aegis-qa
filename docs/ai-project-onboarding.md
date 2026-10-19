# Aegis QA: Project Onboarding Workflow

This document defines how to apply Aegis QA to a new software project while minimizing changes to the application.

## Inputs

Before onboarding, identify what is available:

- Application repository and default branch.
- Business requirements, user stories, acceptance criteria, diagrams, and known defects.
- Approved non-production UI/API URLs and permitted test accounts.
- API specifications and integration documentation, if available.
- Test data constraints, data reset/cleanup strategy, and role/permission matrix.
- CI provider, deployment stages, and release approval policy.

Do not put credentials, access tokens, cookies, customer records, or production data in the repository or AI prompts.

## Phase 1 — Read-only discovery

Use the aegis-project-analyst agent first.

Inspect repository instructions, manifests, source structure, route definitions, domain/API contracts, existing tests, fixtures, CI workflows, and deployment configuration. Use approved browser exploration only against a non-production target.

Deliverable: docs/project-discovery.md in the target project or a reviewable onboarding artifact. Every important finding must cite its evidence path and be marked confirmed, inferred, assumed, or unknown.

No application files are changed in this phase.

## Phase 2 — Requirements and test planning

Create:
- docs/qa/test-strategy.md
- docs/qa/requirements-traceability.md
- docs/qa/test-scenarios.md
- docs/qa/open-questions.md when requirements are ambiguous

Give each requirement and scenario a stable ID. Include role, preconditions, test data, steps, expected result, priority/risk, proposed test layer, automation status, and execution result.

Cover applicable happy paths, negative paths, boundaries, authorization, state transitions, integration failures, and non-functional checks. Scope security, accessibility, performance, and compatibility tests explicitly; do not imply they are covered if they are not.

Do not invent expected business behavior. Ask for decisions when an unknown materially changes expected results or risk.

## Phase 3 — Minimal test-infrastructure adaptation

Before adding infrastructure, compare the target project's current setup with the proposed approach.

1. Reuse existing test tooling when it is suitable.
2. If no suitable browser/API automation exists, propose the smallest compatible setup.
3. Keep test code separate from application code wherever possible.
4. Reuse existing fixtures, factories, API clients, page objects, and test-data mechanisms.
5. Use synthetic data and isolated test accounts.
6. Do not change business logic, database schema, auth behavior, or application architecture just to make tests easier without explicit approval.

List proposed file changes and the reason for each before broad changes.

## Phase 4 — Incremental test generation

Generate tests by risk-ranked feature slices, not by creating hundreds of unreviewed tests at once.

For each batch:
1. Link tests to scenario IDs.
2. Use stable, user-observable assertions and the project's established conventions.
3. Keep tests isolated and deterministic.
4. Run the focused tests.
5. Run typecheck, lint, formatting, and relevant regression checks when supported.
6. Preserve reports, traces, screenshots, and logs for failures.
7. Update traceability with actual outcomes, not expected outcomes.

## Phase 5 — Failure diagnosis and healing

Classify each failure as:
- Product defect
- Test defect
- Environment or test-data issue
- Inconclusive

Use evidence before changing code. Prefer the smallest safe patch. Never delete or skip a failing test, weaken assertions, alter expected business behavior just to pass, or mark a failure fixed without rerunning the relevant checks.

Application-code fixes require explicit authorization. Keep the original failure and before/after results available.

## Phase 6 — CI/CD integration

Inspect the existing CI/CD provider and workflows before changing them.

Propose a staged pipeline appropriate to the project, such as:
- Install with the lockfile and static checks.
- Unit/integration tests already present in the project.
- API and UI smoke tests against approved non-production environments.
- Broader regression and relevant quality/security checks.
- Artifact publication: test report, traces, screenshots, and machine-readable results.
- Deployment to a staging/release candidate environment.
- Explicit approval gates before production deployment.

Use least-privilege permissions, protected secrets, pinned actions where required by repository policy, timeouts, and artifact retention. Never add real secrets to source control. Do not deploy, merge, or approve a release autonomously.

## Phase 7 — Readiness report

The final report must include:
- Scope and requirements understood.
- Scenario counts by priority and layer.
- Requirement-to-test traceability and known gaps.
- Actual test results and exact commands/run links.
- Failures, root-cause classification, and unresolved defects.
- Files changed and why each change was necessary.
- CI/CD status and release blockers.
- Residual risks and a recommendation: ready for human release review, not ready, or inconclusive.

Passing tests are evidence, not proof that the system is bug-free. Never claim complete coverage unless the scope and evidence support that claim.
