/**
 * Hermes Agent — Self-Learning Agent (Phase 5).
 *
 * Reads coverage gaps from the gate decision, then automatically updates the
 * relevant prompt/skill/soul files to close those gaps on the next retry.
 *
 * Update targets per gap type:
 *   ac         → .hermes/prompts/test-generation.md (new rule)
 *   image      → SOUL.md Constraints section (image-to-behavior rule)
 *   figma      → .hermes/prompts/test-generation.md (Figma UI rule)
 *   confluence → .hermes/prompts/test-generation.md (Confluence citation rule)
 *
 * All changes are appended to .hermes/memory/learning-log.jsonl.
 *
 * Usage:
 *   tsx scripts/agents/self-learning-agent.ts <storyId> [--retry <n>]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { chat } from './llm';
import { MEMORY_DIR } from './config';
import type {
  CoverageGateDecision,
  CoverageGap,
  LearningLogEntry,
} from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const GATE_RESULTS_DIR = path.join(process.cwd(), 'test-results');
const SOUL_FILE = path.join(process.cwd(), 'SOUL.md');
const TEST_GEN_PROMPT = path.join(
  process.cwd(),
  '.hermes',
  'prompts',
  'test-generation.md',
);
const LEARNING_LOG = path.join(MEMORY_DIR, 'learning-log.jsonl');
const SELF_HEAL_MARKER = '<!-- HERMES-LEARNED-RULES:';

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(
  storyId: string,
  retryCount: number = 0,
): Promise<void> {
  console.log(`[learn] Processing gaps for ${storyId} (retry ${retryCount})`);

  const gateFile = path.join(GATE_RESULTS_DIR, `coverage-gate-${storyId}.json`);
  if (!fs.existsSync(gateFile)) {
    throw new Error(`[learn] Gate decision file not found: ${gateFile}`);
  }

  const gate: CoverageGateDecision = JSON.parse(
    fs.readFileSync(gateFile, 'utf8'),
  );
  if (gate.gaps.length === 0) {
    console.log('[learn] No gaps to learn from.');
    return;
  }

  console.log(`[learn] Found ${gate.gaps.length} gap(s) to address`);

  for (const gap of gate.gaps) {
    await processGap(gap, storyId, retryCount);
  }

  console.log(`[learn] ✓ Learning complete for ${storyId}`);
}

// ---------------------------------------------------------------------------
// Process a single gap
// ---------------------------------------------------------------------------

async function processGap(
  gap: CoverageGap,
  storyId: string,
  retryCount: number,
): Promise<void> {
  console.log(`[learn] Addressing gap: [${gap.type}] ${gap.id}`);

  let updateFile: string;
  let updateSection: string;
  let newRule: string;

  // Ask the LLM for a precise, actionable rule to fix this gap type
  const rulePrompt = buildRulePrompt(gap);
  const ruleText = await chat([
    {
      role: 'system',
      content:
        'You are improving a QA test generation system. Output ONLY the new rule text — ' +
        'one or two sentences maximum. Be specific and actionable. No preamble.',
    },
    { role: 'user', content: rulePrompt },
  ]);

  newRule = ruleText.trim();

  switch (gap.type) {
    case 'ac':
      updateFile = TEST_GEN_PROMPT;
      updateSection = 'HERMES-LEARNED-RULES';
      break;

    case 'image':
      updateFile = SOUL_FILE;
      updateSection = 'image-behavior-rules';
      break;

    case 'figma':
      updateFile = TEST_GEN_PROMPT;
      updateSection = 'HERMES-LEARNED-RULES';
      break;

    case 'confluence':
      updateFile = TEST_GEN_PROMPT;
      updateSection = 'HERMES-LEARNED-RULES';
      break;
  }

  appendRule(updateFile, updateSection, newRule);
  appendLearningLog({
    gap,
    storyId,
    retryCount,
    file: updateFile,
    summary: newRule,
  });
}

// ---------------------------------------------------------------------------
// LLM rule prompt builders
// ---------------------------------------------------------------------------

function buildRulePrompt(gap: CoverageGap): string {
  switch (gap.type) {
    case 'ac':
      return (
        `A test case generation system missed covering acceptance criterion "${gap.id}".\n` +
        `Gap detail: ${gap.detail}\n\n` +
        `Write ONE specific rule to add to the test generation prompt to prevent this ` +
        `type of AC from being missed in the future. ` +
        `Examples of good rules: "Always generate a negative test case for ACs containing ` +
        `the word 'error' or 'invalid'." Focus on the pattern, not the specific story.`
      );

    case 'image':
      return (
        `A test case generation system failed to capture an expected behavior from an image.\n` +
        `Gap detail: ${gap.detail}\n\n` +
        `Write ONE specific rule for the agent's Constraints section to ensure UI behaviors ` +
        `visible in images are mapped to test assertions. ` +
        `Example: "When an image shows a validation error message, generate a test that ` +
        `verifies the exact error text is displayed."`
      );

    case 'figma':
      return (
        `A test case generation system failed to reference a Figma UI element in the tests.\n` +
        `Gap detail: ${gap.detail}\n\n` +
        `Write ONE specific rule to add to the test generation prompt to ensure Figma ` +
        `UI elements are referenced in test steps or assertions.`
      );

    case 'confluence':
      return (
        `A test case generation system failed to cite a Confluence page in the generated tests.\n` +
        `Gap detail: ${gap.detail}\n\n` +
        `Write ONE specific rule to add to the test generation prompt to ensure Confluence ` +
        `page content informs test context and is cited with a comment.`
      );
  }
}

// ---------------------------------------------------------------------------
// File update helpers
// ---------------------------------------------------------------------------

/** Append a learned rule to the designated section in the target file. */
function appendRule(filePath: string, sectionKey: string, rule: string): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`[learn] Target file not found, skipping: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const marker = `<!-- HERMES-LEARNED-RULES: ${sectionKey} -->`;
  const timestamp = new Date().toISOString();
  const newEntry = `- **[${timestamp}]** ${rule}`;

  if (content.includes(marker)) {
    // Append after the marker
    content = content.replace(marker, `${marker}\n${newEntry}`);
  } else if (content.includes(SELF_HEAL_MARKER)) {
    // Append after existing learned rules section
    const insertIdx = content.lastIndexOf(SELF_HEAL_MARKER);
    const lineEnd = content.indexOf('\n', insertIdx);
    content =
      content.slice(0, lineEnd + 1) +
      newEntry +
      '\n' +
      content.slice(lineEnd + 1);
  } else {
    // Append to end of file
    content =
      content.trimEnd() + `\n\n## Hermes Learned Rules\n\n${newEntry}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[learn] Updated ${path.relative(process.cwd(), filePath)}`);
}

