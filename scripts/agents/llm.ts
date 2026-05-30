/**
 * Hermes Agent — LLM client wrapper.
 *
 * Supports OpenAI (default), Azure OpenAI, and a no-op dry-run mode.
 * All agents use this module for text completion and vision calls.
 *
 * Environment variables (from helpers/env.ts):
 *   LLM_PROVIDER    — openai | azure  (default: openai)
 *   LLM_API_KEY     — API key
 *   LLM_MODEL       — model name (default: gpt-4o)
 *   LLM_BASE_URL    — override base URL (required for Azure)
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Client initialisation (lazy)
// ---------------------------------------------------------------------------

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[llm] LLM_API_KEY is not set. Add it to your .env file.\n' +
        '      See .env.example for all required Hermes variables.',
    );
  }

  const baseURL = process.env.LLM_BASE_URL || undefined;
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

const DEFAULT_MODEL = process.env.LLM_MODEL ?? 'gpt-4o';

// ---------------------------------------------------------------------------
// Text completion
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request and return the response text.
 * @param messages  OpenAI message array
 * @param model     Override the default model
 */
export async function chat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = DEFAULT_MODEL,
): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.2, // low temperature for deterministic QA output
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('[llm] Empty response from LLM');
  return text;
}

// ---------------------------------------------------------------------------
// Vision (image description)
// ---------------------------------------------------------------------------

/**
 * Describe an image using the LLM vision capability.
 * Accepts either a URL or a base64-encoded PNG/JPEG buffer.
 *
 * @param imageSource  HTTPS URL or Buffer (will be base64-encoded as PNG)
 * @param contextHint  Free-text hint describing where this image came from
 * @param model        Override the default model (must support vision)
 */
export async function vision(
  imageSource: string | Buffer,
  contextHint: string = '',
  model: string = DEFAULT_MODEL,
): Promise<string> {
  const client = getClient();

  const imageContent: OpenAI.Chat.ChatCompletionContentPart =
    typeof imageSource === 'string'
      ? {
          type: 'image_url',
          image_url: { url: imageSource, detail: 'high' },
        }
      : {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${imageSource.toString('base64')}`,
            detail: 'high',
          },
        };

  const systemPrompt = `You are a QA engineer describing UI screenshots to help write automated tests.
Focus on: visible UI elements, form fields, buttons, labels, error states, and implied user interactions.
Be specific and structured. Context: ${contextHint || 'Jira story attachment or Figma frame'}.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this UI screenshot for test case generation purposes.',
          },
          imageContent,
        ],
      },
    ],
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('[llm] Empty vision response from LLM');
  return text;
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

/**
 * Ask the LLM to respond with JSON only.
 * Parses the response and returns the typed object.
 */
export async function chatJSON<T>(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = DEFAULT_MODEL,
): Promise<T> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('[llm] Empty JSON response from LLM');
  return JSON.parse(text) as T;
}
