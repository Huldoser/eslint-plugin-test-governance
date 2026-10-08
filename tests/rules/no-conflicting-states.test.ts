import rule from '../../src/rules/no-conflicting-states.ts';
import { runRule, settings } from '../helpers.ts';

const lifecycle = settings({ lifecycleTags: true });
const custom = settings({ customStates: { quarantine: { when: '@quarantine', marker: 'QUARANTINE' } } });

runRule('no-conflicting-states', rule, {
  valid: [
    "test('places an order @New @unstabel', async () => {});",
    { code: "test('places a limit order @new', async () => {});", settings: lifecycle },
    { code: "test('shows live prices @unstable @smoke @news @neww', async () => {});", settings: lifecycle },
    { code: "test.skip('cancels an open order @unstable', async () => {});", settings: lifecycle },
    {
      code: "test('shows the order book', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
      settings: lifecycle,
    },
    // A conditional skip doesn't make a new test skipped.
    {
      code: "test('shows the order book @new', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
      settings: lifecycle,
    },
    {
      code: "test.describe('order entry @new', () => { test('places an order', async () => {}); });",
      settings: lifecycle,
    },
    { code: "test('streams price updates @quarantine', async () => {});", settings: custom },
    // Real words two or more letters away in length are not typos.
    { code: "test('fills a partial order @stable @untestable', async () => {});", settings: lifecycle },
    // Only @unstable is on: no @new checks.
    {
      code: "test.skip('amends the order price @new @unstable', async () => {});",
      settings: settings({ states: { unstable: true } }),
    },
    {
      code: "test('rebalances the portfolio @new @unstable', async () => {});",
      settings: settings({ states: { new: true } }),
    },
  ],
  invalid: [
    {
      code: "test('places a market order @new @unstable', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', data: { new: '@new', unstable: '@unstable' } }],
    },
    {
      code: "test.describe('risk limits @unstable', () => {\n  test('stops trading at the daily loss limit', { tag: '@new' }, async () => {});\n  test('caps position size at 2% of equity', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', line: 2 }],
    },
    // Both tags inherited: reported once, on the describe where they first meet.
    {
      code: "test.describe('order entry @new', () => {\n  test.describe('limit orders @unstable', () => {\n    test.describe('amendments', () => { test('amends an order', async () => {}); });\n  });\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', line: 2 }],
    },
    {
      code: "test.describe('market data @new', () => { test('streams price updates @unstable', async () => {}); });",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable' }],
    },
    {
      code: "test.skip('exports the trade history @new', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', data: { new: '@new' } }],
    },
    {
      code: "test.describe.fixme('backtesting @new', () => {\n  test('backtests a moving-average strategy', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 1 }],
    },
    {
      code: "test.describe('order entry @new', () => {\n  test.skip('cancels an order', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 2, column: 3 }],
    },
    {
      code: "test.describe.skip('portfolio', () => {\n  test('calculates profit and loss @new', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 2 }],
    },
    {
      code: "test('rejects orders after market close @new', async () => {\n  test.skip();\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped' }],
    },
    {
      code: "test.skip('shows the order book @new', async () => {});",
      settings: lifecycle,
      errors: [
        {
          message:
            "`@new` on a skipped test: a new test that doesn't run can't be promoted. Fix the test or drop the tag.",
        },
      ],
    },
    {
      code: "test.describe('risk limits', () => {\n  test.skip(true);\n  test('triggers a stop-loss when the price drops @new', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 3 }],
    },
    {
      code: "test('places a limit order @New', async () => {});",
      settings: lifecycle,
      output: "test('places a limit order @new', async () => {});",
      errors: [{ messageId: 'tagCase', data: { found: '@New', expected: '@new' } }],
    },
    {
      code: "test('shows live prices', { tag: ['@smoke', '@UNSTABLE'] }, async () => {});",
      settings: lifecycle,
      output: "test('shows live prices', { tag: ['@smoke', '@unstable'] }, async () => {});",
      errors: [{ messageId: 'tagCase', data: { found: '@UNSTABLE', expected: '@unstable' } }],
    },
    {
      code: "test('shows quotes @Quarantine and fills @Quarantine', async () => {});",
      settings: custom,
      output: "test('shows quotes @quarantine and fills @quarantine', async () => {});",
      errors: [{ messageId: 'tagCase' }, { messageId: 'tagCase' }],
    },
    // No fix when the tag is written with an escape in the source.
    {
      code: "test('cancels an open order \\u0040New', async () => {});",
      settings: lifecycle,
      output: null,
      errors: [{ messageId: 'tagCase' }],
    },
    // `\u002D` is a hyphen, so the last tag is `@New-beta` and stays as written.
    {
      code: "test('places an order @New and amends it @New @New\\u002Dbeta', async () => {});",
      settings: lifecycle,
      output: "test('places an order @new and amends it @new @New\\u002Dbeta', async () => {});",
      errors: [{ messageId: 'tagCase' }, { messageId: 'tagCase' }],
    },
    // After an escape the source no longer lines up with the title, so there is no fix.
    {
      code: "test('places an order @New\\u002Dbeta @New', async () => {});",
      settings: lifecycle,
      output: null,
      errors: [{ messageId: 'tagCase', data: { found: '@New', expected: '@new' } }],
    },
    // A template reads a CRLF line break as LF, so it doesn't line up either.
    {
      code: 'test(`places an order\r\n@New`, async () => {});',
      settings: lifecycle,
      output: null,
      errors: [{ messageId: 'tagCase' }],
    },
    // A tag after a template expression is fixed in its own part of the template.
    {
      code: 'test(`places a ${side} order @New`, async () => {});',
      settings: lifecycle,
      output: 'test(`places a ${side} order @new`, async () => {});',
      errors: [{ messageId: 'tagCase' }],
    },
    {
      code: "test('amends the order price @unstabel', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@unstabel', expected: '@unstable' } }],
    },
    {
      code: 'test(`buys ${symbol} @quarantin`, async () => {});',
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantin', expected: '@quarantine' } }],
    },
    {
      code: "test('stops trading at the daily loss limit', { tag: ['@unstble', '@stable'] }, async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@unstble', expected: '@unstable' } }],
    },
    {
      code: "test('caps position size at 2% of equity @qurantiine', async () => {});",
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@qurantiine', expected: '@quarantine' } }],
    },
  ],
});
