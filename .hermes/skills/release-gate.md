---
name: release-gate
description: Evaluate release-gate thresholds and produce a go/no-go decision
---

# Skill: release-gate

## Trigger phrases

"release gate", "can we release", "go/no-go decision", "is it safe to release",
"should we ship", "gate check", "release decision"

## What this skill does

Runs the gate script and interprets its decision against configurable thresholds.

## Default thresholds

| Threshold                  | Default | Override env var             |
| -------------------------- | ------- | ---------------------------- |
| Minimum pass rate          | 95%     | `GATE_PASS_RATE`             |
| @smoke tests must all pass | true    | `GATE_SMOKE_MUST_PASS=false` |
| Maximum allowed failures   | 0       | `GATE_MAX_FAILURES`          |

## Steps

1. Run the gate script:

   ```
   npm run gate
   ```

2. Read the output from `test-results/gate-decision.json`.

3. Present the decision clearly:

   **If PASS:**

   ```
   ✅ RELEASE GATE: PASS

   All thresholds met.
   • Pass rate: X% (threshold: 95%)
   • Smoke tests: all passing
   • Commit: <sha> on <branch>

   ✓ Safe to proceed with release.
   ```

   **If FAIL:**

   ```
   ❌ RELEASE GATE: FAIL — BLOCKED

   The following thresholds were not met:
   • <reason 1>
   • <reason 2>

   Failing tests:
   ✗ <test title>  →  <first line of error>
   ...

   Action required:
   1. Investigate using: npm run gate (see details above)
   2. Fix the failing tests or page objects
   3. Re-run: npm run test:archive && npm run gate
   4. If failures are pre-existing and accepted: adjust thresholds in .env
   ```

4. If gate FAILS and the cause involves selectors → load `root-cause` skill.
5. If gate FAILS due to environment issues → load `env-check` skill.

## Overriding thresholds (with caution)

```bash
# Relax pass rate to 90% (e.g., for a hotfix deployment)
GATE_PASS_RATE=90 npm run gate

# Allow 1 known-failing test
GATE_MAX_FAILURES=1 npm run gate

# Skip smoke requirement (NOT recommended for production)
GATE_SMOKE_MUST_PASS=false npm run gate
```

## Important rule

**The gate script's exit code is the source of truth for CI.** The AI summary is explanatory only.
Never override the gate decision in CI based on the LLM output — only based on the exit code.
