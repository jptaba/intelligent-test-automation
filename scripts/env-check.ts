/**
 * env-check.ts
 *
 * Pre-flight environment readiness check. Validates that all required
 * environment variables are present, the target URL is reachable, and
 * Playwright dependencies are installed.
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * Usage:
 *   tsx scripts/env-check.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, ok: boolean, message: string): void {
  results.push({ name, ok, message });
}

// ---------------------------------------------------------------------------
// 1. .env file exists
// ---------------------------------------------------------------------------
const envPath = path.join(process.cwd(), '.env');
check(
  '.env file',
  fs.existsSync(envPath),
  fs.existsSync(envPath)
    ? 'Found'
    : 'Missing — copy .env.example to .env and fill in values',
);

// ---------------------------------------------------------------------------
// 2. Required env vars
// ---------------------------------------------------------------------------
const requiredVars = ['STANDARD_USER', 'USER_PASSWORD'];
for (const v of requiredVars) {
  const present = Boolean(process.env[v]);
  check(
    `env.${v}`,
    present,
    present ? 'Set' : `Missing — add ${v}=<value> to your .env`,
  );
}

// Optional but useful vars
const optionalVars = ['BASE_URL', 'LOCKED_USER', 'PROBLEM_USER'];
for (const v of optionalVars) {
  const present = Boolean(process.env[v]);
  check(
    `env.${v} (optional)`,
    true, // optional vars never block — just inform
    present ? `Set (${process.env[v]})` : `Not set — using default`,
  );
}

// ---------------------------------------------------------------------------
// 3. node_modules installed
// ---------------------------------------------------------------------------
const nodeModulesOk = fs.existsSync(path.join(process.cwd(), 'node_modules'));
check(
  'node_modules',
  nodeModulesOk,
  nodeModulesOk ? 'Installed' : 'Missing — run "npm install"',
);

// ---------------------------------------------------------------------------
// 4. Playwright browsers installed (check for chromium marker)
// ---------------------------------------------------------------------------
const playwrightBrowsersDir = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? '', '.cache'),
  'ms-playwright',
);
const browsersOk = fs.existsSync(playwrightBrowsersDir);
check(
  'Playwright browsers',
  browsersOk,
  browsersOk
    ? `Found at ${playwrightBrowsersDir}`
    : `Not found at ${playwrightBrowsersDir} — run "npm run pw:install"`,
);

// ---------------------------------------------------------------------------
// 5. BASE_URL reachable
// ---------------------------------------------------------------------------
const baseUrl = process.env.BASE_URL ?? 'https://www.saucedemo.com';

async function checkUrl(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    check(
      `BASE_URL reachable (${baseUrl})`,
      res.ok || res.status < 500,
      `HTTP ${res.status}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    check(`BASE_URL reachable (${baseUrl})`, false, `Unreachable — ${msg}`);
  }
}

void (async () => {
  await checkUrl();

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  const width = Math.max(...results.map((r) => r.name.length)) + 2;

  console.log('\n[env-check] Environment Readiness Report');
  console.log('─'.repeat(60));

  for (const r of results) {
    const icon = r.ok ? '✓' : '✗';
    const label = r.name.padEnd(width);
    console.log(`  ${icon}  ${label} ${r.message}`);
  }

  console.log('─'.repeat(60));

  const failures = results.filter((r) => !r.ok);
  if (failures.length === 0) {
    console.log('  All checks passed. Environment is ready.\n');
    process.exit(0);
  } else {
    console.log(
      `  ${failures.length} check(s) failed. Fix the issues above before running tests.\n`,
    );
    process.exit(1);
  }
})();
