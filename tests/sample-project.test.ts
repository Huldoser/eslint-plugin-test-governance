import path from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import testGovernance from '../src/index.js';
// @ts-expect-error plain JS helper shared with scripts/pack-smoke.mjs
import { formatResults } from './fixtures/format.mjs';

const cwd = path.resolve(import.meta.dirname, 'fixtures/sample-project');

// Mirrors fixtures/sample-project/eslint.config.js, but loads the plugin from source.
// scripts/pack-smoke.mjs lints the same project with the real config and the packed tarball.
const config = [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      ticket: { preset: 'jira', projects: ['WEB', 'QA'] },
      lifecycleTags: true,
      customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } },
    }),
  },
] as Linter.Config[];

test('lints the sample project', async () => {
  const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: config });
  const results = await eslint.lintFiles(['tests']);
  await expect(formatResults(results, cwd)).toMatchFileSnapshot('__snapshots__/sample-project.txt');
});

test('the recommended config works without options', async () => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [{ files: ['**/*.ts'], languageOptions: { parser: tsParser } }, testGovernance.configs.recommended] as Linter.Config[],
  });
  const [result] = await eslint.lintFiles(['tests/checkout.spec.ts']);
  expect(result.messages.map((m) => [m.line, m.ruleId])).toEqual([
    [10, 'test-governance/require-ticket'],
    [16, 'test-governance/require-ticket'],
    [18, 'test-governance/require-ticket'],
    [21, 'test-governance/marker-matches-state'],
    [22, 'test-governance/require-ticket'],
  ]);
});

test('configure() rejects a bad config when the config file loads', () => {
  expect(() => testGovernance.configure({ customStates: { x: { when: 'x', marker: 'X' } } })).toThrow(/must be a tag/);
});
