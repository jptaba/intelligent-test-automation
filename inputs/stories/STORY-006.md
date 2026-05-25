# STORY-006: Complete Checkout Happy Path

## User Story

As a standard user,
I want to add items to my cart and complete the full checkout flow with valid information,
So that I can successfully place an order.

## Acceptance Criteria

| ID  | Criterion                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | After adding one or more items to the cart, navigating to `/cart.html` displays each item with its name, quantity, and price.                                                |
| AC2 | Clicking **"Checkout"** from the cart page navigates to `/checkout-step-one.html` ("Checkout: Your Information").                                                            |
| AC3 | Filling in a valid First Name, Last Name, and Zip/Postal Code, then clicking **"Continue"**, navigates to `/checkout-step-two.html` ("Checkout: Overview").                  |
| AC4 | The overview page lists all ordered items with correct quantities and prices.                                                                                                |
| AC5 | The overview page shows: **Payment Information: SauceCard #31337**, **Shipping Information: Free Pony Express Delivery!**, correct item subtotal, tax (8%), and grand total. |
| AC6 | Clicking **"Finish"** navigates to `/checkout-complete.html` and displays the heading **"Thank you for your order!"**.                                                       |
| AC7 | After completing the order the cart badge is no longer visible.                                                                                                              |
| AC8 | Clicking **"Back Home"** on the confirmation page returns the user to `/inventory.html` with an empty cart.                                                                  |

## Automation Notes

- Implement tests in `tests/cart/cart.spec.ts`.
- Uses `InventoryPage`, `CartPage`, and `CheckoutPage`.
- Credentials come from `data/users.ts` (`USERS.standard`).
- Product data (names, prices) come from `data/products.ts`.
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.
- Tag this scenario with `@smoke` — it is a critical path.

## Related Test Cases

- TC-CHECKOUT-001
