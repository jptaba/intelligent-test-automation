/**
 * Hermes Agent — Jira REST API v3 client.
 *
 * Handles: story fetching by assignee/status, ADF parsing, image/URL extraction,
 * attachment downloads. All HTTP calls use axios with Basic auth.
 *
 * Required env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 * Optional env: JIRA_PROJECT_KEY, JIRA_TESTING_STATUS_FIELD, JIRA_ASSIGNEE_FILTER
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getAuth() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!email || !token || !baseUrl) {
    throw new Error(
      '[jira] JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must be set in .env',
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
}

// ---------------------------------------------------------------------------
// ADF types (Atlassian Document Format)
// ---------------------------------------------------------------------------

interface ADFNode {
  type: string;
  text?: string;
  content?: ADFNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

// ---------------------------------------------------------------------------
// Story list item
// ---------------------------------------------------------------------------

export interface JiraStoryListItem {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  storyPoints?: number;
}

// ---------------------------------------------------------------------------
// Full story detail
// ---------------------------------------------------------------------------

export interface JiraStoryDetail {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  storyPoints?: number;
  descriptionADF: ADFNode | null;
  descriptionText: string;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    content: string;
  }>;
  confluenceLinks: string[];
  figmaLinks: string[];
  inlineImageUrls: string[];
}

// ---------------------------------------------------------------------------
// Fetch stories by assignee and "Testing" status
// ---------------------------------------------------------------------------

/**
 * Return all stories matching the assignee + testing status JQL query.
 * Paginates automatically.
 */
export async function fetchStoriesByAssigneeAndStatus(
  assignee?: string,
  testingStatusValue?: string,
): Promise<JiraStoryListItem[]> {
  const { baseUrl, headers } = getAuth();
  const projectKey = process.env.JIRA_PROJECT_KEY;
  const testingField =
    process.env.JIRA_TESTING_STATUS_FIELD ?? 'customfield_10234';
  const assigneeFilter = assignee ?? process.env.JIRA_ASSIGNEE_FILTER;
  const status = testingStatusValue ?? 'Ready for Automation';

  const jqlParts: string[] = [`issuetype = Story`];
  if (projectKey) jqlParts.push(`project = "${projectKey}"`);
  if (assigneeFilter) jqlParts.push(`assignee = "${assigneeFilter}"`);
  jqlParts.push(`"${testingField}" = "${status}"`);
  const jql = jqlParts.join(' AND ');

  const stories: JiraStoryListItem[] = [];
  let startAt = 0;
  const maxResults = 50;

  while (true) {
    const response = await axios.get(`${baseUrl}/rest/api/3/search`, {
      headers,
      params: {
        jql,
        startAt,
        maxResults,
        fields: `summary,status,assignee,story_points,${testingField}`,
      },
    });

    const issues: unknown[] = response.data.issues ?? [];
    for (const issue of issues as Array<{
      key: string;
      fields: Record<string, unknown>;
    }>) {
      stories.push({
        key: issue.key,
        summary: String((issue.fields.summary as string) ?? ''),
        status: String((issue.fields.status as { name?: string })?.name ?? ''),
        assignee: String(
          (issue.fields.assignee as { emailAddress?: string })?.emailAddress ??
            '',
        ),
        storyPoints:
          typeof issue.fields.story_points === 'number'
            ? issue.fields.story_points
            : undefined,
      });
    }

    if (issues.length < maxResults) break;
    startAt += maxResults;
  }

  return stories;
}

// ---------------------------------------------------------------------------
// Fetch full story detail
// ---------------------------------------------------------------------------

