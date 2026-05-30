/**
 * archive-results.ts
 *
 * Reads the Playwright JSON reporter output (test-results/results.json) and
 * saves a structured run record enriched with git metadata to
 * test-results/history/<timestamp>-<sha>.json.
 *
 * Usage:
 *   tsx scripts/archive-results.ts
 *   tsx scripts/archive-results.ts --report path/to/results.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { RunRecord, FlatSpec, PwReport, PwSuite } from './types';

const ROOT = process.cwd();
const DEFAULT_REPORT = path.join(ROOT, 'test-results', 'results.json');
const HISTORY_DIR = path.join(ROOT, 'test-results', 'history');

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function git(cmd: string, fallback = ''): string {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return fallback;
  }
}

function flattenSpecs(suite: PwSuite, parentFile = ''): FlatSpec[] {
  const file = suite.file ?? parentFile;
  const out: FlatSpec[] = [];

  for (const spec of suite.specs ?? []) {
    const lastResult = spec.tests.at(-1)?.results.at(-1);
    out.push({
      title: spec.title,
      file,
      ok: spec.ok,
      isSmoke: spec.title.includes('@smoke'),
      durationMs: lastResult?.duration ?? 0,
      error: lastResult?.error?.message ?? undefined,
    });
  }

  for (const sub of suite.suites ?? []) {
    out.push(...flattenSpecs(sub, file));
  }

  return out;
}

const reportPath = arg('--report') ?? DEFAULT_REPORT;

if (!fs.existsSync(reportPath)) {
  console.error(`[archive] ✗ Report not found: ${reportPath}`);
  console.error('         Run "npm test" first to generate a report.');
  process.exit(1);
}

const report: PwReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const allSpecs = report.suites.flatMap((s) => flattenSpecs(s));

const passed = allSpecs.filter((s) => s.ok).length;
const total = allSpecs.length;
const smokes = allSpecs.filter((s) => s.isSmoke);

const timestamp = report.stats.startTime ?? new Date().toISOString();
const sha = git('git rev-parse --short HEAD', 'unknown');
const branch = git('git rev-parse --abbrev-ref HEAD', 'unknown');
const tag = git('git describe --tags --abbrev=0', '');
const message = git('git log -1 --pretty=%s', '');

const record: RunRecord = {
  runId: `${timestamp}-${sha}`,
  timestamp,
  gitSha: sha,
  gitBranch: branch,
  gitTag: tag,
  gitMessage: message,
  stats: {
    total,
    passed,
    failed: total - passed,
    skipped: report.stats.skipped,
    flaky: report.stats.flaky,
    passRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
    durationMs: report.stats.duration,
  },
  smokeTests: {
    total: smokes.length,
    passed: smokes.filter((s) => s.ok).length,
    failed: smokes.filter((s) => !s.ok).length,
    allPassing: smokes.length === 0 || smokes.every((s) => s.ok),
  },
  failures: allSpecs
    .filter((s) => !s.ok)
    .map((s) => ({
      title: s.title,
      file: s.file,
      error: s.error ?? 'no error message captured',
      durationMs: s.durationMs,
    })),
  slowest: [...allSpecs]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5)
    .map((s) => ({ title: s.title, file: s.file, durationMs: s.durationMs })),
  allSpecs,
};

fs.mkdirSync(HISTORY_DIR, { recursive: true });

// Sanitise timestamp for use in a filename
const safestamp = timestamp.replace(/[:.]/g, '-');
const outFile = path.join(HISTORY_DIR, `${safestamp}-${sha}.json`);
fs.writeFileSync(outFile, JSON.stringify(record, null, 2));

const icon = record.stats.failed === 0 ? '✓' : '✗';
console.log(
  `[archive] ${icon} Archived → test-results/history/${path.basename(outFile)}`,
);
console.log(
  `[archive]   ${passed}/${total} passed (${record.stats.passRate}%) · ${record.stats.failed} failed`,
);
console.log(
  `[archive]   Smoke: ${record.smokeTests.passed}/${record.smokeTests.total} passing`,
);
console.log(
  `[archive]   Git:   ${sha} on ${branch}${tag ? ` (${tag})` : ''}${message ? ` — "${message}"` : ''}`,
);
