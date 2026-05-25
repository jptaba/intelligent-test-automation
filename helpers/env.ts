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

/** All environment variables for this project, validated at startup. */
export const ENV = {
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
} as const;
