import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../src/index.ts';
import limitRetries from '../../src/rules/limit-retries.ts';
import { runRule, withOptions } from '../helpers.ts';

const excessive = (count = 3, max = 2) => ({
  messageId: 'excessiveRetries' as const,
  data: { count, max },
});

runRule('limit-retries (Playwright)', limitRetries, {
  valid: [
    'test.describe.configure({ retries: 2 });',
    'test.describe.configure({ retries: 0 });',
    'test.describe.configure({ mode: "serial" });',
    'test.describe.configure(options);',
    'test.describe.configure({ retries: importedCount });',
    'const count = 2; test.describe.configure({ retries: count });',
    'const options = { retries: 0 }; test.describe.configure(options);',
    'function helper() { const test = other; test.describe.configure({ retries: 9 }); }',
    'test.describe.configure({ retries: "3" });',
    'test.describe.configure({ retries: -3 });',
    'test.describe.configure({ retries: -unknown });',
    'test.describe.configure({ retries: !enabled });',
    'let count = 9; count = 0; test.describe.configure({ retries: count });',
    'const count = count; test.describe.configure({ retries: count });',
    'test.describe.configure({ retries: 1 + 9 });',
    'test.describe.configure({ retries: true ? 0 : 9 });',
    'const enabled = false; test.describe.configure({ retries: enabled ? 9 : 0 });',
    'expect.poll(check, { intervals: [3, 9] });',
    "import { test } from 'vitest'; test('example', { retry: 9 }, () => {});",
    ...withOptions({ maxRetries: 0 }, ['test.describe.configure({ retries: 0 });']),
    ...withOptions({ maxRetries: 5 }, ['test.describe.configure({ retries: 5 });']),
  ],
  invalid: [
    { code: 'test.describe.configure({ retries: 3 });', errors: [excessive()] },
    { code: 'test.describe.configure({ retries: +3 });', errors: [excessive()] },
    { code: 'const count = 3; test.describe.configure({ retries: +count });', errors: [excessive()] },
    { code: 'const counts = { ci: 3 }; test.describe.configure({ retries: counts.ci });', errors: [excessive()] },
    { code: '// RETRY: EXAMPLE-123\ntest.describe.configure({ retries: 3 });', errors: [excessive()] },
    { code: 'const count = 4; test.describe.configure({ retries: count });', errors: [excessive(4)] },
    { code: 'const options = { retries: 3 }; test.describe.configure(options);', errors: [excessive()] },
    {
      code: 'const retries = enabled ? 3 : 0; test.describe.configure({ retries }); test.describe.configure({ retries });',
      errors: [excessive()],
    },
    { code: 'test.describe.configure({ ...{ retries: 3 } });', errors: [excessive()] },
    { code: 'test.describe.configure({ retries: process.env.CI ? 3 : 0 });', errors: [excessive()] },
    { code: 'const count = enabled ? count : 3; test.describe.configure({ retries: count });', errors: [excessive()] },
    {
      code: 'test.describe.configure({ retries: enabled ? 3 : other ? 4 : unknown });',
      errors: [excessive(), excessive(4)],
    },
    {
      code: "import { test as base } from '@playwright/test'; const check = base.extend({}); check.describe.configure({ retries: 3 });",
      errors: [excessive()],
    },
    ...withOptions({ maxRetries: 0 }, [
      { code: 'test.describe.configure({ retries: 1 });', errors: [excessive(1, 0)] },
    ]),
  ],
});

runRule('limit-retries (Jest)', limitRetries, {
  valid: withOptions({ framework: 'jest' }, [
    'jest.retryTimes(2);',
    'jest.retryTimes();',
    'jest.retryTimes(count);',
    'jest.retryTimes({ count: 9 });',
    'const jest = { retryTimes() {} }; jest.retryTimes(9);',
    'function helper(jest) { jest.retryTimes(9); }',
  ]),
  invalid: withOptions({ framework: 'jest' }, [
    { code: 'jest.retryTimes(3);', errors: [excessive()] },
    { code: 'if (process.env.CI) jest.retryTimes(4, { logErrorsBeforeRetry: true });', errors: [excessive(4)] },
    { code: "import { jest as runner } from '@jest/globals'; runner.retryTimes(3);", errors: [excessive()] },
    { code: "import * as runner from '@jest/globals'; runner.jest.retryTimes(3);", errors: [excessive()] },
    { code: 'jest.retryTimes.call(null, 3);', errors: [excessive()] },
  ]),
});

