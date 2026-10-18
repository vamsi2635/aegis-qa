# Test strategy

## Test pyramid

- API: fast contract, validation, authorization and error behavior.
- UI: a small set of high-value end-to-end user journeys.
- Exploratory: human/AI-assisted discovery identifies candidate scenarios, but does not replace deterministic regression tests.

## Test design

For each feature, document requirement/acceptance criteria, preconditions and data, positive/negative/boundary scenarios, expected behavior, cleanup/idempotency, and risk/priority.

## Reliability rules

- Prefer role/label/text locators and explicit test IDs when they are a stable product contract.
- Avoid fixed sleeps and hidden implementation details.
- No shared mutable test data unless synchronization and cleanup are explicit.
- Retries are diagnostic, not proof of stability. Track flaky tests separately.
- Keep smoke tests short; keep broad regression separate.
- Never mark a test as passed by suppressing a meaningful assertion.

## Example release gate (adapt to product risk)

- typecheck and lint pass
- critical smoke tests pass
- no unresolved critical/high-risk defect
- failed tests triaged as product / test / environment / inconclusive
- artifacts reviewed for sensitive data
