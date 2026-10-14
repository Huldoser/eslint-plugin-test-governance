import rule from '../../src/rules/no-conflicting-states.ts';
import { runRule, settings } from '../helpers.ts';

const lifecycle = settings({ lifecycleTags: true });
const custom = settings({ customStates: { quarantine: { when: '@quarantine', marker: 'QUARANTINE' } } });
const flaky = settings({ lifecycleTags: true, states: { quarantined: { tag: '@flaky', marker: 'FLAKY' } } });

runRule('no-conflicting-states', rule, {
  valid: [
    "test('places an order @New @quarantiend', async () => {});",
    { code: "test('places a limit order @new', async () => {});", settings: lifecycle },
    { code: "test('shows live prices @quarantined @smoke @news @neww', async () => {});", settings: lifecycle },
    { code: "test.skip('cancels an open order @quarantined', async () => {});", settings: lifecycle },
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
    { code: "test('fills a partial order @unquarantined @requarantined', async () => {});", settings: lifecycle },
    // Only @quarantined is on: no @new checks.
    {
      code: "test.skip('amends the order price @new @quarantined', async () => {});",
      settings: settings({ states: { quarantined: true } }),
    },
    {
      code: "test('rebalances the portfolio @new @quarantined', async () => {});",
      settings: settings({ states: { new: true } }),
    },
    // A skipped step doesn't skip its test, so a new test with one still runs.
    {
      code: "test('places an order @new', async () => {\n  await test.step.skip('confirms the fill', async () => {});\n});",
      settings: lifecycle,
    },
    {
      code: "test('places an order @new', async () => {\n  await test.step('fills the order', async (step) => {\n    step.skip();\n  });\n});",
      settings: lifecycle,
    },
  ],
  invalid: [
    // A tag from a constant is reported where the test uses it. The constant may be shared, so there is no autofix.
    {
      code: "const TAGS = { NEW: '@New' };\ntest('places an order', { tag: TAGS.NEW }, async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagCase', data: { found: '@New', expected: '@new' }, line: 2, column: 32, endColumn: 40 }],
    },
    {
      code: "test('places a market order @new @quarantined', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndQuarantined', data: { new: '@new', quarantined: '@quarantined' } }],
    },
    {
      code: "test.describe('risk limits @quarantined', () => {\n  test('stops trading at the daily loss limit', { tag: '@new' }, async () => {});\n  test('caps position size at 2% of equity', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndQuarantined', line: 2 }],
    },
    // Both tags inherited: reported once, on the describe where they first meet.
    {
      code: "test.describe('order entry @new', () => {\n  test.describe('limit orders @quarantined', () => {\n    test.describe('amendments', () => { test('amends an order', async () => {}); });\n  });\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndQuarantined', line: 2 }],
    },
    {
      code: "test.describe('market data @new', () => { test('streams price updates @quarantined', async () => {}); });",
      settings: lifecycle,
      errors: [{ messageId: 'newAndQuarantined' }],
    },
    {
      code: "test.describe('market data @new', () => {\n  test.describe('level 2', () => { test('streams the order book @quarantined', async () => {}); });\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndQuarantined', line: 2 }],
    },
    // A renamed tag gets the same checks.
    {
      code: "test('places a market order @new @flaky', async () => {});",
      settings: flaky,
      errors: [{ messageId: 'newAndQuarantined', data: { new: '@new', quarantined: '@flaky' } }],
    },
    {
      code: "test('places a market order @flakey', async () => {});",
      settings: flaky,
      errors: [{ messageId: 'tagTypo', data: { found: '@flakey', expected: '@flaky' } }],
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
      code: "test('shows live prices', { tag: ['@smoke', '@QUARANTINED'] }, async () => {});",
      settings: lifecycle,
      output: "test('shows live prices', { tag: ['@smoke', '@quarantined'] }, async () => {});",
      errors: [{ messageId: 'tagCase', data: { found: '@QUARANTINED', expected: '@quarantined' } }],
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
      code: "test('amends the order price @quarantiend', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantiend', expected: '@quarantined' } }],
    },
    // A team that says `@quarantine` hears about it, and can rename the tag to keep it.
    {
      code: "test('amends the order price @quarantine', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantine', expected: '@quarantined' } }],
    },
    {
      code: 'test(`buys ${symbol} @quarantin`, async () => {});',
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantin', expected: '@quarantine' } }],
    },
    {
      code: "test('stops trading at the daily loss limit', { tag: ['@quarantned', '@unquarantined'] }, async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantned', expected: '@quarantined' } }],
    },
    {
      code: "test('caps position size at 2% of equity @qurantiine', async () => {});",
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@qurantiine', expected: '@quarantine' } }],
    },
    // `test.skip()` inside a step skips the whole test.
    {
      code: "test('places an order @new', async () => {\n  await test.step('fills the order', async () => {\n    test.skip();\n  });\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 1 }],
    },
  ],
});
