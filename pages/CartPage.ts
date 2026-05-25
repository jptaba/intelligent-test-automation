import { type Page, expect } from '@playwright/test';

/**
 * Page Object for the SauceDemo cart page (/cart.html).
 * Covers: item count assertions, item presence, remove, checkout navigation.
 */
export class CartPage {
  constructor(private readonly page: Page) {}

  async expectItemCount(count: number): Promise<void> {
    await expect(this.page.locator('.cart_item')).toHaveCount(count);
  }

  /** Assert that a cart item containing the given product name is visible. */
  async expectItemPresent(name: string): Promise<void> {
    await expect(
      this.page.locator('.cart_item').filter({ hasText: name }),
    ).toBeVisible();
  }

  async removeItemByName(name: string): Promise<void> {
    const item = this.page.locator('.cart_item').filter({ hasText: name });
    await item.getByRole('button', { name: /remove/i }).click();
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.getByText('Checkout', { exact: true }).click();
  }

  async continueShopping(): Promise<void> {
    await this.page.getByText('Continue Shopping', { exact: true }).click();
  }
}
