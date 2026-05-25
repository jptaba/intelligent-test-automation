# demo-playwright-cli

Playwright TypeScript e2e test framework for [SauceDemo](https://www.saucedemo.com), powered by [@playwright/cli](https://playwright.dev/agent-cli/introduction).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in credentials
cp .env.example .env

# 3. Install browsers
npm run pw:install

# 4. Run all tests
npm test
```

## Project Structure

```
├── pages/               # Page Object Model (one class per SauceDemo page)
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   ├── CartPage.ts
│   └── CheckoutPage.ts
├── fixtures/
│   └── auth.fixture.ts  # loggedInPage fixture (pre-authenticated)
├── data/
│   ├── users.ts         # Typed credentials sourced from .env
│   └── products.ts      # SauceDemo product catalogue
├── helpers/
│   └── env.ts           # Validates and exports all env vars
├── tests/
│   ├── auth/            # Login and authentication flows
│   ├── inventory/       # Product listing, sorting, add-to-cart
│   └── cart/            # Cart management and checkout
├── inputs/
│   ├── stories/         # Jira user stories (drop new ones here)
│   └── testcases/       # Traditional test cases with steps
├── playwright.config.ts
├── tsconfig.json
└── .env                 # Not committed — copy from .env.example
```

## Adding Tests from Inputs

1. Drop a Jira story into `inputs/stories/` or a test case into `inputs/testcases/`.
2. In VS Code Copilot chat, ask:
   > "Implement tests for `inputs/stories/STORY-XXX.md`"
3. Copilot reads the project map from `.github/copilot-instructions.md` and follows the framework patterns automatically — Page Objects, fixtures, credential sourcing, and naming conventions all included.

## NPM Scripts

| Command                        | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `npm test`                     | All tests headless                            |
| `npm run test:headed`          | All tests in a visible browser                |
| `npm run test:debug`           | Playwright Inspector (step-through debugging) |
| `npm run test:ui`              | Playwright UI mode (interactive)              |
| `npm run test:smoke`           | Critical path `@smoke` tests only             |
| `npm run test:auth`            | Auth tests only                               |
| `npm run test:inventory`       | Inventory tests only                          |
| `npm run test:cart`            | Cart tests only                               |
| `npm run report`               | Open last HTML report                         |
| `npm run pw:codegen:saucedemo` | Record new tests via Codegen                  |

## Credentials

Copy `.env.example` to `.env` and fill in SauceDemo credentials.  
**Never commit `.env` to version control.**

## Self-Healing Broken Selectors

```bash
playwright-cli open https://www.saucedemo.com
playwright-cli goto /inventory.html
playwright-cli snapshot          # shows current refs
# update the page object, then re-run
npx playwright test tests/inventory/ --headed
```
