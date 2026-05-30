/**
 * Hermes Agent — Confluence REST API v2 client.
 *
 * Handles: fetching pages by ID or URL, extracting sections and images
 * from the page storage format (HTML-like XML).
 *
 * Required env: CONFLUENCE_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
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
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  if (!email || !token || !baseUrl) {
    throw new Error(
      '[confluence] CONFLUENCE_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must be set in .env',
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
    },
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfluencePage {
  pageId: string;
  title: string;
  url: string;
  body: string; // storage format HTML
  sections: Record<string, string>;
  imageUrls: Array<{ src: string; altText: string }>;
}

// ---------------------------------------------------------------------------
// Fetch by page ID
// ---------------------------------------------------------------------------

export async function fetchPageById(pageId: string): Promise<ConfluencePage> {
  const { baseUrl, headers } = getAuth();
  const response = await axios.get(`${baseUrl}/wiki/api/v2/pages/${pageId}`, {
    headers,
    params: { 'body-format': 'storage' },
  });

  const data = response.data as {
    id: string;
    title: string;
    _links: { webui: string };
    body: { storage: { value: string } };
  };

  const body = data.body?.storage?.value ?? '';
  return {
    pageId: data.id,
    title: data.title,
    url: `${baseUrl}/wiki${data._links?.webui ?? ''}`,
    body,
    sections: extractPageSections(body),
    imageUrls: extractPageImages(body),
  };
}

// ---------------------------------------------------------------------------
// Fetch by URL (resolves the page ID from a Confluence share URL)
// ---------------------------------------------------------------------------

/**
 * Accepts:
 *   - https://yourorg.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title
 *   - https://yourorg.atlassian.net/wiki/x/shortlink
 */
export async function fetchPageByUrl(url: string): Promise<ConfluencePage> {
  // Try to extract numeric page ID from the URL path
  const pageIdMatch = url.match(/\/pages\/(\d+)/);
  if (pageIdMatch) {
    return fetchPageById(pageIdMatch[1]);
  }

  // Fall back to the Confluence content by URL API
  const { baseUrl, headers } = getAuth();
  const response = await axios.get(`${baseUrl}/wiki/rest/api/content`, {
    headers,
    params: { type: 'page', expand: 'body.storage', limit: 1 },
  });

  const items: Array<{ id: string }> = response.data?.results ?? [];
  if (items.length === 0) {
    throw new Error(`[confluence] Could not resolve page for URL: ${url}`);
  }
  return fetchPageById(items[0].id);
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

/**
 * Parse the Confluence storage format (simplified XML/HTML) and split into
 * sections by <h1>/<h2>/<h3> headings.
 * Returns Record<sectionTitle, plainText>.
 */
export function extractPageSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = 'Introduction';
  let currentText = '';

  // Strip tags to get text content (simplified — no full XML parser needed)
  const cleanText = (html: string): string =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Split by heading tags
  const headingPattern = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  const parts = body.split(headingPattern);

  // parts alternates: [beforeFirst, heading1text, afterHeading1, heading2text, ...]
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // This is body content between headings
      const text = cleanText(parts[i]);
      if (text) currentText += (currentText ? ' ' : '') + text;
    } else {
      // This is a heading text — save previous section, start new one
      if (currentText.trim()) {
        sections[currentSection] = currentText.trim();
      }
      currentSection = cleanText(parts[i]) || `Section ${Math.ceil(i / 2)}`;
      currentText = '';
    }
  }

  // Save the last section
  if (currentText.trim()) {
    sections[currentSection] = currentText.trim();
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

/** Extract all image src URLs and alt text from Confluence storage format. */
export function extractPageImages(
  body: string,
): Array<{ src: string; altText: string }> {
  const images: Array<{ src: string; altText: string }> = [];

  // Match <ac:image> tags (Confluence-specific) and standard <img> tags
  const acImagePattern = /<ri:attachment\s+ri:filename="([^"]+)"/gi;
  const imgPattern = /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;

  let match: RegExpExecArray | null;

  // Standard <img> tags
  while ((match = imgPattern.exec(body)) !== null) {
    images.push({ src: match[1], altText: match[2] ?? '' });
  }

  // Confluence attachment references (inline images)
  while ((match = acImagePattern.exec(body)) !== null) {
    images.push({ src: match[1], altText: match[1] });
  }

  return images;
}

// ---------------------------------------------------------------------------
// Image download helper
// ---------------------------------------------------------------------------

export async function downloadConfluenceImage(
  src: string,
): Promise<Buffer | null> {
  const { baseUrl, headers } = getAuth();
  const url = src.startsWith('http') ? src : `${baseUrl}${src}`;
  try {
    const response = await axios.get(url, {
      headers,
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    return Buffer.from(response.data as ArrayBuffer);
  } catch {
    console.warn(`[confluence] Could not download image: ${url}`);
    return null;
  }
}
