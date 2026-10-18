# Architecture

## Principles
1. Test observable user and API behavior, not implementation details.
2. Keep tests isolated and safe to run repeatedly.
3. Separate test intent from reusable page interactions.
4. Make failures diagnosable from CI artifacts.
5. Keep AI authoring separate from execution and merge approval.

## Layers
- `tests/ui`: user journeys and user-visible assertions.
- `tests/api`: API contract and response behavior.
- `src/pages`: page-specific interactions and locators.
- `src/fixtures`: typed, reusable setup per test.
- `src/config`: validated environment configuration.
- `.github/workflows`: static checks and deterministic test execution.

## Browser strategy
Start with Chromium for a stable smoke baseline. Add Firefox/WebKit projects only when the product support matrix requires them and CI capacity is understood. Avoid adding browser matrix complexity without a product reason.

## Reporting
HTML report + JUnit output; traces on first retry in CI and retained evidence on failure. Establish artifact retention and access policies based on whether screenshots/traces can contain sensitive data.