runRule('limit-retries (Vitest)', limitRetries, {
  valid: withOptions({ framework: 'vitest' }, [
    "test('example', { retry: 2 }, () => {});",
    "test('example', { retry: { count: 2, delay: 99 } }, () => {});",
    "test('example', { retry: { delay: 99 } }, () => {});",
    "test('example', { retry: { runMode: 99 } }, () => {});",
    "test('example', { retry: unknown }, () => {});",
    "test('example', { retry: false }, () => {});",
    "test('example', { retry: { ...unknown } }, () => {});",
    "test('example', { retry: { count: 9, ...unknown } }, () => {});",
    "const policy = { count: 9 }; policy.count = 0; test('example', { retry: policy }, () => {});",
  ]),
  invalid: withOptions({ framework: 'vitest' }, [
    { code: "test('example', { retry: 3 }, () => {});", errors: [excessive()] },
    { code: "describe('example', { retry: { count: 4, delay: 99 } }, () => {});", errors: [excessive(4)] },
    { code: "const retry = { count: 3 }; test('example', { retry }, () => {});", errors: [excessive()] },
    { code: "test('example', { retry: enabled ? { count: 3 } : { count: 0 } }, () => {});", errors: [excessive()] },
    { code: "const options = { retry: 3 }; test.each([1])('example %i', options, () => {});", errors: [excessive()] },
    { code: "(enabled ? test : test.skip)('example', { retry: 3 }, () => {});", errors: [excessive()] },
  ]),
});

for (const framework of ['mocha', 'cypress', 'webdriverio'] as const) {
  runRule(`limit-retries (${framework})`, limitRetries, {
    valid: withOptions({ framework }, [
      "it('example', function () { this.retries(2); });",
      "it('example', () => { this.retries(9); });",
      'function helper() { this.retries(9); }',
      "it('example', function () {}).retries(2);",
      'other.retries(9);',
      'helper().retries(9);',
      "it('example', function () {}).retries();",
      'function helper() { const it = other; it("example", () => {}).retries(9); }',
    ]),
    invalid: withOptions({ framework }, [
      { code: "it('example', function () { this.retries(3); });", errors: [excessive()] },
      { code: "describe('example', function () { this.retries(3); });", errors: [excessive()] },
      { code: 'beforeEach(function () { this.retries(3); });', errors: [excessive()] },
      { code: "it('example', function () {}).retries(3);", errors: [excessive()] },
      {
        code: "import { it as check } from 'mocha'; check('example', function () {}).retries(3);",
        errors: [excessive()],
      },
    ]),
  });
}

runRule('limit-retries (Cypress options)', limitRetries, {
  valid: withOptions({ framework: 'cypress' }, [
    "it('example', { retries: { runMode: 2, openMode: 0 } }, () => {});",
    "it('example', { retries: { count: 99 } }, () => {});",
  ]),
  invalid: withOptions({ framework: 'cypress' }, [
    { code: "it('example', { retries: 3 }, () => {});", errors: [excessive()] },
    { code: "describe('example', { retries: { runMode: 4, openMode: 0 } }, () => {});", errors: [excessive(4)] },
    { code: "it('example', { retries: { runMode: 3, openMode: 4 } }, () => {});", errors: [excessive(), excessive(4)] },
    {
      code: "const retries = { ...unknown, runMode: 3 }; it('example', { retries }, () => {});",
      errors: [excessive()],
    },
  ]),
});

for (const framework of ['node-test', 'jasmine'] as const) {
  runRule(`limit-retries (${framework})`, limitRetries, {
    valid: withOptions({ framework }, [
      "test('example', { retries: 9 }, () => {});",
      'jest.retryTimes(9);',
      "it('example', function () { this.retries(9); });",
    ]),
    invalid: [],
  });
}

it('keeps limit-retries off in every preset and independent of retry tickets', () => {
  const linter = new Linter();
  for (const config of Object.values(plugin.configs)) {
    assert.equal(config.rules['test-governance/limit-retries'], 'off');
  }
  const config = plugin.configure({ framework: 'jest', maxRetries: 1 });
  assert.deepEqual(linter.verify('jest.retryTimes(3);', config), []);
  config.rules['test-governance/limit-retries'] = 'error';
  const reports = linter.verify('jest.retryTimes(3);', config);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'excessiveRetries');
  assert.equal(reports[0].message, 'This retry count of 3 exceeds the configured maximum of 1.');
  const tracked = plugin.configure({ framework: 'jest', maxRetries: 1, states: { retry: true } });
  tracked.rules['test-governance/limit-retries'] = 'error';
  const both = linter.verify('// RETRY: EXAMPLE-123\njest.retryTimes(3);', tracked);
  assert.equal(both.length, 1);
  assert.equal(both[0].ruleId, 'test-governance/limit-retries');
  const untracked = linter.verify('jest.retryTimes(3);', tracked);
  assert.deepEqual(untracked.map((report) => report.ruleId).sort(), [
    'test-governance/limit-retries',
    'test-governance/require-ticket',
  ]);
});
