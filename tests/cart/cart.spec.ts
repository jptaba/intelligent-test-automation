import { test, expect } from '../../fixtures/auth.fixture';
import { InventoryPage } from '../../pages/InventoryPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';

test.describe('Cart', () => {
  test('added item appears in the cart', async ({ loggedInPage }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.addItemToCartByName('Sauce Labs Backpack');
    await inventory.goToCart();

    const cart = new CartPage(loggedInPage);
    await cart.expectItemCount(1);
    await cart.expectItemPresent('Sauce Labs Backpack');
  });

  test('item can be removed from the cart', async ({ loggedInPage }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.addItemToCartByName('Sauce Labs Backpack');
    await inventory.goToCart();

    const cart = new CartPage(loggedInPage);
    await cart.removeItemByName('Sauce Labs Backpack');
    await cart.expectItemCount(0);
  });

  test('@smoke can complete the full checkout flow', async ({
    loggedInPage,
  }) => {
    const inventory = new InventoryPage(loggedInPage);
    await inventory.addItemToCartByName('Sauce Labs Backpack');
    await inventory.goToCart();

    const cart = new CartPage(loggedInPage);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(loggedInPage);
    await checkout.expectOnStepOne();
    await checkout.fillInfo({
      firstName: 'Test',
      lastName: 'User',
      postalCode: '12345',
    });
    await checkout.continue();
    await checkout.expectOnStepTwo();
    await checkout.finish();
    await checkout.expectOrderComplete();
  });
});
