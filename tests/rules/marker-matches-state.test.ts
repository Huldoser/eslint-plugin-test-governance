import rule from '../../src/rules/marker-matches-state.ts';
import { runRule, settings } from '../helpers.ts';

const lifecycle = settings({ lifecycleTags: true });

runRule('marker-matches-state', rule, {
  valid: [
    "// SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
    "test.skip('cancels an order', async () => {});",
    "// NOTE: TRADE-1\ntest.skip('shows prices', async () => {});",
    // A stray marker on a test with nothing missing is no-orphaned-marker's job.
    "// FIXME: TRADE-1\ntest('places a limit order', async () => {});",
    {
      code: "// SKIP: TRADE-1\n// NEW: TRADE-2\ntest.skip('places a market order @new', async () => {});",
      settings: lifecycle,
    },
    // A broken marker is require-ticket's job, not a mismatch.
    "// SKIP: TODO\ntest.skip('rejects orders after market close', async () => {});",
    // Conditional skips don't need a marker, so nothing is missing.
    "// FIXME: TRADE-1\ntest('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
    // A work comment above a skipped test isn't a marker for another state; require-ticket-in-comments
    // and require-ticket report it.
    "// FIXME: solve test intermitencies\ntest.skip('streams price updates', async () => {});",
    "// FIXME: flaky\ntest.skip('shows live prices', async () => {});",
    // A marker for an inherited state is redundant, not wrong.
    "// SKIP: TRADE-1\ntest.describe.skip('order entry', () => {\n  // SKIP: TRADE-1\n  test('places an order', async () => {});\n});",
  ],
  invalid: [
    {
      code: "// SKIP: TRADE-123 flaky\ntest.fixme('fills a partial order', async () => {});",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'FIXME', state: 'fixme', subject: 'this test' },
          suggestions: [
            {
              messageId: 'renameMarker',
              data: { expected: 'FIXME' },
              output: "// FIXME: TRADE-123 flaky\ntest.fixme('fills a partial order', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "/*\n * Context first. SKIP: is not a marker here\n * SKIP : TRADE-1\n */\ntest.fixme('cancels an open order', async () => {});",
      errors: [
        {
          messageId: 'wrongMarker',
          suggestions: [
            {
              messageId: 'renameMarker',
              output:
                "/*\n * Context first. FIXME: is not a marker here\n * SKIP : TRADE-1\n */\ntest.fixme('cancels an open order', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "test('rebalances the portfolio', async () => {\n  // FIXME: TRADE-1\n  test.skip();\n});",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'FIXME', expected: 'SKIP', state: 'skip', subject: 'this skip call' },
          suggestions: [
            {
              messageId: 'renameMarker',
              output: "test('rebalances the portfolio', async () => {\n  // SKIP: TRADE-1\n  test.skip();\n});",
            },
          ],
        },
      ],
    },
    {
      code: "// UNSTABLE: TRADE-1\ntest.describe.skip('risk limits @new', () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'UNSTABLE', expected: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            {
              messageId: 'renameMarker',
              data: { expected: 'SKIP' },
              output: "// SKIP: TRADE-1\ntest.describe.skip('risk limits @new', () => {});",
            },
            {
              messageId: 'renameMarker',
              data: { expected: 'NEW' },
              output: "// NEW: TRADE-1\ntest.describe.skip('risk limits @new', () => {});",
            },
          ],
        },
      ],
    },
    // One marker for a test in two states.
    {
      code: "// SKIP: TRADE-1, TRADE-2\ntest.skip('triggers a stop-loss @unstable', async () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'sharedMarker',
          data: { found: 'SKIP', foundState: 'skip', expected: 'UNSTABLE', state: 'unstable', subject: 'This test' },
          suggestions: [
            {
              messageId: 'addMarker',
              data: { expected: 'UNSTABLE', tickets: 'TRADE-1, TRADE-2' },
              output:
                "// SKIP: TRADE-1, TRADE-2\n// UNSTABLE: TRADE-1, TRADE-2\ntest.skip('triggers a stop-loss @unstable', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "test.describe('portfolio', () => {\n  /* NEW: TRADE-1 */\n  test.fixme('calculates profit and loss @new', async () => {});\n});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'sharedMarker',
          data: { found: 'NEW', foundState: 'new', expected: 'FIXME', state: 'fixme', subject: 'This test' },
          suggestions: [],
        },
      ],
    },
    {
      code: "// SKIP:\ntest.skip('exports the trade history @new', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'sharedMarker', suggestions: [] }],
    },
  ],
});
