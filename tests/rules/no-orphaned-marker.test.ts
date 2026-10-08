import rule from '../../src/rules/no-orphaned-marker.ts';
import { runRule, settings } from '../helpers.ts';

const lifecycle = settings({ lifecycleTags: true });

runRule('no-orphaned-marker', rule, {
  valid: [
    // A test in an arrow function's expression body takes its marker above the call or the statement.
    "['AAPL', 'MSFT'].forEach((symbol) =>\n  // SKIP: TRADE-1\n  test.skip(symbol, async () => {}),\n);",
    "// SKIP: TRADE-1\n['AAPL', 'MSFT'].forEach((symbol) => test.skip(symbol, async () => {}));",
    "// SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
    "// Plain comment\ntest('shows prices', async () => {});",
    '// skip: lowercase is not a marker here\nconst x = 1;',
    // A lowercase keyword away from any test is not a marker.
    "test('places an order', async () => {});\n// skip: TRADE-1\nconst broker = connectBroker();",
    // With lifecycleTags off, NEW: isn't a known marker.
    "// NEW: TRADE-1\ntest('places a limit order', async () => {});",
    { code: "// NEW: TRADE-1\ntest('places a limit order @new', async () => {});", settings: lifecycle },
    // Marker above a conditional skip, or above the test that holds one, is fine.
    "// SKIP: TRADE-1\ntest.skip(({ browserName }) => browserName === 'webkit');",
    "// SKIP: TRADE-1\ntest('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
    // A test inside a skipped describe may repeat the marker.
    "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  // SKIP: TRADE-1\n  test('places an order', async () => {});\n});",
    // A mismatch next to a missing marker is marker-matches-state's job.
    "// SKIP: TRADE-1\ntest.fixme('cancels an order', async () => {});",
    // An ordinary comment that happens to start with a marker keyword is not a leftover ticket.
    "test('shows live prices', async ({ page }) => {\n  // FIXME: this check is flaky on slow machines\n  await page.goto('/orders');\n});",
    // FIXME and TODO are work comments; require-ticket-in-comments checks them, not this rule.
    "test('places a market order', async ({ page }) => {\n  // FIXME: TRADE-1\n  await page.goto('/orders');\n});",
    "// FIXME: later\nconst x = 1;\ntest('shows prices', async () => {});",
    "// TODO: TRADE-5\ntest('exports the trade history', async () => {});",
    "// FIXME:\ntest('calculates profit and loss', async () => {});",
    // Files without Playwright tests are not checked at all.
    'const x = 1; // SKIP: TRADE-1',
    "import { loadPrices } from './market-data';\n// SKIP: TRADE-1\nloadPrices();",
    // A Playwright import alone makes it a test file.
    {
      code: "import { expect } from '@playwright/test';\n// FIXME: TRADE-1\nexpect(1).toBe(1);",
    },

    '// FIXME: how to restrict it to frames only\nconst matchers = {};',
    "// SKIP: flaky on CI, see TRADE-1\ntest('streams price updates', async () => {});",
  ],
  invalid: [
    // A malformed ticket still reads as a marker.
    {
      code: "// SKIP: trade-12\ntest('cancels an order', async () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('cancels an order', async () => {});" }],
        },
      ],
    },
    {
      code: "// NEW: TRADE-12 promoted last sprint\ntest('places an order', async () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'NEW', state: 'new', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('places an order', async () => {});" }],
        },
      ],
    },
    {
      code: "test.describe('order entry', () => {\n  // SKIP: TRADE-1\n  test.describe('limit orders', () => {});\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "test.describe('order entry', () => {\n  test.describe('limit orders', () => {});\n});",
            },
          ],
        },
      ],
    },
    {
      code: "/* SKIP: TRADE-1 */ test('shows prices', async () => {});",
      errors: [
        {
          messageId: 'orphaned',
          suggestions: [{ messageId: 'removeMarker', output: " test('shows prices', async () => {});" }],
        },
      ],
    },
    {
      code: "test('shows the order book', async ({ page }) => {\n  // SKIP: TRADE-1\n  await page.goto('/orders');\n});",
      errors: [
        {
          messageId: 'detached',
          data: { marker: 'SKIP' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "test('shows the order book', async ({ page }) => {\n  await page.goto('/orders');\n});",
            },
          ],
        },
      ],
    },
    // Custom states are covered too.
    {
      code: "// NEEDS-DATA: TRADE-1\ntest('backtests a moving-average strategy', async () => {});\nconst y = 2; // NEEDS-DATA: TRADE-2",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'NEEDS-DATA', state: 'needs-data', subject: 'this test' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output:
                "test('backtests a moving-average strategy', async () => {});\nconst y = 2; // NEEDS-DATA: TRADE-2",
            },
          ],
        },
        {
          messageId: 'detached',
          data: { marker: 'NEEDS-DATA' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output:
                "// NEEDS-DATA: TRADE-1\ntest('backtests a moving-average strategy', async () => {});\nconst y = 2; ",
            },
          ],
        },
      ],
    },
    {
      code: "test('fills a partial order', async () => {});\nconst x = 1; // SKIP: TRADE-1",
      errors: [
        {
          messageId: 'detached',
          suggestions: [
            { messageId: 'removeMarker', output: "test('fills a partial order', async () => {});\nconst x = 1; " },
          ],
        },
      ],
    },
    {
      code: "test('shows the order book', async () => {});\nconst depth = 10; // SKIP: TRADE-1",
      errors: [
        {
          message: '`SKIP:` is not directly above a test, describe or skip call, so it has no effect.',
          suggestions: [
            { messageId: 'removeMarker', output: "test('shows the order book', async () => {});\nconst depth = 10; " },
          ],
        },
      ],
    },
    {
      code: "// SKIP: TRADE-1\n\ntest.skip('rebalances the portfolio', async () => {});",
      errors: [
        {
          messageId: 'detached',
          suggestions: [
            { messageId: 'removeMarker', output: "\ntest.skip('rebalances the portfolio', async () => {});" },
          ],
        },
      ],
    },
  ],
});
