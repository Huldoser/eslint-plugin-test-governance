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
    // In a class static block or a switch case, the marker sits above the statement.
    "class OrderSuite {\n  static {\n    // SKIP: TRADE-1\n    test.skip('places an order', async () => {});\n  }\n}",
    "switch (process.env.BROKER) {\n  case 'sandbox':\n    // SKIP: TRADE-1\n    test.skip('places an order', async () => {});\n}",
    "test('shows live prices', async () => {});",
    "test.describe('order entry', () => { test('places an order', async () => {}); });",
    "// SKIP: TRADE-123\ntest.skip('places a limit order', async () => {});",
    // A body defined elsewhere.
    "// SKIP: TRADE-123\ntest.skip('buys shares', placeLimitOrder);",
    "test.skip(isMobile, 'Not on mobile');",
    "/* SKIP: TRADE-123 */\ntest.skip('places a market order', async () => {});",
    "//SKIP: TRADE-123\ntest.skip('places a market order', async () => {});",
    // Only code before a comment on the same line takes it out of the block, not another comment.
    "/* Waiting on the broker sandbox. */ // SKIP: TRADE-123\ntest.skip('places a market order', async () => {});",
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
    "// SKIP: TRADE-1...\ntest.skip('cancels an order', async () => {});",
    "// SKIP: TRADE-1 .\ntest.skip('cancels an order', async () => {});",
    "/*\r\n * Waiting on the broker sandbox.\r\n * SKIP: TRADE-1\r\n */\r\ntest.skip('places an order', async () => {});",
    // A lone CR, a line separator and a paragraph separator also end a line.
    "/*\r * Waiting on the broker sandbox.\r * SKIP: TRADE-1\r */\rtest.skip('places an order', async () => {});",
    "/*\u2028 * Waiting on the broker sandbox.\u2029 * SKIP: TRADE-1\u2028 */\ntest.skip('places an order', async () => {});",
    // Notes after the ticket are allowed with allowNotes.
    ...[
      "// SKIP: TRADE-123 flaky on CI\ntest.skip('streams price updates', async () => {});",
      "// SKIP: TRADE-1, TRADE-2 both needed\ntest.skip('streams price updates', async () => {});",
      "// SKIP: TRADE-1: flaky\ntest.skip('streams price updates', async () => {});",
    ].map((code) => ({ code, settings: settings({ allowNotes: true }) })),
    // A note on a marker that doesn't belong here is no-orphaned-marker's job.
    "// SKIP: TRADE-1 left over\ntest('shows prices', async () => {});",
    "// FIXME: TRADE-1\ntest.fixme('places an order', async ({ isMobile }) => {\n  // FIXME: TRADE-2 left over\n  test.skip(isMobile);\n});",
    "// SKIP: https://jira.example.com/browse/TRADE-1\ntest.skip('rebalances the portfolio', async () => {});",
    "// SKIP: #4821\ntest.skip('rebalances the portfolio', async () => {});",
    "// SKIP: acme/trading-engine#4821\ntest.skip('rebalances the portfolio', async () => {});",
    "// FIXME: TRADE-9\ntest.fixme('shows the order book', async () => {});",
    "// FIXME: TRADE-9\ntest.fixme('shows the order book', { tag: '@smoke' }, async () => {});",
    "/* SKIP: TRADE-1 */ test.skip('places an order', async () => {});",
    // A marker on a skipped describe covers its tests, even ones skipped again.
    "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  test('places an order', async () => {});\n  test.skip('cancels an order', async () => {});\n});",
    "// FIXME: TRADE-1\ntest.describe.fixme(() => { test('places an order', async () => {}); });",
    "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  ['AAPL', 'MSFT'].forEach((symbol) => {\n    test.skip(symbol, async () => {});\n  });\n});",
    // Conditional skips are platform limits and need no ticket by default.
    "test('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit', 'No order book on WebKit'); });",
    "test.describe('market data', () => { test.skip(({ browserName }) => browserName === 'webkit', 'n/a'); });",
    "test.describe('market data', () => { test.skip(({ browserName }) => browserName === 'webkit'); });",
    "test('places an order', async () => { test.skip(false, 'Order routing is back'); });",
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
    // The test info parameter only counts inside its own test.
    "test('exports the trade history', async ({ page }, info) => {});\nsteps.forEach((info) => info.skip());",
    // Only Playwright's test.info() returns the test info.
    "test('shows prices', async () => { broker.info().skip(); });",
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
    // Only the tag detail holds tags, and details passed as a variable can't be read.
    {
      code: "test('places an order', { description: 'Covers the @new order form' }, async () => {});",
      settings: lifecycle,
    },
    { code: "test('places an order', orderDetails, async () => {});", settings: lifecycle },
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
    "import { test } from 'uvu';\ntest.skip('calculates profit', () => {});",
    // The same runners bound to a variable, as CommonJS and AVA code usually does.
    "const test = require('node:test');\ntest.skip('calculates profit', () => {});",
    "const test = require('ava').serial;\ntest.skip('calculates profit', (t) => {});",
    "import ava from 'ava';\nconst test = ava;\ntest.skip('calculates profit', (t) => {});",
    "const tap = require('tap');\nconst test = tap.test;\ntest.skip('calculates profit', () => {});",
    "const { test: base } = require('mocha');\nconst test = base;\ntest.skip('calculates profit', () => {});",
    "const { 'test': test } = require('node:test');\ntest.skip('calculates profit', () => {});",
    // Only a key that spells out `test` takes Playwright's test.
    {
      code: "const { [test]: byName, 0: first } = require('@playwright/test');\nbyName.skip('places an order', async () => {});\nfirst.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    // Only `test` itself is taken from a Playwright require.
    "const { expect: e } = require('@playwright/test');\ne.skip('places an order', async () => {});",
    // Only `test` itself is taken from the whole Playwright module.
    {
      code: "import * as pw from '@playwright/test';\nconst config = pw.defineConfig({}), check = pw.expect, deep = market.data.test, other = broker.test;\npw.skip('places an order', async () => {});\npw.expect.skip('cancels an order', async () => {});\ncheck.skip('amends an order', async () => {});\ndeep.skip('fills an order', async () => {});\nother.skip('closes a position', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "const helpers = require('./helpers'), broker = connectBroker();\nhelpers.test.skip('places an order', async () => {});\nbroker.test.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    "const config = require('./playwright.config');\ntest('places an order', async () => {});",
    // A local variable that happens to be called `test` is not Playwright's.
    "function validateOrder() {\n  const test = { skip(name, fn) { fn(); } };\n  test.skip('checks the order size', () => {});\n}",
    "{\n  let test = orderHelpers;\n  test.skip('checks the order size', () => {});\n}",
    {
      code: "function validateOrder() {\n  const test = orderHelpers;\n  test.skip('checks the order size', () => {});\n}",
      languageOptions: { sourceType: 'commonjs' },
    },
    "function validateOrder(test) {\n  var test = orderHelpers;\n  test.skip('checks the order size', () => {});\n}",
    // A private method called #skip is not Playwright's skip.
    "class OrderForm {\n  #skip() {}\n  submit(test) {\n    test.#skip('places an order', async () => {});\n  }\n}",
    // mergeTests() of something that isn't a test, and calls that aren't mergeTests().
    "import { test as base } from '@playwright/test';\nconst t = combine(base), u = factory()(), { a } = config, { b } = load('x');\nt.skip('places an order', async () => {});\nu.skip('cancels an order', async () => {});",
    "import * as playwright from '@playwright/test';\nimport { mergeExpects } from '@playwright/test';\nconst check = mergeExpects(priceExpect, orderExpect);\ncheck.skip('places an order', async () => {});",
    // Only extend() of a test makes a new test function.
    "const broker = fixtures.base.extend({});\nbroker.skip('places an order', async () => {});",
    "const mobile = test.use({ isMobile: true });\nmobile.skip('shows the order book', async () => {});",
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
    // Nor is the test info of a call through a computed name.
    "test[method]('places an order', async ({ page }, testInfo) => { testInfo.skip(); });\ntest[0]('cancels an order', async ({ page }, testInfo) => { testInfo.skip(); });",
    "account.test.skip('places an order', async () => {});",
    "test.describe.configure({ mode: 'serial' });",
    "test.step('submits the order', async () => { other.skip(); });",
    "test.skip.each('places an order', async () => {});",
    'test.skip.each();',
    'fn()();',
    'fn()().skip();',
    { code: "test('places an order', async ({ page }, testInfo) => { testInfo[action](); });", settings: lifecycle },
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
    // A describe without a title and a runtime call have no title to check.
    ...[
      "test.describe(() => { test('places an order', async () => {}); });",
      "test('shows prices', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
    ].map((code) => ({ code, settings: settings({ lifecycleTags: true, reportDynamicTitles: true }) })),
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
      code: "const test = loadPlugin('mocha');\ntest.skip('places an order', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    // In a script, top-level variables are globals.
    {
      code: "const { test } = require('@playwright/test');\ntest.skip('places an order', async () => {});",
      languageOptions: { sourceType: 'script' },
      errors: [missing('skip', 'SKIP')],
    },
    // In CommonJS, top-level variables belong to the function that wraps the module.
    {
      code: "const { test } = require('@playwright/test');\ntest.skip('places an order', async () => {});",
      languageOptions: { sourceType: 'commonjs' },
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
    ...['// SKIP: .', '// SKIP: ...', '/* SKIP: ; */'].map((marker) => ({
      code: `${marker}\ntest.skip('places an order', async () => {});`,
      errors: [{ messageId: 'missingTicket' as const }],
    })),
    {
      code: "// FIXME:\ntest.fixme('cancels an order', async () => {});",
      errors: [{ message: '`FIXME:` needs a ticket right after the colon, e.g. `// FIXME: PROJ-123`.' }],
    },
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
    // A valid marker on the test is enough; the describe's broken marker is reported once, for the describe.
    {
      code: "// SKIP: TODO\ntest.describe.skip('order entry', () => {\n  // SKIP: TRADE-1\n  test.skip('places an order', async () => {});\n});",
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TODO' }, line: 1 }],
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
      ['// SKIP: TRADE-1, .', ', .', '// SKIP: TRADE-1'],
      ['// SKIP: TRADE-1, TRADE-2 ,', ',', '// SKIP: TRADE-1, TRADE-2'],
      ['// SKIP: TRADE-1 and TRADE-2', 'and TRADE-2', '// SKIP: TRADE-1'],
      ['// SKIP: TRADE-1 flaky, see thread', 'flaky, see thread', '// SKIP: TRADE-1'],
      ['/* SKIP: TRADE-1 flaky */', 'flaky', '/* SKIP: TRADE-1 */'],
      ['/**\r\n * SKIP: TRADE-1 see thread\r\n */', 'see thread', '/**\r\n * SKIP: TRADE-1\r\n */'],
      [
        '/**\r * Waiting on the broker.\r * SKIP: TRADE-1 see thread\r */',
        'see thread',
        '/**\r * Waiting on the broker.\r * SKIP: TRADE-1\r */',
      ],
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
    {
      code: "// SKIP: TRADE-1, flaky on CI\ntest.skip('places an order', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'flaky', state: 'skip', expected: ANY } }],
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
    // Notes on two separate markers are both reported.
    {
      code: "// SKIP: TRADE-1 flaky\ntest.skip('places an order', async () => {});\n// SKIP: TRADE-2 flaky\ntest.skip('cancels an order', async () => {});",
      errors: [
        {
          messageId: 'extraText',
          line: 1,
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "// SKIP: TRADE-1\ntest.skip('places an order', async () => {});\n// SKIP: TRADE-2 flaky\ntest.skip('cancels an order', async () => {});",
            },
          ],
        },
        {
          messageId: 'extraText',
          line: 3,
          suggestions: [
            {
              messageId: 'removeExtraText',
              output:
                "// SKIP: TRADE-1 flaky\ntest.skip('places an order', async () => {});\n// SKIP: TRADE-2\ntest.skip('cancels an order', async () => {});",
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
    {
      code: "// FIXME: TRADE-1\ntest('places an order', async () => {\n  test.skip();\n});",
      errors: [missing('skip', 'SKIP', 'This skip call')],
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
    {
      code: "if (process.env.CI) {\n  function skipOnCi() {\n    test.skip();\n  }\n  test('streams price updates', async function () {\n    test.skip();\n  });\n}",
      errors: [missing('skip', 'SKIP', 'This skip call'), missing('skip', 'SKIP', 'This skip call')],
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
    // The right side of an assignment always runs, unlike the right side of `&&`.
    {
      code: "test('shows prices', async () => { let skipped; skipped = test.skip(); });",
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
      code: "test('exports the trade history', async function ({ page }, testInfo) {\n  testInfo.skip();\n});",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('rejects an order over the position limit', async () => { test.fail(); });",
      settings: settings({ states: { fail: true } }),
      errors: [missing('fail', 'FAIL', 'This fail call')],
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
    {
      code: "test.only('places an order @new', async () => {});\ntest.describe.only('market data @unstable', () => {});\ntest.describe.parallel('order entry @unstable', () => {});",
      settings: lifecycle,
      errors: [
        missing('new', 'NEW'),
        missing('unstable', 'UNSTABLE', 'This describe block'),
        missing('unstable', 'UNSTABLE', 'This describe block'),
      ],
    },
    {
      code: "test('places an order', { 'tag': '@new' }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
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
    // A plain alias of a test.
    {
      code: "import { test as base } from '@playwright/test';\nconst orderTest = base;\norderTest.skip('places an order', async () => {});",
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
      code: "const { test } = require(4821);\nconst config = require();\ntest.skip('places an order', async () => {});",
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
    // The whole module, imported or required, with its test used as `pw.test`.
    {
      code: "import * as pw from '@playwright/test';\npw.test.skip('places an order', async () => {});\npw.test.describe.fixme('order entry', () => {});\npw.test('fills an order', async () => {\n  pw.test.skip();\n  pw.test.info().fixme();\n});",
      settings: settings({ testFunctions: [] }),
      errors: [
        missing('skip', 'SKIP'),
        missing('fixme', 'FIXME', 'This describe block'),
        missing('skip', 'SKIP', 'This skip call'),
        missing('fixme', 'FIXME', 'This fixme call'),
      ],
    },
    {
      code: "const pw = require('@playwright/test');\nconst orderTest = pw.test.extend({});\nconst both = pw.mergeTests(orderTest, marketData);\norderTest.skip('places an order', async () => {});\nboth.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP')],
    },
    {
      code: "import { test as base, expect } from '@playwright/test';\nimport other from 'other';\nexport const myTest = base.extend({}).extend({});\nconst made = make(), deep = obj.a.extend({});\nconst x = 1, y = other.extend({});\nlet z;\nexport {};\nmyTest.skip('places an order', async () => {});\ny.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const { 'test': quoted, ['test']: computed } = require('@playwright/test');\nquoted.skip('places an order', async () => {});\ncomputed.skip('cancels an order', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP')],
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
    {
      code: 'test(title, async () => {});',
      settings: settings({ lifecycleTags: true, reportDynamicTitles: true }),
      errors: [
        { message: "This title isn't static text, so its tags can't be checked. Use a string or template literal." },
      ],
    },
  ],
});
