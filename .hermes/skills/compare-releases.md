---
name: compare-releases
description: Compare test results between the current run and a baseline or previous release
---

# Skill: compare-releases

## Trigger phrases

"compare with previous release", "what changed since last release", "compare runs",
"new failures since baseline", "regression check", "what broke since v1.x"

## What this skill does

Runs the comparison script and interprets the diff between two run records.

## Steps

1. Run the comparison:

   ```
   npm run compare
   ```

   This compares latest run against `test-results/baseline.json` (or last two runs if no baseline).

2. Parse the output from `test-results/comparison.json`:
   - `newFailures` — tests passing in baseline that now fail (regressions)
   - `fixedTests` — tests failing in baseline that now pass (improvements)
   - `persistentFailures` — tests failing in both (pre-existing issues)
   - `passRateDelta` — positive = improvement, negative = regression

3. Report in this format:

   ```
   ## Comparison: <baseline runId> → <current runId>

   Pass rate: X% → Y% (±Z%)

   ### 🔴 New failures (regressions): N
   - <test title>
   - ...

   ### 🟢 Fixed since baseline: N
   - <test title>
   - ...

   ### 🟡 Persistent failures: N
   - <test title>
   - ...
   ```

4. If there are new failures → load the `root-cause` skill to explain each one.

5. If there are persistent failures → note that they pre-date this branch and should have their own tickets.

## Baseline management commands

```bash
# Set the current latest run as the new baseline (e.g., after a release)
npm run compare -- --set-baseline

# Compare two specific run files
npm run compare -- --baseline test-results/history/A.json --current test-results/history/B.json
```

## When to set a new baseline

- After every release tag is cut
- After a feature branch is merged that intentionally changes behaviour
- When a known-broken test is fixed and re-enabled

## Interpretation rules

- **New failures are blockers** — they must be investigated before merging or releasing.
- **Fixed tests are improvements** — mention them to the developer as positive feedback.
- **Persistent failures** — these should already be tracked; don't re-raise them as new issues.
- A **negative passRateDelta** alone is not a blocker if no new failures are present (could be test count change).
