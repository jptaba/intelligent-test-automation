# Onboarding Guide — demo-playwright-cli

Welcome to the team. This guide covers everything you need to go from zero to writing your first automated test — whether you're starting from a Jira story, a set of acceptance criteria, or a traditional test case with numbered steps.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-Time Setup](#2-first-time-setup)
3. [How the Framework is Organised](#3-how-the-framework-is-organised)
4. [Core Concepts](#4-core-concepts)
5. [Running Tests](#5-running-tests)
6. [Automating from a Jira Story](#6-automating-from-a-jira-story)
7. [Automating from Acceptance Criteria](#7-automating-from-acceptance-criteria)
8. [Automating from a Traditional Test Case](#8-automating-from-a-traditional-test-case)
9. [Framework Rules — What You Must Follow](#9-framework-rules--what-you-must-follow)
10. [Adding a New Page or Feature Domain](#10-adding-a-new-page-or-feature-domain)
11. [Self-Healing Broken Tests](#11-self-healing-broken-tests)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Install these tools before anything else.

| Tool                                                            | Version         | Why               |
| --------------------------------------------------------------- | --------------- | ----------------- |
| [Node.js](https://nodejs.org)                                   | 18 LTS or later | Runtime and npm   |
| [VS Code](https://code.visualstudio.com)                        | Latest          | Editor            |
| [GitHub Copilot](https://github.com/features/copilot) extension | Latest          | AI test authoring |
| Git                                                             | Any             | Source control    |

Verify your setup:

```bash
node --version   # v18.x or later
npm --version    # 9.x or later
git --version
```

---

## 2. First-Time Setup

### Clone and install

```bash
git clone https://github.com/jptaba/demo-playwright-cli.git
cd demo-playwright-cli
npm install
```

### Set up credentials

```bash
cp .env.example .env
```

The `.env` file is gitignored and contains SauceDemo credentials. The defaults in `.env.example` are the public test credentials — no changes needed for SauceDemo.

```
STANDARD_USER=standard_user
USER_PASSWORD=secret_sauce
BASE_URL=https://www.saucedemo.com
LOCKED_USER=locked_out_user
PROBLEM_USER=problem_user
```

> **Never commit `.env` to version control.**  
> If a required variable is missing, `helpers/env.ts` will throw a clear error before any test runs.

### Install browsers

```bash
npm run pw:install
```

This downloads Chromium, Firefox, and WebKit.

### Verify everything works

```bash
npm test
```

You should see **10 tests passing** across 3 domains: auth, inventory, and cart.

---

## 3. How the Framework is Organised

```
demo-playwright-cli/
│
├── pages/                   ← Page Object Model (one file per app page)
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   ├── CartPage.ts
│   └── CheckoutPage.ts
│
├── fixtures/
│   └── auth.fixture.ts      ← loggedInPage: a page already past login
│
├── data/
│   ├── users.ts             ← Typed credentials loaded from .env
│   └── products.ts          ← SauceDemo product catalogue
│
├── helpers/
│   └── env.ts               ← Validates + exports all env variables
│
├── tests/
│   ├── auth/                ← Login / authentication scenarios
│   ├── inventory/           ← Product listing, sorting, add-to-cart
│   └── cart/                ← Cart management and full checkout
│
├── inputs/                  ← Drop your work inputs here
│   ├── stories/             ← Jira user stories (.md)
│   └── testcases/           ← Traditional test cases with steps (.md)
│
├── .github/
│   ├── copilot-instructions.md        ← AI's project map (always active)
│   ├── instructions/playwright.instructions.md  ← Rules for *.spec.ts files
│   └── skills/playwright-cli/        ← Official Playwright CLI skill
│
├── playwright.config.ts     ← Test runner config, loads dotenv
└── .env                     ← Your local credentials (not committed)
```

---

## 4. Core Concepts

### Page Object Model (POM)

Each SauceDemo page has a matching TypeScript class in `pages/`. Tests never interact with the browser directly — they call methods on page objects.

```
Browser action          →  Page Object method
────────────────────────────────────────────────
type username           →  loginPage.login(user, pass)
click Add to Cart       →  inventory.addItemToCartByName('Product Name')
click Checkout          →  cart.proceedToCheckout()
fill shipping info      →  checkout.fillInfo({ firstName, lastName, postalCode })
```

This means: **if a selector breaks, you fix it in one place (the page object), not across every test.**

### `loggedInPage` Fixture

Most feature tests need the user to already be logged in. Instead of repeating login steps in every test, import `test` from `fixtures/auth.fixture.ts`:

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test('products are visible', async ({ loggedInPage }) => {
  // loggedInPage is already authenticated — ready to use
});
```

Use `page` (from `@playwright/test`) only when you are testing the login page itself.

### Credentials via `data/users.ts`

```typescript
import { USERS } from '../../data/users';

USERS.standard; // { username: 'standard_user', password: 'secret_sauce' }
USERS.locked; // { username: 'locked_out_user', password: 'secret_sauce' }
USERS.problem; // { username: 'problem_user',   password: 'secret_sauce' }
```

Never hardcode `'standard_user'` or `'secret_sauce'` in a test file.

### `@smoke` Tag

Prefix critical-path test names with `@smoke`. Run only these with `npm run test:smoke`.

```typescript
test('@smoke standard_user can log in successfully', async ({ page }) => {
  ...
});
```

---

## 5. Running Tests

| Command                  | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm test`               | All tests, headless                            |
| `npm run test:headed`    | All tests in a visible browser window          |
| `npm run test:smoke`     | Only `@smoke` tagged tests                     |
| `npm run test:auth`      | Auth tests only                                |
| `npm run test:inventory` | Inventory tests only                           |
| `npm run test:cart`      | Cart tests only                                |
| `npm run test:debug`     | Playwright Inspector — pause and step through  |
| `npm run test:ui`        | Playwright UI mode — run/filter tests visually |
| `npm run report`         | Open the last HTML test report                 |

---

## 6. Automating from a Jira Story

### Step 1 — Write the story in Markdown

Create a file in `inputs/stories/` following this template:

```
inputs/stories/STORY-<ID>.md
```

**Template:**

```markdown
# STORY-042: Product Sorting

## User Story

As a logged-in shopper,
I want to sort products by price,
So that I can find the cheapest item quickly.

## Acceptance Criteria

| ID  | Criterion                                                              |
| --- | ---------------------------------------------------------------------- |
| AC1 | A sort dropdown is visible on the inventory page.                      |
| AC2 | Selecting "Price (low to high)" reorders products ascending by price.  |
| AC3 | Selecting "Price (high to low)" reorders products descending by price. |

## Automation Notes

- Use `InventoryPage.sortBy()` and `InventoryPage.getProductNames()`.
- Tests belong in `tests/inventory/inventory.spec.ts`.
- AC2 and AC3 are regression candidates — tag them `@smoke`.
```

### Step 2 — Ask Copilot to implement it

Open the Copilot Chat panel in VS Code and type:

```
Implement tests for inputs/stories/STORY-042.md
```

Copilot will:

1. Read the story and extract each acceptance criterion as a test scenario
2. Check `pages/` for existing methods that can cover each action
3. Extend or create page object methods if needed
4. Write the test spec in the correct `tests/<domain>/` directory
5. Import `USERS` from `data/users.ts` and the right fixture automatically

### Step 3 — Review and run

```bash
npm run test:inventory
```

If a test fails, see [Section 11 — Self-Healing](#11-self-healing-broken-tests).

---

## 7. Automating from Acceptance Criteria

Acceptance criteria (AC) without a full story can be captured directly as a Markdown list in `inputs/stories/` or pasted into the Copilot Chat prompt.

**Example prompt:**

```
Implement Playwright tests for these acceptance criteria on the cart page:

- AC1: A logged-in user can see all items they added to the cart.
- AC2: The cart badge count matches the number of items added.
- AC3: Removing an item from the cart decreases the badge count by 1.
- AC4: An empty cart shows no items and no badge.

Tests belong in tests/cart/. Use the loggedInPage fixture.
```

Copilot reads `.github/copilot-instructions.md` (the project map) so it knows:

- which page objects exist and what they can do
- which fixture to use
- where to put the new file
- how to source credentials

You do not need to explain the framework structure in the prompt.

---

## 8. Automating from a Traditional Test Case

### Step 1 — Write the test case in Markdown

Create a file in `inputs/testcases/` following this template:

```
inputs/testcases/TC-<DOMAIN>-<ID>.md
```

**Template:**

```markdown
# TC-INVENTORY-001: Add Product to Cart

## Objective

Verify a logged-in user can add a product to the cart by name.

## Preconditions

- User is authenticated (use loggedInPage fixture).

## Test Steps

| #   | Action                                   | Expected Result                           |
| --- | ---------------------------------------- | ----------------------------------------- |
| 1   | Log in as standard_user                  | Inventory page is displayed               |
| 2   | Locate "Sauce Labs Backpack" on the page | Product is visible                        |
| 3   | Click "Add to cart" on that product      | Cart badge shows "1"                      |
| 4   | Click the cart icon                      | Cart page loads                           |
| 5   | Observe cart contents                    | "Sauce Labs Backpack" appears in the cart |

## Automation Notes

- Page Objects: InventoryPage, CartPage
- Test file: tests/inventory/inventory.spec.ts
```

### Step 2 — Ask Copilot to implement it

```
Implement tests for inputs/testcases/TC-INVENTORY-001.md
```

### Step 3 — Run and verify

```bash
npm run test:inventory
```

---

## 9. Framework Rules — What You Must Follow

These rules keep the framework consistent and AI-friendly. Copilot enforces them automatically via `.github/instructions/playwright.instructions.md`.

### Rule 1 — Never use raw selectors in test files

```typescript
// ❌ Wrong — raw selector inside the test
await page.locator('.inventory_item').first().click();

// ✅ Correct — delegate to the page object
await inventory.addFirstItemToCart();
```

If a method doesn't exist on the page object yet, add it there, not in the test.

### Rule 2 — Never hardcode credentials

```typescript
// ❌ Wrong
await loginPage.login('standard_user', 'secret_sauce');

// ✅ Correct
await loginPage.login(USERS.standard.username, USERS.standard.password);
```

### Rule 3 — Use the right `test` import

```typescript
// Tests that need the user already logged in:
import { test, expect } from '../../fixtures/auth.fixture';

// Tests that test the login page itself:
import { test, expect } from '@playwright/test';
```

### Rule 4 — Tag critical paths with `@smoke`

At minimum, the main happy-path test for every feature should be tagged:

```typescript
test('@smoke user can complete checkout', async ({ loggedInPage }) => { ... });
```

### Rule 5 — Follow file naming conventions

| What        | Convention                                   | Example                           |
| ----------- | -------------------------------------------- | --------------------------------- |
| Test file   | `<feature>.spec.ts` inside `tests/<domain>/` | `tests/cart/cart.spec.ts`         |
| Page object | `<Page>Page.ts`                              | `pages/CheckoutPage.ts`           |
| Jira story  | `STORY-<ID>.md`                              | `inputs/stories/STORY-042.md`     |
| Test case   | `TC-<DOMAIN>-<ID>.md`                        | `inputs/testcases/TC-CART-001.md` |

---

## 10. Adding a New Page or Feature Domain

When the application adds a new page (e.g. a Wishlist page):

**1. Create the page object:**

```
pages/WishlistPage.ts
```

Add typed methods. No raw selectors — use `getByRole`, `getByPlaceholder`, or `locator()`.

**2. Create the test spec:**

```
tests/wishlist/wishlist.spec.ts
```

**3. Add a npm script to `package.json`:**

```json
"test:wishlist": "playwright test tests/wishlist/"
```

**4. Document the input:**

```
inputs/stories/STORY-XXX.md  (or  inputs/testcases/TC-WISHLIST-001.md)
```

**5. Run:**

```bash
npm run test:wishlist
```

---

## 11. Self-Healing Broken Tests

When a test fails because a selector no longer matches an element on the page, use Playwright CLI to inspect the live page and find the updated selector.

```bash
# 1. Open the browser at the failing URL
playwright-cli open https://www.saucedemo.com

# 2. Navigate to the step that breaks
playwright-cli goto /inventory.html

# 3. Print the current accessibility snapshot (all element refs)
playwright-cli snapshot

# 4. Find the correct ref or CSS selector in the output

# 5. Update the PAGE OBJECT — never the test file
#    Example: pages/InventoryPage.ts → fix the broken locator

# 6. Re-run the failing test with browser visible
npx playwright test tests/inventory/inventory.spec.ts --headed
```

Repeat until green. Commit **only the updated page object**.

> Tip: screenshots of failures are automatically saved to `test-results/` — check them before hunting for the selector change.

---

## 12. Troubleshooting

### "Missing required environment variable"

Your `.env` file is missing or empty.  
Run `cp .env.example .env` and make sure the file has values for `STANDARD_USER` and `USER_PASSWORD`.

### Tests time out on a selector

The app UI may have changed. Follow the [Self-Healing](#11-self-healing-broken-tests) steps. Update the page object, not the test.

### TypeScript error: "Cannot find module"

Run `npm install`. If the error persists, check that the import path is relative (e.g. `../../pages/LoginPage`) with no `.js` extension needed.

### Tests pass locally but fail in CI

- Ensure the CI environment has the required env vars set as secrets.
- CI uses 1 worker and 2 retries by default (configured in `playwright.config.ts`).
- Check the HTML report artefact in CI for screenshots and traces.

### Copilot writes incorrect selectors

Copilot uses `.github/copilot-instructions.md` as its project map. If the page objects change, update that file so Copilot's understanding stays current. Then re-run the failing test using the self-healing workflow.

---

## Quick Reference Card

```
Got a Jira story?
  → inputs/stories/STORY-<ID>.md
  → "Implement tests for inputs/stories/STORY-<ID>.md"

Got ACs only?
  → Paste them into Copilot Chat
  → "Implement Playwright tests for these ACs: ..."

Got a test case with steps?
  → inputs/testcases/TC-<DOMAIN>-<ID>.md
  → "Implement tests for inputs/testcases/TC-<DOMAIN>-<ID>.md"

Test is failing?
  1. Check test-results/ for screenshot
  2. playwright-cli snapshot on the failing page
  3. Fix the page object
  4. Re-run --headed
  5. Commit the page object change only

Running in CI?
  npm test  (headless, 1 worker, 2 retries on failure)
```
