# STORY-008: Logout and Session Security

## User Story

As a standard user,
I want to be able to log out of the application and have my session properly terminated,
So that my account is protected and no other user can access my session.

## Acceptance Criteria

| ID  | Criterion                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Clicking **Logout** in the hamburger menu redirects the user to the login page (`/`).                                                                                                                                                 |
| AC2 | After logout, attempting to directly navigate to a protected URL (e.g. `/inventory.html`) redirects the user to the login page and shows the error: **"Epic sadface: You can only access '/inventory.html' when you are logged in."** |
| AC3 | After logout, pressing the browser **Back** button does not restore the authenticated session; the user remains on the login page or is redirected back to it.                                                                        |
| AC4 | A logged-in user who directly navigates to `/inventory.html` (without logging out) is not redirected — the page loads normally.                                                                                                       |

## Automation Notes

- Implement tests in `tests/auth/login.spec.ts`.
- Use `LoginPage` from `pages/LoginPage.ts`.
- For AC2: use `page.goto('/inventory.html')` directly after logout and assert the login-error heading text.
- For AC3: use `page.goBack()` after logout and assert the current URL is still `/` (or the error heading appears).
- Credentials come from `data/users.ts` (`USERS.standard`).
- AC1–AC3 use a fresh `test` from `@playwright/test` (no fixture); AC4 can use the `loggedInPage` fixture.

## Related Test Cases

- TC-LOGIN-004
