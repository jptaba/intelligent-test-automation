# TC-CHECKOUT-001: Complete Checkout Flow

## Objective

Verify a logged-in standard_user can add a product and complete a full order.

## Preconditions

- User is authenticated (use `loggedInPage` fixture).
- At least one product is available on the inventory page.

## Test Steps

| #   | Action                                                 | Expected Result                         |
| --- | ------------------------------------------------------ | --------------------------------------- |
| 1   | Log in as standard_user                                | Inventory page is displayed             |
| 2   | Add "Sauce Labs Backpack" to cart                      | Cart badge shows "1"                    |
| 3   | Click the cart icon                                    | Cart page loads with 1 item             |
| 4   | Click Checkout                                         | Checkout step one loads                 |
| 5   | Fill: First Name="Test", Last Name="User", Zip="12345" | Fields are populated                    |
| 6   | Click Continue                                         | Checkout step two (order summary) loads |
| 7   | Click Finish                                           | Order complete page loads               |
| 8   | Observe completion message                             | "Thank you for your order" is visible   |

## Automation Notes

- Uses `loggedInPage` fixture from `fixtures/auth.fixture.ts`.
- Page Objects: `InventoryPage`, `CartPage`, `CheckoutPage`
- Test lives in `tests/cart/cart.spec.ts`
- Tag `@smoke` — end-to-end critical path
