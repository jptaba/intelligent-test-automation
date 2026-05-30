---
name: correlate-commits
description: Link test failures to the most likely causative recent commits
---

# Skill: correlate-commits

## Trigger phrases

"what commit broke this", "correlate failures with commits", "which change caused this failure",
"blame the commit", "git blame for this failure"

## What this skill does

Cross-references failing test specs and their corresponding page objects against recent git history
to identify the commit(s) most likely responsible for a failure.

## Steps

1. Load the latest run record:

   ```
   cat test-results/history/<latest>.json
   ```

   Or read `test-results/results.json` for the raw report.

2. Extract the list of failing test titles and their spec files.

3. For each failing spec, identify the **page object(s)** it uses:
   - `tests/auth/` → uses `pages/LoginPage.ts`
   - `tests/inventory/` → uses `pages/InventoryPage.ts`
   - `tests/cart/` → uses `pages/CartPage.ts`, `pages/CheckoutPage.ts`

4. Run git log on the relevant files (spec + page object):

   ```
   git log --oneline -10 tests/<spec>.spec.ts pages/<Page>.ts
   ```

5. For each recent commit that touched these files, retrieve the diff:

   ```
   git show <sha> -- tests/<spec>.spec.ts pages/<Page>.ts
   ```

6. Analyse the diff against the error message from the run record. Look for:
   - Selector changes (data-testid, class, label text)
   - Method renames or signature changes
   - Removed elements or changed flow
   - Dependency version bumps that might affect behaviour

7. Output a structured correlation report:

   ```
   Failing test:  <test title>
   Spec file:     tests/<domain>/<spec>.spec.ts
   Page object:   pages/<Page>.ts

   Most likely commit: <sha> — <message> by <author> (<date>)
   Reason: <explanation of why this diff likely caused the failure>

   Other candidates:
     <sha> — <message> (lower confidence)
   ```

## Important caveats

- This is heuristic analysis, not causal proof.
- Always show the raw commit list alongside your conclusion.
- If no recent commit touches the failing files, the failure may be environmental or a flaky test.
- Use the `flaky-detect` skill to check if the failing test has a history of flipping.
- Recommend a developer reviews the diff before drawing conclusions.

## Useful git commands

```bash
# Log for a specific file with diffs
git log --oneline -15 pages/CartPage.ts

# Show the diff of a specific commit
git show abc1234 -- pages/CartPage.ts

# Find commits that changed a selector pattern
git log -S "data-testid" --oneline

# See all changes since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```
