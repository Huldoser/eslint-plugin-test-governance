import markerMatchesState from '../../src/rules/marker-matches-state.ts';
import noConflictingStates from '../../src/rules/no-conflicting-states.ts';
import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const jasmine = { framework: 'jasmine' } as const;

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});

runRule('require-ticket (Jasmine)', requireTicket, {
  valid: withOptions(jasmine, [
    "// SKIP: TRADE-1\nxit('fills a limit order', () => {});\n// SKIP: TRADE-2\nxdescribe('order book', () => {\n  it('cancels an order', () => {});\n});",
    // `xit` with only a title is pending too, and `it` with only a title is a test still to write.
    "// SKIP: TRADE-1\nxit('fills a limit order');\n// TODO: TRADE-2\nit('settles at T+1');",
    // `pending()` skips the running test; its marker goes above the call or above the test.
    "it('fills a limit order', () => {\n  // SKIP: TRADE-1\n  pending();\n});\n// SKIP: TRADE-2\nit('cancels an order', async () => {\n  await connect();\n  pending('broker sandbox is down');\n});",
    // In `beforeEach` or `afterEach` it skips each test, so a marker above the describe covers it.
    "// SKIP: TRADE-1\ndescribe('order book', () => {\n  beforeEach(() => {\n    pending('broker sandbox is down');\n  });\n  it('fills a limit order', () => {});\n});",
    "// SKIP: TRADE-1\ndescribe('order book', () => {\n  afterEach(() => pending());\n});",
    // Jasmine 7's `notApplicable()` skips the test the same way.
    "it('prints the stack trace', () => {\n  // SKIP: TRADE-1\n  notApplicable('no stack traces in this browser');\n});",
    // Under a condition, a skip needs no ticket by default.
    "it('fills a limit order', () => {\n  if (isNode) pending('needs a browser');\n  if (isFirefox()) {\n    notApplicable('no month input in Firefox');\n  }\n  isSafari && pending();\n  try {\n    connect();\n  } catch {\n    pending('broker sandbox is down');\n  }\n});",
    "(isFirefox() ? xit : it)('binds the month input', () => {});\n(isVite ? describe : xdescribe)('budgets', () => {});",
    // In `beforeAll`, `afterAll` or a describe's body, `pending()` fails the suite instead of skipping it.
    "describe('order book', () => {\n  beforeAll(() => pending());\n  afterAll(() => {\n    pending('flaky');\n  });\n  pending();\n});\npending();",
    // A helper the file declares under the same name is not Jasmine's.
    "function pending() {}\nit('fills a limit order', () => {\n  pending();\n});",
    "import { pending } from './orders';\nconst { notApplicable } = helpers;\nit('fills a limit order', () => {\n  pending();\n  notApplicable();\n});",
    "it('fills a limit order', (pending) => {\n  const notApplicable = () => {};\n  pending();\n  notApplicable();\n});",
    "const [pending] = queue;\nlet notApplicable;\nit('fills a limit order', () => {\n  pending();\n  notApplicable();\n});",
    "import { pending } from 'jasmine-core';\nit('fills a limit order', () => {\n  const pending = () => {};\n  pending();\n});",
    // Focus, failure and the timeout change no state, nor does WebdriverIO's `retries` argument.
    "fit('fills a limit order', () => {\n  fail('rejected');\n}, 5_000);\nfdescribe('order book', () => {});\nit('cancels an order', async () => {}, 10_000, 2);",
    // Jasmine has no `it.skip`, `describe.skip`, `this.skip()` or `test`.
    "it.skip('fills a limit order', () => {});\ndescribe.skip('order book', () => {});\ntest.skip('cancels an order', () => {});\nit('quotes', function () {\n  this.skip();\n});",
    // The same names imported from `jasmine-core`, as Jasmine 7 allows with `globals: false`.
    "const { it: spec, xit, pending: pend } = require('jasmine-core');\n// SKIP: TRADE-1\nxit('fills a limit order', () => {});\nspec('cancels an order', () => {\n  // SKIP: TRADE-2\n  pend();\n});",
    "import { xdescribe } from 'jasmine-core';\n// SKIP: TRADE-1\nxdescribe('order book', () => {});",
    "const core = require('jasmine-core');\n// SKIP: TRADE-1\ncore.xit('fills a limit order', () => {});",
    // Names from other runners.
    "import { xit } from '@jest/globals';\nxit('fills a limit order', () => {});",
    "const { xdescribe } = require('mocha');\nxdescribe('order book', () => {});",
  ]),
  invalid: withOptions(jasmine, [
    {
      code: "xit('fills a limit order', () => {});\nxdescribe('order book', () => {});\nxit('cancels an order');",
      errors: [
        { ...missing('skip', 'SKIP'), line: 1 },
        { ...missing('skip', 'SKIP', 'This describe block'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
      ],
    },
    {
      code: "it('settles at T+1');",
      errors: [{ ...missing('todo', 'TODO'), line: 1 }],
    },
    {
      code: "it('fills a limit order', () => {\n  pending();\n});\nit('cancels an order', () => {\n  orders.forEach(() => {\n    pending('broker sandbox is down');\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This pending call'), line: 2 },
        { ...missing('skip', 'SKIP', 'This pending call'), line: 6 },
      ],
    },
    {
      code: "describe('order book', () => {\n  beforeEach(() => pending('These are pretty broken, investigate.'));\n  afterEach(() => {\n    notApplicable('no order book here');\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This pending call'), line: 2 },
        { ...missing('skip', 'SKIP', 'This notApplicable call'), line: 4 },
      ],
    },
    // A function picked on both branches applies whichever is picked.
    {
      code: "(isVite ? xdescribe : xdescribe)('allowed hosts', () => {});",
      errors: [{ ...missing('skip', 'SKIP', 'This describe block'), line: 1 }],
    },
    {
      code: "it('fills a limit order', () => {\n  if (isNode) pending();\n});\n(isFirefox() ? xit : it)('binds the month input', () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [
        { ...missing('skip', 'SKIP', 'This pending call'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 4 },
      ],
    },
    {
      code: "import { it, pending as pend } from 'jasmine-core';\nit('fills a limit order', () => {\n  pend();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This pending call'), line: 3 }],
    },
    {
      code: "import { xdescribe } from 'jasmine-core';\nconst core = require('jasmine-core');\nxdescribe('order book', () => {});\ncore.xit('fills a limit order', () => {});",
      errors: [
        { ...missing('skip', 'SKIP', 'This describe block'), line: 3 },
        { ...missing('skip', 'SKIP'), line: 4 },
      ],
    },
    // A global declared for ESLint, as `globals.jasmine` does, is still Jasmine's.
    {
      code: "/* global pending */\nit('fills a limit order', () => {\n  pending();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This pending call'), line: 3 }],
    },
  ]),
});

