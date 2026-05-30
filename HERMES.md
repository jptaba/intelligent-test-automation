# Hermes Agent Integration — demo-playwright-cli

This document describes the full Hermes Agent QA intelligence layer built into this project.
It covers what each capability does, how to use it, how to configure it, and how to extend it.

---

## Table of Contents

1. [What is Hermes Agent?](#what-is-hermes-agent)
2. [Installation](#installation)
3. [Project Structure](#project-structure)
4. [Capabilities Overview](#capabilities-overview)
5. [Detailed Usage](#detailed-usage)
   - [Environment Readiness Check](#1-environment-readiness-check)
   - [Test Execution](#2-test-execution)
   - [Archive Results](#3-archive-results)
   - [Correlate Failures with Commits](#4-correlate-failures-with-commits)
   - [Root Cause Analysis](#5-root-cause-analysis)
   - [Compare Releases](#6-compare-releases)
   - [Release Gate](#7-release-gate)
   - [Orchestrate the Full Pipeline](#8-orchestrate-the-full-pipeline)
   - [Flaky Test Detection](#9-flaky-test-detection)
   - [Story Coverage Gaps](#10-story-coverage-gaps)
   - [Notify Stakeholders](#11-notify-stakeholders)
6. [Configuration Reference](#configuration-reference)
7. [Output Files](#output-files)
8. [Hermes Agent Skills Reference](#hermes-skills-reference)
9. [SOUL.md — Agent Identity](#soulmd--agent-identity)
10. [CI/CD Integration](#cicd-integration)
11. [Extending the Integration](#extending-the-integration)
12. [Honest Caveats](#honest-caveats)

---

## What is Hermes Agent?

[Hermes Agent](https://github.com/hermes/hermes) is an open-source AI agent framework with a
CLI/gateway model. You run a local gateway, then interact with it via natural language. It calls
tools and runs scripts on your behalf.

This project uses Hermes Agent as a **QA intelligence layer** — it does not replace the Playwright
test suite but wraps it with analysis, state management, decision making, and notifications.

The integration has **two layers**:

| Layer                          | What it is                            | When you need Hermes Agent                             |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------ |
| **Scripts** (`scripts/`)       | Pure Node.js/TypeScript utilities     | No — run via `npm run <script>` standalone             |
| **Skills** (`.hermes/skills/`) | Prompt templates for the Hermes Agent | Yes — agent interprets results and suggests next steps |

**You can use all scripts without Hermes Agent installed.** Hermes Agent adds the AI reasoning layer
on top of the deterministic scripts.

---

## Installation

### Scripts only (no Hermes Agent required)

```bash
npm install
```

The scripts run via [tsx](https://github.com/privatenumber/tsx), which is already in `devDependencies`.

### With Hermes Agent

```bash
# Install Hermes Agent globally
npm install -g hermes

# Start the gateway (run from project root so SOUL.md is loaded)
hermes gateway start

# Verify SOUL.md is loaded
hermes config show | grep soul
```

Hermes Agent will automatically load `SOUL.md` from the project root, giving the agent full context
about this project's structure, tools, and thresholds.

---

## Project Structure

```
demo-playwright-cli/
├── SOUL.md                          # Hermes Agent identity & project context
├── HERMES.md                      # This document
│
├── scripts/                         # Standalone QA integration scripts
│   ├── types.ts                     # Shared TypeScript types
│   ├── archive-results.ts           # Archive run with git metadata
│   ├── env-check.ts                 # Pre-flight environment validation
│   ├── compare-runs.ts              # Diff two run records
│   ├── release-gate.ts              # Evaluate go/no-go thresholds
│   ├── flaky-detect.ts              # Find tests that flip across runs
│   ├── coverage-gaps.ts             # Find stories without spec coverage
│   ├── notify.ts                    # Post summary to webhooks
│   └── full-pipeline.ts             # Orchestrate all steps end-to-end
│
├── .hermes/
│   └── skills/                      # Hermes Agent skill definitions
│       ├── env-check.md
│       ├── run-tests.md
│       ├── correlate-commits.md
│       ├── root-cause.md
│       ├── compare-releases.md
│       ├── release-gate.md
│       ├── full-pipeline.md
│       ├── notify.md
│       ├── flaky-detect.md
│       └── coverage-gaps.md
│
├── test-results/
│   ├── results.json                 # Latest raw Playwright JSON output (gitignored)
│   ├── baseline.json                # Pinned baseline run (commit this)
│   ├── gate-decision.json           # Latest gate decision output
│   ├── comparison.json              # Latest run comparison output
│   ├── flaky-registry.json          # Flaky test registry
│   ├── coverage-gaps.json           # Story coverage gap report
│   └── history/                     # Archived run records (one per run)
│       └── 2026-05-25T14-00-00Z-abc1234.json
│
└── playwright.config.ts             # Reporter: html + json configured
```

---

## Capabilities Overview

| #   | Capability                      | Script               | npm Script              | Hermes Agent Skill  |
| --- | ------------------------------- | -------------------- | ----------------------- | ------------------- |
| 1   | Environment readiness check     | `env-check.ts`       | `npm run check:env`     | `env-check`         |
| 2   | Test execution                  | (Playwright)         | `npm test`              | `run-tests`         |
| 3   | Archive results                 | `archive-results.ts` | `npm run archive`       | `run-tests`         |
| 4   | Correlate failures with commits | (git + AI)           | —                       | `correlate-commits` |
| 5   | Root cause analysis             | (AI)                 | —                       | `root-cause`        |
| 6   | Compare releases                | `compare-runs.ts`    | `npm run compare`       | `compare-releases`  |
| 7   | Release gate decision           | `release-gate.ts`    | `npm run gate`          | `release-gate`      |
| 8   | Full pipeline orchestration     | `full-pipeline.ts`   | `npm run pipeline`      | `full-pipeline`     |
| 9   | Flaky test detection            | `flaky-detect.ts`    | `npm run flaky`         | `flaky-detect`      |
| 10  | Story coverage gaps             | `coverage-gaps.ts`   | `npm run coverage:gaps` | `coverage-gaps`     |
| 11  | Notify stakeholders             | `notify.ts`          | `npm run notify`        | `notify`            |

---

## Detailed Usage

### 1. Environment Readiness Check

Validates all prerequisites before running tests. Run this first on a new machine or after
configuration changes.

```bash
npm run check:env
```

**What it checks:**

- `.env` file exists
- `STANDARD_USER` and `USER_PASSWORD` are set
- `BASE_URL` is reachable via HTTP
- `node_modules` is installed
- Playwright browsers are installed

**Exit codes:** `0` = all pass · `1` = one or more failures

**Sample output:**

```
[env-check] Environment Readiness Report
────────────────────────────────────────────────────────────
  ✓  .env file                  Found
  ✓  env.STANDARD_USER          Set
  ✓  env.USER_PASSWORD          Set
  ✓  env.BASE_URL (optional)    Set (https://www.saucedemo.com)
  ✓  node_modules               Installed
  ✓  Playwright browsers        Found
  ✓  BASE_URL reachable (...)   HTTP 200
────────────────────────────────────────────────────────────
  All checks passed. Environment is ready.
```

---

### 2. Test Execution

Standard Playwright execution — unchanged from the base project.

```bash
npm test                  # all tests headless
npm run test:smoke        # @smoke tests only
npm run test:headed       # all tests with visible browser
npm run test:archive      # run tests then immediately archive
```

The project is configured with **two reporters**:

- `html` → `playwright-report/index.html` (open with `npm run report`)
- `json` → `test-results/results.json` (consumed by the archive script)

Traces are captured on the first retry of any failing test (`trace: 'on-first-retry'`).

---

### 3. Archive Results

Saves the latest Playwright JSON output to `test-results/history/` with git metadata enrichment.

```bash
npm run archive
```

**Creates:** `test-results/history/<ISO-timestamp>-<git-sha>.json`

Each archive file contains:

- Pass rate, failure count, smoke test status
- All test titles with pass/fail/smoke flag and duration
- 5 slowest tests
- Current git SHA, branch, tag, and commit message

**Sample output:**

```
[archive] ✓ Archived → test-results/history/2026-05-25T14-00-00-000Z-abc1234.json
[archive]   15/15 passed (100%) · 0 failed
[archive]   Smoke: 3/3 passing
[archive]   Git:   abc1234 on main (v1.2.0) — "Add checkout validation"
```

---

### 4. Correlate Failures with Commits

Performed by the Hermes Agent using the `correlate-commits` skill. No standalone script —
this is an AI-reasoning capability.

**Ask Hermes Agent:**

> "What commit broke the checkout test?"

**What the agent does:**

1. Reads the latest archived run
2. Identifies spec files and page objects for each failing test
3. Runs `git log` on those files
4. Analyses diffs against the error messages
5. Returns a ranked list of likely causative commits

**Important:** this is heuristic analysis. Always review the actual diff before acting.

---

### 5. Root Cause Analysis

Performed by the Hermes Agent using the `root-cause` skill.

**Ask Hermes Agent:**

> "Why did the tests fail?" or "Summarise the failures"

**What the agent does:**

1. Reads failure details from the run archive
2. Classifies errors by type (selector broken, timeout, assertion mismatch, navigation)
3. Points to the relevant page object method
4. Notes any available Playwright trace files
5. Produces a structured summary with recommended fixes

---

### 6. Compare Releases

Diffs two run records to identify regressions and improvements.

```bash
# Compare latest run vs saved baseline
npm run compare

# Set the current latest run as the new baseline
npm run compare -- --set-baseline

# Compare two specific run files
npm run compare -- \
  --baseline test-results/history/A.json \
  --current  test-results/history/B.json
```

**Creates:** `test-results/comparison.json`

**Sample output:**

```
[compare] Run Comparison
──────────────────────────────────────────────────────────────────────
  Baseline: 2026-05-20T10-00-00Z-def5678
            98.0% pass · 0 failed
  Current:  2026-05-25T14-00-00Z-abc1234
            86.7% pass · 2 failed
  Delta:    -11.3% pass rate
──────────────────────────────────────────────────────────────────────

  ✗ NEW failures (2):
      - cart checkout can complete full checkout flow
      - checkout step two shows correct order total
```

**Exit codes:** `0` = no new failures · `1` = new failures detected

---

### 7. Release Gate

Evaluates the most recent run against configurable thresholds and produces a go/no-go decision.

```bash
npm run gate
```

**Default thresholds:**
| Threshold | Default | Override |
|---|---|---|
| Pass rate | ≥ 95% | `GATE_PASS_RATE=90` |
| Smoke tests | all must pass | `GATE_SMOKE_MUST_PASS=false` |
| Max failures | 0 | `GATE_MAX_FAILURES=1` |

**Creates:** `test-results/gate-decision.json`

**Exit codes:** `0` = PASS · `1` = FAIL · `2` = error (no data)

**Sample PASS output:**

```
[gate] ✓ PASS — safe to release
  Run:       2026-05-25T14-00-00Z-abc1234
  Commit:    abc1234 on main (v1.2.0)
  Results:   15/15 passed (100%) · 0 failed
  Smoke:     3/3 passing
```

**Sample FAIL output:**

```
[gate] ✗ FAIL — BLOCKED
  ...
  Blocking reasons:
    • 1 @smoke test(s) failing — zero-tolerance threshold
    • Pass rate 86.7% is below threshold of 95%

  Failing tests:
  ✗ cart checkout can complete full checkout flow
    tests/cart/cart.spec.ts
    Error: locator('.checkout-button') not found
```

> **CI rule:** Only the exit code matters for CI automation. The text output is for humans.

---

### 8. Orchestrate the Full Pipeline

Runs all steps in sequence with progress tracking and a final summary.

```bash
npm run pipeline

# Skip webhook notifications (local dev)
npm run pipeline -- --skip-notify
```

**Step behaviour:**
| Step | On failure |
|---|---|
| Environment Check | **Abort** — nothing works without a valid environment |
| Run Tests | Continue — tests may fail; we still want to archive and gate |
| Archive Results | Warn only — non-critical; pipeline continues |
| Compare Runs | Warn only — informational; pipeline continues |
| Release Gate | **Fail pipeline** — gate failure = pipeline failure |
| Notify Stakeholders | Warn only — notification failure never blocks the pipeline |

**Sample final summary:**

```
[pipeline] ═══════════════════════════════════════════════════
[pipeline]  Pipeline Summary
──────────────────────────────────────────────────────────────
  ✓  Environment Check          PASS  ·  2.1s
  ✓  Run Tests                  PASS  · 45.3s
  ✓  Archive Results            PASS  ·  0.2s
  ✓  Compare Runs               PASS  ·  0.1s
  ✓  Release Gate               PASS  ·  0.1s
  ✓  Notify Stakeholders        PASS  ·  0.8s
──────────────────────────────────────────────────────────────
  Total time: 48.6s
  Pipeline:   ✓ PASSED
[pipeline] ═══════════════════════════════════════════════════
```

---

### 9. Flaky Test Detection

Analyses run history to find tests that flip between pass and fail.

```bash
# Default: last 10 runs, 2-flip threshold
npm run flaky

# Custom: last 20 runs, 3-flip threshold
npm run flaky -- --runs 20 --threshold 3
```

**Creates:** `test-results/flaky-registry.json`

**Exit codes:** `0` = no flaky tests · `1` = flaky tests found

**Sample output:**

```
[flaky] Flaky Test Detection — last 10 runs (threshold: 2 flips)
──────────────────────────────────────────────────────────────────────
  ⚠ 1 flaky test(s) detected:

  [3 flips] cart checkout can complete full checkout flow
            tests/cart/cart.spec.ts
            7/10 runs passed (70% reliable) — last: passed
```

**A flaky smoke test is a release blocker regardless of recent pass rate.**

---

### 10. Story Coverage Gaps

Cross-references `inputs/stories/*.md` against all spec files to find untested stories.

```bash
npm run coverage:gaps
```

**Creates:** `test-results/coverage-gaps.json`

**To link a spec to a story**, add this comment anywhere in the spec file:

```typescript
// covers: STORY-001
```

**Sample output:**

```
[coverage] Story Coverage Gaps
──────────────────────────────────────────────────────────────────────
  Stories:  10 total · 8 covered · 2 uncovered

  ✓ Covered stories:
    [STORY-001] User can log in with valid credentials
                → tests/auth/login.spec.ts

  ✗ Stories with NO test coverage:
    [STORY-007] User can apply a coupon code at checkout
                inputs/stories/STORY-007.md
                Add "// covers: STORY-007" to the relevant spec file.
```

---

### 11. Notify Stakeholders

Posts a test run summary to MS Teams as an Adaptive Card. Always prints to stdout.

```bash
# Send to configured Teams channel
npm run notify

# Preview without sending
npm run notify -- --dry-run
```

**Configure in `.env`:**

```bash
# Create via: Teams channel → (•••) More options → Workflows
# → "Post to a channel when a webhook request is received" → copy URL
MS_TEAMS_WEBHOOK_URL=https://prod-xx.westus.logic.azure.com/workflows/...
NOTIFY_ON_PASS=false     # set to true to also notify on passing runs
```

By default, notifications are only sent when the gate **FAILS** — to avoid alert fatigue.

---

## Configuration Reference

All configuration is done via `.env` (in addition to the existing Playwright vars).

```bash
# --- Existing Playwright vars ---
BASE_URL=https://www.saucedemo.com
STANDARD_USER=standard_user
USER_PASSWORD=secret_sauce
LOCKED_USER=locked_out_user
PROBLEM_USER=problem_user

# --- Release gate thresholds ---
GATE_PASS_RATE=95              # minimum pass rate % (default: 95)
GATE_SMOKE_MUST_PASS=true      # require all @smoke tests to pass (default: true)
GATE_MAX_FAILURES=0            # max allowed failing tests (default: 0)

# --- Notifications ---
MS_TEAMS_WEBHOOK_URL=          # MS Teams incoming webhook URL (Power Automate)
NOTIFY_ON_PASS=false           # notify on PASS too (default: false)
```

---

## Output Files

All generated files land in `test-results/`. Git-ignore `results.json` and `history/`
(they're large and ephemeral). Commit `baseline.json` when you cut a release.

| File                               | When created                              | Commit?  |
| ---------------------------------- | ----------------------------------------- | -------- |
| `test-results/results.json`        | After every `npm test`                    | No       |
| `test-results/history/*.json`      | After every `npm run archive`             | Optional |
| `test-results/baseline.json`       | After `npm run compare -- --set-baseline` | Yes      |
| `test-results/comparison.json`     | After `npm run compare`                   | No       |
| `test-results/gate-decision.json`  | After `npm run gate`                      | No       |
| `test-results/flaky-registry.json` | After `npm run flaky`                     | No       |
| `test-results/coverage-gaps.json`  | After `npm run coverage:gaps`             | No       |

---

## Hermes Agent Skills Reference

Skills live in `.hermes/skills/`. Each is a Markdown file with YAML frontmatter that tells
the Hermes Agent what to do when you ask it a question matching the skill's trigger phrases.

| Skill file             | Invoked when you ask…              |
| ---------------------- | ---------------------------------- |
| `env-check.md`         | "Is the environment ready?"        |
| `run-tests.md`         | "Run the tests"                    |
| `correlate-commits.md` | "What commit broke this?"          |
| `root-cause.md`        | "Why did the tests fail?"          |
| `compare-releases.md`  | "What changed since last release?" |
| `release-gate.md`      | "Can we release?"                  |
| `full-pipeline.md`     | "Run the full pipeline"            |
| `notify.md`            | "Notify the team"                  |
| `flaky-detect.md`      | "Find flaky tests"                 |
| `coverage-gaps.md`     | "Which stories have no tests?"     |

---

## SOUL.md — Agent Identity

`SOUL.md` in the project root is Hermes Agent's persistent identity file. It tells the agent:

- What this project is and where everything lives
- Which tests are critical paths (smoke tests)
- What "green" means for this project
- All available npm scripts and their purposes
- Which skill to load for each type of question
- Rules (never hardcode credentials, never put selectors in test files)

Whenever you add new page objects, test domains, or npm scripts, update `SOUL.md` accordingly.

---

## CI/CD Integration

Add the pipeline to your CI workflow. Example GitHub Actions job:

```yaml
jobs:
  qa-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npm run pw:install

      - name: Environment check
        run: npm run check:env

      - name: Run tests
        run: npm test

      - name: Archive results
        run: npm run archive

      - name: Compare vs baseline
        run: npm run compare
        continue-on-error: true # informational — don't fail CI here

      - name: Release gate
        run: npm run gate # exits 1 if gate fails → fails the job

      - name: Notify stakeholders
        if: always() # notify even when gate fails
        run: npm run notify
        env:
          MS_TEAMS_WEBHOOK_URL: ${{ secrets.MS_TEAMS_WEBHOOK_URL }}
          NOTIFY_ON_PASS: 'true'

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**Key points:**

- `npm run gate` exits `1` on failure — this fails the CI job naturally
- `npm run notify` runs with `if: always()` so it sends even on gate failure
- Secrets are passed as env vars, never committed
- Upload the HTML report as an artifact for easy browsing

---

## Extending the Integration

### Add a new capability (script)

1. Create `scripts/my-capability.ts`
2. Export a clear interface using types from `scripts/types.ts`
3. Add to `package.json` scripts: `"my-cap": "tsx scripts/my-capability.ts"`
4. Create `.hermes/skills/my-capability.md`
5. Add the script and skill to `SOUL.md`

### Add a new test domain

Follow the project conventions:

1. Create `pages/<Feature>Page.ts` with typed methods (no selectors in tests)
2. Create `tests/<domain>/<feature>.spec.ts`
3. Add `// covers: STORY-XXX` for each story it covers
4. Add `npm run test:<domain>` script to `package.json`
5. Add the new script to `SOUL.md`'s npm scripts table

### Adjust release gate thresholds

For a hotfix (relaxed):

```bash
GATE_PASS_RATE=85 GATE_MAX_FAILURES=2 npm run gate
```

For a critical release (stricter):

```bash
GATE_PASS_RATE=100 npm run gate
```

---

## Honest Caveats

1. **AI analysis is heuristic, not causal.** Commit correlation and root cause summaries are
   educated guesses. A developer must review diffs before acting on AI conclusions.

2. **The gate exit code is the source of truth.** Never override a CI gate failure based solely
   on an LLM explanation — only based on the deterministic script's exit code.

3. **Flaky test detection requires history.** You need at least 2 archived runs. Meaningful
   flakiness signals emerge after 5–10 runs.

4. **Coverage gaps use ID-matching.** If you don't add `// covers: STORY-XXX` comments,
   gaps can only be detected by exact story ID matches in spec content.

5. **Notifications require configuration.** No webhook URLs = notifications print to stdout
   only. This is intentional — it keeps the pipeline functional in all environments.

6. **Hermes Agent gateway is optional.** Every script in `scripts/` runs standalone via
   `npm run <script>`. Hermes Agent is the AI reasoning layer, not a dependency for execution.
