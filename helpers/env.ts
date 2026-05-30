import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from project root. Idempotent — won't override vars already set by CI.
dotenv.config({ path: resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: "${key}"\n` +
        `      Copy .env.example to .env and fill in the value.`,
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/** All environment variables for this project, validated at startup. */
export const ENV = {
  // ── SauceDemo (required for Playwright tests) ──────────────────────────────
  /** Target application URL */
  BASE_URL: process.env.BASE_URL ?? 'https://www.saucedemo.com',
  /** Standard authenticated test user */
  STANDARD_USER: requireEnv('STANDARD_USER'),
  /** Locked-out test user — used for negative login tests */
  LOCKED_USER: process.env.LOCKED_USER ?? 'locked_out_user',
  /** Problem user — exhibits visual / functional bugs */
  PROBLEM_USER: process.env.PROBLEM_USER ?? 'problem_user',
  /** Shared password for all SauceDemo test users */
  USER_PASSWORD: requireEnv('USER_PASSWORD'),

  // ── Jira (optional — required only for hermes:ingest) ─────────────────────
  JIRA_BASE_URL: optionalEnv('JIRA_BASE_URL'),
  JIRA_EMAIL: optionalEnv('JIRA_EMAIL'),
  JIRA_API_TOKEN: optionalEnv('JIRA_API_TOKEN'),
  JIRA_PROJECT_KEY: optionalEnv('JIRA_PROJECT_KEY'),
  /** Custom field ID for the Testing Status field, e.g. customfield_10234 */
  JIRA_TESTING_STATUS_FIELD: optionalEnv(
    'JIRA_TESTING_STATUS_FIELD',
    'customfield_10234',
  ),
  /** JQL assignee filter — email or accountId */
  JIRA_ASSIGNEE_FILTER: optionalEnv('JIRA_ASSIGNEE_FILTER'),

  // ── Confluence (optional) ─────────────────────────────────────────────────
  /** Confluence base URL, e.g. https://yourorg.atlassian.net/wiki */
  CONFLUENCE_BASE_URL: optionalEnv('CONFLUENCE_BASE_URL'),

  // ── Figma (optional) ─────────────────────────────────────────────────────
  FIGMA_API_TOKEN: optionalEnv('FIGMA_API_TOKEN'),

  // ── LLM (optional — required for hermes:generate, hermes:codebase, etc.) ──
  /** openai | anthropic | azure */
  LLM_PROVIDER: optionalEnv('LLM_PROVIDER', 'openai'),
  LLM_API_KEY: optionalEnv('LLM_API_KEY'),
  /** Must support vision. Default: gpt-4o */
  LLM_MODEL: optionalEnv('LLM_MODEL', 'gpt-4o'),
  /** Optional base URL override — used for Azure OpenAI */
  LLM_BASE_URL: optionalEnv('LLM_BASE_URL'),

  // ── Hermes Orchestrator (optional) ────────────────────────────────────────
  /** Email or accountId of the Jira assignee to watch */
  HERMES_ASSIGNEE_FILTER: optionalEnv('HERMES_ASSIGNEE_FILTER'),
  /** Cron expression for orchestrator schedule. Default: every hour */
  HERMES_SCHEDULE: optionalEnv('HERMES_SCHEDULE', '0 * * * *'),
  /** Max LLM retries before escalating to human */
  HERMES_MAX_RETRIES: parseInt(
    optionalEnv('HERMES_MAX_RETRIES', '3') ?? '3',
    10,
  ),

  // ── Notifications (optional) ─────────────────────────────────────────────
  DISCORD_WEBHOOK_URL: optionalEnv('DISCORD_WEBHOOK_URL'),
  SLACK_WEBHOOK_URL: optionalEnv('SLACK_WEBHOOK_URL'),
} as const;
