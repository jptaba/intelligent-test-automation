/**
 * Hermes Agent — Figma REST API client.
 *
 * Handles: URL parsing, frame image export, image download.
 *
 * Required env: FIGMA_API_TOKEN
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const FIGMA_API_BASE = 'https://api.figma.com/v1';

function getHeaders() {
  const token = process.env.FIGMA_API_TOKEN;
  if (!token) {
    throw new Error('[figma] FIGMA_API_TOKEN must be set in .env');
  }
  return { 'X-Figma-Token': token };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FigmaFrameRef {
  fileKey: string;
  nodeId: string; // as it appears in the URL (with hyphens, e.g. "1-2345")
  nodeIdApi: string; // URL-encoded for API calls (colon, e.g. "1:2345")
  pageName: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Figma share URL into its components.
 *
 * Supported formats:
 *   https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>
 *   https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>
 *   https://www.figma.com/proto/<fileKey>/<name>?node-id=<nodeId>
 */
export function parseFigmaUrl(url: string): FigmaFrameRef | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // pathParts: ['design'|'file'|'proto', fileKey, ...nameParts]
    if (pathParts.length < 2) return null;
    const fileKey = pathParts[1];
    const pageName = pathParts.slice(2).join('/') || 'Unknown';
    const nodeId = parsed.searchParams.get('node-id') ?? '';

    // API expects node IDs with colon (1:2345) but URLs use hyphen (1-2345)
    const nodeIdApi = nodeId.replace(/-/g, ':');

    return { fileKey, nodeId, nodeIdApi, pageName, sourceUrl: url };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch frame images
// ---------------------------------------------------------------------------

/**
 * Export Figma frames as PNG images and return their download URLs.
 * Returns a map of nodeIdApi → download URL.
 */
export async function fetchFrameImages(
  fileKey: string,
  nodeIds: string[], // nodeIdApi format (with colons)
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  const headers = getHeaders();
  const response = await axios.get(`${FIGMA_API_BASE}/images/${fileKey}`, {
    headers,
    params: {
      ids: nodeIds.join(','),
      format: 'png',
      scale: 2,
    },
  });

  const data = response.data as {
    images?: Record<string, string>;
    err?: string;
  };
  if (data.err) {
    throw new Error(`[figma] API error fetching images: ${data.err}`);
  }
  return data.images ?? {};
}

// ---------------------------------------------------------------------------
// Image download
// ---------------------------------------------------------------------------

/** Download a Figma-exported image by its CDN URL, returning a Buffer. */
export async function downloadFigmaImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  return Buffer.from(response.data as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Node metadata
// ---------------------------------------------------------------------------

/**
 * Fetch the node name (label in Figma) for a given nodeId.
 * Returns the node name or the nodeId as fallback.
 */
export async function fetchNodeName(
  fileKey: string,
  nodeIdApi: string,
): Promise<string> {
  const headers = getHeaders();
  try {
    const response = await axios.get(
      `${FIGMA_API_BASE}/files/${fileKey}/nodes`,
      {
        headers,
        params: { ids: nodeIdApi },
      },
    );
    const nodes = (
      response.data as {
        nodes?: Record<string, { document: { name: string } }>;
      }
    ).nodes;
    if (nodes && nodes[nodeIdApi]) {
      return nodes[nodeIdApi].document.name;
    }
  } catch {
    // Non-fatal — fallback to nodeId
  }
  return nodeIdApi;
}
