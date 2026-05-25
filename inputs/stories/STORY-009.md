# STORY-009: Performance Glitch User Login

## User Story
As a QA engineer,
I want to verify that the performance_glitch_user can still log in successfully despite the intentional login delay,
So that I can ensure the application is resilient to slow network or server conditions when given sufficient timeout.

## Acceptance Criteria

| ID  | Criterion |
|-----|-----------|
| AC1 | `performance_glitch_user` can log in using the standard credentials (`secret_sauce`). |
| AC2 | Login with `performance_glitch_user` takes noticeably longer than a standard user login (the default 5 s action timeout elapses, but the login ultimately succeeds). |
| AC3 | After the delayed login, the user lands on `/inventory.html` and sees the full product listing — the same page shown to `standard_user`. |
| AC4 | `standard_user` login completes in under 2 seconds (baseline assertion to contrast with the glitch user). |

## Automation Notes

- Implement tests in `tests/auth/login.spec.ts`.
- Use `LoginPage` from `pages/LoginPage.ts`.
- Credentials come from `data/users.ts` (`USERS.standard` and `USERS.performanceGlitch` — add `performanceGlitch` to the `USERS` map in `data/users.ts`).
- Use a test-level `timeout` override or `navigationTimeout` increase when testing `performance_glitch_user` to prevent flakiness.
- For AC2, capture the wall-clock duration using `Date.now()` before and after the login action.
- Do **not** tag with `@smoke`; this is a non-critical performance check.

## Related Test Cases

- TC-LOGIN-005
