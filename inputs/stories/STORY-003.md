# STORY-003: Sort Products by Price

## User Story

As a shopper,
I want to sort the product list by price (lowest first or highest first),
So that I can quickly find items within my budget or discover premium products.

## Acceptance Criteria

| ID  | Criterion                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | When I select **"Price (low to high)"** from the sort dropdown, products are displayed with the cheapest item first (currently Sauce Labs Onesie at $7.99).               |
| AC2 | When I select **"Price (high to low)"** from the sort dropdown, products are displayed with the most expensive item first (currently Sauce Labs Fleece Jacket at $49.99). |
| AC3 | Product count remains the same (6 items) after changing sort direction.                                                                                                   |
| AC4 | Switching between price sort options immediately re-renders the product list without a page reload.                                                                       |

## Automation Notes

- Implement tests in `tests/inventory/inventory.spec.ts`.
- Use `InventoryPage` from `pages/InventoryPage.ts`; the `sortBy` and `getProductNames` methods are already available.
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.
- Product prices are available in `data/products.ts`.

## Related Test Cases

- TC-INVENTORY-002
