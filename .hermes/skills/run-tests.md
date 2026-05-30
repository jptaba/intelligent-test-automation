---
name: run-tests
description: Execute the Playwright test suite and archive the results
---

# Skill: run-tests

## Trigger phrases

"run tests", "execute the test suite", "run all tests", "run smoke tests", "run tests and archive"

## What this skill does

Executes the Playwright test suite, then archives the results with git metadata.

## Steps

1. Optionally run the environment check first (if not done recently):

   ```
   npm run check:env
   ```

2. Run the selected scope:
   - All tests: `npm test`
   - Smoke only: `npm run test:smoke`
   - Auth only: `npm run test:auth`
   - Inventory only: `npm run test:inventory`
   - Cart only: `npm run test:cart`
   - Run + archive in one step: `npm run test:archive`

3. After the run completes, archive the results:

   ```
   npm run archive
   ```

4. Report the outcome:
   - Total: passed/total
   - Pass rate
   - Smoke: passed/total
   - Number of failures (with titles if any)
   - Git: SHA, branch, tag (if any)
   - Location of archived run: `test-results/history/<file>.json`

## Decision tree

- If the run is clean (100% pass) → suggest `npm run gate` to generate a release decision
- If there are failures → suggest `npm run compare` to check if they are new, then load `root-cause` skill
- If smoke tests fail → immediately note that a release is blocked and load `root-cause` skill

## Context

The JSON reporter writes raw results to `test-results/results.json`.
The `archive` script enriches this with git metadata and saves to `test-results/history/`.
