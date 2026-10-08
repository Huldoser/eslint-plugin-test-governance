// The same config as eslint.config.js, written the CommonJS way: `require()` the plugin, register it
// under `plugins` and extend a config that registers it too. pack-smoke lints with both files.
const { defineConfig } = require('eslint/config');
const tsParser = require('@typescript-eslint/parser');
const testGovernance = require('eslint-plugin-test-governance');

module.exports = defineConfig([
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    plugins: { 'test-governance': testGovernance },
    extends: [
      testGovernance.configure({
        ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
        lifecycleTags: true,
        customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } },
      }),
    ],
  },
  { files: ['tests/unit/**/*.spec.ts'], extends: [testGovernance.configs.vitest] },
  { files: ['tests/jest/**/*.test.js'], extends: [testGovernance.configs.jest] },
]);
