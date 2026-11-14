import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../src/index.ts';
import rule from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

const policy = { ticketsFromReasons: true, requireTicketForConditional: true };
const node = (call: string) => `import { test } from 'node:test'; test('example', (t) => { ${call} });`;

runRule('require-ticket', rule, {
  valid: withOptions(policy, [
    "test.skip(true, 'EXAMPLE-123');",
    "test.fixme(condition, 'EXAMPLE-123');",
    "const REASON = 'EXAMPLE-123'; test.skip(true, REASON);",
    "test('example', { annotation: { type: 'issue', description: 'EXAMPLE-123' } }, () => { test.skip(true, 'ordinary explanation'); });",
    "test('example', ({}, info) => { info.skip(true, 'EXAMPLE-123'); });",
    "test.skip(false, 'unsupported');",
    "// SKIP: EXAMPLE-123\ntest.skip(true, 'ordinary explanation');",
    {
      code: "test.skip(condition, 'ordinary explanation');",
      settings: { 'test-governance': { requireTicketForConditional: false } },
    },
    { code: "test.skip(true, 'EXAMPLE-123 temporary');", settings: { 'test-governance': { allowNotes: true } } },
    { code: node("t.skip('EXAMPLE-123');"), settings: { 'test-governance': { framework: 'node-test' } } },
    { code: node("t.todo('EXAMPLE-123');"), settings: { 'test-governance': { framework: 'node-test' } } },
    {
      code: '// SKIP: EXAMPLE-123\ntest.skip(true, dynamic);',
      settings: { 'test-governance': { annotations: { only: true } } },
    },
  ]),
  invalid: withOptions(policy, [
    {
      code: "import { test } from 'node:test'; test('example', { skip: 'EXAMPLE-123' }, () => {});",
      settings: { 'test-governance': { framework: 'node-test' } },
      errors: [{ messageId: 'missingMarker' }],
    },
    { code: "test.skip(true, 'TBD');", errors: [{ messageId: 'placeholderTicket' }] },
    { code: "test.skip(true, 'not-a-ticket');", errors: [{ messageId: 'invalidReasonTicket' }] },
    { code: "test.skip(true, '');", errors: [{ messageId: 'missingReasonTicket' }] },
    { code: "test.skip(true, 'EXAMPLE-123 note');", errors: [{ messageId: 'reasonNotes' }] },
    { code: 'test.skip(true, dynamic);', errors: [{ messageId: 'missingMarker' }] },
    { code: 'test.skip(true);', errors: [{ messageId: 'missingMarker' }] },
    { code: "test.skip('EXAMPLE-123', () => {});", errors: [{ messageId: 'missingMarker' }] },
    { code: "// SKIP: TBD\ntest.skip(true, 'EXAMPLE-123');", errors: [{ messageId: 'placeholderTicket' }] },
    {
      code: "test.skip('EXAMPLE-123', () => {});",
      settings: { 'test-governance': { annotations: { only: true } } },
      errors: [{ messageId: 'missingAnnotation' }],
    },
    {
      code: node("t.skip('EXAMPLE-123');"),
      settings: { 'test-governance': { ticketsFromReasons: false, framework: 'node-test' } },
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "it('example', function () { this.skip('EXAMPLE-123'); });",
      settings: { 'test-governance': { framework: 'mocha' } },
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

it('keeps native-reason tickets opt-in with all rules enabled', () => {
  const code = "test('example', () => { test.skip(true, 'EXAMPLE-123'); });";
  const linter = new Linter();
  assert.deepEqual(
    linter.verify(code, plugin.configs.playwright).map((message) => message.messageId),
    ['missingMarker'],
  );
  assert.deepEqual(linter.verify(code, plugin.configure({ framework: 'playwright', ticketsFromReasons: true })), []);
});
