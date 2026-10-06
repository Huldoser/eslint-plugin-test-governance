// @ts-check
import eslintPlugin from 'eslint-plugin-eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
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
  { files: ['src/rules/**/*.ts'], ...eslintPlugin.configs.rules },
  { files: ['tests/rules/**/*.ts'], ...eslintPlugin.configs.tests },

  // Plain JavaScript: scripts and config files.
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { eqeqeq: 'error', 'prefer-const': 'error' },
  },
);
