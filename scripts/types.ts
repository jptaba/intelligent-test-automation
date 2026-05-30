/**
 * Shared TypeScript types used across all Hermes Agent integration scripts.
 * All scripts import from here to keep data shapes consistent.
 */

// ---------------------------------------------------------------------------
// Playwright JSON reporter output types
// ---------------------------------------------------------------------------

export interface PwTestResult {
  workerIndex: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  error?: { message?: string; stack?: string };
  retry: number;
}

export interface PwTest {
  timeout: number;
  annotations: Array<{ type: string; description?: string }>;
  expectedStatus: string;
  projectId: string;
  projectName: string;
  results: PwTestResult[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}

export interface PwSpec {
  title: string;
  ok: boolean;
  tags?: string[];
  tests: PwTest[];
}

export interface PwSuite {
  title: string;
  file?: string;
  column?: number;
  line?: number;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

export interface PwReport {
  config: { rootDir: string };
  suites: PwSuite[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
  errors: unknown[];
}

// ---------------------------------------------------------------------------
// Archived run record — written to test-results/history/<timestamp>-<sha>.json
// ---------------------------------------------------------------------------

export interface FlatSpec {
  title: string;
  file: string;
  ok: boolean;
  isSmoke: boolean;
  durationMs: number;
  error?: string;
}

export interface RunRecord {
  runId: string;
  timestamp: string;
  gitSha: string;
  gitBranch: string;
  gitTag: string;
  gitMessage: string;
  stats: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    passRate: number;
    durationMs: number;
  };
  smokeTests: {
    total: number;
    passed: number;
    failed: number;
    allPassing: boolean;
  };
  failures: Array<{
    title: string;
    file: string;
    error: string;
    durationMs: number;
  }>;
  slowest: Array<{
    title: string;
    file: string;
    durationMs: number;
  }>;
  allSpecs: FlatSpec[];
}

// ---------------------------------------------------------------------------
// Release gate output
// ---------------------------------------------------------------------------

export interface GateDecision {
  result: 'PASS' | 'FAIL';
  reasons: string[];
  summary: string;
  runId: string;
  passRate: number;
  smokeAllPassing: boolean;
}

// ---------------------------------------------------------------------------
// Run comparison output
// ---------------------------------------------------------------------------

export interface RunComparison {
  baseline: {
    runId: string;
    passRate: number;
    failed: number;
    timestamp: string;
  };
  current: {
    runId: string;
    passRate: number;
    failed: number;
    timestamp: string;
  };
  newFailures: string[];
  fixedTests: string[];
  persistentFailures: string[];
  passRateDelta: number;
}

// ---------------------------------------------------------------------------
// Flaky test registry
// ---------------------------------------------------------------------------

export interface FlakyEntry {
  title: string;
  file: string;
  flipCount: number;
  runsSeen: number;
  passCount: number;
  failCount: number;
  lastStatus: 'passed' | 'failed';
}
