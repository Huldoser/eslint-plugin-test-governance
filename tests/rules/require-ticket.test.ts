import rule from '../../src/rules/require-ticket.ts';
import { runRule, settings } from '../helpers.ts';

const ANY = 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL';
const lifecycle = settings({ lifecycleTags: true });

const missing = (state: string, marker: string, subject = 'This test', example = 'PROJ-123') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example },
});

runRule('require-ticket', rule, {
  valid: [
    // A test in an arrow function's expression body takes its marker above the call or the statement.
    "['AAPL', 'MSFT'].forEach((symbol) =>\n  // SKIP: TRADE-1\n  test.skip(symbol, async () => {}),\n);",
    "// SKIP: TRADE-1\n['AAPL', 'MSFT'].forEach((symbol) => test.skip(symbol, async () => {}));",
    "test('shows live prices', async () => {});",
    "test.describe('order entry', () => { test('places an order', async () => {}); });",
    "// SKIP: TRADE-123\ntest.skip('places a limit order', async () => {});",
    // A body defined elsewhere.
    "// SKIP: TRADE-123\ntest.skip('buys shares', placeLimitOrder);",
    "test.skip(isMobile, 'Not on mobile');",
    "/* SKIP: TRADE-123 */\ntest.skip('places a market order', async () => {});",
    "/**\n * Waiting on the new order routing API.\n * SKIP: TRADE-123\n */\ntest.skip('cancels an open order', async () => {});",
    "// SKIP: TRADE-1\n// eslint-disable-next-line no-empty-function\ntest.skip('shows prices', async () => {});",
    "// SKIP: TRADE-1, TRADE-2\ntest.skip('places an order', async () => {});",
    "// SKIP: TRADE-1\n// SKIP: TRADE-2\ntest.skip('places an order', async () => {});",
    "// SKIP: TRADE-1,TRADE-2\ntest.skip('places an order', async () => {});",
    "// SKIP:   TRADE-1  ,  TRADE-2   \ntest.skip('places an order', async () => {});",
    "// SKIP: https://acme.atlassian.net/browse/TRADE-1?focusedCommentId=5#comment-5\ntest.skip('fills a partial order', async () => {});",
    // A full stop or colon after the last ticket is punctuation, not a note.
    "// SKIP: TRADE-1.\ntest.skip('cancels an order', async () => {});",
    "// SKIP: TRADE-1, TRADE-2.\ntest.skip('cancels an order', async () => {});",
    "// SKIP: TRADE-1:\ntest.skip('cancels an order', async () => {});",
    "/*\r\n * Waiting on the broker sandbox.\r\n * SKIP: TRADE-1\r\n */\r\ntest.skip('places an order', async () => {});",
    // Notes after the ticket are allowed with allowNotes.
    ...[
      "// SKIP: TRADE-123 flaky on CI\ntest.skip('streams price updates', async () => {});",
      "// SKIP: TRADE-1, TRADE-2 both needed\ntest.skip('streams price updates', async () => {});",
      "// SKIP: TRADE-1: flaky\ntest.skip('streams price updates', async () => {});",
    ].map((code) => ({ code, settings: settings({ allowNotes: true }) })),
    // A note on a marker that doesn't belong here is no-orphaned-marker's job.
    "// SKIP: TRADE-1 left over\ntest('shows prices', async () => {});",
    "// SKIP: https://jira.example.com/browse/TRADE-1\ntest.skip('rebalances the portfolio', async () => {});",
    "// SKIP: #4821\ntest.skip('rebalances the portfolio', async () => {});",
    "// SKIP: acme/trading-engine#4821\ntest.skip('rebalances the portfolio', async () => {});",
    "// FIXME: TRADE-9\ntest.fixme('shows the order book', async () => {});",
    "// FIXME: TRADE-9\ntest.fixme('shows the order book', { tag: '@smoke' }, async () => {});",
    "/* SKIP: TRADE-1 */ test.skip('places an order', async () => {});",
    // A marker on a skipped describe covers its tests, even ones skipped again.
    "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  test('places an order', async () => {});\n  test.skip('cancels an order', async () => {});\n});",
    "// FIXME: TRADE-1\ntest.describe.fixme(() => { test('places an order', async () => {}); });",
    // Conditional skips are platform limits and need no ticket by default.
    "test('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit', 'No order book on WebKit'); });",
    "test.describe('market data', () => { test.skip(({ browserName }) => browserName === 'webkit', 'n/a'); });",
    "test('exports the trade history', async ({ page }, testInfo) => { testInfo.skip(process.env.CI === undefined); });",
    // A runtime skip under an `if`, `switch`, ternary or `&&` is conditional too.
    "test('buys shares with margin', async ({ features }) => { if (!features.marginTrading) test.skip(); });",
    "test('shows live prices', async ({ page }, testInfo) => { if (process.env.CI) { testInfo.fixme(); } });",
    "test('shows live prices', async () => { if (process.env.CI) {} else test.skip(); });",
    "test('shows live prices', async () => { process.env.CI ? test.skip() : undefined; });",
    "test('shows live prices', async () => { process.env.CI && test.skip(); });",
    "test('shows the order book', async () => { switch (process.env.BROWSER) { case 'webkit': test.skip(); } });",
    // So is a skip in a `catch` block, or after an early `return` or `throw`.
    'export async function needsBrokerSandbox() {\n  try { await pingBroker(); } catch (error) { test.skip(true, `Broker sandbox is down: ${error}`); }\n}',
    "test('places an order', async () => { try { await connectBroker(); } catch { test.skip(); } finally { disconnectBroker(); } });",
    "test('places an order', async ({ page }, testInfo) => { try { await connectBroker(); } catch { if (retry) {} testInfo.fixme(); } });",
    "test('places a market order', async () => { if (marketOpen) return; test.skip(); });",
    "test('places a market order', async () => { if (!marketOpen) { log('market closed'); return; }\n  await step();\n  test.skip(); });",
    "test('cancels an order', async () => { if (supported) {} else throw new Error('x'); { test.skip(); } });",
    "test('cancels an order', async () => { if (!tradingEnabled) { throw new Error('off'); } for (;;) { test.skip(); break; } });",
    // Runtime skips: marker above the call or above the enclosing test.
    "test('fills a partial order', async () => {\n  // SKIP: TRADE-1\n  test.skip();\n});",
    "// SKIP: TRADE-1\ntest('fills a partial order', async () => {\n  test.skip();\n});",
    "// SKIP: TRADE-1\ntest.describe('order entry', () => {\n  test('fills a partial order', async () => {\n    test.skip();\n  });\n});",
    "// SKIP: TRADE-1\ntest('fills a partial order', async ({ page }, testInfo) => {\n  testInfo.skip();\n});",
    "test('calculates profit and loss', async () => {\n  // FIXME: TRADE-1\n  await test.info().fixme();\n});",
    "test('calculates profit and loss', async () => {\n  // FIXME: TRADE-1\n  const run = () => test.fixme();\n});",
    // Tags are off unless lifecycleTags is set.
    "test('places an order @new', async () => {});",
    "test('places an order', { tag: '@unstable' }, async () => {});",
    { code: "// NEW: TRADE-1\ntest('places an order @new', async () => {});", settings: lifecycle },
    {
      code: "// NEW: TRADE-1\ntest('places an order', { tag: ['@new', '@smoke'] }, async () => {});",
      settings: lifecycle,
    },
    { code: "// NEW: TRADE-1\ntest('places an order', { 'tag': `@new` }, async () => {});", settings: lifecycle },
    { code: "// NEW: TRADE-1\ntest(`buys ${'AAPL'} @new`, async () => {});", settings: lifecycle },
    { code: "test('emails the fill report to desk@new.com', async () => {});", settings: lifecycle },
    { code: "test('places an order @newer', async () => {});", settings: lifecycle },
    { code: "test('places an order', { tag: [someTag, ...more] }, async () => {});", settings: lifecycle },
    { code: "test('places an order', { [key]: '@new', ...rest }, async () => {});", settings: lifecycle },
    {
      code: "// NEW: TRADE-1\ntest('places an order', { annotation: { type: 'x' }, tag: '@new' }, async () => {});",
      settings: lifecycle,
    },
    "const quotes = [, 1];\ntest('shows prices', async () => { const [, ask] = quotes; });",
    { code: 'test(title, async () => {});', settings: lifecycle },
    {
      code: "// UNSTABLE: TRADE-1\ntest.describe('market data @unstable', () => {\n  test('streams price updates @unstable', async () => {});\n  test('shows live prices', async () => {});\n});",
      settings: lifecycle,
    },
    // Other test runners: `test` from these modules is not Playwright's.
    "import { test } from 'vitest';\ntest.skip('calculates profit', () => {});",
    "import { test, it } from '@jest/globals';\ntest.skip('calculates profit', () => {});\nit.skip('calculates loss', () => {});",
    "import test from 'node:test';\ntest.skip('calculates profit', () => {});",
    "const { test } = require('bun:test');\ntest.skip('calculates profit', () => {});",
    // The same runners bound to a variable, as CommonJS and AVA code usually does.
    "const test = require('node:test');\ntest.skip('calculates profit', () => {});",
    "const test = require('ava').serial;\ntest.skip('calculates profit', (t) => {});",
    "import ava from 'ava';\nconst test = ava;\ntest.skip('calculates profit', (t) => {});",
    "const tap = require('tap');\nconst test = tap.test;\ntest.skip('calculates profit', () => {});",
    "const { test: base } = require('mocha');\nconst test = base;\ntest.skip('calculates profit', () => {});",
    // Only `test` itself is taken from a Playwright require.
    "const { expect: e } = require('@playwright/test');\ne.skip('places an order', async () => {});",
    // A local variable that happens to be called `test` is not Playwright's.
    "function validateOrder() {\n  const test = { skip(name, fn) { fn(); } };\n  test.skip('checks the order size', () => {});\n}",
    "{\n  let test = orderHelpers;\n  test.skip('checks the order size', () => {});\n}",
    // mergeTests() of something that isn't a test, and calls that aren't mergeTests().
    "import { test as base } from '@playwright/test';\nconst t = combine(base), u = factory()(), { a } = config, { b } = load('x');\nt.skip('places an order', async () => {});\nu.skip('cancels an order', async () => {});",
    // Tickets are never read from titles, even when they look like one.
    "test('TRADE-52: closes all positions at market close', async () => {});",
    // fail and slow are off by default.
    "test.fail('rejects an order over the position limit', async () => {});",
    "test('backtests a moving-average strategy', async () => { test.slow(); });",
    // Only Playwright's test function counts.
    "broker.skip('places an order', async () => {});",
    "describe.skip('order entry', () => {});",
    "it.skip('places an order', async () => {});",
    "test[method]('places an order', async () => {});",
    "account.test.skip('places an order', async () => {});",
    "test.describe.configure({ mode: 'serial' });",
    "test.step('submits the order', async () => { other.skip(); });",
    "test.skip.each('places an order', async () => {});",
    'fn()();',
    "test.info().annotations.push({ type: 'x' });",
    'orderHelper().skip();',
    "test('places an order', async (fixtures, info) => { other.skip(); });",
    {
      code: "// SKIP: TRADE-1\n\ntest.skip('places an order', async () => {});",
      settings: settings({ allowBlankLine: true }),
    },
    {
      code: "import { test as it } from '@playwright/test';\n// SKIP: TRADE-1\nit.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "// SKIP: #4821\ntest.skip('shows the order book', async () => {});",
      settings: settings({ ticket: { preset: 'github' } }),
    },
    {
      code: "// FIXME: #4821\ntest.fixme('shows the order book', async () => {});\n// SKIP: TRADE-1\ntest.skip('shows prices', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
    },
    {
      code: "// QUARANTINE: TRADE-1\ntest.skip('streams price updates', async () => {});",
      settings: settings({ states: { skip: { marker: 'QUARANTINE' } } }),
    },
    { code: "test.skip('places an order', async () => {});", settings: settings({ states: { skip: false } }) },
    {
      code: "// NEEDS-DATA: TRADE-1\ntest('backtests a moving-average strategy @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
    },
    {
      code: "// SKIP: 4821\ntest.skip('exports the trade history', async () => {});",
      settings: settings({ ticket: { preset: 'numeric' }, placeholders: [] }),
    },
    {
      code: "test('places an order', async () => { test.skip(); });",
      settings: settings({ states: { skip: false } }),
    },
    { code: 'test(title, async () => {});', settings: settings({ reportDynamicTitles: true }) },
  ],
  invalid: [
    { code: "test.skip('places an order', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A variable called `test` that isn't bound to another test runner is still Playwright's.
    {
      code: "const test = require('@playwright/test').test;\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const test = brokerFixtures;\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const test = makeTest();\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { test as t } from 'playwright/test';\nt.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
      settings: settings({ testFunctions: [] }),
    },
    // A body defined elsewhere, or wrapped in a helper.
    { code: "test.skip('buys shares', placeLimitOrder);", errors: [missing('skip', 'SKIP')] },
    {
      code: "test.skip(`buys ${symbol}`, { tag: '@slow' }, buyShares(symbol));",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test.describe.fixme('order entry', defineOrderEntryTests);",
      errors: [missing('fixme', 'FIXME', 'This describe block')],
    },
    {
      code: "test('buys shares @new', withAccount(async () => {}));",
      errors: [missing('new', 'NEW')],
      settings: lifecycle,
    },
    // Only the head of the declaration is reported, not the whole body.
    {
      code: "test.skip('buys shares with margin', async ({ page }) => {\n  await page.goto('/orders');\n  await page.click('#buy');\n});",
      errors: [{ ...missing('skip', 'SKIP'), line: 1, column: 1, endLine: 1, endColumn: 36 }],
    },
    {
      code: "test.describe.fixme(() => {\n  test('places an order', async () => {});\n});",
      errors: [{ ...missing('fixme', 'FIXME', 'This describe block'), line: 1, column: 1, endLine: 1, endColumn: 20 }],
    },
    {
      code: "test('places an order', async () => {\n  test.skip(true, 'broker sandbox is down');\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2, column: 3, endLine: 2, endColumn: 44 }],
    },
    { code: "test.fixme('cancels an order', async () => {});", errors: [missing('fixme', 'FIXME')] },
    {
      code: "test.describe.skip('order entry', () => { test('places an order', async () => {}); });",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "test.describe.serial.fixme('order entry', () => {});",
      errors: [missing('fixme', 'FIXME', 'This describe block')],
    },
    // A marker above a plain describe does not cover a test skipped inside it.
    {
      code: "// SKIP: TRADE-1\ntest.describe('order entry', () => {\n  test.skip('places an order', async () => {});\n});",
      errors: [missing('skip', 'SKIP')],
    },
    // A ticket key in the title is not a marker.
    {
      code: "test.skip('TRADE-52: cancels all open orders at market close', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    { code: "// SKIP:\ntest.skip('places an order', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    { code: "/* SKIP: */\ntest.skip('places an order', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    {
      code: "// SKIP: , TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: "// SKIP: flaky on CI\ntest.skip('streams price updates', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'flaky', state: 'skip', expected: ANY } }],
    },
    {
      code: "// SKIP: TRADE-1, nope\ntest.skip('streams price updates', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'nope', state: 'skip', expected: ANY } }],
    },
    // A broken marker is reported even when another marker for the same state is valid.
    {
      code: "// SKIP: TRADE-1\n// SKIP: nope\ntest.skip('streams price updates', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'nope', state: 'skip', expected: ANY }, line: 2 }],
    },
    {
      code: "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  // SKIP: TBD\n  test.skip('places an order', async () => {});\n});",
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' }, line: 3 }],
    },
    ...['TODO', 'tbd', 'XXX-1', '#123', '0', '12345', 'TRADE-0'].map((ticket) => ({
      code: `// SKIP: ${ticket}\ntest.skip('places an order', async () => {});`,
      errors: [{ messageId: 'placeholderTicket' as const, data: { ticket } }],
    })),
    // Ticket-only markers: anything after the tickets is reported, with a suggestion to remove it.
    ...[
      ['// SKIP: TRADE-123 flaky on CI', 'flaky on CI', '// SKIP: TRADE-123'],
      ['// SKIP: TRADE-1: flaky', ': flaky', '// SKIP: TRADE-1'],
      ['// SKIP: TRADE-1,', ',', '// SKIP: TRADE-1'],
      ['// SKIP: TRADE-1, TRADE-2 ,', ',', '// SKIP: TRADE-1, TRADE-2'],
      ['// SKIP: TRADE-1 and TRADE-2', 'and TRADE-2', '// SKIP: TRADE-1'],
      ['/* SKIP: TRADE-1 flaky */', 'flaky', '/* SKIP: TRADE-1 */'],
      ['/**\r\n * SKIP: TRADE-1 see thread\r\n */', 'see thread', '/**\r\n * SKIP: TRADE-1\r\n */'],
    ].map(([marker, text, fixed]) => ({
      code: `${marker}\ntest.skip('streams price updates', async () => {});`,
      errors: [
        {
          messageId: 'extraText' as const,
          data: { marker: 'SKIP', text },
          suggestions: [
            {
              messageId: 'removeExtraText' as const,
              data: { text },
              output: `${fixed}\ntest.skip('streams price updates', async () => {});`,
            },
          ],
        },
      ],
    })),
    {
      code: "// SKIP: TRADE-123 flaky\ntest.skip('shows live prices', async () => {});",
      errors: [
        {
          messageId: 'extraText',
          line: 1,
          column: 19,
          endLine: 1,
          endColumn: 25,
          suggestions: [
            {
              messageId: 'removeExtraText',
              output: "// SKIP: TRADE-123\ntest.skip('shows live prices', async () => {});",
            },
          ],
        },
      ],
    },
    // Other separators make the ticket itself invalid.
    ...['TRADE-1;TRADE-2', 'TRADE-1/TRADE-2'].map((ticket) => ({
      code: `// SKIP: ${ticket}\ntest.skip('places an order', async () => {});`,
      errors: [{ messageId: 'invalidTicket' as const, data: { ticket, state: 'skip', expected: ANY } }],
    })),
    // A broken ticket is reported first; its note waits until the ticket is fixed.
    {
      code: "// SKIP: TODO later\ntest.skip('places an order', async () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
    },
    // Notes on a marker that isn't required (conditional skip) are still reported.
    {
      code: "test('shows the order book', async ({ browserName }) => {\n  // SKIP: TRADE-1 webkit only\n  test.skip(browserName === 'webkit');\n});",
      errors: [
        {
          messageId: 'extraText',
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "test('shows the order book', async ({ browserName }) => {\n  // SKIP: TRADE-1\n  test.skip(browserName === 'webkit');\n});",
            },
          ],
        },
      ],
    },
    // A note on a describe marker shared by several tests is reported once.
    {
      code: "// SKIP: TRADE-1 whole suite\ntest.describe.skip('order entry', () => {\n  test.skip('places an order', async () => {});\n  test.skip('cancels an order', async () => {});\n});",
      errors: [
        {
          messageId: 'extraText',
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  test.skip('places an order', async () => {});\n  test.skip('cancels an order', async () => {});\n});",
            },
          ],
        },
      ],
    },
    {
      code: "// skip: TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'SKIP', found: 'skip' }, line: 1 }],
    },
    {
      code: "// Fixme: TRADE-1\ntest.fixme('places an order', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'FIXME', found: 'Fixme' } }],
    },
    // A blank line breaks the block.
    {
      code: "// SKIP: TRADE-1\n\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    // A trailing comment on the previous line belongs to that line.
    {
      code: "connectBroker(); // SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    // A marker for another state doesn't count.
    {
      code: "// FIXME: TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    // Unconditional runtime skips.
    {
      code: "test('cancels an order', async () => {\n  test.skip();\n});",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('cancels an order', async () => { test.skip(true, 'broker sandbox is down'); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    { code: 'test.skip();', errors: [missing('skip', 'SKIP', 'This skip call')] },
    // Code before the call that doesn't always leave the function doesn't make it conditional.
    {
      code: "test('places a market order', async () => { if (marketOpen) { log('market open'); } test.skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('places a market order', async () => { if (marketOpen) log('market open'); else log('waiting for the open'); test.skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('places a market order', async () => { test.skip(); if (marketOpen) return; });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // A `catch` or early return in another function doesn't guard this call.
    {
      code: "test('places an order', async () => {\n  try { await connectBroker(); } catch { const retry = () => { if (x) return; }; }\n  test.skip();\n});",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('places an order', async () => { try { await connectBroker(); } catch { test.skip(); } });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // A guard outside the enclosing function doesn't make the call conditional.
    {
      code: "if (process.env.CI) {\n  test('streams price updates', async () => { test.skip(); });\n}",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // The call is the condition itself, so it always runs.
    {
      code: "test('shows prices', async () => { if (test.skip()) {} });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('shows prices', async () => { test.skip() ? 1 : 2; });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('shows prices', async () => { test.skip() || done(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('shows prices', async () => { switch (mode) { case test.skip(): break; } });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('buys shares with margin', async ({ features }) => { if (!features.marginTrading) test.skip(); });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('exports the trade history', async ({ page }, testInfo) => { testInfo.fixme(); });",
      errors: [missing('fixme', 'FIXME', 'This fixme call')],
    },
    {
      code: 'test.beforeEach(async ({ page }, info) => { info.skip(); });',
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('exports the trade history', async () => { test.info().skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit', 'n/a'); });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // Tags, once lifecycleTags is on.
    { code: "test('places an order @new', async () => {});", settings: lifecycle, errors: [missing('new', 'NEW')] },
    {
      code: "test('places an order', { tag: '@unstable' }, async () => {});",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE')],
    },
    {
      code: "test('places an order', { tag: ['@smoke', '@new'] }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: 'test(`buys ${symbol} @new`, async () => {});',
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test.describe('market data @unstable', () => { test('shows live prices', async () => {}); });",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE', 'This describe block')],
    },
    // Both states need a marker.
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { tag: '@new' }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    // A broken marker on a describe is reported once, not once per test.
    {
      code: "// UNSTABLE: TODO\ntest.describe('market data @unstable', () => {\n  test('shows live prices @unstable', async () => {});\n  test('streams price updates @unstable', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TODO' } }],
    },
    {
      code: "import { test as it } from '@playwright/test';\nit.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // Playwright component testing.
    {
      code: "import { test as ct } from '@playwright/experimental-ct-react';\nct.skip('renders the price chart', async ({ mount }) => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // Fixtures combined with mergeTests().
    {
      code: "import { mergeTests, test as base } from '@playwright/test';\nconst broker = base.extend({});\nexport const test2 = mergeTests(broker, marketData);\ntest2.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    // A parameter named `test` is usually Playwright's test passed to a helper, so it still counts.
    {
      code: "export function defineOrderTests(test) {\n  test.skip('buys shares', async () => {});\n}",
      errors: [missing('skip', 'SKIP')],
    },
    // A require() that can't be resolved leaves the configured name alone.
    {
      code: "const { test } = require(fixturesPath);\nconst { other } = require(`x`);\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { 'test' as named } from '@playwright/test';\nnamed.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import pwTest from '@playwright/test';\npwTest.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { test as base, expect } from '@playwright/test';\nimport other from 'other';\nexport const myTest = base.extend({}).extend({});\nconst made = make(), deep = obj.a.extend({});\nconst x = 1, y = other.extend({});\nlet z;\nexport {};\nmyTest.skip('places an order', async () => {});\ny.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const { test: pwTest, expect } = require('@playwright/test');\nconst { other } = require('other');\nconst { ...rest } = require('@playwright/test');\nconst { test: { nested } } = require('@playwright/test');\npwTest.skip('places an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test['skip']('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "// SKIP: OPS-1\ntest.skip('closes all positions at market close', async () => {});",
      settings: settings({ ticket: { preset: 'jira', projects: ['TRADE'] } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: {
            ticket: 'OPS-1',
            state: 'skip',
            expected: 'a Jira key like TRADE-123 in project TRADE, or a Jira URL',
          },
        },
      ],
    },
    {
      code: "// FIXME: TRADE-1\ntest.fixme('closes all positions at market close', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: {
            ticket: 'TRADE-1',
            state: 'fixme',
            expected: 'a GitHub issue like #4821 or owner/repo#4821, or an issue URL on github.com',
          },
        },
      ],
    },
    {
      code: "test('backtests a moving-average strategy @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
      errors: [missing('needs-data', 'NEEDS-DATA')],
    },
    {
      code: "test.fail('rejects an order over the position limit', async () => {});\ntest('backtests a moving-average strategy', async () => { test.slow(); });",
      settings: settings({ states: { fail: true, slow: { enabled: true } } }),
      errors: [missing('fail', 'FAIL'), missing('slow', 'SLOW', 'This slow call')],
    },
    {
      code: "test.skip('stops trading at the daily loss limit', async () => {});",
      settings: settings({ ticket: { preset: 'linear', teams: ['ENG'] } }),
      errors: [missing('skip', 'SKIP', 'This test', 'ENG-123')],
    },
    {
      code: 'test(title, async () => {});\ntest.describe(symbol, () => {});',
      settings: settings({ lifecycleTags: true, reportDynamicTitles: true }),
      errors: [
        { messageId: 'dynamicTitle', column: 6 },
        { messageId: 'dynamicTitle', column: 15 },
      ],
    },
  ],
});
