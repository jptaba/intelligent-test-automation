---
name: env-check
description: Validate environment readiness before running tests
---

# Skill: env-check

## Trigger phrases

"check environment", "verify setup", "is the environment ready", "pre-flight check", "can I run tests"

## What this skill does

Runs the pre-flight environment readiness script to validate all prerequisites before a test run.

## Steps

1. Run the environment check script:

   ```
   npm run check:env
   ```

2. Parse the output and report on each check:
   - `.env` file exists
   - Required env vars (`STANDARD_USER`, `USER_PASSWORD`) are set
   - Optional vars (`BASE_URL`, `LOCKED_USER`, `PROBLEM_USER`) status
   - `node_modules` installed
   - Playwright browsers installed
   - `BASE_URL` is reachable via HTTP

3. If any check fails, report the **exact fix command** for each failure:
   - Missing `.env` → "Copy `.env.example` to `.env` and fill in credentials"
   - Missing vars → "Add `VAR_NAME=value` to your `.env`"
   - Missing `node_modules` → "Run `npm install`"
   - Missing browsers → "Run `npm run pw:install`"
   - URL unreachable → "Check VPN/network connectivity or update `BASE_URL` in `.env`"

4. If ALL checks pass, confirm environment is ready and suggest: "Run `npm test` or `npm run pipeline`"

## Expected output format

```
Environment: ✓ Ready  (or  ✗ N checks failed)

✓  .env file             Found
✓  env.STANDARD_USER     Set
✓  env.USER_PASSWORD     Set
✓  node_modules          Installed
✓  Playwright browsers   Found
✓  BASE_URL reachable    HTTP 200
```

## Abort conditions

- If env-check fails, do NOT proceed to run tests. Always fix the environment first.
