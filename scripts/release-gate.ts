/**
 * release-gate.ts
 *
 * Reads the most recent archived run record and evaluates it against
 * configurable release-gate thresholds. Outputs a structured decision.
 *
 * Thresholds (override via env vars):
 *   GATE_PASS_RATE        minimum pass rate percentage (default: 95)
 *   GATE_SMOKE_MUST_PASS  require all @smoke tests to pass (default: true)
 *   GATE_MAX_FAILURES     maximum number of failing tests (default: 0)
 *
 * Exit codes:
 *   0 — PASS (safe to release)
 *   1 — FAIL (blocked)
 *   2 — ERROR (no run data found)
 *
 * Usage:
 *   tsx scripts/release-gate.ts
 *   tsx scripts/release-gate.ts --run path/to/run.json
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunRecord, GateDecision } from './types';

const HISTORY_DIR = path.join(process.cwd(), 'test-results', 'history');

const GATE_PASS_RATE = parseFloat(process.env.GATE_PASS_RATE ?? '95');
const GATE_SMOKE_MUST_PASS =
  (process.env.GATE_SMOKE_MUST_PASS ?? 'true') !== 'false';
const GATE_MAX_FAILURES = parseInt(process.env.GATE_MAX_FAILURES ?? '0', 10);

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function loadLatestRun(): RunRecord {
  const runArg = arg('--run');
  if (runArg) {
    if (!fs.existsSync(runArg)) {
      console.error(`[gate] ✗ Run file not found: ${runArg}`);
      process.exit(2);
    }
    return JSON.parse(fs.readFileSync(runArg, 'utf8'));
  }

  if (!fs.existsSync(HISTORY_DIR)) {
    console.error(
      '[gate] ✗ No history directory found. Run "npm run archive" first.',
    );
    process.exit(2);
  }

  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error(
      '[gate] ✗ No archived runs found. Run "npm run archive" first.',
    );
    process.exit(2);
  }

  return JSON.parse(
    fs.readFileSync(path.join(HISTORY_DIR, files.at(-1)!), 'utf8'),
  );
}

const run = loadLatestRun();
const reasons: string[] = [];

// ---------------------------------------------------------------------------
// Evaluate thresholds
// ---------------------------------------------------------------------------
if (GATE_SMOKE_MUST_PASS && !run.smokeTests.allPassing) {
  reasons.push(
    `${run.smokeTests.failed} @smoke test(s) failing — zero-tolerance threshold`,
  );
}

if (run.stats.passRate < GATE_PASS_RATE) {
  reasons.push(
    `Pass rate ${run.stats.passRate}% is below threshold of ${GATE_PASS_RATE}%`,
  );
}

if (run.stats.failed > GATE_MAX_FAILURES) {
  reasons.push(
    `${run.stats.failed} failing test(s) exceeds maximum of ${GATE_MAX_FAILURES}`,
  );
}

const decision: GateDecision = {
  result: reasons.length === 0 ? 'PASS' : 'FAIL',
  reasons,
  summary:
    reasons.length === 0
      ? `All thresholds met — ${run.stats.passed}/${run.stats.total} tests passing (${run.stats.passRate}%)`
      : reasons.join('; '),
  runId: run.runId,
  passRate: run.stats.passRate,
  smokeAllPassing: run.smokeTests.allPassing,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const resultIcon = decision.result === 'PASS' ? '✓' : '✗';
const resultLabel =
  decision.result === 'PASS' ? 'PASS — safe to release' : 'FAIL — BLOCKED';

console.log('\n[gate] Release Gate Decision');
console.log('─'.repeat(70));
console.log(`  ${resultIcon} ${resultLabel}`);
console.log(`  Run:       ${run.runId}`);
console.log(
  `  Commit:    ${run.gitSha} on ${run.gitBranch}${run.gitTag ? ` (${run.gitTag})` : ''}`,
);
console.log(
  `  Results:   ${run.stats.passed}/${run.stats.total} passed (${run.stats.passRate}%) · ${run.stats.failed} failed`,
);
console.log(
  `  Smoke:     ${run.smokeTests.passed}/${run.smokeTests.total} passing`,
);
console.log('─'.repeat(70));

if (reasons.length > 0) {
  console.log('\n  Blocking reasons:');
  for (const r of reasons) console.log(`    • ${r}`);
  if (run.failures.length > 0) {
    console.log('\n  Failing tests:');
    for (const f of run.failures) {
      console.log(`    ✗ ${f.title}`);
      console.log(`      ${f.file}`);
      if (f.error) {
        const excerpt = f.error.split('\n')[0].slice(0, 120);
        console.log(`      ${excerpt}`);
      }
    }
  }
}

console.log('');

// Save decision JSON for downstream scripts (notify, CI)
const outFile = path.join(process.cwd(), 'test-results', 'gate-decision.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(decision, null, 2));
console.log(`[gate] Saved decision → test-results/gate-decision.json`);

process.exit(decision.result === 'PASS' ? 0 : 1);
