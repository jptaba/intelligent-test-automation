# STORY-004: View Product Detail Page and Add to Cart

## User Story

As a shopper,
I want to click on a product to view its full detail page and add it to my cart from there,
So that I can review the product information before making a purchase decision.

## Acceptance Criteria

| ID  | Criterion                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Clicking a product name or image on the inventory page navigates to the product's detail page (URL: `/inventory-item.html?id=<id>`).  |
| AC2 | The detail page displays the product name, description, price, and a product image.                                                   |
| AC3 | The detail page has an **"Add to cart"** button. Clicking it adds the item to the cart and the cart badge count increments to **1**.  |
| AC4 | After adding to cart, the button label changes to **"Remove"**. Clicking **"Remove"** removes the item and the cart badge disappears. |
| AC5 | The **"Back to products"** button returns the user to the inventory page (`/inventory.html`).                                         |

## Automation Notes

- Implement tests in `tests/inventory/inventory.spec.ts`.
- `InventoryPage` already supports `addItemToCartByName` and `getCartCount`.
- A new `goToProductDetail(productName: string)` method may be needed on `InventoryPage`.
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.
- Tag the "add from detail page" scenario with `@smoke`.

## Related Test Cases

- TC-INVENTORY-003
