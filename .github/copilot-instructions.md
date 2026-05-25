# demo-playwright-cli: Project AI Instructions

Playwright TypeScript e2e framework for [SauceDemo](https://www.saucedemo.com),
driven by [@playwright/cli](https://playwright.dev/agent-cli/introduction).

---

## Folder Map

| Path                             | Purpose                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `pages/`                         | Page Object Model — one class per SauceDemo page             |
| `fixtures/`                      | Playwright fixture extensions (pre-authenticated sessions)   |
| `data/`                          | Typed test data: users and products sourced from env         |
| `helpers/`                       | `env.ts` — validates and exports all environment variables   |
| `tests/auth/`                    | Login and authentication flows                               |
| `tests/inventory/`               | Product listing, sorting, add-to-cart                        |
| `tests/cart/`                    | Cart management and full checkout flow                       |
| `inputs/stories/`                | Jira user stories in Markdown — place new ones here          |
| `inputs/testcases/`              | Traditional test cases with numbered steps                   |
| `.github/skills/playwright-cli/` | Official Playwright Agent CLI skill                          |
| `.github/instructions/`          | File-scoped AI instructions (auto-loaded by VS Code Copilot) |

---

## Key Files at a Glance

| File                       | Role                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| `playwright.config.ts`     | Playwright config; loads dotenv; `baseURL` from `BASE_URL` env var               |
| `tsconfig.json`            | TypeScript config; `module: NodeNext`; `types: [node]`                           |
| `helpers/env.ts`           | Single source of truth for env vars; throws clearly if required vars are missing |
| `data/users.ts`            | Exports `USERS` map (standard / locked / problem) — typed, never hardcoded       |
| `data/products.ts`         | Exports `PRODUCTS` array with name + price                                       |
| `fixtures/auth.fixture.ts` | Exports `test` with `loggedInPage` fixture (page past the login screen)          |

---

## Page Objects

| Class           | File                     | Covers                                                                                                         |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `LoginPage`     | `pages/LoginPage.ts`     | `goto`, `login`, `expectOnInventoryPage`, `expectLoginError`                                                   |
| `InventoryPage` | `pages/InventoryPage.ts` | `addItemToCartByName`, `addFirstItemToCart`, `getCartCount`, `goToCart`, `sortBy`, `getProductNames`           |
| `CartPage`      | `pages/CartPage.ts`      | `expectItemCount`, `expectItemPresent`, `removeItemByName`, `proceedToCheckout`, `continueShopping`            |
| `CheckoutPage`  | `pages/CheckoutPage.ts`  | `expectOnStepOne`, `fillInfo`, `continue`, `expectOnStepTwo`, `finish`, `expectOrderComplete`, `getOrderTotal` |

---

## Credentials

All credentials come from `.env`. **Never hardcode credentials in test files.**

```
STANDARD_USER=standard_user
USER_PASSWORD=secret_sauce
BASE_URL=https://www.saucedemo.com
LOCKED_USER=locked_out_user
PROBLEM_USER=problem_user
```

Access credentials in tests via:

```typescript
import { USERS } from '../../data/users';
// USERS.standard.username  /  USERS.standard.password
// USERS.locked.username    /  USERS.locked.password
```

---

## Implementing Tests from Inputs

When handed a Jira story (`inputs/stories/`), acceptance criteria, or test case (`inputs/testcases/`):

### Step-by-step Workflow

1. **Read the input file** — extract every scenario / step.
2. **Check existing page objects** in `pages/` — can the required actions already be performed?
3. **Extend or create page objects** if new actions are needed. Never put raw selectors in test files.
4. **Choose the correct test file location**:
   - Login / auth flows → `tests/auth/`
   - Product / inventory actions → `tests/inventory/`
   - Cart, checkout, orders → `tests/cart/`
   - New feature domain → create `tests/<domain>/<feature>.spec.ts`
5. **Import the right `test`**:
   - Tests that require login → `import { test, expect } from '../../fixtures/auth.fixture';`
   - Auth tests (login form itself) → `import { test, expect } from '@playwright/test';`
6. **Use data** from `data/users.ts` and `data/products.ts` — never hardcode strings.
7. **Tag critical-path tests** with `@smoke` in the test name.
8. **Run** `npm test` or `npx playwright test tests/<domain>/`.
9. **Self-heal** if selectors break (see below).

---

## Self-Healing Workflow

When a test fails due to a broken selector:

```bash
# 1. Open the browser to the failing page
playwright-cli open https://www.saucedemo.com

# 2. Navigate to the broken step manually
playwright-cli goto /inventory.html

# 3. Capture the current accessibility snapshot with element refs
playwright-cli snapshot

# 4. Find the correct ref or selector in the snapshot output
# 5. Update the PAGE OBJECT method — never the test file
# 6. Re-run the specific test
npx playwright test tests/<domain>/<file>.spec.ts --headed
```

Repeat until green. Commit only the updated page object.

---

## Naming Conventions

| Item          | Convention                                   | Example                                 |
| ------------- | -------------------------------------------- | --------------------------------------- |
| Test files    | `<feature>.spec.ts` in `tests/<domain>/`     | `tests/cart/cart.spec.ts`               |
| Page objects  | `<Page>Page.ts` (PascalCase)                 | `pages/CheckoutPage.ts`                 |
| Fixture files | `<purpose>.fixture.ts`                       | `fixtures/auth.fixture.ts`              |
| Test names    | `<subject> <verb> <outcome>` (sentence case) | `standard_user can log in successfully` |
| Smoke tags    | Prefix test name with `@smoke`               | `@smoke can complete checkout`          |
| Input files   | `STORY-<ID>.md`, `TC-<DOMAIN>-<ID>.md`       | `TC-LOGIN-001.md`                       |

---

## NPM Scripts

| Script                         | What it runs                           |
| ------------------------------ | -------------------------------------- |
| `npm test`                     | All tests headless                     |
| `npm run test:headed`          | All tests headed (visible browser)     |
| `npm run test:debug`           | Playwright Inspector (step-through)    |
| `npm run test:ui`              | Playwright UI mode (interactive)       |
| `npm run test:smoke`           | Only `@smoke` tagged tests             |
| `npm run test:auth`            | Auth tests only                        |
| `npm run test:inventory`       | Inventory tests only                   |
| `npm run test:cart`            | Cart tests only                        |
| `npm run report`               | Open last HTML report                  |
| `npm run pw:codegen:saucedemo` | Launch Playwright Codegen on SauceDemo |

---

## Adding a New Feature Domain

1. Create `pages/<Feature>Page.ts` with typed methods.
2. Create `tests/<domain>/<feature>.spec.ts`.
3. Add a matching npm script in `package.json`:
   ```json
   "test:<domain>": "playwright test tests/<domain>/"
   ```
4. If the feature introduces new users or data, extend `data/users.ts` or create a new data file.
5. Document the input in `inputs/stories/` or `inputs/testcases/`.
