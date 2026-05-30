# intelligent-test-automation

Playwright TypeScript end-to-end test framework for [SauceDemo](https://www.saucedemo.com), enhanced with the **Hermes autonomous QA agent pipeline** — a full AI-driven loop that ingests Jira stories, enriches them from Confluence and Figma, generates test cases, validates coverage, writes Playwright specs, and self-heals broken selectors — all on a configurable cron schedule.

> **Repository**: [github.com/jptaba/intelligent-test-automation](https://github.com/jptaba/intelligent-test-automation)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Hermes Autonomous Pipeline](#hermes-autonomous-pipeline)
  - [How it Works](#how-it-works)
  - [Running the Pipeline](#running-the-pipeline)
  - [Individual Agent Commands](#individual-agent-commands)
  - [Configuration](#configuration)
- [Pipeline Scripts](#pipeline-scripts)
- [Adding Tests Manually](#adding-tests-manually)
- [Self-Healing Broken Selectors](#self-healing-broken-selectors)
- [CI/CD Integration](#cicd-integration)
- [Reference Docs](#reference-docs)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Hermes Orchestrator                     │
│               (cron schedule / --once)                   │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │         Phase 1: Ingest             │
        │  Jira → Confluence → Figma → Images │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │      Phase 2: Codebase Scan         │
        │  Hash-diff → LLM → CODEBASE.md      │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │    Phase 3: Test Case Generation    │
        │   Enriched Story + CODEBASE.md      │
        │         → TC Markdown               │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │      Phase 4: Coverage Gate         │
        │  4-Dimension weighted score ≥ 90%?  │
        │  FAIL → Self-Learning → retry (×3)  │
        └──────────────────┬──────────────────┘
                           │ PASS
        ┌──────────────────▼──────────────────┐
        │     Phase 5: Test Automation        │
        │    TC Markdown → Playwright spec    │
        │         → npx playwright test       │
        │  FAIL → Self-Healing agent          │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │          Notify (webhook)           │
        │       Discord / Slack               │
        └─────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/jptaba/intelligent-test-automation.git
cd intelligent-test-automation

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npm run pw:install

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in SauceDemo credentials (required for tests)
# Fill in Jira / OpenAI / Figma credentials to enable Hermes pipeline

# 5. Run the test suite
npm test
```

---

## Project Structure

```
├── pages/                         # Page Object Model (one class per page)
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   ├── CartPage.ts
│   └── CheckoutPage.ts
├── fixtures/
│   └── auth.fixture.ts            # loggedInPage fixture (pre-authenticated)
├── data/
│   ├── users.ts                   # Typed credentials from .env
│   └── products.ts                # SauceDemo product catalogue
├── helpers/
│   └── env.ts                     # Validates and exports all env vars
├── tests/
│   ├── auth/                      # Login / authentication flows
│   ├── inventory/                 # Product listing, sorting, add-to-cart
│   └── cart/                      # Cart management and checkout
├── inputs/
│   ├── stories/                   # Jira user stories (STORY-XXX.md)
│   └── testcases/                 # Traditional test cases (TC-XXX.md)
├── scripts/
│   ├── agents/                    # Hermes autonomous agent pipeline
│   │   ├── hermes-orchestrator.ts # Main entry — cron scheduler
│   │   ├── story-ingestion-agent.ts
│   │   ├── codebase-intelligence-agent.ts
│   │   ├── test-case-generation-agent.ts
│   │   ├── coverage-gate-agent.ts
│   │   ├── self-learning-agent.ts
│   │   ├── test-automation-agent.ts
│   │   ├── self-healing-agent.ts
│   │   ├── llm.ts                 # OpenAI wrapper (chat / vision / JSON)
│   │   ├── config.ts              # Config loader and prompt templates
│   │   └── types.ts               # Shared TypeScript types
│   └── integrations/
│       ├── jira.ts                # Jira REST API + ADF parser
│       ├── confluence.ts          # Confluence REST API
│       ├── figma.ts               # Figma REST API
│       └── image-processor.ts     # Download + LLM vision describe
├── .hermes/
│   ├── config/
│   │   ├── thresholds.json        # Coverage weights, gate thresholds
│   │   └── mcp-server.json        # Playwright MCP server config
│   ├── memory/
│   │   ├── file-hashes.json       # Codebase change tracking
│   │   ├── learning-log.jsonl     # Self-learning history
│   │   └── healing-log.jsonl      # Self-healing history
│   ├── prompts/
│   │   ├── test-generation.md     # LLM prompt for TC generation
│   │   ├── coverage-analysis.md   # LLM prompt for gap analysis
│   │   ├── codebase-scan.md       # LLM prompt for file scanning
│   │   └── self-healing.md        # LLM prompt for selector repair
│   └── skills/                    # Hermes skill definitions
├── SOUL.md                        # Agent identity and project map
├── HERMES.md                      # Full integration reference
├── HERMES-ADOPTION-GUIDE.md       # Adoption guide and capability tiers
├── playwright.config.ts
├── tsconfig.json
└── .env                           # Not committed — copy from .env.example
```

---

## Environment Variables

Copy `.env.example` to `.env`. Variables are grouped by feature:

| Group             | Variable                                                                      | Required for            |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------- |
| **SauceDemo**     | `BASE_URL`, `STANDARD_USER`, `USER_PASSWORD`, `LOCKED_USER`, `PROBLEM_USER`   | Tests                   |
| **LLM**           | `LLM_API_KEY`, `LLM_MODEL` (default: `gpt-4o`), `LLM_PROVIDER`                | Hermes pipeline         |
| **Jira**          | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`           | Story ingestion         |
| **Confluence**    | `CONFLUENCE_BASE_URL`                                                         | Story enrichment        |
| **Figma**         | `FIGMA_API_TOKEN`                                                             | UI reference extraction |
| **Notifications** | `MS_TEAMS_WEBHOOK_URL`                                                        | Pipeline alerts         |
| **Hermes**        | `HERMES_SCHEDULE` (default: `0 * * * *`), `HERMES_MAX_RETRIES` (default: `3`) | Orchestrator            |

**Never commit `.env` to version control.**

---

## Running Tests

| Command                        | Description                         |
| ------------------------------ | ----------------------------------- |
| `npm test`                     | All tests headless                  |
| `npm run test:headed`          | All tests in a visible browser      |
| `npm run test:debug`           | Playwright Inspector (step-through) |
| `npm run test:ui`              | Playwright UI mode (interactive)    |
| `npm run test:smoke`           | Critical path `@smoke` tests only   |
| `npm run test:auth`            | Auth tests only                     |
| `npm run test:inventory`       | Inventory tests only                |
| `npm run test:cart`            | Cart tests only                     |
| `npm run report`               | Open last HTML report               |
| `npm run pw:codegen:saucedemo` | Record new tests via Codegen        |

```bash
# Run a single spec headed
npm run test:headed -- tests/inventory/inventory.spec.ts

# Run tests matching a pattern
npx playwright test --headed --grep "@smoke"
```

---

## Hermes Autonomous Pipeline

### How it Works

The pipeline runs per Jira story through these phases:

1. **Story Ingestion** — fetches the story from Jira, extracts acceptance criteria, downloads attachments, fetches linked Confluence pages and Figma frames, and describes all images with LLM vision. Writes `inputs/stories/<ID>-enriched.json`.

2. **Codebase Intelligence** — computes SHA-256 hashes of all tracked files (pages, fixtures, data, helpers), LLM-scans only changed files, and updates `CODEBASE.md` with current Page Object capabilities.

3. **Test Case Generation** — assembles `SOUL.md` + `CODEBASE.md` + enriched story into a generation prompt, calls the LLM, and writes a structured TC markdown to `inputs/testcases/`.

4. **Coverage Gate** — evaluates the TC against 4 weighted dimensions (AC coverage 40%, image behavior capture 25%, Figma UI refs 20%, Confluence detail refs 15%). Score must reach 90% to pass.

5. **Self-Learning** (on gate failure) — calls the LLM once per gap to generate a specific rule, appends it to the relevant prompt file, then retries generation (up to `HERMES_MAX_RETRIES`).

6. **Test Automation** — converts the TC markdown into a Playwright TypeScript spec, writes it to `tests/<domain>/`, and runs it with `npx playwright test`.

7. **Self-Healing** (on test failure) — captures an accessibility snapshot, asks the LLM for a selector fix, applies it to the Page Object, and re-runs the spec to verify. Low-confidence fixes are escalated to a human via webhook.

### Running the Pipeline

```bash
# Run once and exit (recommended for first test)
npm run hermes:once

# Run on cron schedule (daemon mode — uses HERMES_SCHEDULE env var)
npm run hermes:orchestrator

# Process a specific Jira story
npm run hermes:once -- --story PROJ-123

# Dry run — logs all steps without writing files or calling APIs
npm run hermes:once -- --dry-run

# Stop after coverage gate (skip spec generation and test run)
npm run hermes:once -- --skip-automate
```

### Individual Agent Commands

Run any single phase standalone:

| Command                   | Phase | Description                                  |
| ------------------------- | ----- | -------------------------------------------- |
| `npm run hermes:ingest`   | 1     | Fetch and enrich stories from Jira           |
| `npm run hermes:codebase` | 2     | Scan codebase and update CODEBASE.md         |
| `npm run hermes:generate` | 3     | Generate test case markdown from a story     |
| `npm run hermes:gate`     | 4     | Evaluate coverage gate for a story           |
| `npm run hermes:learn`    | 5     | Learn from coverage gaps and update prompts  |
| `npm run hermes:automate` | 6     | Generate and run a Playwright spec from TC   |
| `npm run hermes:heal`     | 7     | Self-heal broken selectors in a failing spec |

### Configuration

Edit `.hermes/config/thresholds.json` to tune the pipeline:

```json
{
  "coverageGate": {
    "weights": {
      "acCoverage": 40,
      "imageBehaviorCapture": 25,
      "figmaUIElementRefs": 20,
      "confluenceDetailRefs": 15
    },
    "minimumCoveragePercent": 90,
    "maxGenerationRetries": 3
  },
  "selfHealing": {
    "maxHealAttempts": 3
  }
}
```

Prompt templates (customisable) live in `.hermes/prompts/`. The pipeline appends learned rules automatically to `test-generation.md` as the agent self-improves over time.

---

## Pipeline Scripts

Additional analysis scripts available independently of Hermes:

| Command                 | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run check:env`     | Validate all required env vars are set                 |
| `npm run archive`       | Archive latest results to `test-results/history/`      |
| `npm run compare`       | Compare latest run vs baseline                         |
| `npm run gate`          | Evaluate release-gate thresholds (exit 0=PASS, 1=FAIL) |
| `npm run flaky`         | Detect tests that flip between pass/fail across runs   |
| `npm run coverage:gaps` | Report stories not covered by any test                 |
| `npm run notify`        | Send test result summary to Discord/Slack              |
| `npm run pipeline`      | Run full pipeline: test → archive → gate → notify      |

---

## Adding Tests Manually

1. Drop a Jira story into `inputs/stories/STORY-XXX.md` or a test case into `inputs/testcases/TC-<DOMAIN>-XXX.md`.
2. In VS Code Copilot chat, ask:
   > "Implement tests for `inputs/stories/STORY-XXX.md`"
3. Copilot reads the project conventions from `.github/copilot-instructions.md` and follows Page Object, fixture, credential sourcing, and naming patterns automatically.

---

## Self-Healing Broken Selectors

### Automated (via Hermes)

```bash
# Let the self-healing agent fix a failing spec automatically
npm run hermes:heal -- tests/inventory/inventory.spec.ts
```

### Manual

```bash
# Open the page, take a snapshot to find current refs
npx playwright-cli open https://www.saucedemo.com
npx playwright-cli goto /inventory.html
npx playwright-cli snapshot

# Update the Page Object (never the test file), then re-run
npx playwright test tests/inventory/ --headed
```

---

## CI/CD Integration

Add to your pipeline (example GitHub Actions step):

```yaml
- name: Run tests and evaluate release gate
  run: |
    npm test
    npm run archive
    npm run gate
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    STANDARD_USER: ${{ secrets.STANDARD_USER }}
    USER_PASSWORD: ${{ secrets.USER_PASSWORD }}

- name: Notify on failure
  if: failure()
  run: npm run notify
  env:
    MS_TEAMS_WEBHOOK_URL: ${{ secrets.MS_TEAMS_WEBHOOK_URL }}
```

---

## Reference Docs

| File                                                           | Description                                            |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| [HERMES.md](HERMES.md)                                         | Full Hermes integration reference and capability map   |
| [HERMES-ADOPTION-GUIDE.md](HERMES-ADOPTION-GUIDE.md)           | What works standalone vs what needs Hermes running     |
| [SOUL.md](SOUL.md)                                             | Agent identity, project map, and definition of "green" |
| [HERMES-IMPLEMENTATION-PLAN.md](HERMES-IMPLEMENTATION-PLAN.md) | 9-phase implementation plan and design decisions       |
| [.env.example](.env.example)                                   | All supported environment variables with descriptions  |
