/**
 * Hermes Agent — Coverage Gate Agent (Phase 4).
 *
 * Computes a weighted coverage score between the enriched story and
 * generated test cases. Writes a gate decision JSON and returns PASS/FAIL.
 *
 * Algorithm (weights from thresholds.json):
 *   AC coverage          (40) — every AC ID appears in TC frontmatter acCoverage[]
 *   Image behavior       (25) — every expectedBehavior is referenced in TC text
 *   Figma UI elements    (20) — every uiElement is referenced in TC text
 *   Confluence detail    (15) — every confluence page title appears in TC text
 *
 * Usage:
 *   tsx scripts/agents/coverage-gate-agent.ts <storyId>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { loadConfig } from './config';
import type {
  EnrichedStory,
  CoverageGap,
  CoverageGateDecision,
  TCFrontmatter,
} from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const STORIES_DIR = path.join(process.cwd(), 'inputs', 'stories');
const TC_DIR = path.join(process.cwd(), 'inputs', 'testcases');
const GATE_RESULTS_DIR = path.join(process.cwd(), 'test-results');

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(storyId: string): Promise<CoverageGateDecision> {
  console.log(`[gate] Evaluating coverage for ${storyId}`);
  const config = loadConfig();
  const weights = config.coverageGate.weights;
  const threshold = config.coverageGate.minimumCoveragePercent;

  // 1. Load enriched story
  const enrichedPath = path.join(STORIES_DIR, `${storyId}-enriched.json`);
  if (!fs.existsSync(enrichedPath)) {
    throw new Error(`[gate] Enriched story not found: ${enrichedPath}`);
  }
  const story: EnrichedStory = JSON.parse(
    fs.readFileSync(enrichedPath, 'utf8'),
  );

  // 2. Find and load the TC file
  const tcFiles = fs.existsSync(TC_DIR)
    ? fs
        .readdirSync(TC_DIR)
        .filter((f) => f.includes(storyId) && f.endsWith('.md'))
    : [];

  if (tcFiles.length === 0) {
    throw new Error(
      `[gate] No TC file found for ${storyId} in ${TC_DIR}\n` +
        `       Run: npm run hermes:generate -- ${storyId}`,
    );
  }

  const tcPath = path.join(TC_DIR, tcFiles[0]);
  const tcContent = fs.readFileSync(tcPath, 'utf8');
  const frontmatter = parseFrontmatter(tcContent, storyId);
  const tcText = tcContent.toLowerCase();

  // 3. Evaluate each dimension
  const gaps: CoverageGap[] = [];

  // ── Dimension 1: AC coverage ──────────────────────────────────────────────
  let acCovered = 0;
  for (const ac of story.acceptanceCriteria) {
    if (frontmatter.acCoverage.includes(ac.id)) {
      acCovered++;
    } else {
      gaps.push({
        type: 'ac',
        id: ac.id,
        detail:
          `AC "${ac.id}" is not listed in the TC frontmatter acCoverage[]. ` +
          `AC text: "${ac.text.substring(0, 100)}"`,
      });
    }
  }

  const acScore =
    story.acceptanceCriteria.length > 0
      ? (acCovered / story.acceptanceCriteria.length) * weights.acCoverage
      : weights.acCoverage; // no ACs → full score

  // ── Dimension 2: Image behavior capture ──────────────────────────────────
  let imageBehaviorsCovered = 0;
  let imageBehaviorsTotal = 0;

  for (const img of story.inlineImages) {
    for (const behavior of img.llmDescription.expectedBehaviors) {
      imageBehaviorsTotal++;
      const keywords = behavior
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const found = keywords.some((kw) => tcText.includes(kw));
      if (found) {
        imageBehaviorsCovered++;
      } else {
        const imgId = path.basename(img.localPath, path.extname(img.localPath));
        gaps.push({
          type: 'image',
          id: imgId,
          detail: `Expected behavior not captured: "${behavior}"`,
        });
      }
    }
  }

  const imageScore =
    imageBehaviorsTotal > 0
      ? (imageBehaviorsCovered / imageBehaviorsTotal) *
        weights.imageBehaviorCapture
      : weights.imageBehaviorCapture;

  // ── Dimension 3: Figma UI element refs ───────────────────────────────────
  let figmaElementsCovered = 0;
  let figmaElementsTotal = 0;

  for (const figma of story.figmaScreenshots) {
    for (const element of figma.llmDescription.uiElements) {
      figmaElementsTotal++;
      const keywords = element
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const found = keywords.some((kw) => tcText.includes(kw));
      if (found) {
        figmaElementsCovered++;
      } else {
        const frameId = `figma-frame-${figma.nodeName.replace(/\s+/g, '-')}`;
        gaps.push({
          type: 'figma',
          id: frameId,
          detail: `Figma UI element not referenced in tests: "${element}" from frame "${figma.nodeName}"`,
        });
      }
    }
  }

  const figmaScore =
    figmaElementsTotal > 0
      ? (figmaElementsCovered / figmaElementsTotal) * weights.figmaUIElementRefs
      : weights.figmaUIElementRefs;

  // ── Dimension 4: Confluence detail refs ──────────────────────────────────
  let confluenceCovered = 0;
  const confluenceTotal = story.confluencePages.length;

  for (const page of story.confluencePages) {
    const titleWords = page.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const found =
      frontmatter.confluenceCoverage.includes(page.pageId) ||
      titleWords.some((w) => tcText.includes(w));
    if (found) {
      confluenceCovered++;
    } else {
      gaps.push({
        type: 'confluence',
        id: page.pageId,
        detail: `Confluence page "${page.title}" (ID: ${page.pageId}) is not cited in any test case`,
      });
    }
  }

  const confluenceScore =
    confluenceTotal > 0
      ? (confluenceCovered / confluenceTotal) * weights.confluenceDetailRefs
      : weights.confluenceDetailRefs;

  // ── Total score ───────────────────────────────────────────────────────────
  const totalWeight =
    weights.acCoverage +
    weights.imageBehaviorCapture +
    weights.figmaUIElementRefs +
    weights.confluenceDetailRefs;

  const rawScore = acScore + imageScore + figmaScore + confluenceScore;
  const score = Math.round((rawScore / totalWeight) * 100 * 10) / 10;
  const decision: 'PASS' | 'FAIL' = score >= threshold ? 'PASS' : 'FAIL';

  const result: CoverageGateDecision = {
    storyId,
    score,
    threshold,
    decision,
    gaps,
    generationRetry: frontmatter.generationRetry,
    evaluatedAt: new Date().toISOString(),
  };

  // 4. Write gate decision file
  fs.mkdirSync(GATE_RESULTS_DIR, { recursive: true });
  const gateFile = path.join(GATE_RESULTS_DIR, `coverage-gate-${storyId}.json`);
  fs.writeFileSync(gateFile, JSON.stringify(result, null, 2), 'utf8');

  const icon = decision === 'PASS' ? '✓' : '✗';
  console.log(
    `[gate] ${icon} ${storyId}: score=${score}% (threshold=${threshold}%) → ${decision}`,
  );

  if (gaps.length > 0) {
    console.log(`[gate]   ${gaps.length} gap(s):`);
    for (const gap of gaps.slice(0, 5)) {
      console.log(
        `[gate]     [${gap.type}] ${gap.id}: ${gap.detail.substring(0, 80)}`,
      );
    }
    if (gaps.length > 5)
      console.log(`[gate]     ... and ${gaps.length - 5} more`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser (minimal — no js-yaml dependency needed here)
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string, storyId: string): TCFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {
      storyId,
      generatedAt: new Date().toISOString(),
      generationRetry: 0,
      acCoverage: [],
      imageCoverage: [],
      confluenceCoverage: [],
    };
  }

  const yaml = match[1];

  function parseList(key: string): string[] {
    const lineMatch = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!lineMatch) return [];
    const val = lineMatch[1].trim();
    // Handle inline array: [AC1, AC2] or ["AC1", "AC2"]
    if (val.startsWith('[')) {
      return val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
    return [];
  }

  function parseStr(key: string): string {
    const lineMatch = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return lineMatch ? lineMatch[1].trim() : '';
  }

  return {
    storyId: parseStr('storyId') || storyId,
    generatedAt: parseStr('generatedAt') || new Date().toISOString(),
    generationRetry: parseInt(parseStr('generationRetry') || '0', 10),
    acCoverage: parseList('acCoverage'),
    imageCoverage: parseList('imageCoverage'),
    confluenceCoverage: parseList('confluenceCoverage'),
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const storyArg = process.argv[2];
  if (!storyArg) {
    console.error(
      '[gate] Usage: tsx scripts/agents/coverage-gate-agent.ts <storyId>',
    );
    process.exit(1);
  }

  run(storyArg)
    .then((result) => {
      console.log(`[gate] Result: ${JSON.stringify(result, null, 2)}`);
      if (result.decision === 'FAIL') process.exit(1);
    })
    .catch((err: Error) => {
      console.error(`[gate] Fatal: ${err.message}`);
      process.exit(1);
    });
}
