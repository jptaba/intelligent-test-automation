// covers: STORY-001
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { USERS } from '../../data/users';

test.describe('Authentication', () => {
  test('login page displays Username and Password fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectLoginFormVisible();
  });

  test('@smoke standard_user can log in successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.standard.username, USERS.standard.password);
    await loginPage.expectOnInventoryPage();
    await loginPage.expectInventoryHeading();
  });

  test('invalid credentials show a username and password mismatch error', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('invalid_user', 'invalid_password');
    await loginPage.expectLoginError('Username and password do not match');
  });

  test('locked_out_user sees a locked-out error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.locked.username, USERS.locked.password);
    await loginPage.expectLoginError('Sorry, this user has been locked out');
  });

  test('empty credentials shows username required error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('', '');
    await loginPage.expectLoginError('Username is required');
  });
});
