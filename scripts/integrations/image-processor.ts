/**
 * Hermes Agent — image processor.
 *
 * Downloads images (from URLs or Buffers), converts them to base64,
 * and uses the LLM vision API to produce structured ImageDescription objects
 * useful for test case generation.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { vision } from '../agents/llm';
import type { ImageDescription } from '../agents/types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Download an image from a URL, returning a Buffer.
 * Optionally pass auth headers for authenticated downloads (Jira/Confluence).
 */
export async function downloadImage(
  url: string,
  authHeaders: Record<string, string> = {},
): Promise<Buffer> {
  const response = await axios.get(url, {
    headers: { ...authHeaders },
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  return Buffer.from(response.data as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Local save helper
// ---------------------------------------------------------------------------

/** Save an image buffer to a local path, creating parent directories as needed. */
export function saveImage(buffer: Buffer, localPath: string): void {
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(localPath, buffer);
}

// ---------------------------------------------------------------------------
// LLM vision description
// ---------------------------------------------------------------------------

/**
 * Send an image buffer or URL to the LLM and parse the response into a
 * structured ImageDescription object.
 *
 * @param imageSource  Buffer (image bytes) or string (image URL)
 * @param contextHint  Free-text hint (e.g., "Jira attachment: login error screen")
 */
export async function describeImage(
  imageSource: Buffer | string,
  contextHint: string = '',
): Promise<ImageDescription> {
  const systemPrompt = `You are a QA automation engineer analyzing a UI screenshot.
Extract structured information for writing automated tests.
Respond ONLY with valid JSON matching this schema:
{
  "uiElements": ["list of visible UI elements: buttons, inputs, labels, headings, icons"],
  "expectedBehaviors": ["list of implied user interactions, validations, and error states"],
  "layoutHints": "brief layout description: modal, full-page form, side panel, etc.",
  "rawDescription": "2-3 sentence plain description of the screen"
}`;

  const userPrompt = `Analyze this UI screenshot for test case generation.
Context: ${contextHint || 'UI screenshot from Jira story or Figma design'}

Extract:
1. All visible UI elements (buttons, form fields, headings, error messages, icons)
2. Expected behaviors implied by the UI (what happens when user clicks/types/submits)
3. Any visible validation rules or error states
4. Layout type`;

  try {
    const rawResponse = await vision(imageSource, contextHint);

    // Try to parse JSON from the response — the vision endpoint doesn't enforce JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ImageDescription>;
      return {
        uiElements: parsed.uiElements ?? [],
        expectedBehaviors: parsed.expectedBehaviors ?? [],
        layoutHints: parsed.layoutHints ?? '',
        rawDescription: parsed.rawDescription ?? rawResponse,
      };
    }

    // Fallback: return the raw response as the description
    return {
      uiElements: [],
      expectedBehaviors: [],
      layoutHints: '',
      rawDescription: rawResponse,
    };
  } catch (err) {
    console.warn(
      `[image-processor] LLM vision call failed for ${contextHint}: ${(err as Error).message}`,
    );
    return {
      uiElements: [],
      expectedBehaviors: [],
      layoutHints: 'unknown',
      rawDescription: `Image description unavailable: ${(err as Error).message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

export interface ImageProcessResult {
  sourceUrl: string;
  localPath: string;
  llmDescription: ImageDescription;
}

/**
 * Download, save, and describe a list of images.
 * Errors on individual images are caught and logged — does not stop processing.
 */
export async function processImages(
  images: Array<{ url: string; localPath: string; contextHint?: string }>,
  authHeaders: Record<string, string> = {},
): Promise<ImageProcessResult[]> {
  const results: ImageProcessResult[] = [];

  for (const img of images) {
    try {
      const buffer = await downloadImage(img.url, authHeaders);
      saveImage(buffer, img.localPath);
      const llmDescription = await describeImage(
        buffer,
        img.contextHint ?? img.url,
      );
      results.push({
        sourceUrl: img.url,
        localPath: img.localPath,
        llmDescription,
      });
    } catch (err) {
      console.warn(
        `[image-processor] Skipping image ${img.url}: ${(err as Error).message}`,
      );
    }
  }

  return results;
}
