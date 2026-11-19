import limitRetries from '../../src/rules/limit-retries.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

const bun = { framework: 'bun' as const };
const requireConditional = { ...bun, requireTicketForConditional: true };
const missing = { messageId: 'missingMarker' as const };

runRule('Bun test states', requireTicket, {
  valid: [
    ...withOptions(bun, [
      "import { test } from 'bun:test'; test.skipIf(false)('active', () => {});",
      "import { test } from 'bun:test'; test.if(true)('active', () => {});",
      "import { test } from '@jest/globals'; test.skip('outside configured runner', () => {});",
      "import { test } from 'vitest'; test.todo('outside configured runner');",
      "import { test } from 'bun:test'; function helper(test) { test.skip('shadowed', () => {}); }",
      "test.todoIf(false)('active', () => {});",
      "// SKIP: EXAMPLE-1\nit.skip('with a ticket');",
      "// TODO: EXAMPLE-2\nit.todo('with a ticket');",
      "test.only('focused', () => {});",
    ]),
    ...withOptions({ framework: 'jest' }, [
      "import { test } from 'bun:test'; test.skip('outside configured runner', () => {});",
    ]),
    ...withOptions({ ...bun, states: { retry: true } }, [
      "test('no retries', () => {}, { retry: 0 });",
      "test('repeated', () => {}, { repeats: 3 });",
    ]),
  ],
  invalid: [
    ...withOptions(bun, [
      { code: "import { test as check } from 'bun:test'; check.skip('missing');", errors: [missing] },
      { code: "import * as bun from 'bun:test'; bun.test.todo('missing');", errors: [missing] },
      { code: "const { test } = require('bun:test'); test.skip('missing', () => {});", errors: [missing] },
      { code: "xdescribe('missing', () => {});", errors: [missing] },
      { code: "test.skip.each([1])('case %s', () => {});", errors: [missing] },
      { code: "test.skipIf(true)('missing', () => {});", errors: [missing] },
    ]),
    ...withOptions(requireConditional, [
      { code: "test.if(platform)('sometimes skipped', () => {});", errors: [missing] },
      { code: "test.runIf(platform)('sometimes skipped', () => {});", errors: [missing] },
      { code: "describe.todoIf(platform)('sometimes todo', () => {});", errors: [missing] },
    ]),
    ...withOptions({ ...bun, states: { fail: true, retry: true } }, [
      { code: "test.failing('expected failure', () => {});", errors: [missing] },
      { code: "test.failingIf(true)('expected failure', () => {});", errors: [missing] },
      { code: "test('needs retries', () => {}, { retry: 3 });", errors: [missing] },
      { code: "test('needs retries', { retry: 3 }, () => {});", errors: [missing] },
    ]),
  ],
});

runRule('Bun retry ceilings', limitRetries, {
  valid: withOptions(bun, [
    "test('at ceiling', () => {}, { retry: 2 });",
    "test('repeated', () => {}, { repeats: 3 });",
    "test('timeout', () => {}, 3000);",
    "describe('suite', () => {}, { retry: 3 });",
  ]),
  invalid: withOptions(bun, [
    {
      code: "import { test } from 'bun:test'; const options = { retry: 3 }; test('retry', () => {}, options);",
      errors: [{ messageId: 'excessiveRetries', data: { count: 3, max: 2 } }],
    },
    {
      code: "test('retry', { retry: 4 }, () => {});",
      errors: [{ messageId: 'excessiveRetries', data: { count: 4, max: 2 } }],
    },
  ]),
});
