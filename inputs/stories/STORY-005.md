# STORY-005: Empty Cart Edge Case

## User Story
As a QA engineer,
I want to understand the application's behaviour when a user initiates checkout with an empty cart,
So that I can document the current state and raise a defect if needed.

## Acceptance Criteria

| ID  | Criterion |
|-----|-----------|
| AC1 | When the cart has no items, the cart page displays an empty items list (no product rows, only QTY/Description column headers are visible). |
| AC2 | The **"Checkout"** button is present and clickable even when the cart is empty. |
| AC3 | Proceeding through checkout with an empty cart results in step two showing **Item total: $0**, **Tax: $0.00**, and **Total: $0.00**. |
| AC4 | The user can complete an empty cart order; the confirmation page displays **"Thank you for your order!"** (this is the current SauceDemo behaviour — **tracked as a known defect**). |

> **Note:** AC4 represents a known limitation of SauceDemo. In a production app, the "Checkout" button should be disabled or show a validation error when the cart is empty.

## Automation Notes

- Implement tests in `tests/cart/cart.spec.ts`.
- Use `CartPage` and `CheckoutPage` from `pages/`.
- Cart can be emptied via **Reset App State** (hamburger menu) after logging in, rather than removing items one by one. Alternatively start with a fresh `loggedInPage` fixture (cart is always empty at fixture start).
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.

## Related Test Cases

- TC-CART-002
