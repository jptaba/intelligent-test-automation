# STORY-007: Checkout Form Validation

## User Story

As a standard user,
I want to see a clear error message when I submit the checkout form with missing information,
So that I know exactly what I need to fix before I can proceed.

## Acceptance Criteria

| ID  | Criterion                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Clicking **"Continue"** on `/checkout-step-one.html` with all fields empty displays the error: **"Error: First Name is required"**. |
| AC2 | Filling in First Name only and clicking **"Continue"** displays the error: **"Error: Last Name is required"**.                      |
| AC3 | Filling in First Name and Last Name only and clicking **"Continue"** displays the error: **"Error: Postal Code is required"**.      |
| AC4 | Each error appears as a heading at the top of the form and each field gains a visual error indicator (red border / error icon).     |
| AC5 | After correcting all required fields and clicking **"Continue"**, the user proceeds to `/checkout-step-two.html` without any error. |
| AC6 | Clicking **"Cancel"** on the checkout form returns the user to `/cart.html` without submitting the form.                            |

## Automation Notes

- Implement tests in `tests/cart/cart.spec.ts`.
- Use `CheckoutPage` from `pages/CheckoutPage.ts`.
- The `fillInfo` method already exists; a negative variant that submits with blank/partial data will need a new method or inline assertion.
- Credentials come from `data/users.ts` (`USERS.standard`).
- Use the `loggedInPage` fixture from `fixtures/auth.fixture.ts`; add an item to the cart before navigating to checkout.

## Related Test Cases

- TC-CHECKOUT-002
