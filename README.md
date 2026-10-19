# Aegis QA — AI-Ready Playwright Automation Framework

A TypeScript-first QA automation foundation evolving toward a project-aware AI QA engineering workflow: understand a project, map requirements and user flows, plan and generate tests, execute and diagnose failures, and prepare reviewed CI/CD quality gates with minimal application changes.

> **Status:** evolving starter and agent workflow, not an autonomous production release system. Validate it against each application, its security requirements, CI environment, and test data before adopting it as a release gate.

## Architecture

- UI automation: Playwright Test + TypeScript + Page Object Model
- API automation: Playwright APIRequestContext
- Quality controls: TypeScript strict mode, ESLint, Prettier, isolated tests
- Evidence: HTML report, trace on first retry in CI, screenshots on failure
- AI agents: Project Analyst, QA Planner, Test Generator, Test Healer, and Orchestrator profiles under .github/agents
- Onboarding process: docs/ai-project-onboarding.md
- CI: GitHub Actions on pull requests, pushes, scheduled runs, and manual dispatch
- Secrets: .env is ignored; CI secrets are injected through GitHub Actions

## Prerequisites

- Node.js 22 LTS (or newer supported LTS after validating dependency compatibility)
- npm, VS Code, Git
- GitHub Copilot Chat with Agent mode for the AI workflow

## Quick start (Windows PowerShell)

```powershell
Copy-Item .env.example .env
npm install
# The committed package-lock.json supports reproducible installs with npm ci
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run report
```

The default UI tests target https://playwright.dev and the API example targets https://jsonplaceholder.typicode.com. These are demo services, not application coverage or a release gate.

Set BASE_URL for the UI and API_BASE_URL for the API in .env when connecting an application. Both must use http or https. ALLOWED_TARGET_ORIGINS is a comma-separated list of exact origins (scheme, host, and optional port) allowed for either target; paths are allowed in target URLs but not in this list. The defaults allow only the two demo origins. When using a real application, replace the allowlist with explicitly approved non-production UI and API origins. Configuration fails at startup if a target origin is not allowlisted or if a URL is invalid or uses another protocol.

UI paths passed to homePage.open() are resolved relative to BASE_URL, including slash-prefixed routes, so a base path such as /qa-app/ is preserved.

This allowlist is a safety guard, not an environment classifier. Keep production origins out of ALLOWED_TARGET_ORIGINS and configure only dedicated development, test, or staging systems. Never point write-capable tests at production.

## Commands

| Command              | Purpose                        |
| -------------------- | ------------------------------ |
| npm test             | Run all Playwright tests       |
| npm run test:ui      | Run UI tests                   |
| npm run test:api     | Run API tests                  |
| npm run test:smoke   | Run smoke-tagged tests         |
| npm run test:headed  | Run with visible browser       |
| npm run test:debug   | Open Playwright debugging mode |
| npm run report       | Open latest HTML report        |
| npm run typecheck    | TypeScript static checks       |
| npm run lint         | ESLint                         |
| npm run format:check | Check formatting               |

## Onboard a new project

Start with the read-only discovery agent, then review the discovery report before planning or modifying anything.

1. Open the target project in VS Code and confirm its repository instructions and approved non-production environment.
2. Invoke the **Aegis Project Analyst** agent to inventory architecture, requirements evidence, user roles, flows, test infrastructure, and CI/CD.
3. Review the findings and resolve important unknown business rules with the product owner.
4. Use the **Aegis Orchestrator** agent to create a risk-ranked test strategy and requirement-to-test traceability.
5. Generate tests incrementally using the existing project conventions and the smallest necessary infrastructure changes.
6. Run targeted tests, typecheck, lint, and relevant regression checks. Preserve failure evidence and update traceability with actual outcomes.
7. Propose CI/CD changes on a feature branch. Require human review for application changes, merges, deployments, and release decisions.

See docs/ai-project-onboarding.md for the full process and required deliverables.

## AI workflow and safety

The agent profiles are reusable instructions for specialized work; they do not by themselves prove that the entire workflow is automatically orchestrated end-to-end. Validate each agent with a representative task and inspect its edits and actual tool results.

AI may explore and propose tests, but generated code must pass appropriate checks. The Healer must not change expected business behavior, weaken assertions, skip tests, or silently convert a product defect into a passing test. Do not give agents production secrets or unfiltered customer data. Use synthetic data and approved non-production targets.

## Important limitations

- This scaffold does not include an application-under-test, production credentials, a deployment pipeline for your product, or verified coverage for your app.
- The API test uses a public demo endpoint. Replace it with your approved test API before using the suite as a release gate.
- A passing suite is not proof of zero defects or complete coverage.
- Before production adoption, verify action pinning, branch protection and required checks, data cleanup, threat model, artifact retention, and human release approvals.
