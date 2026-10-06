import rule from '../../src/rules/require-ticket.js';
import { runRule, settings } from '../helpers.js';

const ANY = 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL';
const lifecycle = settings({ lifecycleTags: true });

const missing = (state: string, marker: string, subject = 'This test', example = 'PROJ-123') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example },
});

runRule('require-ticket', rule, {
  valid: [
    // A test in an arrow function's expression body takes its marker above the call or the statement.
    "['a', 'b'].forEach((name) =>\n  // SKIP: WEB-1\n  test.skip(name, async () => {}),\n);",
    "// SKIP: WEB-1\n['a', 'b'].forEach((name) => test.skip(name, async () => {}));",
    "test('plain', async () => {});",
    "test.describe('suite', () => { test('a', async () => {}); });",
    "// SKIP: WEB-123\ntest.skip('a', async () => {});",
    // A body defined elsewhere.
    "// SKIP: WEB-123\ntest.skip('pays', payWithCard);",
    "test.skip(isMobile, 'Not on mobile');",
    "/* SKIP: WEB-123 */\ntest.skip('a', async () => {});",
    "/**\n * Waiting on the new checkout API.\n * SKIP: WEB-123\n */\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1\n// eslint-disable-next-line no-empty-function\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1, WEB-2\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1\n// SKIP: WEB-2\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1,WEB-2\ntest.skip('a', async () => {});",
    "// SKIP:   WEB-1  ,  WEB-2   \ntest.skip('a', async () => {});",
    "// SKIP: https://acme.atlassian.net/browse/WEB-1?focusedCommentId=5#comment-5\ntest.skip('a', async () => {});",
    // A full stop or colon after the last ticket is punctuation, not a note.
    "// SKIP: WEB-1.\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1, WEB-2.\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1:\ntest.skip('a', async () => {});",
    "/*\r\n * Context for the skip.\r\n * SKIP: WEB-1\r\n */\r\ntest.skip('a', async () => {});",
    // Notes after the ticket are allowed with allowNotes.
    ...[
      "// SKIP: WEB-123 flaky on CI\ntest.skip('a', async () => {});",
      "// SKIP: WEB-1, WEB-2 both needed\ntest.skip('a', async () => {});",
      "// SKIP: WEB-1: flaky\ntest.skip('a', async () => {});",
    ].map((code) => ({ code, settings: settings({ allowNotes: true }) })),
    // A note on a marker that doesn't belong here is no-orphaned-marker's job.
    "// SKIP: WEB-1 left over\ntest('a', async () => {});",
    "// SKIP: https://jira.example.com/browse/WEB-1\ntest.skip('a', async () => {});",
    "// SKIP: #4821\ntest.skip('a', async () => {});",
    "// SKIP: acme/web#4821\ntest.skip('a', async () => {});",
    "// FIXME: WEB-9\ntest.fixme('a', async () => {});",
    "// FIXME: WEB-9\ntest.fixme('a', { tag: '@smoke' }, async () => {});",
    "/* SKIP: WEB-1 */ test.skip('a', async () => {});",
    // A marker on a skipped describe covers its tests, even ones skipped again.
    "// SKIP: WEB-1\ntest.describe.skip('suite', () => {\n  test('a', async () => {});\n  test.skip('b', async () => {});\n});",
    "// FIXME: WEB-1\ntest.describe.fixme(() => { test('a', async () => {}); });",
    // Conditional skips are platform limits and need no ticket by default.
    "test('a', async ({ browserName }) => { test.skip(browserName === 'webkit', 'Not supported'); });",
    "test.describe('s', () => { test.skip(({ browserName }) => browserName === 'webkit', 'n/a'); });",
    "test('a', async ({ page }, testInfo) => { testInfo.skip(process.env.CI === undefined); });",
    // A runtime skip under an `if`, `switch`, ternary or `&&` is conditional too.
    "test('a', async ({ features }) => { if (!features.email) test.skip(); });",
    "test('a', async ({ page }, testInfo) => { if (process.env.CI) { testInfo.fixme(); } });",
    "test('a', async () => { if (process.env.CI) {} else test.skip(); });",
    "test('a', async () => { process.env.CI ? test.skip() : undefined; });",
    "test('a', async () => { process.env.CI && test.skip(); });",
    "test('a', async () => { switch (process.env.BROWSER) { case 'webkit': test.skip(); } });",
    // So is a skip in a `catch` block, or after an early `return` or `throw`.
    'export async function needsAzurite() {\n  try { await ping(); } catch (error) { test.skip(true, `Azurite is down: ${error}`); }\n}',
    "test('a', async () => { try { await setup(); } catch { test.skip(); } finally { cleanup(); } });",
    "test('a', async ({ page }, testInfo) => { try { await setup(); } catch { if (retry) {} testInfo.fixme(); } });",
    "test('a', async () => { if (ready) return; test.skip(); });",
    "test('a', async () => { if (!ready) { log('not ready'); return; }\n  await step();\n  test.skip(); });",
    "test('a', async () => { if (supported) {} else throw new Error('x'); { test.skip(); } });",
    "test('a', async () => { if (!enabled) { throw new Error('off'); } for (;;) { test.skip(); break; } });",
    // Runtime skips: marker above the call or above the enclosing test.
    "test('a', async () => {\n  // SKIP: WEB-1\n  test.skip();\n});",
    "// SKIP: WEB-1\ntest('a', async () => {\n  test.skip();\n});",
    "// SKIP: WEB-1\ntest.describe('s', () => {\n  test('a', async () => {\n    test.skip();\n  });\n});",
    "// SKIP: WEB-1\ntest('a', async ({ page }, testInfo) => {\n  testInfo.skip();\n});",
    "test('a', async () => {\n  // FIXME: WEB-1\n  await test.info().fixme();\n});",
    "test('a', async () => {\n  // FIXME: WEB-1\n  const run = () => test.fixme();\n});",
    // Tags are off unless lifecycleTags is set.
    "test('checkout @new', async () => {});",
    "test('checkout', { tag: '@unstable' }, async () => {});",
    { code: "// NEW: WEB-1\ntest('checkout @new', async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest('checkout', { tag: ['@new', '@smoke'] }, async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest('checkout', { 'tag': `@new` }, async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest(`checkout ${'x'} @new`, async () => {});", settings: lifecycle },
    { code: "test('mail user@new.com', async () => {});", settings: lifecycle },
    { code: "test('checkout @newer', async () => {});", settings: lifecycle },
    { code: "test('checkout', { tag: [someTag, ...more] }, async () => {});", settings: lifecycle },
    { code: "test('checkout', { [key]: '@new', ...rest }, async () => {});", settings: lifecycle },
    {
      code: "// NEW: WEB-1\ntest('checkout', { annotation: { type: 'x' }, tag: '@new' }, async () => {});",
      settings: lifecycle,
    },
    "const list = [, 1];\ntest('a', async () => { const [, b] = list; });",
    { code: 'test(title, async () => {});', settings: lifecycle },
    {
      code: "// UNSTABLE: WEB-1\ntest.describe('flows @unstable', () => {\n  test('a @unstable', async () => {});\n  test('b', async () => {});\n});",
      settings: lifecycle,
    },
    // Other test runners: `test` from these modules is not Playwright's.
    "import { test } from 'vitest';\ntest.skip('adds', () => {});",
    "import { test, it } from '@jest/globals';\ntest.skip('adds', () => {});\nit.skip('subtracts', () => {});",
    "import test from 'node:test';\ntest.skip('adds', () => {});",
    "const { test } = require('bun:test');\ntest.skip('adds', () => {});",
    // The same runners bound to a variable, as CommonJS and AVA code usually does.
    "const test = require('node:test');\ntest.skip('adds', () => {});",
    "const test = require('ava').serial;\ntest.skip('adds', (t) => {});",
    "import ava from 'ava';\nconst test = ava;\ntest.skip('adds', (t) => {});",
    "const tap = require('tap');\nconst test = tap.test;\ntest.skip('adds', () => {});",
    "const { test: base } = require('mocha');\nconst test = base;\ntest.skip('adds', () => {});",
    // Only `test` itself is taken from a Playwright require.
    "const { expect: e } = require('@playwright/test');\ne.skip('a', async () => {});",
    // A local variable that happens to be called `test` is not Playwright's.
    "function check() {\n  const test = { skip(name, fn) { fn(); } };\n  test.skip('not playwright', () => {});\n}",
    "{\n  let test = helpers;\n  test.skip('not playwright', () => {});\n}",
    // mergeTests() of something that isn't a test, and calls that aren't mergeTests().
    "import { test as base } from '@playwright/test';\nconst t = combine(base), u = factory()(), { a } = config, { b } = load('x');\nt.skip('a', async () => {});\nu.skip('b', async () => {});",
    // Tickets are never read from titles, even when they look like one.
    "test('SDQA-52: Successful logout', async () => {});",
    // fail and slow are off by default.
    "test.fail('a', async () => {});",
    "test('a', async () => { test.slow(); });",
    // Only Playwright's test function counts.
    "foo.skip('a', async () => {});",
    "describe.skip('a', () => {});",
    "it.skip('a', async () => {});",
    "test[method]('a', async () => {});",
    "obj.test.skip('a', async () => {});",
    "test.describe.configure({ mode: 'serial' });",
    "test.step('a', async () => { other.skip(); });",
    "test.skip.each('a', async () => {});",
    'fn()();',
    "test.info().annotations.push({ type: 'x' });",
    'helper().skip();',
    "test('a', async (fixtures, info) => { other.skip(); });",
    { code: "// SKIP: WEB-1\n\ntest.skip('a', async () => {});", settings: settings({ allowBlankLine: true }) },
    {
      code: "import { test as it } from '@playwright/test';\n// SKIP: WEB-1\nit.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "// SKIP: #4821\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'github' } }),
    },
    {
      code: "// FIXME: #4821\ntest.fixme('a', async () => {});\n// SKIP: WEB-1\ntest.skip('b', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
    },
    {
      code: "// QUARANTINE: WEB-1\ntest.skip('a', async () => {});",
      settings: settings({ states: { skip: { marker: 'QUARANTINE' } } }),
    },
    { code: "test.skip('a', async () => {});", settings: settings({ states: { skip: false } }) },
    {
      code: "// NEEDS-DATA: WEB-1\ntest('a @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
    },
    {
      code: "// SKIP: 4821\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'numeric' }, placeholders: [] }),
    },
    { code: "test('a', async () => { test.skip(); });", settings: settings({ states: { skip: false } }) },
    { code: 'test(title, async () => {});', settings: settings({ reportDynamicTitles: true }) },
  ],
  invalid: [
    { code: "test.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A variable called `test` that isn't bound to another test runner is still Playwright's.
    {
      code: "const test = require('@playwright/test').test;\ntest.skip('a', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    { code: "const test = fixtures;\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "const test = makeTest();\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "import { test as t } from 'playwright/test';\nt.skip('a', async () => {});",
      errors: [missing('skip', 'SKIP')],
      settings: settings({ testFunctions: [] }),
    },
    // A body defined elsewhere, or wrapped in a helper.
    { code: "test.skip('pays', payWithCard);", errors: [missing('skip', 'SKIP')] },
    { code: "test.skip(`pays ${card}`, { tag: '@slow' }, payWith(card));", errors: [missing('skip', 'SKIP')] },
    {
      code: "test.describe.fixme('checkout', defineCheckoutTests);",
      errors: [missing('fixme', 'FIXME', 'This describe block')],
    },
    { code: "test('pays @new', withPage(async () => {}));", errors: [missing('new', 'NEW')], settings: lifecycle },
    // Only the head of the declaration is reported, not the whole body.
    {
      code: "test.skip('pays with PayPal', async ({ page }) => {\n  await page.goto('/');\n  await page.click('#pay');\n});",
      errors: [{ ...missing('skip', 'SKIP'), line: 1, column: 1, endLine: 1, endColumn: 29 }],
    },
    {
      code: "test.describe.fixme(() => {\n  test('a', async () => {});\n});",
      errors: [{ ...missing('fixme', 'FIXME', 'This describe block'), line: 1, column: 1, endLine: 1, endColumn: 20 }],
    },
    {
      code: "test('a', async () => {\n  test.skip(true, 'broken');\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2, column: 3, endLine: 2, endColumn: 28 }],
    },
    { code: "test.fixme('a', async () => {});", errors: [missing('fixme', 'FIXME')] },
    {
      code: "test.describe.skip('s', () => { test('a', async () => {}); });",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "test.describe.serial.fixme('s', () => {});",
      errors: [missing('fixme', 'FIXME', 'This describe block')],
    },
    // A marker above a plain describe does not cover a test skipped inside it.
    {
      code: "// SKIP: WEB-1\ntest.describe('s', () => {\n  test.skip('a', async () => {});\n});",
      errors: [missing('skip', 'SKIP')],
    },
    // The test-case ID in the title is not a ticket.
    { code: "test.skip('SDQA-52: Successful logout', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "// SKIP:\ntest.skip('a', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    { code: "/* SKIP: */\ntest.skip('a', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    { code: "// SKIP: , WEB-1\ntest.skip('a', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    {
      code: "// SKIP: flaky on CI\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'flaky', state: 'skip', expected: ANY } }],
    },
    {
      code: "// SKIP: WEB-1, nope\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'nope', state: 'skip', expected: ANY } }],
    },
    // A broken marker is reported even when another marker for the same state is valid.
    {
      code: "// SKIP: WEB-1\n// SKIP: nope\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'nope', state: 'skip', expected: ANY }, line: 2 }],
    },
    {
      code: "// SKIP: WEB-1\ntest.describe.skip('s', () => {\n  // SKIP: TBD\n  test.skip('a', async () => {});\n});",
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' }, line: 3 }],
    },
    ...['TODO', 'tbd', 'XXX-1', '#123', '0', '12345', 'SDQA-0'].map((ticket) => ({
      code: `// SKIP: ${ticket}\ntest.skip('a', async () => {});`,
      errors: [{ messageId: 'placeholderTicket' as const, data: { ticket } }],
    })),
    // Ticket-only markers: anything after the tickets is reported, with a suggestion to remove it.
    ...[
      ['// SKIP: WEB-123 flaky on CI', 'flaky on CI', '// SKIP: WEB-123'],
      ['// SKIP: WEB-1: flaky', ': flaky', '// SKIP: WEB-1'],
      ['// SKIP: WEB-1,', ',', '// SKIP: WEB-1'],
      ['// SKIP: WEB-1, WEB-2 ,', ',', '// SKIP: WEB-1, WEB-2'],
      ['// SKIP: WEB-1 and WEB-2', 'and WEB-2', '// SKIP: WEB-1'],
      ['/* SKIP: WEB-1 flaky */', 'flaky', '/* SKIP: WEB-1 */'],
      ['/**\r\n * SKIP: WEB-1 see thread\r\n */', 'see thread', '/**\r\n * SKIP: WEB-1\r\n */'],
    ].map(([marker, text, fixed]) => ({
      code: `${marker}\ntest.skip('a', async () => {});`,
      errors: [
        {
          messageId: 'extraText' as const,
          data: { marker: 'SKIP', text },
          suggestions: [
            {
              messageId: 'removeExtraText' as const,
              data: { text },
              output: `${fixed}\ntest.skip('a', async () => {});`,
            },
          ],
        },
      ],
    })),
    {
      code: "// SKIP: WEB-123 flaky\ntest.skip('a', async () => {});",
      errors: [
        {
          messageId: 'extraText',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 23,
          suggestions: [{ messageId: 'removeExtraText', output: "// SKIP: WEB-123\ntest.skip('a', async () => {});" }],
        },
      ],
    },
    // Other separators make the ticket itself invalid.
    ...['WEB-1;WEB-2', 'WEB-1/WEB-2'].map((ticket) => ({
      code: `// SKIP: ${ticket}\ntest.skip('a', async () => {});`,
      errors: [{ messageId: 'invalidTicket' as const, data: { ticket, state: 'skip', expected: ANY } }],
    })),
    // A broken ticket is reported first; its note waits until the ticket is fixed.
    { code: "// SKIP: TODO later\ntest.skip('a', async () => {});", errors: [{ messageId: 'placeholderTicket' }] },
    // Notes on a marker that isn't required (conditional skip) are still reported.
    {
      code: "test('a', async ({ browserName }) => {\n  // SKIP: WEB-1 webkit only\n  test.skip(browserName === 'webkit');\n});",
      errors: [
        {
          messageId: 'extraText',
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "test('a', async ({ browserName }) => {\n  // SKIP: WEB-1\n  test.skip(browserName === 'webkit');\n});",
            },
          ],
        },
      ],
    },
    // A note on a describe marker shared by several tests is reported once.
    {
      code: "// SKIP: WEB-1 whole suite\ntest.describe.skip('s', () => {\n  test.skip('a', async () => {});\n  test.skip('b', async () => {});\n});",
      errors: [
        {
          messageId: 'extraText',
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "// SKIP: WEB-1\ntest.describe.skip('s', () => {\n  test.skip('a', async () => {});\n  test.skip('b', async () => {});\n});",
            },
          ],
        },
      ],
    },
    {
      code: "// skip: WEB-1\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'SKIP', found: 'skip' }, line: 1 }],
    },
    {
      code: "// Fixme: WEB-1\ntest.fixme('a', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'FIXME', found: 'Fixme' } }],
    },
    // A blank line breaks the block.
    { code: "// SKIP: WEB-1\n\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A trailing comment on the previous line belongs to that line.
    { code: "setup(); // SKIP: WEB-1\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A marker for another state doesn't count.
    { code: "// FIXME: WEB-1\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // Unconditional runtime skips.
    { code: "test('a', async () => {\n  test.skip();\n});", errors: [missing('skip', 'SKIP', 'This skip call')] },
    {
      code: "test('a', async () => { test.skip(true, 'broken'); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    { code: 'test.skip();', errors: [missing('skip', 'SKIP', 'This skip call')] },
    // Code before the call that doesn't always leave the function doesn't make it conditional.
    {
      code: "test('a', async () => { if (ready) { log('ready'); } test.skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async () => { if (ready) log('ready'); else log('waiting'); test.skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async () => { test.skip(); if (ready) return; });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // A `catch` or early return in another function doesn't guard this call.
    {
      code: "test('a', async () => {\n  try { await setup(); } catch { const retry = () => { if (x) return; }; }\n  test.skip();\n});",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async () => { try { await setup(); } catch { test.skip(); } });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // A guard outside the enclosing function doesn't make the call conditional.
    {
      code: "if (process.env.CI) {\n  test('a', async () => { test.skip(); });\n}",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // The call is the condition itself, so it always runs.
    { code: "test('a', async () => { if (test.skip()) {} });", errors: [missing('skip', 'SKIP', 'This skip call')] },
    { code: "test('a', async () => { test.skip() ? 1 : 2; });", errors: [missing('skip', 'SKIP', 'This skip call')] },
    { code: "test('a', async () => { test.skip() || done(); });", errors: [missing('skip', 'SKIP', 'This skip call')] },
    {
      code: "test('a', async () => { switch (mode) { case test.skip(): break; } });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async ({ features }) => { if (!features.email) test.skip(); });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async ({ page }, testInfo) => { testInfo.fixme(); });",
      errors: [missing('fixme', 'FIXME', 'This fixme call')],
    },
    {
      code: 'test.beforeEach(async ({ page }, info) => { info.skip(); });',
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async () => { test.info().skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async ({ browserName }) => { test.skip(browserName === 'webkit', 'n/a'); });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // Tags, once lifecycleTags is on.
    { code: "test('checkout @new', async () => {});", settings: lifecycle, errors: [missing('new', 'NEW')] },
    {
      code: "test('checkout', { tag: '@unstable' }, async () => {});",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE')],
    },
    {
      code: "test('checkout', { tag: ['@smoke', '@new'] }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: 'test(`checkout ${step} @new`, async () => {});',
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test.describe('flows @unstable', () => { test('a', async () => {}); });",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE', 'This describe block')],
    },
    // Both states need a marker.
    {
      code: "// SKIP: WEB-1\ntest.skip('a', { tag: '@new' }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    // A broken marker on a describe is reported once, not once per test.
    {
      code: "// UNSTABLE: TODO\ntest.describe('s @unstable', () => {\n  test('a @unstable', async () => {});\n  test('b @unstable', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TODO' } }],
    },
    {
      code: "import { test as it } from '@playwright/test';\nit.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // Playwright component testing.
    {
      code: "import { test as ct } from '@playwright/experimental-ct-react';\nct.skip('renders', async ({ mount }) => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // Fixtures combined with mergeTests().
    {
      code: "import { mergeTests, test as base } from '@playwright/test';\nconst db = base.extend({});\nexport const test2 = mergeTests(db, other);\ntest2.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // A parameter named `test` is usually Playwright's test passed to a helper, so it still counts.
    {
      code: "export function definePaymentTests(test) {\n  test.skip('pays', async () => {});\n}",
      errors: [missing('skip', 'SKIP')],
    },
    // A require() that can't be resolved leaves the configured name alone.
    {
      code: "const { test } = require(fixturesPath);\nconst { other } = require(`x`);\ntest.skip('a', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { 'test' as named } from '@playwright/test';\nnamed.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import pwTest from '@playwright/test';\npwTest.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { test as base, expect } from '@playwright/test';\nimport other from 'other';\nexport const myTest = base.extend({}).extend({});\nconst made = make(), deep = obj.a.extend({});\nconst x = 1, y = other.extend({});\nlet z;\nexport {};\nmyTest.skip('a', async () => {});\ny.skip('b', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const { test: pwTest, expect } = require('@playwright/test');\nconst { other } = require('other');\nconst { ...rest } = require('@playwright/test');\nconst { test: { nested } } = require('@playwright/test');\npwTest.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test['skip']('a', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "// SKIP: OPS-1\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'jira', projects: ['WEB'] } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: { ticket: 'OPS-1', state: 'skip', expected: 'a Jira key like WEB-123 in project WEB, or a Jira URL' },
        },
      ],
    },
    {
      code: "// FIXME: WEB-1\ntest.fixme('a', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: {
            ticket: 'WEB-1',
            state: 'fixme',
            expected: 'a GitHub issue like #4821 or owner/repo#4821, or an issue URL on github.com',
          },
        },
      ],
    },
    {
      code: "test('a @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
      errors: [missing('needs-data', 'NEEDS-DATA')],
    },
    {
      code: "test.fail('a', async () => {});\ntest('b', async () => { test.slow(); });",
      settings: settings({ states: { fail: true, slow: { enabled: true } } }),
      errors: [missing('fail', 'FAIL'), missing('slow', 'SLOW', 'This slow call')],
    },
    {
      code: "test.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'linear', teams: ['ENG'] } }),
      errors: [missing('skip', 'SKIP', 'This test', 'ENG-123')],
    },
    {
      code: 'test(title, async () => {});\ntest.describe(name, () => {});',
      settings: settings({ lifecycleTags: true, reportDynamicTitles: true }),
      errors: [
        { messageId: 'dynamicTitle', column: 6 },
        { messageId: 'dynamicTitle', column: 15 },
      ],
    },
  ],
});
