/**
 * Hermes Agent — Test Case Generation Agent (Phase 3).
 *
 * Loads:
 *   1. SOUL.md          — agent identity + quality constraints
 *   2. CODEBASE.md      — living codebase reference
 *   3. Enriched story   — story with ACs, images described, Figma, Confluence
 *   4. Prompt template  — .hermes/prompts/test-generation.md
 *
 * Sends to LLM → outputs TC markdown with YAML frontmatter →
 * writes to inputs/testcases/TC-<DOMAIN>-<STORY-ID>.md
 *
 * Usage:
 *   tsx scripts/agents/test-case-generation-agent.ts <storyId> [--retry <n>]
 *   tsx scripts/agents/test-case-generation-agent.ts PROJ-123
 *   tsx scripts/agents/test-case-generation-agent.ts PROJ-123 --retry 1
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { chat } from './llm';
import { loadPrompt } from './config';
import type { EnrichedStory, TCFrontmatter } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const STORIES_DIR = path.join(process.cwd(), 'inputs', 'stories');
const TC_DIR = path.join(process.cwd(), 'inputs', 'testcases');
const SOUL_FILE = path.join(process.cwd(), 'SOUL.md');
const CODEBASE_FILE = path.join(process.cwd(), 'CODEBASE.md');

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(
  storyId: string,
  retryCount: number = 0,
  previousGaps: string = '',
): Promise<{ tcPath: string; frontmatter: TCFrontmatter }> {
  console.log(
    `[generate] Generating test cases for ${storyId} (retry ${retryCount})`,
  );

  // 1. Load context
  const enrichedPath = path.join(STORIES_DIR, `${storyId}-enriched.json`);
  if (!fs.existsSync(enrichedPath)) {
    throw new Error(
      `[generate] Enriched story not found: ${enrichedPath}\n` +
        `           Run: npm run hermes:ingest -- ${storyId}`,
    );
  }

  const story: EnrichedStory = JSON.parse(
    fs.readFileSync(enrichedPath, 'utf8'),
  );
  const soulMd = fs.existsSync(SOUL_FILE)
    ? fs.readFileSync(SOUL_FILE, 'utf8')
    : '(SOUL.md not found)';
  const codebaseMd = fs.existsSync(CODEBASE_FILE)
    ? fs.readFileSync(CODEBASE_FILE, 'utf8')
    : '(CODEBASE.md not found — run npm run hermes:codebase first)';

  // 2. Build prompt
  const promptTemplate = loadPrompt('test-generation');
  const gapNote = previousGaps
    ? `\n\n## GAPS FROM PREVIOUS ATTEMPT (fix these)\n\n${previousGaps}`
    : '';

  const systemPrompt =
    `You are Hermes Agent — a QA automation engineer. Follow the rules in the prompt exactly.\n` +
    `Current retry attempt: ${retryCount}. Generation timestamp: ${new Date().toISOString()}.`;

  const userPrompt = `${promptTemplate}${gapNote}

---

## SOUL (Agent Identity & Constraints)

${soulMd}

---

## CODEBASE REFERENCE

${codebaseMd}

---

## ENRICHED STORY

\`\`\`json
${JSON.stringify(story, null, 2)}
\`\`\`

---

Generate the complete test case document now. Include the YAML frontmatter, all TC blocks,
and the Summary table. Set generationRetry to ${retryCount}.`;

  // 3. Call LLM
  const rawOutput = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 4. Parse frontmatter from the output
  const frontmatter = parseFrontmatter(rawOutput, storyId, retryCount);

  // 5. Determine domain and write TC file
  const domain = inferDomain(story);
  const tcFileName = `TC-${domain.toUpperCase()}-${storyId}.md`;
  const tcPath = path.join(TC_DIR, tcFileName);

  fs.mkdirSync(TC_DIR, { recursive: true });
  fs.writeFileSync(tcPath, rawOutput, 'utf8');

  console.log(`[generate] ✓ Wrote ${tcPath}`);
  console.log(
    `[generate]   AC coverage: ${frontmatter.acCoverage.join(', ')} ` +
      `(${frontmatter.acCoverage.length}/${story.acceptanceCriteria.length})`,
  );

  return { tcPath, frontmatter };
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

function parseFrontmatter(
  content: string,
  storyId: string,
  retryCount: number,
): TCFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    console.warn(
      '[generate] No YAML frontmatter found in LLM output — using defaults',
    );
    return {
      storyId,
      generatedAt: new Date().toISOString(),
      generationRetry: retryCount,
      acCoverage: [],
      imageCoverage: [],
      confluenceCoverage: [],
    };
  }

  const yaml = frontmatterMatch[1];

  function parseYamlList(key: string): string[] {
    const match = yaml.match(new RegExp(`${key}:\\s*\\[(.*?)\\]`, 's'));
    if (!match) return [];
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  function parseYamlString(key: string): string {
    const match = yaml.match(new RegExp(`${key}:\\s*(.+)`));
    return match ? match[1].trim() : '';
  }

  return {
    storyId: parseYamlString('storyId') || storyId,
    generatedAt: parseYamlString('generatedAt') || new Date().toISOString(),
    generationRetry: parseInt(parseYamlString('generationRetry') || '0', 10),
    acCoverage: parseYamlList('acCoverage'),
    imageCoverage: parseYamlList('imageCoverage'),
    confluenceCoverage: parseYamlList('confluenceCoverage'),
  };
}

// ---------------------------------------------------------------------------
// Domain inference
// ---------------------------------------------------------------------------

function inferDomain(story: EnrichedStory): string {
  const text = `${story.title} ${story.description}`.toLowerCase();
  if (text.includes('login') || text.includes('auth') || text.includes('sign'))
    return 'login';
  if (
    text.includes('checkout') ||
    text.includes('cart') ||
    text.includes('order') ||
    text.includes('payment')
  )
    return 'cart';
  if (
    text.includes('product') ||
    text.includes('inventory') ||
    text.includes('catalog') ||
    text.includes('sort')
  )
    return 'inventory';
  return 'general';
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
      '[generate] Usage: tsx scripts/agents/test-case-generation-agent.ts <storyId> [--retry n]',
    );
    process.exit(1);
  }

  run(storyArg, retryCount)
    .then(({ tcPath, frontmatter }) => {
      console.log(`[generate] Done. TC file: ${tcPath}`);
      console.log(
        `[generate] Coverage: ${JSON.stringify(frontmatter.acCoverage)}`,
      );
    })
    .catch((err: Error) => {
      console.error(`[generate] Fatal: ${err.message}`);
      process.exit(1);
    });
}
