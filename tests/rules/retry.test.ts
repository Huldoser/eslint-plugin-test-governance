import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

const retry = { states: { retry: true } } as const;

const missing = (subject: string) => ({
  messageId: 'missingMarker' as const,
  data: { subject, state: 'retry', marker: 'RETRY', example: 'PROJ-123' },
});

runRule('require-ticket (retry, Playwright)', requireTicket, {
  valid: [
    // The state is off by default.
    "test.describe('orders', () => {\n  test.describe.configure({ retries: 2 });\n});",
    ...withOptions(retry, [
      "test.describe('orders', () => {\n  // RETRY: TRADE-1\n  test.describe.configure({ retries: 2 });\n  test('places an order', async () => {});\n});",
      "// RETRY: TRADE-1\ntest.describe('orders', () => {\n  test.describe.configure({ retries: 2 });\n});",
      // No retries, or a configure call about something else.
      "test.describe.configure({ retries: 0 });\ntest.describe.configure({ mode: 'serial' });",
      // Options the file can't read are left alone, as unreadable tags are.
      'test.describe.configure(options);',
      'const options = { retries: 0 };\ntest.describe.configure(options);',
    ]),
  ],
  invalid: withOptions(retry, [
    {
      code: "test.describe('orders', () => {\n  test.describe.configure({ retries: 2 });\n});",
      errors: [{ ...missing('This configure call'), line: 2 }],
    },
    // Retries only on CI are how a flaky test hides there, so they need the ticket too.
    {
      code: 'test.describe.configure({ retries: process.env.CI ? 2 : 0 });',
      errors: [missing('This configure call')],
    },
    {
      code: "test.describe.configure({ mode: 'serial', retries: RETRIES });",
      errors: [missing('This configure call')],
    },
    // Options in a constant or a spread, and `describe` taken from `test`, are read too.
    {
      code: 'const options = { retries: 2 };\ntest.describe.configure(options);',
      errors: [{ ...missing('This configure call'), line: 2 }],
    },
    { code: 'test.describe.configure({ ...{ retries: 2 } });', errors: [missing('This configure call')] },
    {
      code: "import { test } from '@playwright/test';\nconst { describe } = test;\ndescribe.configure({ retries: 2 });",
      errors: [{ ...missing('This configure call'), line: 3 }],
    },
  ]),
});

runRule('require-ticket (retry, Jest)', requireTicket, {
  valid: withOptions({ framework: 'jest', ...retry }, [
    "// RETRY: TRADE-1\njest.retryTimes(3);\ntest('places an order', () => {});",
    "// RETRY: TRADE-1\ndescribe('orders', () => {\n  jest.retryTimes(3, { logErrorsBeforeRetry: true });\n});",
    "import { jest } from '@jest/globals';\n// RETRY: TRADE-1\njest.retryTimes(3);",
    'jest.retryTimes(0);',
    // A `jest` the file declares itself is not Jest's.
    'const jest = { retryTimes() {} };\njest.retryTimes(3);',
  ]),
  invalid: withOptions({ framework: 'jest', ...retry }, [
    {
      code: "jest.retryTimes(3);\ntest('places an order', () => {});",
      errors: [{ ...missing('This retryTimes call'), line: 1 }],
    },
    {
      code: "describe('orders', () => {\n  if (process.env.CI) jest.retryTimes(3);\n});",
      errors: [missing('This retryTimes call')],
    },
  ]),
});

runRule('require-ticket (retry, Vitest)', requireTicket, {
  valid: withOptions({ framework: 'vitest', ...retry }, [
    "// RETRY: TRADE-1\ntest('places an order', { retry: 3 }, () => {});",
    "// RETRY: TRADE-1\ndescribe('orders', { retry: 3 }, () => {\n  test('places an order', () => {});\n});",
    "test('places an order', { retry: 0 }, () => {});\ntest('cancels an order', { retry: { count: 0 } }, () => {});",
  ]),
  invalid: withOptions({ framework: 'vitest', ...retry }, [
    { code: "test('places an order', { retry: 3 }, () => {});", errors: [missing('This test')] },
    { code: "test('places an order', { retry: { count: 2, delay: 100 } }, () => {});", errors: [missing('This test')] },
    // An object whose count can't be read may retry.
    { code: "test('places an order', { retry: { [key]: 2 } }, () => {});", errors: [missing('This test')] },
    {
      code: "describe('orders', { retry: process.env.CI ? 2 : 0 }, () => {});",
      errors: [missing('This describe block')],
    },
  ]),
});

runRule('require-ticket (retry, Mocha and Cypress)', requireTicket, {
  valid: [
    ...withOptions({ framework: 'mocha', ...retry }, [
      "describe('orders', function () {\n  // RETRY: TRADE-1\n  this.retries(2);\n  it('places an order', () => {});\n});",
      "// RETRY: TRADE-1\ndescribe('orders', function () {\n  this.retries(2);\n});",
      "it('places an order', function () {\n  this.retries(0);\n});",
      // An arrow function has no suite or test as its `this`.
      "describe('orders', () => {\n  this.retries(2);\n});",
    ]),
    ...withOptions({ framework: 'cypress', ...retry }, [
      "// RETRY: TRADE-1\nit('places an order', { retries: 2 }, () => {});",
      "it('places an order', { retries: { runMode: 0, openMode: 0 } }, () => {});",
    ]),
  ],
  invalid: [
    ...withOptions({ framework: 'mocha', ...retry }, [
      {
        code: "describe('orders', function () {\n  this.retries(2);\n});",
        errors: [{ ...missing('This retries call'), line: 2 }],
      },
      {
        code: "it('places an order', function () {\n  this.retries(2);\n});",
        errors: [missing('This retries call')],
      },
    ]),
    ...withOptions({ framework: 'cypress', ...retry }, [
      { code: "it('places an order', { retries: 2 }, () => {});", errors: [missing('This test')] },
      {
        code: "describe('orders', { retries: { runMode: 2, openMode: 0 } }, () => {});",
        errors: [missing('This describe block')],
      },
    ]),
  ],
});

runRule('require-ticket (retry, node:test and Jasmine)', requireTicket, {
  // Neither has a retry of its own, so the state never applies.
  valid: [
    ...withOptions({ framework: 'node-test', ...retry }, [
      "import { test } from 'node:test';\ntest('places an order', { retries: 2 }, () => {});",
    ]),
    ...withOptions({ framework: 'jasmine', ...retry }, ["it('places an order', () => {});"]),
  ],
  invalid: [],
});

runRule('no-orphaned-marker (retry)', noOrphanedMarker, {
  valid: withOptions(retry, [
    "// RETRY: TRADE-1\ntest.describe('orders', () => {\n  test.describe.configure({ retries: 2 });\n});",
  ]),
  invalid: withOptions(retry, [
    {
      code: "// RETRY: TRADE-1\ntest('places an order', async () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'RETRY', state: 'retry', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('places an order', async () => {});" }],
        },
      ],
    },
  ]),
});