export async function fetchStoryDetail(
  storyId: string,
): Promise<JiraStoryDetail> {
  const { baseUrl, headers } = getAuth();
  const response = await axios.get(`${baseUrl}/rest/api/3/issue/${storyId}`, {
    headers,
    params: {
      fields: 'summary,status,assignee,description,attachment,story_points',
      expand: 'renderedFields',
    },
  });

  const fields = response.data.fields as Record<string, unknown>;
  const descriptionADF = (fields.description as ADFNode | null) ?? null;
  const descriptionText = descriptionADF ? extractText(descriptionADF) : '';

  const attachments: JiraStoryDetail['attachments'] = (
    (fields.attachment as Array<{
      id: string;
      filename: string;
      mimeType: string;
      content: string;
    }>) ?? []
  ).map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    content: a.content,
  }));

  return {
    key: storyId,
    summary: String(fields.summary ?? ''),
    status: String((fields.status as { name?: string })?.name ?? ''),
    assignee: String(
      (fields.assignee as { emailAddress?: string })?.emailAddress ?? '',
    ),
    storyPoints:
      typeof fields.story_points === 'number' ? fields.story_points : undefined,
    descriptionADF,
    descriptionText,
    attachments,
    confluenceLinks: descriptionADF
      ? extractConfluenceLinks(descriptionADF)
      : [],
    figmaLinks: descriptionADF ? extractFigmaLinks(descriptionADF) : [],
    inlineImageUrls: descriptionADF
      ? extractInlineImageUrls(descriptionADF)
      : [],
  };
}

// ---------------------------------------------------------------------------
// ADF parsing utilities
// ---------------------------------------------------------------------------

/** Recursively extract all plain text from an ADF document. */
export function extractText(node: ADFNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map(extractText).join(' ').trim();
}

/** Extract acceptance criteria from ADF — looks for a "Acceptance Criteria" heading
 *  followed by a bulletList or orderedList, or a table with criteria rows. */
export function extractAcceptanceCriteria(
  node: ADFNode,
): Array<{ id: string; text: string }> {
  const criteria: Array<{ id: string; text: string }> = [];
  let inACSection = false;

  function walk(n: ADFNode): void {
    if (n.type === 'heading') {
      const headingText = extractText(n).toLowerCase();
      inACSection =
        headingText.includes('acceptance') ||
        headingText.includes('criteria') ||
        headingText.includes('done');
      return;
    }

    if (inACSection && (n.type === 'bulletList' || n.type === 'orderedList')) {
      const items = n.content ?? [];
      items.forEach((item, idx) => {
        const text = extractText(item).trim();
        if (text) {
          criteria.push({ id: `AC${idx + 1}`, text });
        }
      });
      inACSection = false;
      return;
    }

    if (n.content) n.content.forEach(walk);
  }

  walk(node);

  // Fallback: if no AC section found, treat the entire description as AC1
  if (criteria.length === 0) {
    const fullText = extractText(node).trim();
    if (fullText) criteria.push({ id: 'AC1', text: fullText });
  }

  return criteria;
}

/** Extract all URLs from an ADF document that match Confluence base URL. */
export function extractConfluenceLinks(node: ADFNode): string[] {
  const confluenceBase = process.env.CONFLUENCE_BASE_URL ?? '';
  return extractUrls(node).filter((url) =>
    confluenceBase
      ? url.startsWith(confluenceBase)
      : url.includes('atlassian.net/wiki'),
  );
}

/** Extract all Figma URLs from an ADF document. */
export function extractFigmaLinks(node: ADFNode): string[] {
  return extractUrls(node).filter((url) => url.includes('figma.com'));
}

/** Extract inline image attachment URLs from ADF (mediaInline / mediaSingle nodes). */
export function extractInlineImageUrls(node: ADFNode): string[] {
  const urls: string[] = [];

  function walk(n: ADFNode): void {
    if (n.type === 'media' || n.type === 'mediaInline') {
      const src = (n.attrs?.url as string) ?? (n.attrs?.id as string);
      if (src) urls.push(src);
    }
    if (n.content) n.content.forEach(walk);
  }

  walk(node);
  return urls;
}

/** Extract all hyperlink URLs from ADF marks. */
function extractUrls(node: ADFNode): string[] {
  const urls: string[] = [];

  function walk(n: ADFNode): void {
    if (n.marks) {
      for (const mark of n.marks) {
        if (mark.type === 'link' && mark.attrs?.href) {
          urls.push(mark.attrs.href as string);
        }
      }
    }
    if (n.attrs?.href) urls.push(n.attrs.href as string);
    if (n.content) n.content.forEach(walk);
  }

  walk(node);
  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// Attachment download
// ---------------------------------------------------------------------------

/**
 * Download a Jira attachment by its content URL, returning a Buffer.
 * The content URL is the one returned in the attachment.content field.
 */
export async function downloadAttachment(contentUrl: string): Promise<Buffer> {
  const { headers } = getAuth();
  const response = await axios.get(contentUrl, {
    headers,
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data as ArrayBuffer);
}
