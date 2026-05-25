import { type Page, expect } from '@playwright/test';

/**
 * Page Object for the SauceDemo inventory / products page (/inventory.html).
 * Covers: product visibility, add-to-cart, sorting, cart badge, navigate to cart.
 */
export class InventoryPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  async expectProductsVisible(): Promise<void> {
    await expect(this.page.locator('.inventory_item').first()).toBeVisible();
  }

  /** Add a product to the cart by its exact display name. */
  async addItemToCartByName(name: string): Promise<void> {
    const item = this.page.locator('.inventory_item').filter({ hasText: name });
    await item.getByRole('button', { name: /add to cart/i }).click();
  }

  async addFirstItemToCart(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Add to cart' })
      .first()
      .click();
  }

  /** Returns the cart badge count as a string, or '0' if badge is not visible. */
  async getCartCount(): Promise<string> {
    return (
      (await this.page.locator('.shopping_cart_badge').textContent()) ?? '0'
    );
  }

  async goToCart(): Promise<void> {
    await this.page.locator('.shopping_cart_link').click();
  }

  /** Sort products. Options: 'az' | 'za' | 'lohi' (price low→high) | 'hilo' (price high→low) */
  async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo'): Promise<void> {
    await this.page
      .locator('[data-test="product-sort-container"]')
      .selectOption(option);
  }

  async getProductNames(): Promise<string[]> {
    return this.page.locator('.inventory_item_name').allTextContents();
  }
}
