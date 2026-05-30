/**
 * full-pipeline.ts
 *
 * Orchestrates the complete Hermes Agent QA pipeline end-to-end:
 *
 *   1. Environment check     — validate prerequisites
 *   2. Run tests             — execute Playwright suite
 *   3. Archive results       — persist run record with git metadata
 *   4. Compare runs          — diff against baseline / previous run
 *   5. Release gate          — evaluate go/no-go thresholds
 *   6. Notify stakeholders   — post summary to configured webhooks
 *
 * Each step's exit code is respected. The pipeline aborts on env-check
 * failure. All other step failures are recorded and surfaced at the end.
 * Notification always runs, even when the gate fails.
 *
 * Usage:
 *   tsx scripts/full-pipeline.ts
 *   tsx scripts/full-pipeline.ts --skip-notify
 */
import { spawnSync } from 'child_process';
import * as path from 'path';

const SKIP_NOTIFY = process.argv.includes('--skip-notify');

interface Step {
  name: string;
  cmd: string;
  args: string[];
  abortOnFailure?: boolean;
  warnOnly?: boolean;
}

const steps: Step[] = [
  {
    name: 'Environment Check',
    cmd: 'npx',
    args: ['tsx', 'scripts/env-check.ts'],
    abortOnFailure: true,
  },
  {
    name: 'Run Tests',
    cmd: 'npx',
    args: ['playwright', 'test'],
  },
  {
    name: 'Archive Results',
    cmd: 'npx',
    args: ['tsx', 'scripts/archive-results.ts'],
    warnOnly: true,
  },
  {
    name: 'Compare Runs',
    cmd: 'npx',
    args: ['tsx', 'scripts/compare-runs.ts'],
    warnOnly: true,
  },
  {
    name: 'Release Gate',
    cmd: 'npx',
    args: ['tsx', 'scripts/release-gate.ts'],
  },
];

if (!SKIP_NOTIFY) {
  steps.push({
    name: 'Notify Stakeholders',
    cmd: 'npx',
    args: ['tsx', 'scripts/notify.ts'],
    warnOnly: true,
  });
}

// ---------------------------------------------------------------------------
// Run each step
// ---------------------------------------------------------------------------
interface StepResult {
  name: string;
  exitCode: number;
  durationMs: number;
}

const results: StepResult[] = [];
let pipelineFailed = false;

console.log('\n[pipeline] ═══════════════════════════════════════════════════');
console.log('[pipeline]  demo-playwright-cli — Full QA Pipeline');
console.log('[pipeline] ═══════════════════════════════════════════════════\n');

const pipelineStart = Date.now();

for (const step of steps) {
  const stepStart = Date.now();
  console.log(`[pipeline] ▶ ${step.name}`);
  console.log('─'.repeat(70));

  const result = spawnSync(step.cmd, step.args, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });

  const durationMs = Date.now() - stepStart;
  const exitCode = result.status ?? 1;
  const passed = exitCode === 0;

  results.push({ name: step.name, exitCode, durationMs });

  const icon = passed ? '✓' : step.warnOnly ? '⚠' : '✗';
  console.log(
    `\n[pipeline] ${icon} ${step.name} — ${passed ? 'OK' : `exit ${exitCode}`} (${(durationMs / 1000).toFixed(1)}s)\n`,
  );

  if (!passed) {
    if (step.abortOnFailure) {
      console.error(
        `[pipeline] ✗ Aborting: critical step "${step.name}" failed.`,
      );
      process.exit(exitCode);
    }
    if (!step.warnOnly) {
      pipelineFailed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const totalMs = Date.now() - pipelineStart;

console.log('[pipeline] ═══════════════════════════════════════════════════');
console.log('[pipeline]  Pipeline Summary');
console.log('─'.repeat(70));

for (const r of results) {
  const icon = r.exitCode === 0 ? '✓' : '✗';
  const label = r.name.padEnd(30);
  const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
  console.log(
    `  ${icon}  ${label} ${r.exitCode === 0 ? 'PASS' : `FAIL (${r.exitCode})`} · ${duration}`,
  );
}

console.log('─'.repeat(70));
console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);
console.log(`  Pipeline:   ${pipelineFailed ? '✗ FAILED' : '✓ PASSED'}`);
console.log('[pipeline] ═══════════════════════════════════════════════════\n');

process.exit(pipelineFailed ? 1 : 0);
