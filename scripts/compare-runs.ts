/**
 * compare-runs.ts
 *
 * Compares two archived run records and reports new failures, fixed tests,
 * persistent failures, and pass-rate delta.
 *
 * Usage:
 *   tsx scripts/compare-runs.ts                    # latest two runs in history
 *   tsx scripts/compare-runs.ts --set-baseline     # tag the latest run as baseline
 *   tsx scripts/compare-runs.ts --baseline <file> --current <file>
 *
 * Exit codes:
 *   0 — no new failures introduced
 *   1 — new failures detected
 *   2 — not enough run history to compare
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunRecord, RunComparison } from './types';

const HISTORY_DIR = path.join(process.cwd(), 'test-results', 'history');
const BASELINE_FILE = path.join(process.cwd(), 'test-results', 'baseline.json');

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function loadRecord(filePath: string): RunRecord {
  if (!fs.existsSync(filePath)) {
    console.error(`[compare] ✗ File not found: ${filePath}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RunRecord;
}

function getHistoryFiles(): string[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(HISTORY_DIR, f))
    .sort(); // lexicographic sort — filenames start with ISO timestamp so this is chronological
}

// ---------------------------------------------------------------------------
// Handle --set-baseline
// ---------------------------------------------------------------------------
if (process.argv.includes('--set-baseline')) {
  const files = getHistoryFiles();
  if (files.length === 0) {
    console.error(
      '[compare] ✗ No run history found. Run "npm run archive" first.',
    );
    process.exit(2);
  }
  const latest = files.at(-1)!;
  fs.copyFileSync(latest, BASELINE_FILE);
  const rec = loadRecord(BASELINE_FILE);
  console.log(`[compare] ✓ Baseline set → test-results/baseline.json`);
  console.log(
    `[compare]   Run: ${rec.runId} · ${rec.stats.passRate}% pass · ${rec.stats.failed} failed`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Resolve which two runs to compare
// ---------------------------------------------------------------------------
let baselineRecord: RunRecord;
let currentRecord: RunRecord;

const baselineArg = arg('--baseline');
const currentArg = arg('--current');

if (baselineArg && currentArg) {
  baselineRecord = loadRecord(baselineArg);
  currentRecord = loadRecord(currentArg);
} else if (fs.existsSync(BASELINE_FILE)) {
  // Compare latest run against the saved baseline
  const files = getHistoryFiles();
  if (files.length === 0) {
    console.error('[compare] ✗ No run history. Run "npm run archive" first.');
    process.exit(2);
  }
  baselineRecord = loadRecord(BASELINE_FILE);
  currentRecord = loadRecord(files.at(-1)!);
} else {
  // Fall back to last two runs
  const files = getHistoryFiles();
  if (files.length < 2) {
    console.error(
      '[compare] ✗ Need at least 2 archived runs. Run "npm run archive" after each test run.',
    );
    console.error(
      '          Use "npm run compare --set-baseline" to save a baseline first.',
    );
    process.exit(2);
  }
  baselineRecord = loadRecord(files.at(-2)!);
  currentRecord = loadRecord(files.at(-1)!);
}

// ---------------------------------------------------------------------------
// Compute diff
// ---------------------------------------------------------------------------
const baselineFailed = new Set(baselineRecord.failures.map((f) => f.title));
const currentFailed = new Set(currentRecord.failures.map((f) => f.title));

const comparison: RunComparison = {
  baseline: {
    runId: baselineRecord.runId,
    passRate: baselineRecord.stats.passRate,
    failed: baselineRecord.stats.failed,
    timestamp: baselineRecord.timestamp,
  },
  current: {
    runId: currentRecord.runId,
    passRate: currentRecord.stats.passRate,
    failed: currentRecord.stats.failed,
    timestamp: currentRecord.timestamp,
  },
  newFailures: currentRecord.failures
    .filter((f) => !baselineFailed.has(f.title))
    .map((f) => f.title),
  fixedTests: baselineRecord.failures
    .filter((f) => !currentFailed.has(f.title))
    .map((f) => f.title),
  persistentFailures: currentRecord.failures
    .filter((f) => baselineFailed.has(f.title))
    .map((f) => f.title),
  passRateDelta:
    Math.round(
      (currentRecord.stats.passRate - baselineRecord.stats.passRate) * 10,
    ) / 10,
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const deltaSign = comparison.passRateDelta >= 0 ? '+' : '';

console.log('\n[compare] Run Comparison');
console.log('─'.repeat(70));
console.log(`  Baseline: ${comparison.baseline.runId}`);
console.log(
  `            ${comparison.baseline.passRate}% pass · ${comparison.baseline.failed} failed`,
);
console.log(`  Current:  ${comparison.current.runId}`);
console.log(
  `            ${comparison.current.passRate}% pass · ${comparison.current.failed} failed`,
);
console.log(`  Delta:    ${deltaSign}${comparison.passRateDelta}% pass rate`);
console.log('─'.repeat(70));

if (comparison.newFailures.length > 0) {
  console.log(`\n  ✗ NEW failures (${comparison.newFailures.length}):`);
  for (const t of comparison.newFailures) console.log(`      - ${t}`);
}

if (comparison.fixedTests.length > 0) {
  console.log(`\n  ✓ Fixed since baseline (${comparison.fixedTests.length}):`);
  for (const t of comparison.fixedTests) console.log(`      + ${t}`);
}

if (comparison.persistentFailures.length > 0) {
  console.log(
    `\n  ⚠ Persistent failures (${comparison.persistentFailures.length}):`,
  );
  for (const t of comparison.persistentFailures) console.log(`      ~ ${t}`);
}

if (
  comparison.newFailures.length === 0 &&
  comparison.fixedTests.length === 0 &&
  comparison.persistentFailures.length === 0
) {
  console.log('\n  No changes between runs.');
}

console.log('');

// Save comparison result for downstream use
const outFile = path.join(process.cwd(), 'test-results', 'comparison.json');
fs.writeFileSync(outFile, JSON.stringify(comparison, null, 2));
console.log(`[compare] Saved comparison → test-results/comparison.json`);

process.exit(comparison.newFailures.length > 0 ? 1 : 0);
