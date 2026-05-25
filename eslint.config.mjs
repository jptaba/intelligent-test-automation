// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules for all TS files
  ...tseslint.configs.recommended,

  // Playwright-specific rules for spec files
  {
    files: ['tests/**/*.spec.ts'],
    plugins: {
      playwright: playwright,
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Disabled: the Page Object Model intentionally moves assertions into
      // page-object methods (e.g. loginPage.expectOnInventoryPage()). The rule
      // only recognises direct function calls so it fires false positives here.
      'playwright/expect-expect': 'off',
      // Disallow test.only left in committed code
      'playwright/no-focused-test': 'error',
      // Disallow skipped tests without a comment
      'playwright/no-skipped-test': 'warn',
    },
  },

  // TypeScript rules for the whole project
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow `expect` as an unused import — it's the standard Playwright import
      // pattern even when assertions are delegated to page-object methods.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^expect$' }],
    },
  },

  // Files to ignore
  {
    ignores: [
      'node_modules/',
      'playwright-report/',
      'test-results/',
      '.playwright-cli/',
      '.playwright/',
    ],
  },
);
