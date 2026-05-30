/**
 * Hermes Agent — configuration loader.
 * Reads .hermes/config/thresholds.json and returns a validated typed config.
 * Results are cached for the lifetime of the process.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ThresholdsConfig } from './types';

const THRESHOLDS_PATH = path.join(
  process.cwd(),
  '.hermes',
  'config',
  'thresholds.json',
);

let _cached: ThresholdsConfig | null = null;

/**
 * Load and return the thresholds config. Cached after first read.
 * Throws with a clear message if the file is missing or malformed.
 */
export function loadConfig(): ThresholdsConfig {
  if (_cached) return _cached;

  if (!fs.existsSync(THRESHOLDS_PATH)) {
    throw new Error(
      `[config] thresholds.json not found at ${THRESHOLDS_PATH}\n` +
        `         Run: npm run hermes:codebase to initialise Hermes.`,
    );
  }

  try {
    _cached = JSON.parse(
      fs.readFileSync(THRESHOLDS_PATH, 'utf8'),
    ) as ThresholdsConfig;
  } catch (err) {
    throw new Error(
      `[config] Failed to parse thresholds.json: ${(err as Error).message}`,
    );
  }

  return _cached;
}

/** Reset the cache (useful for testing). */
export function resetConfigCache(): void {
  _cached = null;
}

/** Convenience: get the HERMES memory directory path. */
export const MEMORY_DIR = path.join(process.cwd(), '.hermes', 'memory');

/** Convenience: get the HERMES prompts directory path. */
export const PROMPTS_DIR = path.join(process.cwd(), '.hermes', 'prompts');

/** Convenience: read a prompt template, substituting {{PLACEHOLDER}} tokens. */
export function loadPrompt(
  name:
    | 'test-generation'
    | 'coverage-analysis'
    | 'codebase-scan'
    | 'self-healing',
  substitutions: Record<string, string> = {},
): string {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[config] Prompt template not found: ${filePath}`);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(substitutions)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}
