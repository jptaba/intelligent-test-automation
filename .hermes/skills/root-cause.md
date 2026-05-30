---
name: root-cause
description: Summarise why tests failed using error messages, traces, and git context
---

# Skill: root-cause

## Trigger phrases

"why did the tests fail", "summarise failures", "root cause analysis", "explain the failures",
"what went wrong", "analyse the test results"

## What this skill does

Produces a structured root cause summary for all failing tests in the most recent run,
combining error messages, Playwright trace context, and git commit analysis.

## Prerequisites

- An archived run record exists in `test-results/history/`
- Traces were captured (configured in `playwright.config.ts` as `trace: 'on-first-retry'`)

## Steps

1. Load the latest run record and extract all failures:

   ```
   cat test-results/history/<latest>.json   # failures[].error and failures[].file
   ```

2. For each failing test:

   a. **Error message analysis** — from `failures[].error`:
   - If it contains "locator" or "selector" → likely a broken selector in the page object
   - If it contains "timeout" → page load or animation timing issue
   - If it contains "navigation" or "URL" → routing or environment issue
   - If it contains "expected ... to be" → assertion mismatch, data or logic change

   b. **Trace file** — check `test-results/` for `.zip` trace files:

   ```
   dir test-results\
   ```

   If traces exist, note their location. Direct the developer to open them:

   ```
   npx playwright show-trace test-results/<test-name>/trace.zip
   ```

   c. **Page object check** — read the relevant page object method:
   - Cart failures → `pages/CartPage.ts`
   - Checkout failures → `pages/CheckoutPage.ts`
   - Login failures → `pages/LoginPage.ts`
   - Inventory failures → `pages/InventoryPage.ts`

   d. **Commit correlation** — load the `correlate-commits` skill for the failing spec.

3. Produce the root cause summary:

   ```
   ## Root Cause Summary — <runId>

   ### <test title> [FAILING]
   **Error:** <first line of error message>
   **File:** <spec file>
   **Likely cause:** <explanation>
   **Recommended fix:** <specific action>

   ### <test title 2> [FAILING]
   ...

   ### Overall assessment
   <1–3 sentence summary of the pattern across all failures>
   ```

## Root cause patterns for SauceDemo tests

| Error pattern                   | Likely cause                                      | Fix location                                    |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `locator('...')` not found      | Selector changed in app or page object            | `pages/<Page>.ts`                               |
| `Timeout … waiting for`         | Element not rendering, animation, or slow network | `pages/<Page>.ts` — add wait or stable selector |
| `Expected '...' to equal '...'` | Product data or text copy changed                 | `data/products.ts` or assertion in spec         |
| `Navigation to ... failed`      | `BASE_URL` wrong or app down                      | `.env` — check `BASE_URL`                       |
| `strict mode violation`         | Selector matches multiple elements                | `pages/<Page>.ts` — make selector more specific |

## Self-critique notice

Always include this caveat in your summary:

> "This analysis is based on error messages and git history. A developer should review the actual
> Playwright trace before acting on these conclusions."
