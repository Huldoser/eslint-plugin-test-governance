import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      framework: 'playwright',
      ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
      lifecycleTags: true,
      customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } },
    }),
  },
  // Unit tests run on Vitest, Jest, Mocha, node:test and Jasmine, and the UI tests on Cypress. These configs set the framework
  // and keep the options above.
  { files: ['tests/unit/**/*.spec.ts'], ...testGovernance.configs.vitest },
  { files: ['tests/jest/**/*.test.js'], ...testGovernance.configs.jest },
  { files: ['tests/mocha/**/*.test.js'], ...testGovernance.configs.mocha },
  { files: ['tests/cypress/**/*.cy.js'], ...testGovernance.configs.cypress },
  { files: ['tests/node/**/*.test.js'], ...testGovernance.configs['node-test'] },
  { files: ['tests/jasmine/**/*.spec.js'], ...testGovernance.configs.jasmine },
];
