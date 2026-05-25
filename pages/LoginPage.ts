import { type Page, expect } from '@playwright/test';

/**
 * Page Object for the SauceDemo login page (/).
 * Covers: navigation, login form submission, error assertions.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByPlaceholder('Username').fill(username);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async expectOnInventoryPage(): Promise<void> {
    await expect(this.page).toHaveURL(/inventory\.html/);
  }

  /** Asserts the red error banner contains the given substring. */
  async expectLoginError(message: string): Promise<void> {
    await expect(this.page.locator('[data-test="error"]')).toContainText(
      message,
    );
  }
}
