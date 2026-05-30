---
name: coverage-gaps
description: Identify user stories that have no corresponding test spec coverage
---

# Skill: coverage-gaps

## Trigger phrases

"coverage gaps", "untested stories", "which stories have no tests", "find missing coverage",
"story coverage", "what's not tested"

## What this skill does

Cross-references story files in `inputs/stories/` against all spec files in `tests/`.
Flags stories that are not referenced by any spec file.

## Linking convention

To explicitly link a spec file to a story, add a comment anywhere in the spec:

```typescript
// covers: STORY-001
```

The script also detects the story ID anywhere in spec file content (e.g., in `describe` blocks,
comments, or test titles).

## Steps

1. Run the coverage gap script:

   ```
   npm run coverage:gaps
   ```

2. Read results from `test-results/coverage-gaps.json`.

3. Present the report:

   ```
   ## Story Coverage Report

   ✓ Covered stories (N):
   [STORY-001] User can log in with valid credentials
               → tests/auth/login.spec.ts

   ✗ Uncovered stories (N) — ACTION REQUIRED:
   [STORY-007] User can apply coupon code at checkout
               inputs/stories/STORY-007.md
               → Add "// covers: STORY-007" to the relevant spec file, or create a new spec
   ```

4. For each uncovered story:
   - Read the story file to understand what needs to be tested
   - Suggest the appropriate test domain (`tests/auth/`, `tests/inventory/`, `tests/cart/`)
   - Offer to create the spec file using the project conventions

## Story-to-domain mapping

| Story topic                                   | Test domain        | Relevant page objects            |
| --------------------------------------------- | ------------------ | -------------------------------- |
| Login, authentication, locked users           | `tests/auth/`      | `LoginPage.ts`                   |
| Product listing, sorting, search, cart add    | `tests/inventory/` | `InventoryPage.ts`               |
| Cart management, checkout, order confirmation | `tests/cart/`      | `CartPage.ts`, `CheckoutPage.ts` |

## When asked to close a gap

1. Read the story file: `cat inputs/stories/STORY-XXX.md`
2. Identify the acceptance criteria / test scenarios
3. Check if any page object methods already cover the required actions
4. If not, extend the page object first, then write the spec
5. Add `// covers: STORY-XXX` at the top of the spec file
6. Run `npm run coverage:gaps` again to confirm the gap is closed

## Project file naming convention

```
tests/<domain>/<feature>.spec.ts    e.g. tests/cart/coupon.spec.ts
```
