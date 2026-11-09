import markerMatchesState from '../../src/rules/marker-matches-state.ts';
import consistentTagNames from '../../src/rules/consistent-tag-names.ts';
import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicketInComments from '../../src/rules/require-ticket-in-comments.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const jest = { framework: 'jest' } as const;

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});

runRule('require-ticket (Jest)', requireTicket, {
  valid: withOptions(jest, [
    "// SKIP: TRADE-1\ntest.skip('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nit.skip('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nxit('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nxtest('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nxdescribe('order book', () => {\n  it('shows the best bid', () => {});\n});",
    "// SKIP: TRADE-1\ndescribe.skip('order book', () => {\n  it.skip('shows the best bid', () => {});\n});",
    "// SKIP: TRADE-1\ntest.concurrent.skip('streams quotes', async () => {});",
    // A timeout after the body, with a title that isn't static text.
    '// SKIP: TRADE-1\ntest.skip(title, async () => {}, 10_000);',
    // A title held in a variable and a body defined elsewhere.
    '// SKIP: TRADE-1\ntest.skip(title, fillLimitOrder);',
    // Jest tests have no details object, so a second argument never hides a tag.
    {
      code: "test('fills a limit order', orderCase, () => {});",
      settings: settings({
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    // Jest's hooks get no test context to skip with.
    'beforeEach((context) => {\n  context.skip();\n});',
    // Tests built from a table.
    "test.each([[1], [2]])('buys %i shares', (shares) => {});",
    "// SKIP: TRADE-1\ntest.skip.each([[1], [2]])('buys %i shares', (shares) => {});",
    "// SKIP: TRADE-1\nxit.each([[1]])('buys %i shares', (shares) => {});",
    "// SKIP: TRADE-1\ndescribe.skip.each([['AAPL'], ['MSFT']])('%s order book', (symbol) => {});",
    "// SKIP: TRADE-1\ntest.skip.each`\n  shares\n  ${1}\n`('buys $shares shares', ({ shares }) => {});",
    // A todo test takes a TODO marker.
    "// TODO: TRADE-1\ntest.todo('fills a partial order');",
    "// TODO: TRADE-1\nit.todo('fills a partial order');",
    // `only`, `fit` and `fdescribe` change no state, and `failing` needs a marker only when `fail` is on.
    "test.only('fills a limit order', () => {});\nfit('fills a market order', () => {});\nfdescribe('order book', () => {});",
    "test.failing('rejects an order above the buying power', () => {});",
    {
      code: "// FAIL: TRADE-1\ntest.failing('rejects an order above the buying power', () => {});",
      settings: settings({ states: { fail: true } }),
    },
    { code: "test.todo('fills a partial order');", settings: settings({ states: { todo: false } }) },
    // Imports and requires from @jest/globals, with their own names.
    "import { it as check, xdescribe as skipGroup } from '@jest/globals';\n// SKIP: TRADE-1\ncheck.skip('fills', () => {});\n// SKIP: TRADE-2\nskipGroup('order book', () => {});",
    "import * as j from '@jest/globals';\n// SKIP: TRADE-1\nj.it.skip('fills', () => {});",
    "const { test: check } = require('@jest/globals');\n// SKIP: TRADE-1\ncheck.skip('fills', () => {});",
    "const { expect } = require('@jest/globals');\nexpect.skip('fills', () => {});",
    // Playwright's and Vitest's tests, and Playwright-only calls, are not Jest's.
    "import { test } from '@playwright/test';\ntest.skip('fills a limit order', async () => {});",
    "import { test } from 'vitest';\ntest.skip('fills a limit order', () => {});",
    "const { describe } = require('vitest');\ndescribe.skip('order book', () => {});",
    "test.fixme('fills a limit order', () => {});",
    "test('fills a limit order', () => { test.skip(); });",
    "test.describe.skip('order book', () => {});",
    "test.step.skip('confirms the fill', () => {});",
    // A default import from @jest/globals is not a test function.
    "import globals from '@jest/globals';\nglobals.skip('fills', () => {});",
    // Jest has no test context, so a test's first parameter is just a name.
    "test('fills a limit order', (done) => { done.skip(); });",
    // A test's title only.
    "test.skip('fills a limit order');",
    // A test or describe whose function a condition picks is skipped only sometimes.
    "(process.env.CI ? describe.skip : describe)('order book', () => {\n  it('shows the best bid', () => {});\n});",
    {
      code: "const symbol = 'AAPL'\n// SKIP: TRADE-1\n;(process.env.CI ? it.skip : it)('fills a limit order', () => {})",
      settings: settings({ requireTicketForConditional: true }),
    },
    {
      code: "// SKIP: TRADE-1\n;(process.env.CI ? it.skip : it)('fills a limit order', () => {})",
      settings: settings({ requireTicketForConditional: true }),
    },
    // A condition that picks a function other than a test, or a test or a describe, declares nothing.
    "(process.env.CI ? it : renderOrderBook)('order book', () => {});",
    "(process.env.CI ? renderOrderBook : it)('order book', () => {});",
    "(process.env.CI ? describe : it)('order book', () => {});",
    // Jest's `skip` needs a body, which a `todo` doesn't have.
    "(process.env.CI ? it.skip : it.todo)('fills a partial order');",
    "(process.env.CI ? it.todo : it.skip)('fills a partial order');",
  ]),
  invalid: withOptions(jest, [
    {
      code: "test.skip('fills a limit order', () => {});",
      errors: [{ ...missing('skip', 'SKIP'), line: 1, column: 1, endColumn: 32 }],
    },
    // A constant that holds a test function built from a table, or one declared inside a describe.
    {
      code: "const itSkip = it.skip.each([[1], [2]]);\nitSkip('buys %i shares', () => {});",
      errors: [{ ...missing('skip', 'SKIP'), line: 2 }],
    },
    {
      code: "describe('order book', () => {\n  const itSkip = it.skip;\n  itSkip('shows the best bid', () => {});\n});",
      errors: [{ ...missing('skip', 'SKIP'), line: 3 }],
    },
    // A constant whose test function a condition picks skips sometimes, like `test.skip(isCI)`.
    {
      code: "const itUnlessWindows = isWindows ? it.skip : it;\nitUnlessWindows('fills a limit order', () => {});",
      settings: settings({ framework: 'jest', requireTicketForConditional: true }),
      errors: [{ ...missing('skip', 'SKIP'), line: 2 }],
    },
    { code: "it.skip('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "xit('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "xtest('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "xdescribe('order book', () => {\n  it('shows the best bid', () => {});\n});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "describe.skip('order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    { code: "test.concurrent.skip('streams quotes', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: 'test.skip(title, async () => {}, 10_000);', errors: [missing('skip', 'SKIP')] },
    // Jest has no runtime `test.skip(condition)`, so these declare skipped tests.
    {
      code: "const title = 'fills a limit order';\ntest.skip(title, fillLimitOrder);",
      errors: [{ ...missing('skip', 'SKIP'), line: 2 }],
    },
    {
      code: 'describe.skip(suiteName, defineOrderBookTests);',
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "test.skip.each([[1], [2]])('buys %i shares', (shares) => {});",
      errors: [{ ...missing('skip', 'SKIP'), line: 1, column: 1, endColumn: 44 }],
    },
    { code: "xit.each([[1]])('buys %i shares', (shares) => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "describe.skip.each([['AAPL']])('%s order book', (symbol) => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "test.todo('fills a partial order');",
      errors: [{ ...missing('todo', 'TODO'), line: 1, column: 1, endColumn: 34 }],
    },
    { code: "it.todo('fills a partial order');", errors: [missing('todo', 'TODO')] },
    {
      code: "test.failing('rejects an order above the buying power', () => {});",
      settings: settings({ states: { fail: true } }),
      errors: [missing('fail', 'FAIL')],
    },
    {
      code: "test('fills a limit order @new', () => {});",
      settings: settings({
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      errors: [missing('new', 'NEW')],
    },
    // `only`, `fit` and `fdescribe` change no state, but the tags in their titles do.
    {
      code: "test.only('fills a limit order @new', () => {});\nfit('fills a market order @new', () => {});\nfdescribe('order book @quarantined', () => {});\ndescribe.only('order entry @quarantined', () => {});",
      settings: settings({
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      errors: [
        missing('new', 'NEW'),
        missing('new', 'NEW'),
        missing('quarantined', 'QUARANTINED', 'This describe block'),
        missing('quarantined', 'QUARANTINED', 'This describe block'),
      ],
    },
    {
      code: "import { xit } from '@jest/globals';\nxit('fills a limit order', () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { test as check, it as spec, describe as group } from '@jest/globals';\ncheck.skip('fills a limit order', () => {});\nspec.skip('fills a market order', () => {});\ngroup.skip('order book', () => {});",
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP'), missing('skip', 'SKIP', 'This describe block')],
    },
    // `testFunctions` replaces `test` and `it`; Jest's other globals stay.
    {
      code: "it.skip('fills a limit order', () => {});\ntest.skip('fills a stop order', () => {});\ncheck.skip('fills a market order', () => {});\nxit('cancels an order', () => {});",
      settings: settings({ testFunctions: ['check'] }),
      errors: [
        { ...missing('skip', 'SKIP'), line: 3 },
        { ...missing('skip', 'SKIP'), line: 4 },
      ],
    },
    {
      code: "import * as j from '@jest/globals';\nj.describe.skip('order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "const { xdescribe: skipGroup } = require('@jest/globals');\nskipGroup('order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "const check = it;\ncheck.skip('fills a limit order', () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const s = it.skip;\ns('fills a limit order', () => {});\nconst { skip } = it;\nskip('fills a limit order', () => {});",
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP')],
    },
    {
      code: "(process.env.CI ? describe.skip : describe)('order book', () => {\n  it('shows the best bid', () => {});\n});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "const symbol = 'AAPL'\n;(process.env.CI ? it.skip : it)('fills a limit order', () => {})",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP')],
    },
    // Both functions skip, so the test always does.
    {
      code: "(process.env.CI ? it.skip : xit)('fills a limit order', () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "(process.env.CI ? describe.skip : describe)('order book @new', () => {\n  it('shows the best bid', () => {});\n});",
      settings: settings({
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      errors: [missing('new', 'NEW', 'This describe block')],
    },
    // A marker above a line that starts with another statement isn't the test's.
    {
      code: "// SKIP: TRADE-1\nconst title = 'fills a limit order'; it.skip(title, () => {});",
      errors: [missing('skip', 'SKIP')],
    },
  ]),
});

runRule('marker-matches-state (Jest)', markerMatchesState, {
  valid: withOptions(jest, [
    "// TODO: TRADE-1\ntest.todo('fills a partial order');",
    // An `eslint-disable` region's marker covers every test up to its `eslint-enable`, not only the first.
    "/* eslint-disable no-console -- SKIP: TRADE-1 */\ntest.todo('fills a partial order');\ntest.skip('fills a limit order', () => {});",
  ]),
  invalid: withOptions(jest, [
    {
      code: "// SKIP: TRADE-1\ntest.todo('fills a partial order');",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'TODO', state: 'todo', subject: 'this test' },
          suggestions: [{ messageId: 'renameMarker', output: "// TODO: TRADE-1\ntest.todo('fills a partial order');" }],
        },
      ],
    },
  ]),
});

runRule('no-orphaned-marker (Jest)', noOrphanedMarker, {
  valid: withOptions(jest, [
    "// TODO: TRADE-1\ntest.todo('fills a partial order');",
    // A TODO without a ticket is a work comment, which require-ticket-in-comments checks.
    "// TODO: cover partial fills\ntest('fills a limit order', () => {});",
    // FIXME is not a state in Jest, even when turned on, so a FIXME comment is a work comment too.
    "// FIXME: TRADE-1\ntest('fills a limit order', () => {});",
    {
      code: "// FIXME: TRADE-1\ntest('fills a limit order', () => {});\n// SLOW: TRADE-2\ntest('backtests a year of quotes', () => {});",
      settings: settings({ states: { fixme: true, slow: true } }),
    },
    // A TODO with a ticket above a test that isn't a todo is a tracked work comment about the test.
    "// TODO: TRADE-1\ntest('fills a partial order', () => {});",
    "// TODO: TRADE-1\ndescribe('order book', () => {\n  it('shows the best bid', () => {});\n});",
    "// TODO: #7348 keep the fills in time order\ntest('fills a partial order', () => {});",
    "// Todo: TRADE-1\ntest('fills a partial order', () => {});",
    // A marker above a test or describe whose function a condition picks belongs to it.
    "// SKIP: TRADE-1\n(process.env.CI ? describe.skip : describe)('order book', () => {\n  it('shows the best bid', () => {});\n});",
    "const symbol = 'AAPL'\n// SKIP: TRADE-1\n;(process.env.CI ? describe : describe.skip)('order book', () => {})",
    // A marker above a test whose function a constant picks with a condition belongs to it.
    "const itUnlessWindows = process.platform === 'win32' ? it.skip : it;\n// SKIP: TRADE-1\nitUnlessWindows('fills a limit order', () => {});\ntest('cancels an order', () => {});",
    // An `eslint-disable` region directly above a describe or a test covers the skipped tests after it.
    "/* eslint-disable no-console -- SKIP: TRADE-1 */\ndescribe('order book', () => {\n  it('shows the best bid', () => {});\n  it.skip('shows the best ask', () => {});\n});",
    "/* eslint-disable no-console -- SKIP: TRADE-1 */\ntest('fills a limit order', () => {});\ntest.skip('fills a partial order', () => {});\n/* eslint-enable no-console */",
  ]),
  invalid: withOptions(jest, [
    // A todo marker under its own keyword is still checked.
    {
      code: "// PENDING: TRADE-1\ntest('fills a partial order', () => {});",
      settings: settings({ states: { todo: { marker: 'PENDING' } } }),
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'PENDING', state: 'todo', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('fills a partial order', () => {});" }],
        },
      ],
    },
    {
      code: "// SKIP: TRADE-1\ntest('fills a partial order', () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('fills a partial order', () => {});" }],
        },
      ],
    },
  ]),
});

runRule('consistent-tag-names (Jest)', consistentTagNames, {
  valid: withOptions(
    {
      ...jest,
      customStates: {
        new: { when: '@new', marker: 'NEW' },
        quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
      },
    },
    [
      "test('fills a limit order @new', () => {});",
      // Custom tags do not impose lifecycle conflicts.
      { code: "xit('fills a limit order @new', () => {});" },
      { code: "test.todo('fills a partial order @new');" },
    ],
  ),
  invalid: [],
});

runRule('require-ticket-in-comments (Jest)', requireTicketInComments, {
  valid: withOptions(jest, [
    // A TODO marker above a todo test belongs to require-ticket.
    "// TODO: TRADE-1\ntest.todo('fills a partial order');",
    // So does one in the wrong case, which require-ticket reports as `markerCase`.
    "// todo: fills need a quote feed\ntest.todo('fills a partial order');",
    // Files without Jest tests are not checked.
    'export function fillOrder() {\n  // TODO: later\n}',
    // A todo marker in an `eslint-disable` region belongs to require-ticket too, which reports its note.
    "/* eslint-disable no-console -- TODO: TRADE-1 rewrite after the API change */\nimport { test } from '@jest/globals';\n\ntest.todo('fills a partial order');",
    "/* eslint-disable no-console -- TODO: TRADE-1 rewrite after the API change */\ntest.todo('fills a partial order');",
  ]),
  invalid: withOptions(jest, [
    {
      code: "describe('order book', () => {\n  // TODO: later\n  it('shows the best bid', () => {});\n});",
      errors: [{ messageId: 'missingTicket' }],
    },
    // A TODO above a test that isn't a todo is a work comment, so the note after its ticket is reported here.
    {
      code: "// TODO: TRADE-1 keep the fills in time order\ntest('fills a partial order', () => {});",
      errors: [
        {
          messageId: 'extraText',
          suggestions: [
            { messageId: 'removeExtraText', output: "// TODO: TRADE-1\ntest('fills a partial order', () => {});" },
          ],
        },
      ],
    },
  ]),
});
