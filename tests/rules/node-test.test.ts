import markerMatchesState from '../../src/rules/marker-matches-state.ts';
import noConflictingStates from '../../src/rules/no-conflicting-states.ts';
import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const nodeTest = { framework: 'node-test' } as const;

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});

runRule('require-ticket (node:test)', requireTicket, {
  valid: withOptions(nodeTest, [
    "import { test, it } from 'node:test';\n// SKIP: TRADE-1\ntest.skip('fills a limit order', () => {});\n// SKIP: TRADE-2\nit.skip('cancels an order', () => {});",
    "import { describe, suite } from 'node:test';\n// SKIP: TRADE-1\ndescribe.skip('order book', () => {});\n// SKIP: TRADE-2\nsuite.skip('quotes', () => {});",
    "import { test, describe } from 'node:test';\n// TODO: TRADE-1\ntest.todo('settles at T+1');\n// TODO: TRADE-2\ndescribe.todo('margin calls', () => {});",
    // The state members are exported by name too.
    "import { skip, todo } from 'node:test';\n// SKIP: TRADE-1\nskip('fills a limit order', () => {});\n// TODO: TRADE-2\ntodo('settles at T+1');",
    // An option with any value but `false` or `undefined` puts the test in its state: a string is the reason.
    "import { test } from 'node:test';\n// SKIP: TRADE-1\ntest('fills a limit order', { skip: true }, () => {});\n// SKIP: TRADE-2\ntest('cancels an order', { skip: 'broker sandbox is down' }, () => {});\n// TODO: TRADE-3\ntest('settles at T+1', { todo: 'needs the clearing API' }, () => {});",
    "import { test } from 'node:test';\ntest('fills a limit order', { skip: false, todo: undefined }, () => {});",
    // A value only known when the test runs is a condition.
    "import { test, describe } from 'node:test';\ntest('fills a limit order', { skip: process.platform === 'win32' }, () => {});\ndescribe('order book', { skip }, () => {});\ntest('cancels', { todo: !ready && 'needs the clearing API' }, () => {});",
    // `t.skip()` and `t.todo()` take a message, so with or without one they always apply.
    "import { test } from 'node:test';\ntest('fills a limit order', (t) => {\n  // SKIP: TRADE-1\n  t.skip('broker sandbox is down');\n});",
    "import { test } from 'node:test';\n// TODO: TRADE-1\ntest('settles at T+1', async (context) => {\n  context.todo();\n});",
    "import { test } from 'node:test';\ntest('fills a limit order', (t) => {\n  if (!process.env.BROKER_URL) t.skip();\n});",
    // `beforeEach` and `afterEach` get the test's context; a marker above their describe covers them.
    "import { describe, beforeEach } from 'node:test';\n// SKIP: TRADE-1\ndescribe('order book', () => {\n  beforeEach((t) => {\n    t.skip();\n  });\n});",
    // A describe's body, and `before` and `after` in it, get the suite's context, which can't skip.
    "import { describe, before, after } from 'node:test';\ndescribe('order book', (suite) => {\n  suite.skip();\n  before((s) => s.skip());\n  after((s) => s.todo());\n});",
    // Their `this` is that context too, and an arrow function has none of its own.
    "import { describe, before, after, test } from 'node:test';\ndescribe('order book', function () {\n  this.skip();\n  before(function () {\n    this.skip();\n  });\n  after(function () {\n    this.todo();\n  });\n});\ntest('fills a limit order', () => {\n  this.skip();\n});",
    // Subtests declared through the context.
    "import { test } from 'node:test';\ntest('order book', async (t) => {\n  // SKIP: TRADE-1\n  await t.test('fills a limit order', { skip: true }, () => {});\n  await t.test('cancels an order', (t) => {\n    // SKIP: TRADE-2\n    t.skip();\n  });\n});",
    // A subtest with no function passes, as a test does.
    "import { test } from 'node:test';\ntest('order book', async (t) => {\n  await t.test('settles at T+1');\n});",
    // Not a context: `test` on any other object, and a regex's `test`.
    "import { test } from 'node:test';\nconst client = { test() {} };\nclient.test('fills a limit order', { skip: true }, () => {});\ntest('quotes', () => {\n  /^Q-/.test(quote);\n});",
    // node:test lets a test or describe leave out its title.
    "import { test, describe } from 'node:test';\n// SKIP: TRADE-1\ntest({ skip: true }, () => {});\ndescribe(() => {});\ntest(function fillsALimitOrder() {});",
    // A test with no function is a passing no-op, not a todo.
    "import { test, it } from 'node:test';\ntest('settles at T+1');\nit('cancels at the close');",
    // `.only` and these options and context methods change no state.
    "import { test } from 'node:test';\ntest.only('fills a limit order', { only: true, timeout: 1_000, concurrency: 2, plan: 1 }, (t) => {\n  t.plan(1);\n  t.runOnly(true);\n  t.diagnostic('filled');\n});",
    // `fail` is off by default.
    "import { test } from 'node:test';\ntest.expectFailure('rejects a short sale', () => {});\ntest('rejects a margin call', { expectFailure: /margin/ }, () => {});",
    // The module is `test` itself, with the other functions as its members.
    "const test = require('node:test');\n// SKIP: TRADE-1\ntest.skip('fills a limit order', () => {});\n// SKIP: TRADE-2\ntest.describe.skip('order book', () => {});",
    "import test from 'node:test';\n// SKIP: TRADE-1\ntest.suite.skip('order book', () => {});",
    "const { test: check, describe } = require('node:test');\n// SKIP: TRADE-1\ncheck.skip('fills', () => {});\n// SKIP: TRADE-2\ndescribe.skip('order book', () => {});",
    // Names from other runners.
    "import { test } from 'vitest';\ntest.skip('fills a limit order', () => {});",
    "import { it } from 'mocha';\nit.skip('fills a limit order', () => {});",
    "import test from 'ava';\ntest.skip('fills a limit order', () => {});",
    // node:test has no globals besides `testFunctions`.
    "describe.skip('order book', () => {});\nsuite.skip('quotes', () => {});",
  ]),
  invalid: withOptions(nodeTest, [
    {
      code: "import { test, it, describe, suite } from 'node:test';\ntest.skip('fills', () => {});\nit.skip('cancels', () => {});\ndescribe.skip('order book', () => {});\nsuite.skip('quotes', () => {});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
        { ...missing('skip', 'SKIP', 'This describe block'), line: 4 },
        { ...missing('skip', 'SKIP', 'This describe block'), line: 5 },
      ],
    },
    // `test.skip('title')` with no function is a skipped test.
    {
      code: "import { test } from 'node:test';\ntest.skip('fills a limit order');",
      errors: [{ ...missing('skip', 'SKIP'), line: 2 }],
    },
    {
      code: "import { test, it, describe } from 'node:test';\ntest.todo('settles');\nit.todo('cancels', () => {});\ndescribe.todo('margin calls', () => {});",
      errors: [
        { ...missing('todo', 'TODO'), line: 2 },
        { ...missing('todo', 'TODO'), line: 3 },
        { ...missing('todo', 'TODO', 'This describe block'), line: 4 },
      ],
    },
    {
      code: "import { skip as later, todo } from 'node:test';\nlater('fills', () => {});\ntodo('settles');",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('todo', 'TODO'), line: 3 },
      ],
    },
    // Node skips a test whose `skip` is any value but `false` or `undefined`, `''`, `0` and `null` included.
    {
      code: "import { test } from 'node:test';\ntest('a', { skip: true }, () => {});\ntest('b', { skip: 'flaky' }, () => {});\ntest('c', { skip: '' }, () => {});\ntest('d', { skip: 0 }, () => {});\ntest('e', { skip: null }, () => {});\ntest('f', { skip: `on ${os}` }, () => {});",
      errors: [2, 3, 4, 5, 6, 7].map((line) => ({ ...missing('skip', 'SKIP'), line })),
    },
    {
      code: "import { describe, test } from 'node:test';\ndescribe('order book', { todo: 'needs the clearing API' }, () => {});\nconst options = { skip: 'flaky' };\ntest('fills', options, () => {});",
      errors: [
        { ...missing('todo', 'TODO', 'This describe block'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 4 },
      ],
    },
    // Node reports a test in one state only: skip, else todo, else expectFailure.
    {
      code: "import { describe, test } from 'node:test';\ndescribe.skip('order book', { todo: 'needs the clearing API' }, () => {});\ntest('fills', { skip: true, todo: 'later', expectFailure: true }, () => {});\ntest.todo('settles', { expectFailure: true }, () => {});\ntest.expectFailure('cancels', { skip: 'flaky' }, () => {});",
      errors: [
        { ...missing('skip', 'SKIP', 'This describe block'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
        { ...missing('todo', 'TODO'), line: 4 },
        { ...missing('skip', 'SKIP'), line: 5 },
      ],
      settings: settings({ states: { fail: true } }),
    },
    // A skip that applies only sometimes leaves the todo for the other runs.
    {
      code: "import { test } from 'node:test';\ntest('fills', { skip: isWindows, todo: 'later' }, () => {});",
      errors: [missing('todo', 'TODO')],
    },
    {
      code: "import { test } from 'node:test';\ntest('fills', { skip: process.platform === 'win32' }, () => {});\ntest('cancels', { skip: isCI ? 'slow' : false }, () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
      ],
    },
    {
      code: "import { test } from 'node:test';\ntest('fills a limit order', (t) => {\n  t.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 3 }],
    },
    {
      code: "import { test } from 'node:test';\ntest('fills a limit order', async (context) => {\n  await connect();\n  context.skip('broker sandbox is down');\n  context.todo('needs the clearing API');\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This skip call'), line: 4 },
        { ...missing('todo', 'TODO', 'This todo call'), line: 5 },
      ],
    },
    {
      code: "import { test } from 'node:test';\ntest('fills a limit order', (t) => {\n  if (isMobile) t.skip();\n});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 3 }],
    },
    {
      code: "import { describe, beforeEach, afterEach } from 'node:test';\ndescribe('order book', () => {\n  beforeEach((t) => t.skip());\n  afterEach((t) => {\n    t.todo();\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This skip call'), line: 3 },
        { ...missing('todo', 'TODO', 'This todo call'), line: 5 },
      ],
    },
    // A test, subtest or `beforeEach` written as a `function` gets the context as `this` as well.
    {
      code: "import { test, describe, beforeEach } from 'node:test';\ntest('fills a limit order', function () {\n  this.skip('broker sandbox is down');\n});\ntest('settles at T+1', async function () {\n  this.todo();\n});\ndescribe('order book', () => {\n  beforeEach(function () {\n    this.skip();\n  });\n});\ntest('quotes', async (t) => {\n  await t.test('cancels an order', function () {\n    this.skip();\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This skip call'), line: 3 },
        { ...missing('todo', 'TODO', 'This todo call'), line: 6 },
        { ...missing('skip', 'SKIP', 'This skip call'), line: 10 },
        { ...missing('skip', 'SKIP', 'This skip call'), line: 15 },
      ],
    },
    // A subtest takes the same options, and its body gets a context of its own.
    {
      code: "import { test } from 'node:test';\ntest('order book', async (t) => {\n  await t.test('fills', { skip: true }, () => {});\n  t.test('settles', { todo: 'later' });\n  await t.test('cancels', async (t) => {\n    t.skip();\n    await t.test({ skip: 'flaky' }, () => {});\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 3 },
        { ...missing('todo', 'TODO'), line: 4 },
        { ...missing('skip', 'SKIP', 'This skip call'), line: 6 },
        { ...missing('skip', 'SKIP'), line: 7 },
      ],
    },
    // A title left out: the options come first, or hold the name.
    {
      code: "import { test, describe } from 'node:test';\ntest({ skip: true }, () => {});\ntest({ name: 'settles at T+1', todo: true });\ndescribe({ skip: 'flaky' }, () => {});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2, column: 1, endColumn: 5 },
        { ...missing('todo', 'TODO'), line: 3 },
        { ...missing('skip', 'SKIP', 'This describe block'), line: 4 },
      ],
    },
    {
      code: "const test = require('node:test');\ntest.skip('fills', () => {});\ntest.describe.skip('order book', () => {});\ntest('cancels', { skip: true }, () => {});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('skip', 'SKIP', 'This describe block'), line: 3 },
        { ...missing('skip', 'SKIP'), line: 4 },
      ],
    },
    {
      code: "const nodeTest = require('node:test');\nnodeTest('fills', { skip: true }, () => {});\nnodeTest.it.todo('settles');",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('todo', 'TODO'), line: 3 },
      ],
    },
    {
      code: "import check from 'node:test';\ncheck.describe.skip('order book', () => {});\ncheck.todo('settles');",
      errors: [
        { ...missing('skip', 'SKIP', 'This describe block'), line: 2 },
        { ...missing('todo', 'TODO'), line: 3 },
      ],
    },
    {
      code: "import * as nodeTest from 'node:test';\nnodeTest.it.skip('fills', () => {});\nnodeTest.skip('cancels', () => {});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
      ],
    },
    {
      code: "import { test, describe, expectFailure } from 'node:test';\ntest.expectFailure('rejects a short sale', () => {});\ntest('rejects a margin call', { expectFailure: /margin/ }, () => {});\ndescribe('limits', { expectFailure: { label: 'not built', match: /limit/ } }, () => {});\nexpectFailure('rejects a stop order', () => {});",
      settings: settings({ states: { fail: true } }),
      errors: [
        { ...missing('fail', 'FAIL'), line: 2 },
        { ...missing('fail', 'FAIL'), line: 3 },
        { ...missing('fail', 'FAIL', 'This describe block'), line: 4 },
        { ...missing('fail', 'FAIL'), line: 5 },
      ],
    },
    {
      code: "import { it } from 'node:test';\n(isCI ? it.skip : it)('fills a limit order', () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [{ ...missing('skip', 'SKIP'), line: 2 }],
    },
    {
      code: "import { test, describe } from 'node:test';\ntest('fills a limit order @new', () => {});\ndescribe('order book @quarantined', () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [
        { ...missing('new', 'NEW'), line: 2 },
        { ...missing('quarantined', 'QUARANTINED', 'This describe block'), line: 3 },
      ],
    },
    // `testFunctions` counts without an import, as for a project's own wrapper.
    {
      code: "test.skip('fills', () => {});\nit.todo('settles');",
      errors: [missing('skip', 'SKIP'), missing('todo', 'TODO')],
    },
  ]),
});

