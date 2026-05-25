# STORY-010: Reset App State Clears Cart

## User Story
As a standard user,
I want to use "Reset App State" from the hamburger menu to clear my cart,
So that I can start a fresh shopping session without having to remove items one by one.

## Acceptance Criteria

| ID  | Criterion |
|-----|-----------|
| AC1 | After adding one or more items to the cart, clicking **"Reset App State"** from the hamburger menu removes all items — the cart badge disappears from the header. |
| AC2 | Navigating to `/cart.html` after a reset shows an empty cart (no product rows). |
| AC3 | After a reset, the inventory page still shows all 6 products and sorting still works. |
| AC4 | After a reset, a full checkout flow can be started fresh (add new items → cart → checkout). |

> **Known behaviour:** After clicking Reset App State, the **"Add to cart" / "Remove"** button labels on the inventory page may not immediately refresh (the UI can appear stale). The actual cart data is cleared — confirmed by navigating to `/cart.html`. This is a known SauceDemo UI quirk.

## Automation Notes

- Implement tests in `tests/inventory/inventory.spec.ts` or `tests/cart/cart.spec.ts`.
- Use `InventoryPage` and `CartPage` from `pages/`.
- A new `resetAppState()` helper method may be needed on `InventoryPage` (opens menu → clicks Reset App State → closes menu).
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.

## Related Test Cases

- TC-CART-003
