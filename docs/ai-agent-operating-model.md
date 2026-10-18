# AI agent operating model (VS Code + GitHub Copilot)

## Before enabling agents

1. Install dependencies and run baseline tests.
2. Open this repository in VS Code and use Copilot Chat Agent mode.
3. Configure Playwright MCP and verify the server starts.
4. Run `npx playwright init-agents --loop=vscode` with a compatible Playwright version; review generated files.
5. Keep agent-generated edits on a feature branch.

## Planner contract

Explore only an explicitly approved non-production URL. Produce a Markdown plan containing user goal/assumptions, preconditions/data, positive/negative/boundary/authorization cases, observable expected results, risk/priority, candidate locator strategy, and unresolved questions. Do not invent requirements.

## Generator contract

Convert an approved plan into TypeScript tests. Inspect existing fixtures/page objects first; use accessible locators, observable assertions, isolation and controlled data. Do not hard-code credentials or production data. Do not change product code unless separately requested.

## Healer contract

1. Preserve original failure and evidence.
2. Inspect trace, screenshot, console/network errors, response status and test data.
3. Classify product defect, test defect, environment/data issue, or inconclusive.
4. Propose the smallest safe patch and explain root cause.
5. Run targeted test, typecheck/lint and related regression after approval.
6. Report before/after results and residual risk.

Forbidden healing actions: deleting/skipping a failing test, weakening/removing assertions, increasing timeouts without evidence, replacing meaningful assertions with `toBeTruthy()`, changing business expectations to match incorrect behavior, auto-merging or deploying AI-authored changes.

## Prompt templates

### Planner

"Explore the approved non-production application at BASE_URL. Create a risk-ranked test plan for [feature]. Do not invent requirements. Save it under docs/test-plans/[feature].md. Report assumptions and unknowns."

### Generator

"Implement only the approved scenarios in docs/test-plans/[feature].md using the existing framework. Inspect fixtures and page objects first. Do not change product code or weaken acceptance criteria. Run typecheck, lint and targeted tests; report actual results."

### Healer

"Diagnose this failure using test output and trace artifacts. Do not edit until you classify the likely root cause. Propose the smallest patch; do not skip tests or weaken assertions. Run the targeted test and relevant checks after approval."

## Safety boundary

Do not give AI production secrets or unfiltered customer data. MCP browser access is powerful: use a dedicated test account and non-production environment, and confirm destructive actions before execution.
