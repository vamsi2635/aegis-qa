# Aegis QA — AI-Ready Playwright Automation Framework

A clean, TypeScript-first test automation starter designed for maintainability, traceable failures, and controlled AI-assisted test authoring.

> **Status:** production-oriented starter scaffold, not a certified production system. Validate it against your application, security requirements, CI environment, and test data before adopting it as a release gate.

## Architecture

- UI automation: Playwright Test + TypeScript + Page Object Model
- API automation: Playwright `APIRequestContext`
- Quality controls: TypeScript strict mode, ESLint, Prettier, isolated tests
- Evidence: HTML report, trace on first retry in CI, screenshots on failure
- AI workflow: Copilot instructions + Planner / Generator / Healer operating contract
- CI: GitHub Actions on pull requests, pushes, scheduled runs, and manual dispatch
- Secrets: `.env` is ignored; CI secrets are injected through GitHub Actions

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

The default UI tests target `https://playwright.dev` and the API example targets `https://jsonplaceholder.typicode.com`. These are demo services, not application coverage or a release gate.

Set `BASE_URL` for the UI and `API_BASE_URL` for the API in `.env` when connecting an application. Both must use `http` or `https`. `ALLOWED_TARGET_ORIGINS` is a comma-separated list of exact origins (scheme, host, and optional port) allowed for either target; paths are allowed in the target URLs but not in this list. The defaults allow only the two demo origins. When using a real application, replace the allowlist with the explicitly approved non-production UI and API origins. Configuration fails at startup if a target origin is not allowlisted or if a URL is invalid or uses another protocol.

UI paths passed to `homePage.open()` are resolved relative to `BASE_URL`, including slash-prefixed routes, so a base path such as `/qa-app/` is preserved.

This allowlist is the production-target safety guard; the framework does not guess or hardcode your production domain. Keep production origins out of `ALLOWED_TARGET_ORIGINS`, and configure only dedicated development, test, or staging systems. Never point write-capable tests at production.

## Commands

| Command                | Purpose                        |
| ---------------------- | ------------------------------ |
| `npm test`             | Run all Playwright tests       |
| `npm run test:ui`      | Run UI tests                   |
| `npm run test:api`     | Run API tests                  |
| `npm run test:smoke`   | Run smoke-tagged tests         |
| `npm run test:headed`  | Run with visible browser       |
| `npm run test:debug`   | Open Playwright debugging mode |
| `npm run report`       | Open latest HTML report        |
| `npm run typecheck`    | TypeScript static checks       |
| `npm run lint`         | ESLint                         |
| `npm run format:check` | Check formatting               |

## First run against your app

The committed `package-lock.json` supports reproducible dependency installation through `npm ci`. When dependencies change, review and commit the corresponding lockfile update.

1. Set `BASE_URL` and `API_BASE_URL` in `.env` to the approved non-production UI and API targets.
2. Set `ALLOWED_TARGET_ORIGINS` to the exact origins for those targets; do not include production origins.
3. Agree on a small, stable smoke-test scope.
4. Add page objects and tests only for observed, user-visible behavior.
5. Run locally, inspect report and trace, then open a PR.
6. Add CI secrets only after confirming the workflow requires them.

## AI workflow

See `docs/ai-agent-operating-model.md`. AI may explore and propose tests, but generated code must pass typecheck, lint, and test validation. The Healer must not change expected business behavior, weaken assertions, skip tests, or silently convert a product defect into a passing test.

## Important limitations

- This scaffold does not include an application-under-test, production credentials, deployment pipeline for your product, or verified coverage for your app.
- The API test uses a public demo endpoint. Replace it with your approved test API before using the suite as a release gate.
- Before production adoption, pin GitHub Actions to verified full commit SHAs, configure branch protection and required checks, define data cleanup, and review threat model and retention policies.
