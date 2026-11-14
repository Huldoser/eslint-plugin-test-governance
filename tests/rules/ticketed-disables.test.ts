import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../src/index.ts';
import rule from '../../src/rules/require-ticket-in-comments.ts';
import { runRule, withOptions } from '../helpers.ts';

const test = "test('example', () => {});";
const policy = { comments: { ticketedDisables: ['no-console', 'no-alert'] } };

runRule('require-ticket-in-comments', rule, {
  valid: withOptions(policy, [
    test,
    `// eslint-disable-next-line no-console -- TODO: EXAMPLE-123\n${test}`,
    `/* eslint-disable no-console -- TODO(EXAMPLE-123) */\n${test}`,
    `${test} // eslint-disable-line no-console -- FIXME: EXAMPLE-123`,
    `// eslint-disable-next-line no-debugger\n${test}`,
    `/* eslint-enable no-console */\n${test}`,
    `// eslint-disable no-console\n${test}`,
    `// eslint-disable-next-line no-console\nconst value = 1;`,
    `// eslint-disable-next-line no-console -- SKIP: EXAMPLE-123\ntest.skip('example', () => {});`,
    {
      code: `// eslint-disable-next-line no-console -- TRACK: EXAMPLE-123\n${test}`,
      settings: { 'test-governance': { comments: { keywords: ['TRACK'], ticketedDisables: ['no-console'] } } },
    },
    {
      code: `// eslint-disable-next-line no-console -- TODO: EXAMPLE-123 explanation\n${test}`,
      settings: { 'test-governance': { allowNotes: true } },
    },
  ]),
  invalid: withOptions(policy, [
    ...[
      `// eslint-disable-next-line no-console\n${test}`,
      `/* eslint-disable no-console */\n${test}`,
      `${test} // eslint-disable-line no-console`,
      `// eslint-disable-next-line no-console -- temporary workaround\n${test}`,
      `// eslint-disable-next-line no-console, no-alert\n${test}`,
      `// eslint-disable-next-line no-console -- SKIP: EXAMPLE-123\n${test}`,
    ].map((code) => ({ code, errors: [{ messageId: 'missingDirectiveTicket' }] })),
    {
      code: `// eslint-disable-next-line no-console -- TODO: TBD\n${test}`,
      errors: [{ messageId: 'placeholderTicket' }],
    },
    {
      code: `// eslint-disable-next-line no-console -- TODO: later\n${test}`,
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: `// eslint-disable-next-line no-console -- TODO: WRONG-123\n${test}`,
      settings: { 'test-governance': { ticket: { preset: 'jira', projects: ['EXAMPLE'] } } },
      errors: [{ messageId: 'invalidTicket' }],
    },
  ]),
});

it('keeps ticketed suppression checks opt-in and reports an invalid description once', () => {
  const linter = new Linter();
  const code = "// eslint-disable-next-line no-console\ntest('example', () => { console.log('example'); });";
  const consoleRule = { rules: { 'no-console': 'error' as const } };
  assert.deepEqual(linter.verify(code, [plugin.configs.playwright, consoleRule]), []);
  const config = plugin.configure({ framework: 'playwright', ...policy });
  const messages = linter.verify(code.replace('no-console', 'no-console -- TODO: TBD'), [config, consoleRule]);
  assert.deepEqual(
    messages.map((message) => message.messageId),
    ['placeholderTicket'],
  );
});

it('leaves applicable state markers to require-ticket without duplicate reports', () => {
  const config = plugin.configure({ framework: 'playwright', ...policy });
  const messages = new Linter().verify(
    "// eslint-disable-next-line no-console -- SKIP: TBD\ntest.skip('example', () => { console.log('example'); });",
    [config, { rules: { 'no-console': 'error' } }],
  );
  assert.deepEqual(
    messages.map((message) => message.messageId),
    ['placeholderTicket'],
  );
  assert.equal(messages[0].ruleId, 'test-governance/require-ticket');
});

it('does not claim to enforce tickets when a blanket disable suppresses the checker', () => {
  const config = plugin.configure({ framework: 'playwright', ...policy });
  const code = "/* eslint-disable */\ntest('example', () => { console.log('example'); });";
  assert.deepEqual(new Linter().verify(code, [config, { rules: { 'no-console': 'error' } }]), []);
});

it('rejects wildcard and malformed selected rule IDs at configuration time', () => {
  for (const id of ['', '*', 'jest/*', 'no-console, no-alert', 'no console']) {
    assert.throws(
      () => plugin.configure({ framework: 'jest', comments: { ticketedDisables: [id] } }),
      /an exact rule ID/,
    );
  }
  assert.throws(
    () => plugin.configure({ framework: 'jest', comments: { ticketedDisables: 'no-console' } } as never),
    /array/,
  );
});
