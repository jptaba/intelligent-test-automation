/**
 * Hermes Agent — Test Automation Agent (Phase 7).
 *
 * Converts generated test cases (TC-*.md) into runnable Playwright spec files.
 *
 * Process per test case:
 *   1. Load CODEBASE.md → understand existing page objects and patterns
 *   2. Load TC-<DOMAIN>-<ID>.md → read test steps with Given/When/Then
 *   3. Call LLM to generate TypeScript spec code following project conventions
 *   4. Write spec to tests/<domain>/<feature>.spec.ts
 *   5. Run: npx playwright test tests/<domain>/<feature>.spec.ts
 *   6. Return result (PASS / FAIL → triggers self-healing)
 *
 * Hard constraint: never emit page.locator() in spec files — all interactions
 * go through Page Object methods. Validated post-generation.
 *
 * Usage:
 *   tsx scripts/agents/test-automation-agent.ts <storyId>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { spawnSync } from 'child_process';
import { chat } from './llm';
import type { EnrichedStory } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const STORIES_DIR = path.join(process.cwd(), 'inputs', 'stories');
const TC_DIR = path.join(process.cwd(), 'inputs', 'testcases');
const SOUL_FILE = path.join(process.cwd(), 'SOUL.md');
const CODEBASE_FILE = path.join(process.cwd(), 'CODEBASE.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationResult {
  storyId: string;
  specFile: string;
  testRunResult: 'PASS' | 'FAIL' | 'SKIPPED';
  failedTests: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(storyId: string): Promise<AutomationResult> {
  console.log(`[automate] Generating spec for ${storyId}`);

  // 1. Load context
  const tcFiles = fs.existsSync(TC_DIR)
    ? fs
        .readdirSync(TC_DIR)
        .filter((f) => f.includes(storyId) && f.endsWith('.md'))
    : [];

  if (tcFiles.length === 0) {
    throw new Error(`[automate] No TC file found for ${storyId} in ${TC_DIR}`);
  }

  const tcPath = path.join(TC_DIR, tcFiles[0]);
  const tcContent = fs.readFileSync(tcPath, 'utf8');

  const enrichedPath = path.join(STORIES_DIR, `${storyId}-enriched.json`);
  const story: EnrichedStory | null = fs.existsSync(enrichedPath)
    ? JSON.parse(fs.readFileSync(enrichedPath, 'utf8'))
    : null;

  const soulMd = fs.existsSync(SOUL_FILE)
    ? fs.readFileSync(SOUL_FILE, 'utf8')
    : '';
  const codebaseMd = fs.existsSync(CODEBASE_FILE)
    ? fs.readFileSync(CODEBASE_FILE, 'utf8')
    : '(CODEBASE.md not available)';

  // 2. Infer domain from TC filename
  const domain = inferDomainFromFilename(tcFiles[0]);
  const specFileName = `${storyId.toLowerCase().replace(/[^a-z0-9]/g, '-')}.spec.ts`;
  const specDir = path.join(process.cwd(), 'tests', domain);
  const specPath = path.join(specDir, specFileName);

  // 3. Build generation prompt
  const systemPrompt = buildSystemPrompt(soulMd);
  const userPrompt = buildUserPrompt(
    tcContent,
    codebaseMd,
    story,
    storyId,
    domain,
  );

  console.log(`[automate] Calling LLM to generate spec...`);
  const rawSpec = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 4. Extract TypeScript code from the response
  const specCode = extractTypeScriptCode(rawSpec);

  // 5. Validate: no raw page.locator() calls in spec (only in page objects)
  const violations = findDirectLocatorUsage(specCode);
  if (violations.length > 0) {
    console.warn(
      `[automate] WARNING: ${violations.length} raw locator(s) found in generated spec. ` +
        `These must be moved to Page Objects. Violations:\n` +
        violations.map((v) => `  - ${v}`).join('\n'),
    );
  }

  // 6. Write spec file
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(specPath, specCode, 'utf8');
  console.log(
    `[automate] ✓ Wrote spec: ${path.relative(process.cwd(), specPath)}`,
  );

  // 7. Run the spec
  const result = runSpec(specPath);

  console.log(
    `[automate] Test run: ${result.testRunResult} ` +
      `(${result.failedTests.length} failure(s), ${result.duration}ms)`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// LLM prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(soulMd: string): string {
  return `You are Hermes Agent — a Playwright TypeScript automation engineer.
Generate production-quality spec files following ALL rules below.

## Project Rules (from SOUL.md)
${soulMd.substring(0, 3000)}

## Critical Constraints
1. NEVER use page.locator() or page.getByRole() directly in spec files
2. ALL browser interactions MUST go through Page Object methods
3. Import credentials from data/users.ts (USERS.standard, etc.) — NEVER hardcode
4. Import products from data/products.ts — NEVER hardcode product strings
5. Tests needing login: import { test, expect } from '../../fixtures/auth.fixture'
6. Auth tests: import { test, expect } from '@playwright/test'
7. If a Page Object method doesn't exist, add: // TODO: add <ClassName>.<methodName>()
8. Output ONLY the TypeScript spec code — no explanations, no markdown fences`;
}

function buildUserPrompt(
  tcContent: string,
  codebaseMd: string,
  story: EnrichedStory | null,
  storyId: string,
  domain: string,
): string {
  return `## Codebase Reference

${codebaseMd}

---

## Test Cases to Implement

${tcContent}

---

## Instructions

Generate a complete Playwright TypeScript spec file for the test cases above.

- File location: tests/${domain}/${storyId.toLowerCase().replace(/[^a-z0-9]/g, '-')}.spec.ts
- Use the Given/When/Then structure as comments in each test
- Map each TC block to one test() call
- Use the page objects and fixtures documented in the Codebase Reference
- Story ID for reference: ${storyId}
${story ? `- Story has ${story.acceptanceCriteria.length} acceptance criteria to cover` : ''}

Generate the complete spec file now:`;
}

// ---------------------------------------------------------------------------
// Code extraction
// ---------------------------------------------------------------------------

function extractTypeScriptCode(rawOutput: string): string {
  // Strip markdown code fences if present
  const fenceMatch = rawOutput.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // If no fences, assume the entire output is code
  return rawOutput.trim();
}

function findDirectLocatorUsage(code: string): string[] {
  const violations: string[] = [];
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Allow page.locator in comments
    if (line.trim().startsWith('//')) continue;
    if (
      /\bpage\.(locator|getByRole|getByLabel|getByText|getByTestId|fill|click|type)\s*\(/.test(
        line,
      )
    ) {
      violations.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function runSpec(specPath: string): AutomationResult {
  const relPath = path.relative(process.cwd(), specPath);
  const storyId = path.basename(specPath, '.spec.ts');
  const start = Date.now();

  const result = spawnSync(
    'npx',
    ['playwright', 'test', relPath, '--reporter=json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120_000,
    },
  );

  const duration = Date.now() - start;

  if (result.status === 0) {
    return {
      storyId,
      specFile: relPath,
      testRunResult: 'PASS',
      failedTests: [],
      duration,
    };
  }

  // Parse failed test names from stdout (JSON reporter)
  const failedTests: string[] = [];
  try {
    const report = JSON.parse(result.stdout ?? '{}');
    const suites = report.suites ?? [];
    function collectFailed(suiteList: unknown[]): void {
      for (const suite of suiteList as Array<{
        specs?: Array<{ ok: boolean; title: string }>;
        suites?: unknown[];
      }>) {
        for (const spec of suite.specs ?? []) {
          if (!spec.ok) failedTests.push(spec.title);
        }
        if (suite.suites) collectFailed(suite.suites);
      }
    }
    collectFailed(suites);
  } catch {
    // Non-fatal — JSON parse failed
  }

  return {
    storyId,
    specFile: relPath,
    testRunResult: 'FAIL',
    failedTests,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferDomainFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('login') || lower.includes('auth')) return 'auth';
  if (lower.includes('cart') || lower.includes('checkout')) return 'cart';
  if (lower.includes('inventory') || lower.includes('product'))
    return 'inventory';
  return 'general';
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const storyArg = process.argv[2];
  if (!storyArg) {
    console.error(
      '[automate] Usage: tsx scripts/agents/test-automation-agent.ts <storyId>',
    );
    process.exit(1);
  }

  run(storyArg)
    .then((result) => {
      console.log(`[automate] Done: ${result.testRunResult}`);
      if (result.testRunResult === 'FAIL') process.exit(1);
    })
    .catch((err: Error) => {
      console.error(`[automate] Fatal: ${err.message}`);
      process.exit(1);
    });
}
