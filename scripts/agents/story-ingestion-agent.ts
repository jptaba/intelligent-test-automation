/**
 * Hermes Agent — Story Ingestion Agent (Phase 2).
 *
 * Orchestrates: Jira fetch → Confluence enrichment → Figma screenshots →
 * image descriptions → writes EnrichedStory JSON + human-readable MD.
 *
 * Usage:
 *   tsx scripts/agents/story-ingestion-agent.ts [storyId]
 *   tsx scripts/agents/story-ingestion-agent.ts PROJ-123
 *
 * If no storyId is given, fetches all stories matching JIRA_ASSIGNEE_FILTER
 * with Testing Status = "Ready for Automation".
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  fetchStoriesByAssigneeAndStatus,
  fetchStoryDetail,
  extractAcceptanceCriteria,
  downloadAttachment,
} from '../integrations/jira';
import {
  fetchPageByUrl,
  downloadConfluenceImage,
} from '../integrations/confluence';
import {
  parseFigmaUrl,
  fetchFrameImages,
  downloadFigmaImage,
  fetchNodeName,
} from '../integrations/figma';
import { describeImage, saveImage } from '../integrations/image-processor';
import type { EnrichedStory, ImageDescription } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const ASSETS_BASE = path.join(process.cwd(), 'inputs', 'assets');
const STORIES_DIR = path.join(process.cwd(), 'inputs', 'stories');

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(storyId?: string): Promise<EnrichedStory[]> {
  const results: EnrichedStory[] = [];

  if (storyId) {
    const story = await ingestStory(storyId);
    results.push(story);
  } else {
    const assignee = process.env.JIRA_ASSIGNEE_FILTER;
    console.log(`[ingest] Fetching stories for assignee: ${assignee ?? 'any'}`);
    const list = await fetchStoriesByAssigneeAndStatus(assignee);
    console.log(`[ingest] Found ${list.length} stories to process`);

    for (const item of list) {
      try {
        const story = await ingestStory(item.key);
        results.push(story);
      } catch (err) {
        console.error(
          `[ingest] Failed to ingest ${item.key}: ${(err as Error).message}`,
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Ingest a single story
// ---------------------------------------------------------------------------

async function ingestStory(storyId: string): Promise<EnrichedStory> {
  console.log(`[ingest] Processing story: ${storyId}`);
  const detail = await fetchStoryDetail(storyId);

  const assetsDir = path.join(ASSETS_BASE, storyId);
  fs.mkdirSync(assetsDir, { recursive: true });

  // 1. Acceptance criteria
  const acceptanceCriteria = detail.descriptionADF
    ? extractAcceptanceCriteria(detail.descriptionADF)
    : [{ id: 'AC1', text: detail.descriptionText }];

  // 2. Inline images from Jira attachments
  const inlineImages: EnrichedStory['inlineImages'] = [];
  const jiraAuth = buildJiraAuthHeaders();

  for (const attachment of detail.attachments) {
    if (!isImageMimeType(attachment.mimeType)) continue;

    const localPath = path.join(
      assetsDir,
      `attachment-${attachment.id}-${attachment.filename}`,
    );
    try {
      const buffer = await downloadAttachment(attachment.content);
      saveImage(buffer, localPath);
      const llmDescription = await describeImage(
        buffer,
        `Jira attachment: ${attachment.filename} from story ${storyId}`,
      );
      inlineImages.push({
        sourceUrl: attachment.content,
        localPath,
        llmDescription,
      });
    } catch (err) {
      console.warn(
        `[ingest] Skipping attachment ${attachment.filename}: ${(err as Error).message}`,
      );
    }
  }

  // Also process inline image URLs from ADF (media nodes)
  for (let i = 0; i < detail.inlineImageUrls.length; i++) {
    const imageUrl = detail.inlineImageUrls[i];
    const localPath = path.join(
      assetsDir,
      `inline-img-${String(i + 1).padStart(3, '0')}.png`,
    );
    try {
      const buffer = await downloadAttachment(imageUrl);
      saveImage(buffer, localPath);
      const llmDescription = await describeImage(
        buffer,
        `Inline image ${i + 1} from Jira story ${storyId}`,
      );
      inlineImages.push({ sourceUrl: imageUrl, localPath, llmDescription });
    } catch {
      // Try as a plain URL without auth
      try {
        const llmDescription = await describeImage(
          imageUrl,
          `Inline image from ${storyId}`,
        );
        inlineImages.push({ sourceUrl: imageUrl, localPath, llmDescription });
      } catch (err2) {
        console.warn(
          `[ingest] Skipping inline image ${i + 1}: ${(err2 as Error).message}`,
        );
      }
    }
  }

  // 3. Confluence pages
  const confluencePages: EnrichedStory['confluencePages'] = [];
  for (const confUrl of detail.confluenceLinks) {
    try {
      console.log(`[ingest] Fetching Confluence page: ${confUrl}`);
      const page = await fetchPageByUrl(confUrl);

      const pageImages: Array<{
        localPath: string;
        llmDescription: ImageDescription;
      }> = [];
      for (let i = 0; i < page.imageUrls.length; i++) {
        const imgRef = page.imageUrls[i];
        const localPath = path.join(
          assetsDir,
          `conf-${page.pageId}-img-${String(i + 1).padStart(3, '0')}.png`,
        );
        const buffer = await downloadConfluenceImage(imgRef.src);
        if (buffer) {
          saveImage(buffer, localPath);
          const llmDescription = await describeImage(
            buffer,
            `Confluence page "${page.title}" image: ${imgRef.altText}`,
          );
          pageImages.push({ localPath, llmDescription });
        }
      }

      confluencePages.push({
        url: confUrl,
        title: page.title,
        pageId: page.pageId,
        sections: page.sections,
        images: pageImages,
      });
    } catch (err) {
      console.warn(
        `[ingest] Skipping Confluence page ${confUrl}: ${(err as Error).message}`,
      );
    }
  }

  // 4. Figma screenshots
  const figmaScreenshots: EnrichedStory['figmaScreenshots'] = [];
  const figmaByFile = groupFigmaByFile(detail.figmaLinks);

  for (const [fileKey, frames] of Object.entries(figmaByFile)) {
    try {
      const nodeIds = frames.map((f) => f.nodeIdApi).filter(Boolean);
      const imageUrls = await fetchFrameImages(fileKey, nodeIds);

      for (const frame of frames) {
        const downloadUrl = imageUrls[frame.nodeIdApi];
        if (!downloadUrl) continue;

        const nodeName = await fetchNodeName(fileKey, frame.nodeIdApi);
        const safeName = nodeName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
        const localPath = path.join(assetsDir, `figma-${safeName}.png`);

        const buffer = await downloadFigmaImage(downloadUrl);
        saveImage(buffer, localPath);
        const llmDescription = await describeImage(
          buffer,
          `Figma frame "${nodeName}" from story ${storyId}`,
        );

        figmaScreenshots.push({
          figmaUrl: frame.sourceUrl,
          fileKey,
          nodeName,
          nodeId: frame.nodeId,
          localPath,
          llmDescription,
        });
      }
    } catch (err) {
      console.warn(
        `[ingest] Skipping Figma file ${fileKey}: ${(err as Error).message}`,
      );
    }
  }

  // 5. Build enriched story
  const enriched: EnrichedStory = {
    storyId,
    title: detail.summary,
    description: detail.descriptionText,
    acceptanceCriteria,
    inlineImages,
    confluencePages,
    figmaScreenshots,
    metadata: {
      jiraKey: detail.key,
      status: detail.status,
      assignee: detail.assignee,
      fetchedAt: new Date().toISOString(),
      storyPoints: detail.storyPoints,
    },
  };

  // 6. Persist outputs
  writeEnrichedJSON(enriched);
  writeHumanReadableMD(enriched);

  console.log(
    `[ingest] ✓ ${storyId} — ${acceptanceCriteria.length} ACs, ` +
      `${inlineImages.length} images, ${confluencePages.length} Confluence pages, ` +
      `${figmaScreenshots.length} Figma frames`,
  );

  return enriched;
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function writeEnrichedJSON(story: EnrichedStory): void {
  const filePath = path.join(STORIES_DIR, `${story.storyId}-enriched.json`);
  fs.writeFileSync(filePath, JSON.stringify(story, null, 2), 'utf8');
  console.log(`[ingest] Wrote ${filePath}`);
}

function writeHumanReadableMD(story: EnrichedStory): void {
  const lines: string[] = [
    `# ${story.title}`,
    '',
    `**Story ID:** \`${story.storyId}\`  `,
    `**Status:** ${story.metadata.status}  `,
    `**Assignee:** ${story.metadata.assignee}  `,
    `**Fetched:** ${story.metadata.fetchedAt}`,
    '',
    '## Description',
    '',
    story.description,
    '',
    '## Acceptance Criteria',
    '',
  ];

  for (const ac of story.acceptanceCriteria) {
    lines.push(`- **${ac.id}:** ${ac.text}`);
  }

  if (story.inlineImages.length > 0) {
    lines.push('', '## Inline Images', '');
    for (const img of story.inlineImages) {
      lines.push(`### ${path.basename(img.localPath)}`);
      lines.push(`**Source:** ${img.sourceUrl}  `);
      lines.push(`**Description:** ${img.llmDescription.rawDescription}  `);
      if (img.llmDescription.uiElements.length > 0) {
        lines.push(
          `**UI Elements:** ${img.llmDescription.uiElements.join(', ')}  `,
        );
      }
      if (img.llmDescription.expectedBehaviors.length > 0) {
        lines.push(`**Expected Behaviors:**`);
        for (const b of img.llmDescription.expectedBehaviors) {
          lines.push(`- ${b}`);
        }
      }
      lines.push('');
    }
  }

  if (story.confluencePages.length > 0) {
    lines.push('## Confluence Pages', '');
    for (const page of story.confluencePages) {
      lines.push(`### ${page.title}`);
      lines.push(`**URL:** ${page.url}  `);
      for (const [section, text] of Object.entries(page.sections)) {
        lines.push(
          `**${section}:** ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`,
        );
      }
      lines.push('');
    }
  }

  if (story.figmaScreenshots.length > 0) {
    lines.push('## Figma Frames', '');
    for (const fig of story.figmaScreenshots) {
      lines.push(`### ${fig.nodeName}`);
      lines.push(`**URL:** ${fig.figmaUrl}  `);
      lines.push(`**Description:** ${fig.llmDescription.rawDescription}  `);
      if (fig.llmDescription.uiElements.length > 0) {
        lines.push(
          `**UI Elements:** ${fig.llmDescription.uiElements.join(', ')}  `,
        );
      }
      lines.push('');
    }
  }

  // Note: stories generated by this agent overwrite the manual MD
  const filePath = path.join(STORIES_DIR, `${story.storyId}.md`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`[ingest] Wrote ${filePath}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isImageMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') || mimeType === 'application/octet-stream'
  );
}

function buildJiraAuthHeaders(): Record<string, string> {
  const email = process.env.JIRA_EMAIL ?? '';
  const token = process.env.JIRA_API_TOKEN ?? '';
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
  };
}

function groupFigmaByFile(
  urls: string[],
): Record<
  string,
  Array<{ nodeIdApi: string; nodeId: string; sourceUrl: string }>
> {
  const groups: Record<
    string,
    Array<{ nodeIdApi: string; nodeId: string; sourceUrl: string }>
  > = {};

  for (const url of urls) {
    const parsed = parseFigmaUrl(url);
    if (!parsed) continue;
    if (!groups[parsed.fileKey]) groups[parsed.fileKey] = [];
    groups[parsed.fileKey].push({
      nodeIdApi: parsed.nodeIdApi,
      nodeId: parsed.nodeId,
      sourceUrl: url,
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  const storyArg = process.argv[2];
  run(storyArg)
    .then((stories) => {
      console.log(`[ingest] Done. Processed ${stories.length} story(ies).`);
    })
    .catch((err: Error) => {
      console.error(`[ingest] Fatal: ${err.message}`);
      process.exit(1);
    });
}
