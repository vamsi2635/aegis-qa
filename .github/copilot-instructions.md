# Aegis QA — Copilot instructions

You are assisting with a production-oriented Playwright + TypeScript test framework. Preserve its architecture.

## Non-negotiable rules
- Inspect relevant existing files before editing. Do not rebuild the framework or add a competing test stack.
- Use TypeScript strict mode and `@playwright/test`.
- Prefer user-visible locators (`getByRole`, `getByLabel`, `getByPlaceholder`, and `getByTestId` when it is an explicit app contract). Avoid brittle CSS/XPath selectors.
- Tests must be isolated, deterministic, and independent. Do not depend on execution order.
- Use explicit, meaningful assertions tied to acceptance criteria. Never weaken/delete assertions just to make a test pass.
- Avoid arbitrary sleeps (`waitForTimeout`) unless a documented, unavoidable reason exists.
- Keep credentials, tokens, cookies, storage state, PII, and customer data out of source control, logs, prompts, and artifacts.
- Never run destructive actions against production. Use a dedicated non-production environment and synthetic data.
- Keep Page Objects focused on page interactions; keep business assertions in tests.
- Preserve diagnostics: trace, screenshot, video when configured, and relevant console/network evidence.
- Classify failures as product defect, test defect, environment/data issue, or inconclusive.
- The Healer may propose a patch but must not auto-merge, skip a failing test, loosen an assertion, or silently change acceptance criteria.
- Do not claim tests pass unless you ran them and inspected the result.

## Validation before handoff
Run `npm run typecheck`, `npm run lint`, and the relevant Playwright test command. Report commands run, actual outcomes, risks, and files changed.
