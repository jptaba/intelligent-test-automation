import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { USERS } from '../data/users';

type AuthFixtures = {
  /** A Playwright Page pre-authenticated as standard_user. Ready to use at /inventory.html. */
  loggedInPage: Page;
};

/**
 * Extended fixture that provides `loggedInPage` — a page already past the login screen.
 *
 * Usage in feature tests:
 *   import { test, expect } from '../../fixtures/auth.fixture';
 *   test('...', async ({ loggedInPage }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  loggedInPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.standard.username, USERS.standard.password);
    await loginPage.expectOnInventoryPage();
    await use(page);
  },
});

export { expect } from '@playwright/test';
