/**
 * Hermes Agent — Orchestrator (Phase 9).
 *
 * Main entry point for the autonomous QA pipeline. Runs on a cron schedule
 * (default: every hour) and executes the full pipeline per story:
 *
 *   1. Codebase Intelligence (pre-step — updates CODEBASE.md if changed)
 *   2. Story Ingestion       (fetch from Jira, enrich with Confluence/Figma)
 *   3. Test Case Generation  (LLM → TC markdown)
 *   4. Coverage Gate         (weighted score check)
 *      └─ FAIL → Self-Learning → retry generation (up to maxRetries)
 *   5. Test Automation       (TC → spec → run)
 *      └─ FAIL → Self-Healing (up to maxHealAttempts)
 *   6. Release Gate          (existing gate from scripts/release-gate.ts)
 *   7. Notify                (MS Teams)
 *
 * Flags:
 *   --once           Run one cycle immediately and exit
 *   --story <id>     Process only this story (skip Jira fetch)
 *   --skip-automate  Stop after coverage gate PASS (don't generate/run spec)
 *   --skip-notify    Don't send webhook notifications
 *   --dry-run        Log all steps but don't call external APIs or write files
 *
 * Usage:
 *   tsx scripts/agents/hermes-orchestrator.ts                    # start daemon
 *   tsx scripts/agents/hermes-orchestrator.ts --once             # one shot
 *   tsx scripts/agents/hermes-orchestrator.ts --story PROJ-123   # specific story
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { run as runCodebaseAgent } from './codebase-intelligence-agent';
import { run as runIngestionAgent } from './story-ingestion-agent';
import { run as runGenerationAgent } from './test-case-generation-agent';
import { run as runGateAgent } from './coverage-gate-agent';
import { run as runLearningAgent } from './self-learning-agent';
import { run as runAutomationAgent } from './test-automation-agent';
import { run as runHealingAgent } from './self-healing-agent';
import { loadConfig } from './config';
import type { OrchestratorRunResult } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const ONCE = process.argv.includes('--once');
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_AUTOMATE = process.argv.includes('--skip-automate');
const SKIP_NOTIFY = process.argv.includes('--skip-notify');
const storyFlagIdx = process.argv.indexOf('--story');
const STORY_OVERRIDE =
  storyFlagIdx !== -1 ? process.argv[storyFlagIdx + 1] : undefined;

// ---------------------------------------------------------------------------
// Full pipeline execution
// ---------------------------------------------------------------------------

async function executePipeline(): Promise<void> {
  const config = loadConfig();
  const maxRetries = config.coverageGate.maxGenerationRetries;
  const pipelineStart = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[orchestrator] Pipeline start: ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('[orchestrator] DRY RUN MODE — no external writes');
  console.log(`${'═'.repeat(60)}\n`);

  // ── Step 1: Codebase Intelligence ─────────────────────────────────────────
  console.log('[orchestrator] Step 1/6: Codebase Intelligence');
  if (!DRY_RUN) {
    try {
      await runCodebaseAgent();
    } catch (err) {
      console.warn(
        `[orchestrator] Codebase agent warning: ${(err as Error).message}`,
      );
      // Non-fatal — proceed with potentially stale CODEBASE.md
    }
  }

  // ── Step 2: Story Ingestion ───────────────────────────────────────────────
  console.log('[orchestrator] Step 2/6: Story Ingestion');
  let storiesToProcess: string[] = [];

  if (STORY_OVERRIDE) {
    storiesToProcess = [STORY_OVERRIDE];
  } else if (!DRY_RUN) {
    try {
      const stories = await runIngestionAgent();
      storiesToProcess = stories.map((s) => s.storyId);
    } catch (err) {
      console.error(
        `[orchestrator] Story ingestion failed: ${(err as Error).message}`,
      );
      console.error('[orchestrator] Check your Jira credentials in .env');
      return;
    }
  }

  if (storiesToProcess.length === 0) {
    console.log('[orchestrator] No stories to process this cycle.');
    return;
  }

  console.log(
    `[orchestrator] Processing ${storiesToProcess.length} story(ies): ${storiesToProcess.join(', ')}`,
  );

  // ── Process each story ────────────────────────────────────────────────────
  const results: OrchestratorRunResult[] = [];

  for (const storyId of storiesToProcess) {
    const storyStart = Date.now();
    const result: OrchestratorRunResult = {
      storyId,
      ingestSuccess: true,
      codebaseUpdated: false,
      generationRetries: 0,
      coverageScore: 0,
      coverageDecision: 'SKIPPED',
      automationSpecWritten: false,
      errors: [],
    } as unknown as OrchestratorRunResult;

    try {
      await processStory(storyId, maxRetries, result, config);
    } catch (err) {
      result.errors.push((err as Error).message);
      console.error(
        `[orchestrator] Story ${storyId} failed: ${(err as Error).message}`,
      );
    }

    result.durationMs = Date.now() - storyStart;
    results.push(result);

    printStoryResult(result);
  }

  // ── Pipeline summary ──────────────────────────────────────────────────────
  const totalDuration = Date.now() - pipelineStart;
  const passed = results.filter((r) => r.coverageDecision === 'PASS').length;
  const failed = results.filter((r) => r.coverageDecision === 'FAIL').length;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `[orchestrator] Pipeline complete in ${(totalDuration / 1000).toFixed(1)}s`,
  );
  console.log(
    `[orchestrator] Stories: ${results.length} total, ${passed} PASS, ${failed} FAIL`,
  );
  console.log(`${'═'.repeat(60)}\n`);

  // ── Step 6: Notify ────────────────────────────────────────────────────────
  if (
    !SKIP_NOTIFY &&
    !DRY_RUN &&
    results.some((r) => r.errors.length > 0 || r.coverageDecision === 'FAIL')
  ) {
    await sendNotification(results);
  }
}

// ---------------------------------------------------------------------------
// Per-story pipeline
// ---------------------------------------------------------------------------

async function processStory(
  storyId: string,
  maxRetries: number,
  result: OrchestratorRunResult,
  config: ReturnType<typeof loadConfig>,
): Promise<void> {
  console.log(`\n[orchestrator] ── Processing ${storyId} ──`);

  // ── Step 3: Test Case Generation + Gate loop ──────────────────────────────
  let coverageDecision: 'PASS' | 'FAIL' = 'FAIL';
  let previousGaps = '';

  for (let retry = 0; retry <= maxRetries; retry++) {
    result.generationRetries = retry;

    // Generate test cases
    console.log(
      `[orchestrator] Step 3/${maxRetries + 3}: TC Generation (attempt ${retry + 1})`,
    );
    if (!DRY_RUN) {
      await runGenerationAgent(storyId, retry, previousGaps);
    }

    // Coverage gate
    console.log(`[orchestrator] Step 4/${maxRetries + 3}: Coverage Gate`);
    if (!DRY_RUN) {
      const gateResult = await runGateAgent(storyId);
      result.coverageScore = gateResult.score;
      result.coverageDecision = gateResult.decision;
      coverageDecision = gateResult.decision;

      if (coverageDecision === 'PASS') break;

      // FAIL — learn and retry (unless last attempt)
      if (retry < maxRetries) {
        console.log(
          `[orchestrator] Step 5/${maxRetries + 3}: Self-Learning (retry ${retry + 1})`,
        );
        previousGaps = gateResult.gaps
          .map((g) => `[${g.type}] ${g.id}: ${g.detail}`)
          .join('\n');
        await runLearningAgent(storyId, retry);
      } else {
        console.warn(
          `[orchestrator] Coverage gate FAILED after ${maxRetries + 1} attempts for ${storyId}. ` +
            `Score: ${gateResult.score}%. Human review required.`,
        );
        result.errors.push(
          `Coverage gate failed after ${maxRetries + 1} retries. Final score: ${gateResult.score}%`,
        );
      }
    } else {
      result.coverageDecision = 'PASS'; // dry run — assume pass
      break;
    }
  }

  if (coverageDecision === 'FAIL') return; // Don't proceed to automation

  // ── Step 5: Test Automation ───────────────────────────────────────────────
  if (SKIP_AUTOMATE) {
    console.log('[orchestrator] --skip-automate: Skipping spec generation');
    return;
  }

  console.log(`[orchestrator] Step 5/6: Test Automation`);
  if (!DRY_RUN) {
    let automationResult;
    try {
      automationResult = await runAutomationAgent(storyId);
      result.automationSpecWritten = true;
      result.testRunResult = automationResult.testRunResult;
    } catch (err) {
      result.errors.push(`Automation failed: ${(err as Error).message}`);
      return;
    }

    // ── Step 6: Self-Healing (if tests failed) ───────────────────────────────
    if (automationResult.testRunResult === 'FAIL') {
      console.log(`[orchestrator] Step 6/6: Self-Healing`);
      const healResult = await runHealingAgent(automationResult.specFile);
      result.testRunResult = healResult.healed ? 'HEALED' : 'FAIL';

      if (healResult.escalated) {
        result.errors.push(`Self-healing escalated to human for ${storyId}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

async function sendNotification(
  results: OrchestratorRunResult[],
): Promise<void> {
  const teamsUrl = process.env.MS_TEAMS_WEBHOOK_URL;
  if (!teamsUrl) return;

  const failed = results.filter(
    (r) => r.coverageDecision === 'FAIL' || r.errors.length > 0,
  );

  const facts = [
    { title: 'Stories processed', value: String(results.length) },
    { title: 'Failures', value: String(failed.length) },
    { title: 'Time', value: new Date().toISOString() },
  ];

  const bodyItems: object[] = [
    {
      type: 'TextBlock',
      text: '🤖 Hermes Agent Pipeline Report',
      weight: 'Bolder',
      size: 'Medium',
      color: failed.length > 0 ? 'Attention' : 'Good',
    },
    { type: 'FactSet', facts },
  ];

  if (failed.length > 0) {
    const lines = failed
      .map(
        (r) =>
          `• ${r.storyId}: score=${r.coverageScore}% | ${r.errors[0] ?? 'gate failed'}`,
      )
      .join('\n');
    bodyItems.push({ type: 'TextBlock', text: lines, wrap: true });
  }

  const payload = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.5',
          body: bodyItems,
        },
      },
    ],
  };

  try {
    const axios = (await import('axios')).default;
    await axios.post(teamsUrl, payload);
    console.log('[orchestrator] MS Teams notification sent');
  } catch (err) {
    console.warn(
      `[orchestrator] MS Teams notification failed: ${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Result printer
// ---------------------------------------------------------------------------

function printStoryResult(result: OrchestratorRunResult): void {
  const icon =
    result.errors.length > 0
      ? '✗'
      : result.coverageDecision === 'PASS'
        ? '✓'
        : '~';

  console.log(
    `\n[orchestrator] ${icon} ${result.storyId}: ` +
      `coverage=${result.coverageScore}%/${result.coverageDecision} ` +
      `retries=${result.generationRetries} ` +
      `test=${result.testRunResult ?? 'N/A'} ` +
      `(${(result.durationMs / 1000).toFixed(1)}s)`,
  );
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  ⚠ ${err}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

function startScheduler(): void {
  const schedule = process.env.HERMES_SCHEDULE ?? '0 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[orchestrator] Invalid cron expression: "${schedule}"`);
    process.exit(1);
  }

  console.log(`[orchestrator] Hermes Agent starting. Schedule: "${schedule}"`);
  console.log('[orchestrator] Press Ctrl+C to stop.\n');

  // Run once immediately on start
  executePipeline().catch((err: Error) => {
    console.error(`[orchestrator] Pipeline error: ${err.message}`);
  });

  // Then on schedule
  cron.schedule(schedule, () => {
    console.log(
      `[orchestrator] Scheduled run triggered: ${new Date().toISOString()}`,
    );
    executePipeline().catch((err: Error) => {
      console.error(`[orchestrator] Pipeline error: ${err.message}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (ONCE || DRY_RUN || STORY_OVERRIDE) {
  // Single run mode
  executePipeline()
    .then(() => {
      console.log('[orchestrator] Single run complete.');
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error(`[orchestrator] Fatal: ${err.message}`);
      process.exit(1);
    });
} else {
  // Daemon mode with cron
  startScheduler();
}
