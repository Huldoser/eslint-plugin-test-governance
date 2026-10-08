import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
      lifecycleTags: true,
      customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } },
    }),
  },
  // Unit tests run on Vitest and Jest. These configs set the framework and keep the options above.
  { files: ['tests/unit/**/*.spec.ts'], ...testGovernance.configs.vitest },
  { files: ['tests/jest/**/*.test.js'], ...testGovernance.configs.jest },
];
