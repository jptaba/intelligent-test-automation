# TC-LOGIN-001: Successful Login — Standard User

## Objective

Verify that a `standard_user` can log in and land on the inventory page.

## Preconditions

- `.env` is configured with `STANDARD_USER` and `USER_PASSWORD`.
- Application is accessible at `BASE_URL`.

## Test Steps

| #   | Action                                       | Expected Result                                           |
| --- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | Navigate to `BASE_URL`                       | Login page is displayed with username and password fields |
| 2   | Fill username with `USERS.standard.username` | Username field is populated                               |
| 3   | Fill password with `USERS.standard.password` | Password field is populated                               |
| 4   | Click the Login button                       | Page redirects to `/inventory.html`                       |
| 5   | Observe the page                             | "Products" heading is visible                             |

## Expected Automation Implementation

```typescript
// tests/auth/login.spec.ts
test('@smoke standard_user can log in successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(USERS.standard.username, USERS.standard.password);
  await loginPage.expectOnInventoryPage();
});
```

## Automation Notes

- Page Object: `pages/LoginPage.ts`
- Data: `data/users.ts` → `USERS.standard`
- Tag `@smoke` — part of the critical regression path
