import markerMatchesState from '../../src/rules/marker-matches-state.ts';
import noConflictingStates from '../../src/rules/no-conflicting-states.ts';
import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const vitest = { framework: 'vitest' } as const;

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});

runRule('require-ticket (Vitest)', requireTicket, {
  valid: withOptions(vitest, [
    "// SKIP: TRADE-1\ntest.skip('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nit.skip('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nsuite.skip('order book', () => {});",
    "// SKIP: TRADE-1\ntest.concurrent.skip('streams quotes', async () => {});",
    "// SKIP: TRADE-1\ntest.skip.concurrent('streams quotes', async () => {});",
    "import { test } from 'vitest';\n// SKIP: TRADE-1\ntest.skip('fills a limit order', () => {});",
    // The options object: `{ skip: true }` skips, `false` doesn't, and anything else only sometimes does.
    "// SKIP: TRADE-1\ntest('fills a limit order', { skip: true }, () => {});",
    "// SKIP: TRADE-1\ndescribe('order book', { 'skip': true }, () => {});",
    "test('fills a limit order', { skip: false, timeout: 5_000 }, () => {});",
    "test('fills a limit order', { skip: process.env.CI === 'true' }, () => {});",
    "test('fills a limit order', { [option]: true, ...defaults }, () => {});",
    // skipIf and runIf skip only sometimes, so they need no ticket by default.
    "test.skipIf(process.env.CI)('fills a limit order', () => {});",
    "test.runIf(process.platform === 'linux')('fills a limit order', () => {});",
    "describe.skipIf(isMobile)('order book', () => {});",
    "test.skipIf(isMobile).each([1, 2])('buys %i shares', (shares) => {});",
    "test.skipIf(isMobile).concurrent('streams quotes', async () => {});",
    // A todo test or describe takes a TODO marker.
    "// TODO: TRADE-1\ntest.todo('fills a partial order');",
    "// TODO: TRADE-1\ndescribe.todo('order book');",
    "// TODO: TRADE-1\ntest('fills a partial order', { todo: true });",
    // `fails` needs a marker only when the `fail` state is on.
    "test.fails('rejects an order above the buying power', () => {});",
    {
      code: "// FAIL: TRADE-1\ntest.fails('rejects an order above the buying power', () => {});\n// FAIL: TRADE-2\ntest('rejects a short sale', { fails: true }, () => {});",
      settings: settings({ states: { fail: true } }),
    },
    // Skipping from the test context.
    "test('fills a limit order', (context) => {\n  // SKIP: TRADE-1\n  context.skip();\n});",
    "// SKIP: TRADE-1\ntest('fills a limit order', ({ skip }) => {\n  skip();\n});",
    "test('fills a limit order', ({ skip: skipTest }) => {\n  // SKIP: TRADE-1\n  skipTest();\n});",
    "test('fills a limit order', (context) => {\n  context.skip(isMobile, 'No order ticket on mobile');\n});",
    "test('fills a limit order', ({ skip }) => {\n  if (isMobile) skip();\n});",
    // A skip with only a note is a call the test makes once it is running, so it needs no ticket.
    "test('fills a limit order', (context) => {\n  context.skip('Broker sandbox is down');\n});",
    "test.for([1, 2])('buys %i shares', (shares, context) => {\n  // SKIP: TRADE-1\n  context.skip();\n});",
    // A table row is not the test context.
    "test.each([{ skip: () => {} }])('buys shares', (row) => {\n  row.skip();\n});",
    "test('fills a limit order', ({ task, expect }) => {\n  task.skip();\n  expect.skip();\n});",
    "test('fills a limit order', ({ skip: [first] }) => {\n  first();\n});",
    'skip();\ncontext.skip();',
    // Fixtures made with test.extend() are tests too.
    "const orderTest = test.extend({ broker: async ({}, use) => use({}) });\n// SKIP: TRADE-1\norderTest.skip('fills a limit order', () => {});",
    // Tags in the title and in `tags`.
    {
      code: "// NEW: TRADE-1\ntest('fills a limit order', { tags: ['@new', 'smoke'] }, () => {});\n// NEW: TRADE-2\ntest('fills a market order @new', () => {});",
      settings: settings({ lifecycleTags: true }),
    },
    // Vitest tag names are written without the `@`: `new` is the `@new` tag.
    {
      code: "// NEW: TRADE-1\ntest('fills a limit order', { tags: ['new', `smoke`] }, () => {});",
      settings: settings({ lifecycleTags: true }),
    },
    {
      code: "const QUARANTINE = 'quarantine';\n// QUARANTINE: TRADE-1\ndescribe('order book', { tags: [QUARANTINE] }, () => {});",
      settings: settings({ customStates: { quarantine: { when: '@quarantine', marker: 'QUARANTINE' } } }),
    },
    // A skip in beforeEach, global or imported, skips the tests it runs before.
    "// SKIP: TRADE-1\ndescribe('order book', () => {\n  beforeEach(({ skip }) => {\n    skip();\n  });\n  test('fills a limit order', () => {});\n});",
    "import { beforeEach as setup } from 'vitest';\nsetup((context) => {\n  // SKIP: TRADE-1\n  context.skip();\n});",
    'beforeEach((context) => {\n  if (isMobile) context.skip();\n});',
    // Not Vitest: Playwright's and Jest's tests, Playwright-only calls and Jest's x/f functions.
    "import { test } from '@playwright/test';\ntest.skip('fills a limit order', async () => {});",
    "import { describe } from '@jest/globals';\ndescribe.skip('order book', () => {});",
    "test.fixme('fills a limit order', () => {});",
    "xit('fills a limit order', () => {});",
    "test.step.skip('confirms the fill', () => {});",
    "import vitestDefault from 'vitest';\nvitestDefault.skip('fills a limit order', () => {});",
  ]),
  invalid: withOptions(vitest, [
    { code: "test.skip('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "it.skip('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "suite.skip('order book', () => {});", errors: [missing('skip', 'SKIP', 'This describe block')] },
    { code: "test.skip.concurrent('streams quotes', async () => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "import { it as check, suite as group } from 'vitest';\ncheck.skip('fills', () => {});\ngroup.skip('order book', () => {});",
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "import * as vi from 'vitest';\nvi.test.skip('fills', () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test('fills a limit order', { skip: true }, () => {});",
      errors: [{ ...missing('skip', 'SKIP'), line: 1, column: 1, endColumn: 27 }],
    },
    {
      code: "describe('order book', { skip: true }, () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    // An unconditional skip stays one when the options also skip conditionally.
    {
      code: "test.skip('fills a limit order', { skip: isMobile }, () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test.skipIf(process.env.CI)('fills a limit order', () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "describe.runIf(isLinux)('order book', () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    { code: "test.skip.each([1, 2])('buys %i shares', (shares) => {});", errors: [missing('skip', 'SKIP')] },
    { code: "test.skip.for([1, 2])('buys %i shares', (shares) => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "describe.skip.each`\n  symbol\n  ${'AAPL'}\n`('$symbol order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    { code: "test.todo('fills a partial order');", errors: [missing('todo', 'TODO')] },
    { code: "describe.todo('order book');", errors: [missing('todo', 'TODO', 'This describe block')] },
    { code: "test('fills a partial order', { todo: true });", errors: [missing('todo', 'TODO')] },
    {
      code: "test('rejects a short sale', { fails: true }, () => {});",
      settings: settings({ states: { fail: true } }),
      errors: [missing('fail', 'FAIL')],
    },
    {
      code: "test('fills a limit order', (context) => {\n  context.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "test('fills a limit order', async function ({ skip: skipTest }) {\n  skipTest();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "test.for([1, 2])('buys %i shares', (shares, { skip }) => {\n  skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "describe('order book', () => {\n  test.beforeEach((context) => {\n    context.skip();\n  });\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 3 }],
    },
    {
      code: "test('fills a limit order', { tags: '@new' }, () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test('fills a limit order', { tags: 'unstable' }, () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [missing('unstable', 'UNSTABLE')],
    },
    {
      code: "beforeEach((context) => {\n  context.skip();\n});\ntest('fills a limit order', () => {});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "import { beforeEach as setup } from 'vitest';\ndescribe('order book', () => {\n  setup(({ skip }) => {\n    skip();\n  });\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 4 }],
    },
    {
      code: "const orderTest = test.extend({ broker: async ({}, use) => use({}) });\norderTest.skip('fills a limit order', () => {});",
      errors: [missing('skip', 'SKIP')],
    },
  ]),
});

runRule('marker-matches-state (Vitest)', markerMatchesState, {
  valid: withOptions(vitest, ["// TODO: TRADE-1\ntest('fills a partial order', { todo: true });"]),
  invalid: withOptions(vitest, [
    {
      code: "// SKIP: TRADE-1\ndescribe.todo('order book');",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'TODO', state: 'todo', subject: 'this describe block' },
          suggestions: [{ messageId: 'renameMarker', output: "// TODO: TRADE-1\ndescribe.todo('order book');" }],
        },
      ],
    },
  ]),
});

runRule('no-orphaned-marker (Vitest)', noOrphanedMarker, {
  valid: withOptions(vitest, [
    // An options object from another file may skip the test, so its marker may well be right.
    "import { orderOptions } from './options';\n// SKIP: TRADE-1\ntest('fills a limit order', orderOptions, () => {});",
    {
      code: "// NEW: TRADE-1\ntest('fills a limit order', { tags: ['new'] }, () => {});",
      settings: settings({ lifecycleTags: true }),
    },
  ]),
  invalid: withOptions(vitest, [
    {
      code: "const options = { tags: ['smoke'] };\n// SKIP: TRADE-1\ntest('fills a limit order', options, () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "const options = { tags: ['smoke'] };\ntest('fills a limit order', options, () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "// NEW: TRADE-1\ntest('fills a limit order', { tags: ['smoke'] }, () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'NEW', state: 'new', subject: 'this test' },
          suggestions: [
            { messageId: 'removeMarker', output: "test('fills a limit order', { tags: ['smoke'] }, () => {});" },
          ],
        },
      ],
    },
  ]),
});

runRule('no-conflicting-states (Vitest)', noConflictingStates, {
  valid: withOptions({ ...vitest, lifecycleTags: true }, [
    // A conditional skip leaves the test running elsewhere.
    "test.skipIf(isMobile)('fills a limit order @new', () => {});",
    "test('fills a limit order @new', { skip: isMobile }, () => {});",
    "test('fills a limit order', { tags: ['@new'] }, ({ skip }) => {\n  if (isMobile) skip();\n});",
  ]),
  invalid: withOptions({ ...vitest, lifecycleTags: true }, [
    { code: "test('fills a limit order @new', { skip: true }, () => {});", errors: [{ messageId: 'newSkipped' }] },
    {
      code: "test('fills a limit order', { tags: ['@new'] }, ({ skip }) => {\n  skip();\n});",
      errors: [{ messageId: 'newSkipped' }],
    },
    {
      code: "test('fills a limit order', { tags: ['@New'] }, () => {});",
      output: "test('fills a limit order', { tags: ['@new'] }, () => {});",
      errors: [{ messageId: 'tagCase' }],
    },
    // A tag name is shown and fixed without the `@` it is written without.
    {
      code: "test('fills a limit order', { tags: ['New', 'unstabel'] }, () => {});",
      output: "test('fills a limit order', { tags: ['new', 'unstabel'] }, () => {});",
      errors: [
        { messageId: 'tagCase', data: { found: 'New', expected: 'new' } },
        { messageId: 'tagTypo', data: { found: 'unstabel', expected: 'unstable' } },
      ],
    },
    {
      code: "const QUEUE = 'New';\ntest('fills a limit order', { tags: [QUEUE, 'N\\u0065w'] }, () => {});",
      errors: [
        { messageId: 'tagCase', data: { found: 'New', expected: 'new' }, column: 38 },
        { messageId: 'tagCase', data: { found: 'New', expected: 'new' }, column: 45 },
      ],
    },
  ]),
});