runRule('marker-matches-state (node:test)', markerMatchesState, {
  valid: withOptions(nodeTest, [
    "import { test } from 'node:test';\n// TODO: TRADE-1\ntest('settles', { todo: true }, () => {});",
  ]),
  invalid: withOptions(nodeTest, [
    {
      code: "import { test } from 'node:test';\n// SKIP: TRADE-1\ntest('settles', { todo: true }, () => {});",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'TODO', state: 'todo', subject: 'this test' },
          suggestions: [
            {
              messageId: 'renameMarker',
              output: "import { test } from 'node:test';\n// TODO: TRADE-1\ntest('settles', { todo: true }, () => {});",
            },
          ],
        },
      ],
    },
  ]),
});

runRule('no-orphaned-marker (node:test)', noOrphanedMarker, {
  valid: withOptions(nodeTest, [
    "import { test } from 'node:test';\n// SKIP: TRADE-1\ntest('fills', { skip: 'flaky' }, () => {});",
    "import { test } from 'node:test';\n// SKIP: TRADE-1\ntest('fills', (t) => {\n  t.skip();\n});",
  ]),
  invalid: withOptions(nodeTest, [
    {
      code: "import { test } from 'node:test';\n// SKIP: TRADE-1\ntest('fills', { skip: false }, () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "import { test } from 'node:test';\ntest('fills', { skip: false }, () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "import { describe } from 'node:test';\n// SKIP: TRADE-1\ndescribe('order book', (suite) => {\n  suite.skip();\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output:
                "import { describe } from 'node:test';\ndescribe('order book', (suite) => {\n  suite.skip();\n});",
            },
          ],
        },
      ],
    },
  ]),
});

runRule('no-conflicting-states (node:test)', noConflictingStates, {
  valid: withOptions({ ...nodeTest, lifecycleTags: true }, [
    "import { test } from 'node:test';\ntest('fills a limit order @new', { skip: isWindows }, () => {});",
  ]),
  invalid: withOptions({ ...nodeTest, lifecycleTags: true }, [
    {
      code: "import { test } from 'node:test';\ntest('fills a limit order @new', { skip: 'flaky' }, () => {});",
      errors: [{ messageId: 'newSkipped' }],
    },
    {
      code: "import { test } from 'node:test';\ntest('settles at T+1 @new', (t) => {\n  t.todo();\n});",
      errors: [{ messageId: 'newSkipped' }],
    },
  ]),
});

// Only node:test declares subtests through the context and reads any option value.
for (const framework of ['playwright', 'vitest'] as const) {
  runRule(`require-ticket (node:test syntax in ${framework})`, requireTicket, {
    valid: withOptions({ framework }, [
      "test('order book', async (t) => {\n  await t.test('fills', { skip: true }, () => {});\n});",
      "test('fills', { skip: 'flaky' }, () => {});",
    ]),
    invalid: [],
  });
}
