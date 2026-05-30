---
name: full-pipeline
description: Orchestrate the complete QA pipeline end-to-end
---

# Skill: full-pipeline

## Trigger phrases

"run the full pipeline", "end-to-end pipeline", "full QA run", "run everything",
"pipeline", "full workflow", "orchestrate"

## What this skill does

Runs all QA pipeline steps in order, interpreting results at each stage.

## Steps

Run the complete pipeline:

```
npm run pipeline
```

Or with notification suppressed (local dev):

```
npm run pipeline -- --skip-notify
```

## Pipeline stages and what to watch for at each

### 1. Environment Check

- Expected: all checks green
- If fails: **abort** — fix environment before proceeding
- Load `env-check` skill for remediation

### 2. Run Tests

- Expected: all tests pass (or known failures only)
- Watch for: new failures, smoke test failures, unexpected timeouts
- Exit 1 from Playwright means at least one test failed (normal on CI)

### 3. Archive Results

- Expected: run record saved to `test-results/history/`
- If fails: likely a file permission or disk space issue
- Non-blocking — pipeline continues

### 4. Compare Runs

- Expected: no new failures vs baseline
- If new failures detected → load `compare-releases` skill
- Non-blocking — pipeline continues to gate

### 5. Release Gate

- Expected: PASS
- If FAIL: load `release-gate` skill for decision details
- **This is the authoritative go/no-go signal**

### 6. Notify Stakeholders

- Expected: webhook delivery confirmation (or "not configured" messages)
- Non-blocking — notification failures don't fail the pipeline

## Interpreting the final summary

```
[pipeline] ✓ Environment Check    PASS  ·  2.1s
[pipeline] ✓ Run Tests            PASS  · 45.3s
[pipeline] ✓ Archive Results      PASS  ·  0.2s
[pipeline] ⚠ Compare Runs        exit 1 ·  0.1s   ← new failures vs baseline
[pipeline] ✗ Release Gate         FAIL  ·  0.1s   ← BLOCKED
[pipeline] ⚠ Notify Stakeholders PASS  ·  0.8s

Pipeline: ✗ FAILED
```

## Quick pipeline for local development

```bash
# Run tests then immediately check the gate
npm run test:archive && npm run gate

# Full pipeline but skip notifications
npm run pipeline -- --skip-notify
```

## Remediation flow after a pipeline failure

1. Read the gate decision: `cat test-results/gate-decision.json`
2. Read the comparison: `cat test-results/comparison.json`
3. Load `root-cause` skill to analyse failures
4. Fix the page object or spec
5. Re-run: `npm run test:archive && npm run gate`
6. Once gate passes: `npm run compare -- --set-baseline`
