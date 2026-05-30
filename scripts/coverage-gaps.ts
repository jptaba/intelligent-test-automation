/**
 * coverage-gaps.ts
 *
 * Cross-references story files in inputs/stories/ against test spec files.
 * Flags stories that have no corresponding spec coverage.
 *
 * Convention: add a comment `// covers: STORY-001` to any spec file to
 * explicitly link it to a story. The script also performs a fuzzy search
 * for story IDs anywhere in spec file content.
 *
 * Usage:
 *   tsx scripts/coverage-gaps.ts
 *
 * Exit codes:
 *   0 — all stories have coverage
 *   1 — one or more stories have no coverage
 */
import * as fs from 'fs';
import * as path from 'path';

interface StoryInfo {
  id: string; // e.g. STORY-001
  file: string; // relative path
  title: string; // first H1 from the file
  covered: boolean;
  coveredBy: string[];
}

const ROOT = process.cwd();
const STORIES_DIR = path.join(ROOT, 'inputs', 'stories');
const TESTS_DIR = path.join(ROOT, 'tests');

// ---------------------------------------------------------------------------
// Load all spec files into a searchable index
// ---------------------------------------------------------------------------
function findSpecFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...findSpecFiles(full));
    } else if (e.name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

const specFiles = findSpecFiles(TESTS_DIR);
const specContents: Map<string, string> = new Map();
for (const f of specFiles) {
  specContents.set(f, fs.readFileSync(f, 'utf8'));
}

// ---------------------------------------------------------------------------
// Load all stories
// ---------------------------------------------------------------------------
if (!fs.existsSync(STORIES_DIR)) {
  console.log(
    '[coverage] No stories directory found at inputs/stories/ — nothing to check.',
  );
  process.exit(0);
}

const storyFiles = fs
  .readdirSync(STORIES_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

if (storyFiles.length === 0) {
  console.log('[coverage] No story files found in inputs/stories/');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build story info and check coverage
// ---------------------------------------------------------------------------
const stories: StoryInfo[] = [];

for (const filename of storyFiles) {
  const storyId = filename.replace('.md', '').toUpperCase(); // e.g. STORY-001
  const filePath = path.join(STORIES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract first H1 as story title
  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].trim() : filename;

  // Check if any spec file references this story ID
  const coveredBy: string[] = [];
  for (const [specPath, specContent] of specContents.entries()) {
    if (specContent.includes(storyId)) {
      coveredBy.push(path.relative(ROOT, specPath).replace(/\\/g, '/'));
    }
  }

  stories.push({
    id: storyId,
    file: path.join('inputs', 'stories', filename).replace(/\\/g, '/'),
    title,
    covered: coveredBy.length > 0,
    coveredBy,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const covered = stories.filter((s) => s.covered);
const gaps = stories.filter((s) => !s.covered);

console.log('\n[coverage] Story Coverage Gaps');
console.log('─'.repeat(70));
console.log(
  `  Stories:  ${stories.length} total · ${covered.length} covered · ${gaps.length} uncovered`,
);
console.log(`  Specs:    ${specFiles.length} spec file(s) scanned`);
console.log('─'.repeat(70));

if (covered.length > 0) {
  console.log('\n  ✓ Covered stories:');
  for (const s of covered) {
    console.log(`    [${s.id}] ${s.title}`);
    for (const spec of s.coveredBy) console.log(`            → ${spec}`);
  }
}

if (gaps.length > 0) {
  console.log('\n  ✗ Stories with NO test coverage:');
  for (const s of gaps) {
    console.log(`    [${s.id}] ${s.title}`);
    console.log(`            ${s.file}`);
    console.log(
      `            Add "// covers: ${s.id}" to the relevant spec file.`,
    );
  }
  console.log('');
}

// Save report
const outFile = path.join(ROOT, 'test-results', 'coverage-gaps.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(stories, null, 2));
console.log(`[coverage] Saved report → test-results/coverage-gaps.json\n`);

process.exit(gaps.length > 0 ? 1 : 0);
