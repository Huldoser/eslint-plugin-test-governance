import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import testGovernance from '../src/index.ts';
// Plain JS so scripts/pack-smoke.mjs can share it; types are in format.d.mts.
import { formatResults } from './fixtures/format.mjs';

const cwd = path.resolve(import.meta.dirname, 'fixtures/sample-project');
// Run with UPDATE_SNAPSHOTS=1 to rewrite the snapshot after an intended change.
const snapshot = path.resolve(import.meta.dirname, '__snapshots__/sample-project.txt');

// Mirrors fixtures/sample-project/eslint.config.js, but loads the plugin from source.
// scripts/pack-smoke.mjs lints the same project with the real config and the packed tarball.
const config = [
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
  { files: ['tests/unit/**/*.spec.ts'], ...testGovernance.configs.vitest },
  { files: ['tests/jest/**/*.test.js'], ...testGovernance.configs.jest },
] as Linter.Config[];

test('lints the sample project', async () => {
  const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: config });
  const results = await eslint.lintFiles(['tests']);
  const actual = formatResults(results, cwd);
  if (process.env.UPDATE_SNAPSHOTS) writeFileSync(snapshot, actual);
  assert.equal(actual, readFileSync(snapshot, 'utf8'));
});

test('the Playwright config works without options', async () => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
      testGovernance.configs.playwright,
    ] as Linter.Config[],
  });
  const [result] = await eslint.lintFiles(['tests/orders.spec.ts']);
  assert.deepEqual(
    result.messages.map((m) => [m.line, m.ruleId]),
    [
      [7, 'test-governance/require-ticket-in-comments'],
      [12, 'test-governance/require-ticket'],
      [18, 'test-governance/require-ticket'],
      [20, 'test-governance/require-ticket'],
      [23, 'test-governance/marker-matches-state'],
      [24, 'test-governance/require-ticket'],
    ],
  );
});

test('configure() rejects a bad config when the config file loads', () => {
  assert.throws(
    () => testGovernance.configure({ framework: 'playwright', customStates: { x: { when: 'x', marker: 'X' } } }),
    /must be a tag/,
  );
  // A typo fails with a hint instead of being ignored.
  assert.throws(
    () => testGovernance.configure({ framework: 'playwright', lifecycleTag: true } as never),
    /did you mean "lifecycleTags"/,
  );
});
