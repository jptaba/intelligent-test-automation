import { test, expect } from '../../fixtures/auth.fixture';
import { InventoryPage } from '../../pages/InventoryPage';

test.describe('Inventory', () => {
  test('@smoke products are displayed after login', async ({
    loggedInPage,
  }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.expectProductsVisible();
  });

  test('can add a specific product to cart by name', async ({
    loggedInPage,
  }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.addItemToCartByName('Sauce Labs Backpack');
    expect(await inventory.getCartCount()).toBe('1');
  });

  test('can add multiple products and cart badge updates', async ({
    loggedInPage,
  }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.addItemToCartByName('Sauce Labs Backpack');
    await inventory.addItemToCartByName('Sauce Labs Bike Light');
    expect(await inventory.getCartCount()).toBe('2');
  });

  test('products can be sorted A to Z', async ({ loggedInPage }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.sortBy('az');
    const names = await inventory.getProductNames();
    expect(names).toEqual([...names].sort());
  });
});