runRule('marker-matches-state (Jasmine)', markerMatchesState, {
  valid: withOptions(jasmine, ["// TODO: TRADE-1\nit('settles at T+1');"]),
  invalid: withOptions(jasmine, [
    {
      code: "// TODO: TRADE-1\nxit('settles at T+1');",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'TODO', expected: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [{ messageId: 'renameMarker', output: "// SKIP: TRADE-1\nxit('settles at T+1');" }],
        },
      ],
    },
  ]),
});

runRule('no-orphaned-marker (Jasmine)', noOrphanedMarker, {
  valid: withOptions(jasmine, [
    "// SKIP: TRADE-1\nit('fills a limit order', () => {\n  pending();\n});",
    "it('fills a limit order', () => {\n  // SKIP: TRADE-1\n  notApplicable('no stack traces here');\n});",
  ]),
  invalid: withOptions(jasmine, [
    {
      code: "// SKIP: TRADE-1\nfit('fills a limit order', () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "fit('fills a limit order', () => {});" }],
        },
      ],
    },
    {
      code: "// SKIP: TRADE-1\ndescribe('order book', () => {\n  beforeAll(() => pending());\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            { messageId: 'removeMarker', output: "describe('order book', () => {\n  beforeAll(() => pending());\n});" },
          ],
        },
      ],
    },
  ]),
});

runRule('no-conflicting-states (Jasmine)', noConflictingStates, {
  valid: withOptions({ ...jasmine, lifecycleTags: true }, [
    // Angular's `@if` and `@Input` in a title aren't state tags.
    "it('renders @if blocks and @Input() bindings', () => {});",
    "it('fills a limit order @new', () => {\n  if (isNode) pending();\n});",
  ]),
  invalid: withOptions({ ...jasmine, lifecycleTags: true }, [
    {
      code: "xit('fills a limit order @new', () => {});",
      errors: [{ messageId: 'newSkipped' }],
    },
    {
      code: "it('settles at T+1 @new', () => {\n  pending('needs the clearing API');\n});",
      errors: [{ messageId: 'newSkipped' }],
    },
  ]),
});

// Only Jasmine reads `pending()` and `notApplicable()`.
for (const framework of ['jest', 'mocha'] as const) {
  runRule(`require-ticket (Jasmine syntax in ${framework})`, requireTicket, {
    valid: withOptions({ framework }, [
      "it('fills a limit order', () => {\n  pending();\n  notApplicable('no stack traces here');\n});",
    ]),
    invalid: [],
  });
}
