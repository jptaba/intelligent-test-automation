/**
 * flaky-detect.ts
 *
 * Analyses archived run history to identify tests that flip between pass and
 * fail (i.e., are unreliable). Outputs a ranked flaky test registry.
 *
 * A test is considered flaky when its status changes (pass→fail or fail→pass)
 * at least --threshold times across the sampled runs.
 *
 * Usage:
 *   tsx scripts/flaky-detect.ts
 *   tsx scripts/flaky-detect.ts --runs 20 --threshold 2
 *
 * Exit codes:
 *   0 — no flaky tests found
 *   1 — one or more flaky tests detected
 *   2 — not enough run history
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunRecord, FlakyEntry } from './types';

const HISTORY_DIR = path.join(process.cwd(), 'test-results', 'history');

function intArg(flag: string, defaultValue: number): number {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) {
    const v = parseInt(process.argv[i + 1], 10);
    return isNaN(v) ? defaultValue : v;
  }
  return defaultValue;
}

const MAX_RUNS = intArg('--runs', 10);
const FLIP_THRESHOLD = intArg('--threshold', 2);

// ---------------------------------------------------------------------------
// Load last N run records
// ---------------------------------------------------------------------------
if (!fs.existsSync(HISTORY_DIR)) {
  console.error(
    '[flaky] ✗ No history directory. Run "npm run archive" after test runs.',
  );
  process.exit(2);
}

const files = fs
  .readdirSync(HISTORY_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .slice(-MAX_RUNS);

if (files.length < 2) {
  console.error(
    `[flaky] ✗ Need at least 2 archived runs (found ${files.length}). Run more test cycles.`,
  );
  process.exit(2);
}

const runs: RunRecord[] = files.map((f) =>
  JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8')),
);

// ---------------------------------------------------------------------------
// Build per-test status timeline
// ---------------------------------------------------------------------------
// Map<testTitle, { file, statuses: boolean[] }>
const timeline = new Map<string, { file: string; statuses: boolean[] }>();

for (const run of runs) {
  for (const spec of run.allSpecs) {
    const key = spec.title;
    if (!timeline.has(key)) {
      timeline.set(key, { file: spec.file, statuses: [] });
    }
    timeline.get(key)!.statuses.push(spec.ok);
  }
}

// ---------------------------------------------------------------------------
// Detect flips
// ---------------------------------------------------------------------------
const flakyTests: FlakyEntry[] = [];

for (const [title, { file, statuses }] of timeline.entries()) {
  let flips = 0;
  for (let i = 1; i < statuses.length; i++) {
    if (statuses[i] !== statuses[i - 1]) flips++;
  }

  if (flips >= FLIP_THRESHOLD) {
    flakyTests.push({
      title,
      file,
      flipCount: flips,
      runsSeen: statuses.length,
      passCount: statuses.filter(Boolean).length,
      failCount: statuses.filter((s) => !s).length,
      lastStatus: statuses.at(-1) ? 'passed' : 'failed',
    });
  }
}

// Sort by flip count descending
flakyTests.sort((a, b) => b.flipCount - a.flipCount);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(
  `\n[flaky] Flaky Test Detection — last ${files.length} runs (threshold: ${FLIP_THRESHOLD} flips)`,
);
console.log('─'.repeat(70));

if (flakyTests.length === 0) {
  console.log(`  ✓ No flaky tests detected across ${files.length} runs.\n`);
  process.exit(0);
}

console.log(`  ⚠ ${flakyTests.length} flaky test(s) detected:\n`);
for (const t of flakyTests) {
  const reliability = Math.round((t.passCount / t.runsSeen) * 100);
  console.log(`  [${t.flipCount} flips] ${t.title}`);
  console.log(`          ${t.file}`);
  console.log(
    `          ${t.passCount}/${t.runsSeen} runs passed (${reliability}% reliable) — last: ${t.lastStatus}`,
  );
  console.log('');
}

// Save flaky registry
const outFile = path.join(process.cwd(), 'test-results', 'flaky-registry.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(flakyTests, null, 2));
console.log(`[flaky] Saved registry → test-results/flaky-registry.json`);

process.exit(1);