/** Append an entry to the learning log JSONL. */
function appendLearningLog(params: {
  gap: CoverageGap;
  storyId: string;
  retryCount: number;
  file: string;
  summary: string;
}): void {
  const entry: LearningLogEntry = {
    ts: new Date().toISOString(),
    storyId: params.storyId,
    gapType: params.gap.type,
    gapId: params.gap.id,
    action: 'updated-prompt',
    file: path.relative(process.cwd(), params.file),
    summary: params.summary,
    retryCount: params.retryCount,
  };

  fs.mkdirSync(path.dirname(LEARNING_LOG), { recursive: true });
  fs.appendFileSync(LEARNING_LOG, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const storyArg = process.argv[2];
  const retryIdx = process.argv.indexOf('--retry');
  const retryCount =
    retryIdx !== -1 ? parseInt(process.argv[retryIdx + 1] ?? '0', 10) : 0;

  if (!storyArg) {
    console.error(
      '[learn] Usage: tsx scripts/agents/self-learning-agent.ts <storyId> [--retry n]',
    );
    process.exit(1);
  }

  run(storyArg, retryCount)
    .then(() => console.log('[learn] Done.'))
    .catch((err: Error) => {
      console.error(`[learn] Fatal: ${err.message}`);
      process.exit(1);
    });
}
