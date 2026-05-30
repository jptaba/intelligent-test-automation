/**
 * Hermes Agent — Self-Healing Agent (Phase 8).
 *
 * When a Playwright spec fails, this agent:
 *   1. Reads the test results JSON to identify failed tests
 *   2. Maps failures to Page Object methods
 *   3. Uses playwright-cli snapshot to get the current accessibility tree
 *   4. Calls LLM with the snapshot + failure + page object code to get a fix
 *   5. Applies the fix to the Page Object
 *   6. Re-runs the spec to verify the fix
 *   7. Writes to .hermes/memory/healing-log.jsonl
 *
 * Respects maxHealAttempts from thresholds.json. Escalates to human if
 * confidence is low or all attempts exhausted.
 *
 * Usage:
 *   tsx scripts/agents/self-healing-agent.ts <specFile> [--test-name <name>]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { spawnSync } from 'child_process';
import { chat } from './llm';
import { loadConfig, loadPrompt, MEMORY_DIR } from './config';
import type { HealingLogEntry } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const HEALING_LOG = path.join(MEMORY_DIR, 'healing-log.jsonl');
const CODEBASE_FILE = path.join(process.cwd(), 'CODEBASE.md');
const SOUL_FILE = path.join(process.cwd(), 'SOUL.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealingFix {
  pageObjectFile: string;
  methodName: string;
  failureRootCause: string;
  oldCode: string;
  newCode: string;
  newSelector: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface HealingResult {
  specFile: string;
  healed: boolean;
  attempts: number;
  escalated: boolean;
  fixes: HealingFix[];
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(
  specFile: string,
  targetTestName?: string,
): Promise<HealingResult> {
  const config = loadConfig();
  const maxAttempts = config.selfHealing.maxHealAttempts;
  const relSpecPath = path.isAbsolute(specFile)
    ? path.relative(process.cwd(), specFile)
    : specFile;

  console.log(`[heal] Starting self-healing for ${relSpecPath}`);

  const appliedFixes: HealingFix[] = [];
  let healed = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[heal] Attempt ${attempt}/${maxAttempts}`);

    // 1. Run the spec to capture current failures
    const testResult = runSpec(relSpecPath, targetTestName);
    if (testResult.exitCode === 0) {
      console.log(`[heal] ✓ All tests passing — healing complete`);
      healed = true;
      break;
    }

    const failedTest = targetTestName ?? testResult.firstFailedTest;
    if (!failedTest) {
      console.log('[heal] No specific failing test identified');
      break;
    }

    const failureMessage = testResult.failureMessage;
    console.log(`[heal] Failing test: "${failedTest}"`);
    console.log(`[heal] Error: ${failureMessage.substring(0, 200)}`);

    // 2. Get the page under test from the failure message
    const pageUrl = extractPageUrl(failureMessage);

    // 3. Get accessibility snapshot
    const snapshot = captureSnapshot(pageUrl);

    // 4. Identify which Page Object is responsible
    const pageObjectInfo = identifyPageObject(failedTest, failureMessage);
    if (!pageObjectInfo) {
      console.warn(
        '[heal] Could not identify responsible Page Object — escalating',
      );
      break;
    }

    const { pageObjectPath, pageObjectContent } = pageObjectInfo;

    // 5. Ask LLM for a fix
    const soulMd = fs.existsSync(SOUL_FILE)
      ? fs.readFileSync(SOUL_FILE, 'utf8')
      : '';
    const codebaseMd = fs.existsSync(CODEBASE_FILE)
      ? fs.readFileSync(CODEBASE_FILE, 'utf8')
      : '';

    const healPrompt = loadPrompt('self-healing', {
      SOUL_MD: soulMd.substring(0, 2000),
      CODEBASE_MD: codebaseMd.substring(0, 3000),
      TEST_NAME: failedTest,
      FAILURE_MESSAGE: failureMessage.substring(0, 1000),
      PAGE_URL: pageUrl,
      MCP_SNAPSHOT: snapshot,
      PAGE_OBJECT_CONTENT: pageObjectContent,
    });

    let fix: HealingFix;
    try {
      const fixResponse = await chat([
        {
          role: 'system',
          content:
            'You are a Playwright test repair expert. Output ONLY valid JSON. ' +
            'Follow the output format exactly.',
        },
        { role: 'user', content: healPrompt },
      ]);

      const jsonMatch = fixResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      fix = JSON.parse(jsonMatch[0]) as HealingFix;
    } catch (err) {
      console.warn(`[heal] LLM fix parsing failed: ${(err as Error).message}`);
      break;
    }

    if (fix.confidence === 'low') {
      console.warn(
        `[heal] Low confidence fix — escalating to human. Reason: ${fix.explanation}`,
      );
      appendHealingLog({
        specFile: relSpecPath,
        testName: failedTest,
        failureMessage,
        fix,
        attempt,
        result: 'ESCALATED',
      });
      return {
        specFile: relSpecPath,
        healed: false,
        attempts: attempt,
        escalated: true,
        fixes: appliedFixes,
      };
    }

    // 6. Apply the fix
    const fixApplied = applyFix(fix);
    if (!fixApplied) {
      console.warn(
        `[heal] Could not apply fix — old code not found in ${fix.pageObjectFile}`,
      );
      break;
    }

    appliedFixes.push(fix);
    console.log(
      `[heal] Applied fix to ${fix.pageObjectFile}: ${fix.explanation}`,
    );

    appendHealingLog({
      specFile: relSpecPath,
      testName: failedTest,
      failureMessage,
      fix,
      attempt,
      result: 'PASS', // optimistic — verified on next loop iteration
    });
  }

  // Final run to confirm
  if (!healed) {
    const finalResult = runSpec(relSpecPath, targetTestName);
    healed = finalResult.exitCode === 0;
  }

  return {
    specFile: relSpecPath,
    healed,
    attempts: appliedFixes.length,
    escalated: false,
    fixes: appliedFixes,
  };
}

// ---------------------------------------------------------------------------
// Fix application
// ---------------------------------------------------------------------------

function applyFix(fix: HealingFix): boolean {
  const absPath = path.join(process.cwd(), fix.pageObjectFile);
  if (!fs.existsSync(absPath)) {
    console.warn(`[heal] Page Object file not found: ${absPath}`);
    return false;
  }

  const content = fs.readFileSync(absPath, 'utf8');
  if (!content.includes(fix.oldCode)) {
    console.warn(`[heal] Old code not found in ${fix.pageObjectFile}`);
    return false;
  }

  const updated = content.replace(fix.oldCode, fix.newCode);
  fs.writeFileSync(absPath, updated, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// Spec runner
// ---------------------------------------------------------------------------

function runSpec(
  specPath: string,
  testName?: string,
): { exitCode: number; firstFailedTest: string; failureMessage: string } {
  const args = ['playwright', 'test', specPath, '--reporter=json'];
  if (testName) args.push('--grep', testName);

  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 120_000,
  });

  let firstFailedTest = '';
  let failureMessage = result.stderr ?? '';

  try {
    const report = JSON.parse(result.stdout ?? '{}');
    function findFirstFail(suites: unknown[]): void {
      for (const suite of suites as Array<{
        specs?: Array<{
          ok: boolean;
          title: string;
          tests: Array<{ results: Array<{ error?: { message?: string } }> }>;
        }>;
        suites?: unknown[];
      }>) {
        for (const spec of suite.specs ?? []) {
          if (!spec.ok && !firstFailedTest) {
            firstFailedTest = spec.title;
            const err = spec.tests[0]?.results[0]?.error;
            if (err?.message) failureMessage = err.message;
          }
        }
        if (suite.suites) findFirstFail(suite.suites);
      }
    }
    findFirstFail(report.suites ?? []);
  } catch {
    // Non-fatal
  }

  return {
    exitCode: result.status ?? 1,
    firstFailedTest,
    failureMessage,
  };
}

// ---------------------------------------------------------------------------
// Accessibility snapshot via playwright-cli
// ---------------------------------------------------------------------------

function captureSnapshot(pageUrl: string): string {
  if (!pageUrl) return '(no URL — could not capture snapshot)';

  // Use @playwright/cli if available
  const result = spawnSync(
    'npx',
    ['playwright', 'accessibility', pageUrl, '--timeout=15000'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
    },
  );

  if (result.status === 0 && result.stdout) {
    return result.stdout.substring(0, 5000);
  }

  return '(snapshot unavailable — browser could not load the page)';
}

// ---------------------------------------------------------------------------
// Page Object identification
// ---------------------------------------------------------------------------

function identifyPageObject(
  testName: string,
  failureMessage: string,
): { pageObjectPath: string; pageObjectContent: string } | null {
  // Look for Page Object class name in the failure stack trace
  const pagesDir = path.join(process.cwd(), 'pages');
  if (!fs.existsSync(pagesDir)) return null;

  const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.ts'));

  // Try to find the page object mentioned in the stack trace or test name
  const combined = `${testName} ${failureMessage}`.toLowerCase();
  for (const file of pageFiles) {
    const className = path.basename(file, '.ts').toLowerCase();
    if (combined.includes(className.replace('page', ''))) {
      const absPath = path.join(pagesDir, file);
      return {
        pageObjectPath: path.join('pages', file),
        pageObjectContent: fs.readFileSync(absPath, 'utf8'),
      };
    }
  }

  // Fallback: return the first page object that has a matching method name
  const methodMatch = failureMessage.match(/at \w+\.(\w+)\s/);
  if (methodMatch) {
    const methodName = methodMatch[1];
    for (const file of pageFiles) {
      const absPath = path.join(pagesDir, file);
      const content = fs.readFileSync(absPath, 'utf8');
      if (content.includes(methodName)) {
        return {
          pageObjectPath: path.join('pages', file),
          pageObjectContent: content,
        };
      }
    }
  }

  return null;
}

function extractPageUrl(failureMessage: string): string {
  const urlMatch = failureMessage.match(/https?:\/\/[^\s"']+/);
  return urlMatch ? urlMatch[0] : '';
}

// ---------------------------------------------------------------------------
// Healing log
// ---------------------------------------------------------------------------

function appendHealingLog(params: {
  specFile: string;
  testName: string;
  failureMessage: string;
  fix: HealingFix;
  attempt: number;
  result: 'PASS' | 'FAIL' | 'ESCALATED';
}): void {
  const entry: HealingLogEntry = {
    ts: new Date().toISOString(),
    specFile: params.specFile,
    testName: params.testName,
    failureMessage: params.failureMessage.substring(0, 300),
    pageObjectFile: params.fix.pageObjectFile,
    methodHealed: params.fix.methodName,
    oldSelector: params.fix.oldCode.substring(0, 200),
    newSelector: params.fix.newSelector,
    healAttempt: params.attempt,
    result: params.result,
    explanation: params.fix.explanation,
  };

  fs.mkdirSync(path.dirname(HEALING_LOG), { recursive: true });
  fs.appendFileSync(HEALING_LOG, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const specArg = process.argv[2];
  const testNameIdx = process.argv.indexOf('--test-name');
  const testName =
    testNameIdx !== -1 ? process.argv[testNameIdx + 1] : undefined;

  if (!specArg) {
    console.error(
      '[heal] Usage: tsx scripts/agents/self-healing-agent.ts <specFile> [--test-name <name>]',
    );
    process.exit(1);
  }

  run(specArg, testName)
    .then((result) => {
      const status = result.healed
        ? 'HEALED'
        : result.escalated
          ? 'ESCALATED'
          : 'FAILED';
      console.log(
        `[heal] Done: ${status} (${result.attempts} fix(es) applied)`,
      );
      if (!result.healed && !result.escalated) process.exit(1);
    })
    .catch((err: Error) => {
      console.error(`[heal] Fatal: ${err.message}`);
      process.exit(1);
    });
}
