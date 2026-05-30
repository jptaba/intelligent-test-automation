---
name: flaky-detect
description: Identify tests that flip between pass and fail across recent runs
---

# Skill: flaky-detect

## Trigger phrases

"find flaky tests", "which tests are unreliable", "intermittent failures",
"flaky test report", "tests that sometimes fail", "detect flakiness"

## What this skill does

Analyses the run history to find tests that change status (pass↔fail) across runs.
A test flipping 2 or more times across the sampled window is reported as flaky.

## Steps

1. Run the flaky detector:

   ```
   npm run flaky
   ```

   Default: last 10 runs, flip threshold: 2

2. With custom options:

   ```
   npm run flaky -- --runs 20 --threshold 3
   ```

3. Read results from `test-results/flaky-registry.json`.

4. Present the report:

   ```
   ## Flaky Tests — last N runs

   [5 flips] cart checkout can complete full checkout flow
             tests/cart/cart.spec.ts
             7/10 runs passed (70% reliable) — last: passed

   [3 flips] inventory user can sort by price low to high
             tests/inventory/inventory.spec.ts
             6/10 runs passed (60% reliable) — last: failed
   ```

## Interpreting the results

| Reliability       | Interpretation                       | Recommendation             |
| ----------------- | ------------------------------------ | -------------------------- |
| < 50%             | Very unreliable — essentially random | Investigate immediately    |
| 50–70%            | Unreliable                           | Add to tech debt backlog   |
| 70–90%            | Occasionally flaky                   | Monitor; add stability fix |
| > 90% with 1 flip | Likely environmental, not test logic | Re-run to confirm          |

## Common causes of flakiness in Playwright tests

1. **Timing issues** — element not yet visible when action fires
   - Fix: add `waitFor` or use `toBeVisible()` assertion before acting
2. **Strict mode violations** — selector matches multiple elements
   - Fix: make selector more specific in the page object

3. **State leakage** — test depends on state left by a previous test
   - Fix: ensure each test sets up its own state; avoid shared cart/session

4. **Network timing** — SauceDemo occasionally slow to respond
   - Fix: increase `timeout` for specific assertions in the affected page object method

5. **Parallel execution conflicts** — tests compete for shared resources
   - Fix: check `playwright.config.ts` workers setting

## What NOT to do

- Do not use `test.skip()` to silence a flaky test — it hides the problem.
- Do not use `test.retry()` as a long-term fix — it masks the root cause.
- Flaky smoke tests are **release blockers** regardless of pass rate.
