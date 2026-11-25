import rule from '../../src/rules/require-ticket-for-serial-groups.ts';
import { runRule, withOptions } from '../helpers.ts';

runRule('Playwright serial groups', rule, {
  valid: [
    "test.describe('orders', () => {});",
    "test.describe.parallel('orders', () => {});",
    "test.describe.configure({ mode: 'default', retries: 2 });",
    "test.describe.configure({ mode: 'serial', ...defaults });",
    "test.describe.configure({ mode: 'serial', mode: 'parallel' });",
    'test.describe.configure({ mode });',
    "test['describe.configure']({ mode: 'serial' }); test.describe['serial.only'](() => {});",
    'test.describe.serial.other(() => {}); test.describe.serial.only.other(() => {});',
    "const runner = makeRunner(); runner.describe.serial('orders', () => {});",
    "function setup() { const test = makeRunner(); test.describe.configure({ mode: 'serial' }); }",
    "// SERIAL: EXAMPLE-12, EXAMPLE-34\ntest.describe.serial('orders', () => {});",
    "/*\n * SERIAL: EXAMPLE-12\n */\ntest.describe.configure({ mode: 'serial' });",
    ...withOptions({ allowNotes: true, allowBlankLine: true, ticket: { preset: 'github' } }, [
      "// SERIAL: #123 shared fixture\n\ntest.describe.serial('orders', () => {});",
    ]),
    ...withOptions({ framework: 'vitest' }, [
      "describe.sequential('orders', () => {}); test.describe.configure({ mode: 'serial' });",
    ]),
  ],
  invalid: [
    {
      code: "test.describe.serial('orders', () => { test('setup', () => {}); test('verify', () => {}); });",
      errors: [{ messageId: 'missingTicket', line: 1 }],
    },
    {
      code: "import { test as base } from '@playwright/test'; const test = base.extend({}); test.describe.serial.only(() => {});",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: "const { describe } = test; const serial = describe.serial; serial('orders', () => {});",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: "test['describe']['serial'].only(() => {});",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: "const { describe } = test; const mode = 'serial'; const config = { mode }; describe.configure(config);",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: "const opts = { mode: 'serial' }; test.describe.configure({ ...opts, retries: 1 });",
      errors: [{ messageId: 'missingTicket' }],
    },
    ...withOptions({ testFunctions: ['spec'] }, [
      {
        code: 'spec.describe.serial(() => {});',
        errors: [{ messageId: 'missingTicket' }],
      },
    ]),
    {
      code: "// SERIAL: EXAMPLE-12\ntest.describe('orders', () => {\n  test.describe.configure({ mode: 'serial' });\n});",
      errors: [{ messageId: 'missingTicket', line: 3 }],
    },
    {
      code: '// SERIAL: EXAMPLE-12\n// test.describe.serial(() => {});\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'missingTicket', line: 3 }],
    },
    {
      code: '// SERIAL: EXAMPLE-12\n\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'missingTicket', line: 3 }],
    },
    {
      code: '// SERIAL:\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'missingTicket', line: 1 }],
    },
    {
      code: '// Serial: EXAMPLE-12\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'markerCase', data: { marker: 'SERIAL' }, line: 1 }],
    },
    {
      code: '// SERIAL: TBD\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'placeholderTicket', line: 1 }],
    },
    {
      code: '// SERIAL: example\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'invalidTicket', line: 1 }],
    },
    {
      code: '// SERIAL: EXAMPLE-12 shared fixture\ntest.describe.serial(() => {});',
      errors: [{ messageId: 'extraText', data: { marker: 'SERIAL' }, line: 1 }],
    },
  ],
});
