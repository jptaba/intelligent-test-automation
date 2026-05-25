# STORY-001: Standard User Login

## User Story

As a registered standard_user,
I want to log in with my credentials,
So that I can access the product inventory.

## Acceptance Criteria

| ID  | Criterion                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- |
| AC1 | The login page displays Username and Password input fields.                                    |
| AC2 | Submitting valid credentials (standard_user / secret_sauce) redirects to `/inventory.html`.    |
| AC3 | The inventory page shows the "Products" heading after login.                                   |
| AC4 | Submitting invalid credentials shows an error containing "Username and password do not match". |
| AC5 | A locked-out user (`locked_out_user`) sees "Sorry, this user has been locked out".             |
| AC6 | Submitting empty credentials shows "Username is required".                                     |

## Automation Notes

- Implement tests in `tests/auth/login.spec.ts`.
- Use `LoginPage` from `pages/LoginPage.ts` — never call raw selectors from the test.
- Credentials come from `data/users.ts` (`USERS.standard`, `USERS.locked`).
- Tag the successful login test with `@smoke` — it is a critical path.

## Related Test Cases

- TC-LOGIN-001 (successful login)
- TC-LOGIN-002 (locked user)
- TC-LOGIN-003 (empty credentials)
