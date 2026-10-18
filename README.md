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
# npm install creates package-lock.json; commit it before pushing to GitHub
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run report
```

The default UI smoke test targets `https://playwright.dev` as a safe example. Set `BASE_URL` to your own test/staging app when ready. Never point write-capable tests at production without an explicit approved strategy.

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

Before the first push, run `npm install`, review the generated `package-lock.json`, and commit it. CI uses `npm ci`, which intentionally requires a committed lockfile for repeatable dependency resolution.

1. Set `BASE_URL` in `.env` to a test/staging URL.
2. Agree on a small, stable smoke-test scope.
3. Add page objects and tests only for observed, user-visible behavior.
4. Run locally, inspect report and trace, then open a PR.
5. Add CI secrets only after confirming the workflow requires them.

## AI workflow

See `docs/ai-agent-operating-model.md`. AI may explore and propose tests, but generated code must pass typecheck, lint, and test validation. The Healer must not change expected business behavior, weaken assertions, skip tests, or silently convert a product defect into a passing test.

## Important limitations

- This scaffold does not include an application-under-test, production credentials, deployment pipeline for your product, or verified coverage for your app.
- The API test uses a public demo endpoint. Replace it with your approved test API before using the suite as a release gate.
- Before production adoption, pin GitHub Actions to verified full commit SHAs, configure branch protection and required checks, define data cleanup, and review threat model and retention policies.
