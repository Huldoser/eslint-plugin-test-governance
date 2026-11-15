import requireTicket from '../../src/rules/require-ticket.ts';
import limitRetries from '../../src/rules/limit-retries.ts';
import markerMatches from '../../src/rules/marker-matches-state.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

runRule('require-ticket (resolved boolean conditions)', requireTicket, {
  valid: [
    'const enabled = false; test.skip(enabled);',
    'const metadata = { enabled: false }; test.skip(metadata.enabled);',
    'const enabled = external ? false : false; test.skip(enabled);',
    'const enabled = false ? true : false; test.skip(enabled);',
    'const enabled = external ? true : false; test.skip(enabled);',
    'const enabled = external ? enabled : false; test.skip(enabled);',
    ...withOptions({ framework: 'node-test', requireTicketForConditional: true }, [
      "import { test } from 'node:test'; const skipped = false; test('option', { skip: skipped }, () => {});",
      "import { test } from 'node:test'; test('option', { skip: !true }, () => {});",
      "import { test } from 'node:test'; test('option', { todo: void 0 }, () => {});",
    ]),
  ],
  invalid: [
    { code: 'const enabled = true; test.skip(enabled);', errors: [{ messageId: 'missingMarker' }] },
    { code: 'const onMobile = true; test.skip(onMobile, reason);', errors: [{ messageId: 'missingMarker' }] },
    { code: 'const enabled = true ? true : false; test.skip(enabled);', errors: [{ messageId: 'missingMarker' }] },
    { code: 'const { enabled } = { enabled: true }; test.fixme(enabled);', errors: [{ messageId: 'missingMarker' }] },
    ...withOptions({ framework: 'vitest' }, [
      {
        code: "const skipped = true; test('option', { skip: skipped }, () => {});",
        errors: [{ messageId: 'missingMarker' }],
      },
    ]),
  ],
});

runRule('require-ticket (disabled retry expressions)', requireTicket, {
  valid: withOptions({ states: { retry: true } }, [
    'test.describe.configure({ retries: -0 });',
    'test.describe.configure({ retries: +0 });',
    'test.describe.configure({ retries: true ? 0 : 7 });',
    'test.describe.configure({ retries: external ? 0 : 0 });',
    'const count = undefined; test.describe.configure({ retries: count });',
  ]),
  invalid: withOptions({ states: { retry: true } }, [
    { code: 'test.describe.configure({ retries: external ? 7 : 0 });', errors: [{ messageId: 'missingMarker' }] },
  ]),
});

runRule('limit-retries (nested constant predicates)', limitRetries, {
  valid: [
    'test.describe.configure({ retries: (true ? false : true) ? 7 : 0 });',
    'const enabled = false; test.describe.configure({ retries: !enabled ? 0 : 7 });',
  ],
  invalid: [
    {
      code: 'test.describe.configure({ retries: (true ? false : true) ? 0 : 7 });',
      errors: [{ messageId: 'excessiveRetries' }],
    },
  ],
});

runRule('require-ticket (static spreads and computed keys)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true }, [
    "const { reason } = { ...{ reason: 'EXAMPLE-731' } }; test.skip(true, reason);",
    "const KEY = 'reason'; const metadata = { [KEY]: 'EXAMPLE-731' }; test.skip(true, metadata.reason);",
    "const metadata = { [`rea${'son'}`]: 'EXAMPLE-731' }; test.skip(true, metadata.reason);",
  ]),
  invalid: withOptions({ reportUnreadableTags: true, customStates: { hold: { when: '@hold', marker: 'HOLD' } } }, [
    {
      code: "const { tag } = { tag: '@open', ...{ tag: '@hold' } }; test('spread', { tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const { tag } = { tag: '@hold', ...external }; test('spread', { tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const KEY = 'tag'; const { tag } = { [KEY]: '@hold' }; test('computed', { tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

runRule('marker-matches-state (native reason tickets)', markerMatches, {
  valid: withOptions({ ticketsFromReasons: true, customStates: { hold: { when: '@hold', marker: 'HOLD' } } }, [
    "test('reason', () => {\n// HOLD: EXAMPLE-941\ntest.skip(true, 'EXAMPLE-731'); });",
    {
      code: "import { test } from 'node:test'; test('reason', t => {\n// HOLD: EXAMPLE-941\nt.skip('EXAMPLE-731'); });",
      settings: settings({ framework: 'node-test' }),
    },
  ]),
  invalid: [],
});

runRule('require-ticket (catch bindings)', requireTicket, {
  valid: ["try {} catch (test) { test.skip('helper', () => {}); }"],
  invalid: [],
});

runRule('require-ticket (destructured context method defaults)', requireTicket, {
  valid: withOptions({ framework: 'node-test' }, [
    "import { test } from 'node:test'; test('rest', t => { const { ...rest } = t; rest.skip(); });",
  ]),
  invalid: withOptions({ framework: 'node-test', ticketsFromReasons: true }, [
    {
      code: "import { test } from 'node:test'; test('reason', t => { const { skip = fallback } = t; skip('TBD'); });",
      errors: [{ messageId: 'placeholderTicket' }],
    },
  ]),
});

it('keeps invalid native reasons missing and accepts notes only under the configured policy', () => {
  for (const [reason, allowNotes, expected] of [
    ['EXAMPLE-731 note', false, ['wrongMarker']],
    ['EXAMPLE-731 note', true, []],
    ['TBD', false, ['wrongMarker']],
    ['', false, ['wrongMarker']],
  ] as const) {
    const config = plugin.configure({
      framework: 'playwright',
      ticketsFromReasons: true,
      allowNotes,
      customStates: { hold: { when: '@hold', marker: 'HOLD' } },
    });
    const messages = new Linter().verify(
      `test('reason', () => {\n// HOLD: EXAMPLE-941\ntest.skip(true, ${JSON.stringify(reason)}); });`,
      { ...config, rules: { 'test-governance/marker-matches-state': 'error' } },
    );
    assert.deepEqual(
      messages.map((message) => message.messageId),
      expected,
    );
  }
});

it('ends a blanket marker region at a named enable without executing inline configuration', () => {
  const config = plugin.configure({ framework: 'playwright' });
  const messages = new Linter()
    .verify(
      "/* eslint-disable -- SKIP: EXAMPLE-731 */\ntest.skip('first', () => {});\n/* eslint-enable no-console */\ntest.skip('second', () => {});",
      { ...config, rules: { 'test-governance/require-ticket': 'error' }, linterOptions: { noInlineConfig: true } },
    )
    .filter((message) => message.ruleId === 'test-governance/require-ticket');
  assert.deepEqual(
    messages.map(({ messageId, line }) => ({ messageId, line })),
    [{ messageId: 'missingMarker', line: 4 }],
  );
});
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../src/index.ts';
