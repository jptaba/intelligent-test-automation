---
applyTo: 'tests/**/*.spec.ts'
---

# Playwright Test Authoring Rules

## Import Pattern

For **feature tests** (anything that requires login):

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
```

For **auth tests** (testing the login page itself):

```typescript
import { test, expect } from '@playwright/test';
```

## Page Object Rule

**Never** use raw selectors (`page.locator`, `page.fill`, etc.) directly in test files.  
Always delegate to page objects from `pages/`.

```typescript
// ✅ Correct
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(USERS.standard.username, USERS.standard.password);

// ❌ Wrong — raw selectors in tests
await page.getByPlaceholder('Username').fill('standard_user');
```

## Credentials Rule

**Never** hardcode usernames or passwords. Always import from `data/users.ts`:

```typescript
import { USERS } from '../../data/users';
// USERS.standard  |  USERS.locked  |  USERS.problem
```

## Test Structure Template

```typescript
import { test, expect } from '../../fixtures/auth.fixture';
import { InventoryPage } from '../../pages/InventoryPage';

test.describe('<Feature>: <short description>', () => {
  test('<subject> <verb> <expected outcome>', async ({ loggedInPage }) => {
    // Arrange
    const page = new InventoryPage(loggedInPage);
    // Act
    await page.addItemToCartByName('Sauce Labs Backpack');
    // Assert
    expect(await page.getCartCount()).toBe('1');
  });
});
```

## Smoke Tag

Tag any critical-path test by prefixing the test name with `@smoke`:

```typescript
test('@smoke standard_user can log in successfully', async ({ page }) => { ... });
```

Run only smoke tests: `npm run test:smoke`

## Fixture Reference

| Fixture        | Source                  | Use when                               |
| -------------- | ----------------------- | -------------------------------------- |
| `page`         | `@playwright/test`      | Testing login form itself              |
| `loggedInPage` | `fixtures/auth.fixture` | Any test that requires being logged in |

## Assertions

Keep assertions close to the action. Prefer Playwright-native matchers:

```typescript
await expect(page).toHaveURL(/inventory\.html/);
await expect(page.locator('.complete-header')).toContainText('Thank you');
await expect(page.locator('.cart_item')).toHaveCount(1);
```
