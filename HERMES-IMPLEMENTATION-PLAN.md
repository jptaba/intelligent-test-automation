# Hermes Agent + Playwright MCP — Autonomous QA System: Implementation Plan

> **Status:** Planning  
> **Owner:** QA Engineering  
> **Last Updated:** 2026-05-29

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 0 — Prerequisites & Infrastructure](#2-phase-0--prerequisites--infrastructure)
3. [Phase 1 — External Integrations Layer](#3-phase-1--external-integrations-layer)
4. [Phase 2 — Story Ingestion Agent](#4-phase-2--story-ingestion-agent)
5. [Phase 3 — Test Case Generation Agent](#5-phase-3--test-case-generation-agent)
6. [Phase 4 — Coverage Gate](#6-phase-4--coverage-gate)
7. [Phase 5 — Self-Learning Agent](#7-phase-5--self-learning-agent)
8. [Phase 6 — Codebase Intelligence Agent](#8-phase-6--codebase-intelligence-agent)
9. [Phase 7 — Test Automation Agent with Playwright MCP](#9-phase-7--test-automation-agent-with-playwright-mcp)
10. [Phase 8 — Self-Healing Agent](#10-phase-8--self-healing-agent)
11. [Phase 9 — Orchestrator & Scheduler](#11-phase-9--orchestrator--scheduler)
12. [Phase Delivery Order & Dependencies](#12-phase-delivery-order--dependencies)
13. [Human Control Points](#13-human-control-points)

---

## 1. Architecture Overview

```
⏰ Hourly Cron (hermes-orchestrator.ts)
│
├── [PARALLEL] Phase 6: Codebase Intelligence Agent
│   └── Watches pages/ fixtures/ data/ helpers/
│       ├── No changes → exit immediately
│       └── Changes detected → deep scan changed files → update CODEBASE.md
│
├── Phase 1-2: Story Ingestion
│   ├── Jira REST API  (filter: TestingStatus + Assignee)
│   ├── Confluence REST API  (linked pages → text + images)
│   ├── Figma REST API  (frame screenshots)
│   ├── Image Processor  (LLM vision → structured descriptions)
│   └── → inputs/stories/<ID>-enriched.json
│
├── Phase 3-5: Test Case Generation + Gate (retry loop)
│   ├── Test Case Generation Agent  (LLM + SOUL.md + CODEBASE.md)
│   ├── Coverage Gate  (.hermes/config/thresholds.json)
│   │   ├── PASS  → continue to Phase 7
│   │   └── FAIL  → Self-Learning Agent → update prompts/skills/SOUL → retry
│   │             → still FAIL after N retries → notify human + skip story
│
└── Phase 7-8: Test Automation + Self-Healing
    ├── Test Automation Agent  (@playwright/mcp codegen)
    ├── Run Tests  (npm test)
    ├── Self-Healing Agent  (MCP snapshot → fix page objects)
    │   └── max attempts exceeded → notify human
    └── Archive + Release Gate + Notify
```

---

## 2. Phase 0 — Prerequisites & Infrastructure

**Goal:** Install real packages, wire up API credentials, and establish the configuration schema that all phases read from.

### 2.1 Current State

> **Note:** Hermes is not a pre-existing npm package. It is the autonomous AI orchestration layer being built in this project. The previous OpenClaw docs were renamed to Hermes in a prior session — no runtime was installed. `@playwright/mcp` is also not yet installed.

### 2.2 Packages to Install

```bash
npm install --save-dev \
  @playwright/mcp \    # MCP server for browser automation
  node-cron \          # Hourly scheduler
  chokidar \           # File watcher for codebase agent
  axios \              # HTTP client (Jira, Confluence, Figma)
  zod \                # Runtime schema validation for all agent I/O
  sharp \              # Image processing (resize/convert before LLM)
  openai               # LLM client (swap for Anthropic/Azure via env var)
```

### 2.3 New Environment Variables (`.env`)

```dotenv
# Jira
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=
JIRA_TESTING_STATUS_FIELD=customfield_XXXXX
JIRA_ASSIGNEE_FILTER=person@example.com

# Confluence
CONFLUENCE_BASE_URL=https://yourorg.atlassian.net/wiki
# CONFLUENCE_API_TOKEN reuses JIRA_API_TOKEN when on the same Atlassian domain

# Figma
FIGMA_API_TOKEN=

# LLM
LLM_PROVIDER=openai           # openai | anthropic | azure
LLM_API_KEY=
LLM_MODEL=gpt-4o              # must support vision
LLM_BASE_URL=                 # optional, for Azure OpenAI

# Hermes Orchestrator
HERMES_ASSIGNEE_FILTER=person@example.com
HERMES_SCHEDULE=0 * * * *     # cron: every hour on the hour
HERMES_MAX_RETRIES=3
```

### 2.4 Configuration File: `.hermes/config/thresholds.json`

This is the single file humans edit to change any threshold or tunable behaviour. No code changes needed.

```json
{
  "coverageGate": {
    "minimumCoveragePercent": 90,
    "requireImagesDescribed": true,
    "requireFigmaReferences": true,
    "requireConfluenceDetails": true,
    "maxGenerationRetries": 3,
    "weights": {
      "acCoverage": 40,
      "imageBehaviorCapture": 25,
      "figmaUIElementRefs": 20,
      "confluenceDetailRefs": 15
    }
  },
  "codebaseAgent": {
    "trackedGlobs": [
      "pages/**/*.ts",
      "fixtures/**/*.ts",
      "data/**/*.ts",
      "helpers/**/*.ts"
    ],
    "deepScanOnlyChanged": true
  },
  "selfHealing": {
    "maxHealAttempts": 3,
    "selectorFallbackToSnapshot": true
  },
  "releaseGate": {
    "minimumPassRate": 95,
    "smokesMustAllPass": true
  }
}
```

### 2.5 New Folder Structure

```
.hermes/
├── config/
│   ├── thresholds.json           ← tweakable thresholds (human-editable)
│   └── mcp-server.json           ← @playwright/mcp server config
├── prompts/
│   ├── test-generation.md        ← prompt template: AC → test cases
│   ├── coverage-analysis.md      ← prompt template: gate validation
│   ├── codebase-scan.md          ← prompt template: code summarisation
│   └── self-healing.md           ← prompt template: selector repair
├── memory/
│   ├── file-hashes.json          ← codebase agent change detection
│   ├── learning-log.jsonl        ← self-learning audit trail (append-only)
│   └── healing-log.jsonl         ← self-healing audit trail (append-only)
└── skills/                       ← existing skill definitions

scripts/
├── integrations/
│   ├── jira.ts
│   ├── confluence.ts
│   ├── figma.ts
│   └── image-processor.ts
├── agents/
│   ├── story-ingestion-agent.ts
│   ├── test-case-generation-agent.ts
│   ├── coverage-gate-agent.ts
│   ├── self-learning-agent.ts
│   ├── codebase-intelligence-agent.ts
│   ├── test-automation-agent.ts
│   ├── self-healing-agent.ts
│   └── hermes-orchestrator.ts
└── ... (existing scripts unchanged)

CODEBASE.md                        ← living LLM-context document (generated)
inputs/
├── stories/
│   ├── <STORY-ID>.md              ← human-readable story (generated)
│   └── <STORY-ID>-enriched.json   ← full enriched payload (gitignored)
└── assets/
    └── <STORY-ID>/                ← downloaded images (gitignored)
```

### 2.6 New npm Scripts

```json
"hermes:orchestrator":  "tsx scripts/agents/hermes-orchestrator.ts",
"hermes:once":          "tsx scripts/agents/hermes-orchestrator.ts --once",
"hermes:ingest":        "tsx scripts/agents/story-ingestion-agent.ts",
"hermes:codebase":      "tsx scripts/agents/codebase-intelligence-agent.ts",
"hermes:generate":      "tsx scripts/agents/test-case-generation-agent.ts",
"hermes:gate":          "tsx scripts/agents/coverage-gate-agent.ts",
"hermes:learn":         "tsx scripts/agents/self-learning-agent.ts",
"hermes:automate":      "tsx scripts/agents/test-automation-agent.ts",
"hermes:heal":          "tsx scripts/agents/self-healing-agent.ts"
```

---

## 3. Phase 1 — External Integrations Layer

**Goal:** Reliable, typed HTTP clients for Jira, Confluence, Figma, and image extraction. All clients must handle pagination, rate-limiting, and auth errors gracefully.

### 3.1 `scripts/integrations/jira.ts`

| Function                                            | Description                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `fetchStoriesByAssigneeAndStatus(assignee, status)` | Paginated JQL query returning story list                                              |
| `fetchStoryDetail(storyId)`                         | Full story: ADF description, attachments, custom fields                               |
| `parseADF(doc)`                                     | Extracts plain text, inline image nodes, and URL nodes from Atlassian Document Format |
| `extractConfluenceLinks(adfDoc)`                    | Filters URL nodes matching the Confluence base URL                                    |
| `extractFigmaLinks(adfDoc)`                         | Filters URL nodes matching `figma.com`                                                |
| `downloadAttachment(url)`                           | Returns `Buffer` with auth headers                                                    |

### 3.2 `scripts/integrations/confluence.ts`

| Function                    | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `fetchPageById(pageId)`     | Full page in storage format + title + metadata    |
| `fetchPageByUrl(url)`       | Resolves a Confluence share URL → `fetchPageById` |
| `extractPageSections(body)` | Returns `Record<sectionTitle, plainText>`         |
| `extractPageImages(body)`   | Returns `Array<{ src, altText, context }>`        |

### 3.3 `scripts/integrations/figma.ts`

| Function                               | Description                                              |
| -------------------------------------- | -------------------------------------------------------- |
| `parseFigmaUrl(url)`                   | Extracts `fileKey` and `nodeId` from any Figma share URL |
| `fetchFrameImages(fileKey, nodeIds[])` | Calls Figma `/images` API → returns download URLs        |
| `downloadFigmaImage(url)`              | Returns `Buffer`                                         |

### 3.4 `scripts/integrations/image-processor.ts`

Uses the configured LLM (vision-capable model) to produce structured descriptions.

```typescript
interface ImageDescription {
  uiElements: string[]; // buttons, inputs, labels, headings observed
  expectedBehaviors: string[]; // implied interactions and validation rules
  layoutHints: string; // "modal", "full-page form", "above the fold", etc.
  rawDescription: string; // free-text description for context
}
```

| Function                             | Description                                   |
| ------------------------------------ | --------------------------------------------- |
| `resizeForLLM(buffer)`               | Caps at 1024 px longest edge, converts to PNG |
| `describeImage(buffer, contextHint)` | LLM vision call → `ImageDescription`          |

---

## 4. Phase 2 — Story Ingestion Agent

**Goal:** Produce a single, rich story document that is the ground truth for all downstream agents.

**File:** `scripts/agents/story-ingestion-agent.ts`

### 4.1 Enriched Story Schema

Output saved to `inputs/stories/<STORY-ID>-enriched.json`:

```typescript
interface EnrichedStory {
  storyId: string;
  title: string;
  description: string;
  acceptanceCriteria: Array<{
    id: string; // "AC1", "AC2", ...
    text: string;
  }>;
  inlineImages: Array<{
    sourceUrl: string;
    localPath: string; // inputs/assets/<ID>/<filename>
    llmDescription: ImageDescription;
  }>;
  confluencePages: Array<{
    url: string;
    title: string;
    sections: Record<string, string>;
    images: Array<{ localPath: string; llmDescription: ImageDescription }>;
  }>;
  figmaScreenshots: Array<{
    figmaUrl: string;
    fileKey: string;
    nodeName: string;
    localPath: string;
    llmDescription: ImageDescription;
  }>;
  metadata: {
    jiraKey: string;
    status: string;
    assignee: string;
    fetchedAt: string;
    storyPoints?: number;
  };
}
```

A human-readable `inputs/stories/<STORY-ID>.md` is also written from the enriched JSON, replacing the old manual Markdown drop-in process.

---

## 5. Phase 3 — Test Case Generation Agent

**Goal:** Use the enriched story and full project context to generate structured, implementable test cases that follow the project's framework conventions.

**File:** `scripts/agents/test-case-generation-agent.ts`

### 5.1 LLM Context Assembled per Call

1. `SOUL.md` — agent identity, quality constraints, tone
2. `CODEBASE.md` — living codebase reference (produced by Phase 6)
3. `inputs/stories/<ID>-enriched.json` — story with all images described
4. `.hermes/prompts/test-generation.md` — prompt template with rules

### 5.2 Prompt Template Responsibilities (`.hermes/prompts/test-generation.md`)

- Maps **every AC** to ≥ 1 test case with explicit Given/When/Then
- References image behaviors via `llmDescription.expectedBehaviors`
- References Figma frames via `llmDescription.uiElements`
- Tags `@smoke` for critical paths
- Places tests in the correct `tests/<domain>/` folder per project conventions
- Never hardcodes credentials — references `data/users.ts`
- Uses existing Page Object methods; explicitly flags new methods needed with `<!-- NEW_METHOD: ClassName.methodName -->`

### 5.3 Output Format

`inputs/testcases/TC-<DOMAIN>-<STORY-ID>.md` with YAML frontmatter:

```yaml
---
storyId: STORY-XXX
generatedAt: 2026-05-29T14:00:00Z
generationRetry: 0
acCoverage: [AC1, AC2, AC3]
imageCoverage: [inline-img-001, figma-frame-LoginModal]
confluenceCoverage: [page-id-123456]
---
```

The frontmatter is machine-read by the Coverage Gate to compute the coverage score.

---

## 6. Phase 4 — Coverage Gate

**Goal:** Deterministic, configurable check that the generated test cases fully capture the story before automation begins.

**File:** `scripts/agents/coverage-gate-agent.ts`

### 6.1 Coverage Score Algorithm

```
score = Σ (weight × 1 if criterion met, else 0) / Σ total weights × 100

Criteria                       Weight (default)   Met when
──────────────────────────────────────────────────────────────────
AC coverage                    40                 Every AC ID in enriched story
                                                  appears in TC frontmatter acCoverage[]
Image behavior capture         25                 Every inlineImages[].llmDescription
                                                  .expectedBehaviors entry is referenced
                                                  in at least one TC step
Figma UI element refs          20                 Every figmaScreenshots[].llmDescription
                                                  .uiElements entry is referenced
Confluence detail refs         15                 Every confluencePages[].title appears
                                                  in at least one TC context/note
```

All weights are read from `thresholds.json` and can be adjusted without code changes.

### 6.2 Gate Output

`test-results/coverage-gate-<STORY-ID>.json`:

```json
{
  "storyId": "STORY-XXX",
  "score": 87,
  "threshold": 90,
  "decision": "FAIL",
  "gaps": [
    {
      "type": "ac",
      "id": "AC3",
      "detail": "No test case covers the error state described in AC3"
    },
    {
      "type": "image",
      "id": "inline-img-002",
      "detail": "Login error screenshot behavior 'shows red banner' not captured"
    }
  ]
}
```

**Decision logic:**

- `score >= threshold` → **PASS** → proceed to Phase 7
- `score < threshold` → **FAIL** → pass `gaps[]` to Self-Learning Agent → retry generation
- After `maxGenerationRetries` still FAIL → pause, notify human with the gap report

---

## 7. Phase 5 — Self-Learning Agent

**Goal:** Automatically close coverage gaps by updating the agent's own instructions, prompts, and skills so it performs better on the next retry and on future stories.

**File:** `scripts/agents/self-learning-agent.ts`

### 7.1 Update Targets by Gap Type

| Gap type                 | File updated                                      | What is added/changed                   |
| ------------------------ | ------------------------------------------------- | --------------------------------------- |
| AC missed                | `.hermes/prompts/test-generation.md`              | Explicit rule for this AC pattern type  |
| Image behavior missed    | `SOUL.md` Constraints section                     | Image-to-expected-behavior mapping rule |
| Figma element missed     | `.hermes/skills/run-tests.md`                     | UI element extraction step instruction  |
| Confluence detail missed | `.hermes/prompts/test-generation.md`              | Confluence citation template            |
| Wrong domain placement   | `.github/instructions/playwright.instructions.md` | Reinforced test location rule           |

### 7.2 Learning Log Entry

`.hermes/memory/learning-log.jsonl` (append-only JSONL):

```json
{
  "ts": "2026-05-29T14:05:00Z",
  "storyId": "STORY-XXX",
  "gapType": "ac",
  "gapId": "AC3",
  "action": "updated-prompt",
  "file": ".hermes/prompts/test-generation.md",
  "summary": "Added rule: always generate a negative test case for ACs containing the word 'error' or 'invalid'",
  "retryCount": 1
}
```

The learning log is a permanent record. Humans can review it to understand how the agent evolved.

### 7.3 Retry Loop

```
Generation (retry 0) → Gate → FAIL
  → Learn (writes to prompts/skills) → Generation (retry 1) → Gate → FAIL
    → Learn → Generation (retry 2) → Gate → PASS
```

If still FAIL after `maxGenerationRetries`: emit a human notification containing the gap report and skip the story for this cycle. The story will be retried in the next hourly run after a human optionally corrects the prompts.

---

## 8. Phase 6 — Codebase Intelligence Agent

**Goal:** Maintain a living `CODEBASE.md` that the LLM can efficiently load as project context. Runs as a lazy pre-step: exits in milliseconds when nothing has changed.

**File:** `scripts/agents/codebase-intelligence-agent.ts`

### 8.1 Change Detection Algorithm

Hash store: `.hermes/memory/file-hashes.json`

```json
{
  "pages/LoginPage.ts": {
    "sha256": "abc123...",
    "lastScannedAt": "2026-05-28T10:00:00Z"
  },
  "pages/CartPage.ts": {
    "sha256": "def456...",
    "lastScannedAt": "2026-05-29T08:00:00Z"
  },
  "fixtures/auth.fixture.ts": {
    "sha256": "ghi789...",
    "lastScannedAt": "2026-05-28T10:00:00Z"
  }
}
```

**Algorithm:**

```
1. Read trackedGlobs from thresholds.json
2. Resolve all matching files
3. Compute sha256 of each file's current content
4. Compare against stored hashes
5. If ALL hashes match → log "no changes detected, exiting" → exit(0)  ← fast path
6. For changed files only → run deep LLM scan (codebase-scan.md prompt)
7. Update CODEBASE.md section for that file only
8. Persist new hashes
```

This means the codebase agent is almost free to run on every orchestrator cycle when the codebase is stable.

### 8.2 `CODEBASE.md` Structure

Optimised for fast LLM context loading. Each section is self-contained so the LLM can reason about a Page Object without reading the full file.

```markdown
---
lastUpdated: 2026-05-29T14:00:00Z
trackedFiles: 8
changedOnLastScan: ['pages/CartPage.ts']
---

## Page Objects

### LoginPage · `pages/LoginPage.ts`

**Purpose:** Login form interactions
**Key methods:**

- `goto()` — navigates to baseURL
- `login(user, pass)` — fills username/password and clicks Login
- `expectOnInventoryPage()` — asserts redirect to /inventory.html
- `expectLoginError(message?)` — asserts the error banner text

### InventoryPage · `pages/InventoryPage.ts`

...

## Fixtures

### `loggedInPage` · `fixtures/auth.fixture.ts`

Extends `test` — provides a Page already authenticated as USERS.standard.
Import: `import { test, expect } from '../../fixtures/auth.fixture';`

## Data Layer

### `USERS` · `data/users.ts`

Keys: standard | locked | problem
Access: USERS.standard.username / USERS.standard.password
Source: .env (never hardcoded)

## Test Patterns (extracted from existing specs)

### Pattern: smoke + happy path

Prefix test name with `@smoke`. Uses `loggedInPage` fixture. One expect per behaviour.

### Pattern: negative / error state

Uses raw `page` from `@playwright/test`. Calls LoginPage.login() then expectLoginError().
```

---

## 9. Phase 7 — Test Automation Agent with Playwright MCP

**Goal:** Convert generated test cases into runnable Playwright spec files using the MCP server for real-time browser introspection and code generation.

**File:** `scripts/agents/test-automation-agent.ts`

### 9.1 MCP Server Config (`.hermes/config/mcp-server.json`)

```json
{
  "command": "npx",
  "args": [
    "@playwright/mcp@latest",
    "--headless",
    "--codegen=typescript",
    "--isolated"
  ]
}
```

### 9.2 Automation Loop (per test case)

```
1. Load CODEBASE.md         → understand existing page objects and patterns
2. Load TC-<DOMAIN>-<ID>.md → read test steps with Given/When/Then
3. For each step:
   a. Method exists in CODEBASE.md?
      YES → emit: await <pageObject>.<method>(args)
      NO  → use MCP browser_snapshot on the target page
           → identify element by role/label in accessibility tree
           → add typed method to existing Page Object class
           → emit code using the new method
4. Write spec to tests/<domain>/<feature>.spec.ts
5. Run: npx playwright test tests/<domain>/<feature>.spec.ts
6. Failures detected? → Self-Healing Agent (Phase 8)
7. Green? → continue to archive + gate + notify
```

**Hard constraint:** Never emit `page.locator(...)` directly in spec files. All browser interactions go through Page Object methods. This is enforced by the prompt template and validated post-generation.

---

## 10. Phase 8 — Self-Healing Agent

**Goal:** Automatically repair broken selectors and test logic without human intervention, up to the configured maximum attempts.

**File:** `scripts/agents/self-healing-agent.ts`

### 10.1 Healing Strategies by Failure Type

| Failure pattern           | Healing action                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `locator.click()` timeout | `MCP browser_snapshot` on the page → find closest accessible element by role/name → update Page Object selector |
| `toHaveText()` mismatch   | `MCP browser_snapshot` → read actual text in element → update assertion value in Page Object                    |
| Navigation timeout        | Check if URL changed → update `goto()` target path in Page Object                                               |
| `toBeVisible()` fail      | Check if element was moved to new DOM parent → update selector strategy                                         |
| Functional logic error    | Re-read enriched story AC for that test → re-generate test case for that AC only (triggers Phase 3 mini-loop)   |

### 10.2 Healing Log Entry

`.hermes/memory/healing-log.jsonl` (append-only JSONL):

```json
{
  "ts": "2026-05-29T15:00:00Z",
  "specFile": "tests/cart/cart.spec.ts",
  "testName": "@smoke can complete full checkout flow",
  "failureType": "selector-timeout",
  "pageObject": "pages/CartPage.ts",
  "methodHealed": "proceedToCheckout",
  "oldSelector": "text=Checkout",
  "newSelector": "[data-test='checkout-button']",
  "healAttempt": 1,
  "result": "PASS"
}
```

If `maxHealAttempts` is reached without a green run: pause, notify human with the healing log for this test, and mark the test as quarantined in the run record.

---

## 11. Phase 9 — Orchestrator & Scheduler

**Goal:** Tie every phase into a single autonomous loop that runs on the configured cron schedule.

**File:** `scripts/agents/hermes-orchestrator.ts`

### 11.1 Full Loop Sequence

```
Schedule: HERMES_SCHEDULE (default: 0 * * * * → every hour)

On each tick:
│
├─ [PARALLEL] Codebase Intelligence Agent
│  └─ lazy: exits fast if no tracked file changed
│
├─ Jira: fetchStoriesByAssigneeAndStatus()
│  └─ No stories with pending Testing Status? → exit tick cleanly
│
└─ For each story:
   │
   ├─ Story Ingestion Agent
   │  └─ Produces inputs/stories/<ID>-enriched.json
   │
   ├─ Test Case Generation Agent
   │  └─ Produces inputs/testcases/TC-<DOMAIN>-<ID>.md
   │
   ├─ Coverage Gate
   │  ├─ PASS (score >= threshold) ─────────────────────┐
   │  └─ FAIL                                           │
   │     ├─ Self-Learning Agent (updates prompts/skills) │
   │     ├─ Retry generation (up to maxGenerationRetries)│
   │     └─ Still FAIL → notify human → skip story       │
   │                                                     │
   ├─ Test Automation Agent ◄────────────────────────────┘
   │  └─ Writes tests/<domain>/<feature>.spec.ts
   │
   ├─ Run Tests (npm test)
   │  ├─ GREEN → continue
   │  └─ FAILURES → Self-Healing Agent
   │     ├─ Heal + retry (up to maxHealAttempts)
   │     └─ Still FAIL → notify human → quarantine test
   │
   └─ Archive + Release Gate + Notify
      └─ npm run pipeline --skip-notify=false
```

### 11.2 CLI Flags

| Flag                | Behaviour                                               |
| ------------------- | ------------------------------------------------------- |
| `--once`            | Run a single tick then exit (useful for manual trigger) |
| `--story STORY-XXX` | Process only a specific story ID                        |
| `--skip-automate`   | Run ingestion + generation + gate only (no browser)     |
| `--skip-notify`     | Suppress webhook notifications                          |
| `--dry-run`         | Log all decisions but write no files                    |

---

## 12. Phase Delivery Order & Dependencies

```
Phase 0  ──────────────────────────────────────────────────────────────┐
          │                                                             │
Phase 1   └─► Phase 2  ──────────────────────────────────────────────┐ │
                                                                      │ │
Phase 6   (parallel, depends only on Phase 0) ──── CODEBASE.md ──►───┤ │
                                                                      │ │
                               Phase 3 ◄──────────────────────────────┘ │
                                  │                                      │
                               Phase 4                                   │
                                  │                                      │
                          ┌───────┴──────────┐                          │
                        PASS               FAIL                          │
                          │                  └─► Phase 5 ──► Phase 3    │
                          │                                              │
                       Phase 7 ◄─────────────────────────────────────────┘
                          │
                       Phase 8
                          │
                       Phase 9
```

| Phase | Key Deliverable                   | Unblocks       |
| ----- | --------------------------------- | -------------- |
| **0** | Packages, env, config schema      | Everything     |
| **1** | Jira / Confluence / Figma clients | Phase 2        |
| **2** | Enriched story JSON               | Phases 3, 4, 5 |
| **6** | `CODEBASE.md` + lazy watcher      | Phases 3, 7    |
| **3** | TC Markdown files                 | Phase 4        |
| **4** | Coverage gate + score JSON        | Phases 5, 7    |
| **5** | Self-learning loop                | Phase 3 retry  |
| **7** | Spec files via Playwright MCP     | Phase 8        |
| **8** | Self-healing in page objects      | Phase 9        |
| **9** | Hourly scheduler + full pipeline  | **Ship**       |

---

## 13. Human Control Points

Every tunable behaviour in the system is accessible without touching TypeScript source code.

| What to change                                 | Where                                             | Field                                 |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| Coverage threshold                             | `.hermes/config/thresholds.json`                  | `coverageGate.minimumCoveragePercent` |
| AC / image / Figma / Confluence score weights  | `.hermes/config/thresholds.json`                  | `coverageGate.weights.*`              |
| Max generation retries before human escalation | `.hermes/config/thresholds.json`                  | `coverageGate.maxGenerationRetries`   |
| Max self-heal attempts before quarantine       | `.hermes/config/thresholds.json`                  | `selfHealing.maxHealAttempts`         |
| Files the codebase agent tracks                | `.hermes/config/thresholds.json`                  | `codebaseAgent.trackedGlobs`          |
| Run schedule                                   | `.env`                                            | `HERMES_SCHEDULE` (cron syntax)       |
| Jira assignee filter                           | `.env`                                            | `HERMES_ASSIGNEE_FILTER`              |
| LLM model                                      | `.env`                                            | `LLM_MODEL`                           |
| How the LLM generates test cases               | `.hermes/prompts/test-generation.md`              | Edit prompt directly                  |
| How coverage gaps are analysed                 | `.hermes/prompts/coverage-analysis.md`            | Edit prompt directly                  |
| How the codebase is summarised                 | `.hermes/prompts/codebase-scan.md`                | Edit prompt directly                  |
| Agent identity and quality constraints         | `SOUL.md`                                         | Edit directly                         |
| Per-file coding rules for spec files           | `.github/instructions/playwright.instructions.md` | Edit directly                         |
