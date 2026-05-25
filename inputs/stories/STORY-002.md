# STORY-002: Sort Products by Name

## User Story
As a shopper,
I want to sort the product list alphabetically by name (A–Z or Z–A),
So that I can browse products in a predictable order.

## Acceptance Criteria

| ID  | Criterion |
|-----|-----------|
| AC1 | The default sort on the inventory page is **Name (A to Z)** and products are displayed in ascending alphabetical order. |
| AC2 | When I select **"Name (Z to A)"** from the sort dropdown, products are immediately re-ordered in descending alphabetical order. |
| AC3 | When I select **"Name (A to Z)"** from the sort dropdown, products return to ascending alphabetical order. |
| AC4 | Product count remains the same (6 items) after changing sort direction. |

## Automation Notes

- Implement tests in `tests/inventory/inventory.spec.ts`.
- Use `InventoryPage` from `pages/InventoryPage.ts`; the `sortBy` and `getProductNames` methods are already available.
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`.
- Tag the A-Z default-sort check with `@smoke`.

## Related Test Cases

- TC-INVENTORY-001
