// @ts-check
import { defineConfig } from 'eslint/config';
import eslintPlugin from 'eslint-plugin-eslint-plugin';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'tests/fixtures/'] },

  // TypeScript sources and tests, with type information.
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: 'error',
      'no-console': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // AST checks compare `node.type` with string literals, the convention for ESLint plugins. Comparing
      // with typescript-eslint's runtime enum instead would make it a runtime dependency.
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      // Template literals in messages interpolate numbers and booleans on purpose.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      // node:test returns promises from describe() and it(), and the runner awaits them itself.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['describe', 'it', 'test'] }],
        },
      ],
    },
  },

  // Rule implementations follow ESLint's own conventions for plugins.
  {
    files: ['src/rules/**/*.ts'],
    extends: [eslintPlugin.configs.rules],
    rules: {
      // Descriptions start with a capital, as ESLint's own rules do: "Require ...".
      'eslint-plugin/require-meta-docs-description': ['error', { pattern: '^(Enforce|Require|Disallow) ' }],
      // `recommended` holds the severity the recommended config uses.
      'eslint-plugin/require-meta-docs-recommended': ['error', { allowNonBoolean: true }],
      'eslint-plugin/require-meta-docs-url': [
        'error',
        { pattern: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/{{name}}.md' },
      ],
      // Messages are sentences: they start with a capital letter, a quote or a placeholder and end with a full stop.
      'eslint-plugin/report-message-format': ['error', "^[A-Z`'{].*\\.$"],
      // With `meta.languages`, ESLint 10 rejects a config that applies these rules to JSON, Markdown or CSS
      // files, as `configs.recommended` without `files` does. The rules already skip other languages.
      'eslint-plugin/require-meta-languages': 'off',
    },
  },
  { files: ['tests/rules/**/*.ts'], extends: [eslintPlugin.configs.tests] },

  // Plain JavaScript: scripts and config files.
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { eqeqeq: 'error', 'prefer-const': 'error' },
  },
);
