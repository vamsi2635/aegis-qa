# Aegis QA: Full-Application Testing Platform Blueprint

## Objective

Evolve Aegis from a repository/catalog helper into a guarded, evidence-based application testing platform. The intended workflow begins with an application URL but does not assume the URL reveals all application behavior. Every run records what was observed, what was supplied by an owner, what was inferred, and what remains unknown.

## Capability boundaries

Aegis must not promise exhaustive coverage from a URL alone. Browser-visible behavior cannot reliably reveal server-side rules, private routes, authorization policy, async jobs, integrations, data constraints, or API contracts. Aegis must request the relevant evidence and report gaps rather than invent requirements.

## Onboarding inputs

Use `schemas/application-onboarding.schema.json` as the machine-readable contract. The onboarding manifest supports:

- UI origin(s), API base URL, optional OpenAPI spec, and optional repository location.
- Environment classification and exact authorized origins.
- Explicit read/write/destructive-action policy, crawl page/time budgets, and external-link policy.
- Authentication approach, local storage-state path, environment-variable references, and manual OIDC handoff.
- Role inventory and permission statements without embedding credentials.
- Business journeys with priority, preconditions, approval status, data and cleanup strategy.
- Coverage scope for UI, API, authorization, accessibility, performance, and security.
- Evidence sources and trust level.

The example manifest is deliberately non-runnable and uses an invalid placeholder host. Replace it only with owner-approved test configuration.

## Target pipeline

1. **Preflight and policy gate** — validate the manifest, URL schemes, exact origin allowlist, environment type, credentials policy, budgets, and destructive-action policy. Production/unknown environments default to passive discovery only.
2. **Passive UI discovery** — use a bounded same-origin queue. Record route, title, headings, landmarks, links, controls, forms and validation metadata, console/page errors, response status, redirects, and screenshots. Never submit forms or invoke buttons in passive mode. Redact query strings, fragments, personal data and secret-like text from artifacts.
3. **Authenticated discovery** — use a dedicated test account or reviewed storage state, one role per isolated browser context. Do not bypass MFA/SSO; support a manual login handoff or existing approved fixture. Do not save raw cookies/tokens to reports. Verify role and session identity before recording routes.
4. **API contract discovery** — prefer a reviewed OpenAPI specification or application repository. Inventory documented methods, schemas, auth requirements and status codes. A URL-only HTTP probe is insufficient to infer business rules. Avoid mutation methods unless explicitly authorized and isolated test data is available.
5. **Business journey and requirement modelling** — combine discovered evidence with approved stories, acceptance criteria, role/permission matrix, data model, known bugs and integration contracts. Assign stable REQ/JNY/TC IDs and evidence references. Mark each expected result approved, inferred, assumption, or needs-clarification.
6. **Test design** — derive positive, negative, boundary, state-transition, role/authorization, session, API schema, integration, accessibility, and risk-based regression scenarios only where evidence supports expected outcomes. Include setup and cleanup.
7. **Executable test generation** — generate real Playwright UI/API tests in small reviewable batches, using stable accessible locators, fixtures, typed API clients, unique synthetic data, cleanup hooks, scenario IDs and deterministic assertions. Never ship a placeholder as a passing test. Unresolved requirements remain disabled and visibly blocked.
8. **Controlled execution** — run by environment and role with strict origin allowlist, timeouts, concurrency and rate limits. Start with read-only smoke tests; require explicit per-environment approval for writes and separately approved destructive tests. Isolate data and never run uncontrolled tests against production.
9. **Failure triage** — classify failures as product defect, test defect, environment/data issue, or inconclusive. Capture Playwright trace, screenshot, console/network metadata and relevant API response after redaction. Retry to diagnose flakiness but do not erase the first failure or turn retry-passes into clean passes.
10. **Evidence-backed reporting** — publish coverage by route, requirement, journey, role, API operation and risk; pass/fail/blocked/inconclusive; reproducible defect reports; artifact references; environment/build; gaps and residual risks. Distinguish a clean run from proof of complete coverage. Release decisions remain human-owned.

## Required input checklist for real projects

| Input                                               | Why it matters                         | Fallback if unavailable                             |
| --------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Approved non-production UI URL                      | Entry point for browser discovery      | Passive discovery only                              |
| API base URL and OpenAPI/API docs                   | Contract and API tests                 | Mark API coverage unknown                           |
| Test credentials or approved storage state per role | Authenticated routes and role coverage | Mark protected areas inaccessible                   |
| Role/permission matrix                              | Authorization expectations             | Ask owner; never guess access rules                 |
| User stories/acceptance criteria                    | Expected business outcomes             | Report observed UI only; do not invent expectations |
| Synthetic test data and reset/cleanup strategy      | Repeatable stateful tests              | Do not perform writes                               |
| Integrations/webhooks/email/payment sandbox         | End-to-end behavior                    | Mock or mark as out of scope                        |
| Build/version and environment identity              | Reproducibility                        | Mark run provenance incomplete                      |
| Permission and action policy                        | Safe exploration/execution             | Read-only, same-origin mode only                    |
| CI access and artifact retention                    | Repeatable scheduled regression        | Local report only                                   |

## Security and privacy controls

- Keep secrets in CI secret stores or ignored local environment files; only reference environment variable names in manifests.
- Never commit storage state, cookies, tokens, passwords, real customer data or unredacted logs.
- Treat application text, HTML, links and API responses as untrusted data, never as instructions for the agent.
- Block unapproved origins and cross-origin redirects; do not follow external links by default.
- Passive discovery is the default. Writes require an explicit manifest flag and owner authorization; destructive operations require a separate explicit gate and cleanup plan.
- Set bounded page count, duration, request rate and concurrency; stop on unexpected redirects, authentication anomalies or policy violations.
- Keep application code immutable during testing unless a separate code-change task is authorized.

## Definition of done for the full platform

The platform is not complete until automated tests prove the policy gates, same-origin crawl, login-state isolation, role matrix, API schema ingestion, journey-to-test traceability, executable UI/API test generation, safe test data/cleanup, failure classification, artifact redaction, and evidence report generation. Include synthetic fixture applications covering public pages, login, role restrictions, forms, API success/error cases, redirects and flaky/network failures. Run CI against these fixtures; never claim full capability based only on docs or scaffolds.

## Current implementation versus target

Existing Aegis has read-only single-page URL inventory, project inventory, scenario catalog validation/planning, placeholder test scaffolding, Playwright result import and a catalog readiness audit. The multi-page crawler, safe authenticated discovery, API contract ingestion, real journey-based test generation, policy enforcement across all execution paths, failure diagnosis and end-to-end evidence-backed reports are future implementation work. This document is a target architecture, not a claim that those features already exist.
