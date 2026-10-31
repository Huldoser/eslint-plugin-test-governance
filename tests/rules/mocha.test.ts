import markerMatchesState from '../../src/rules/marker-matches-state.ts';
import noConflictingStates from '../../src/rules/no-conflicting-states.ts';
import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const mocha = { framework: 'mocha' } as const;
const cypress = { framework: 'cypress' } as const;
const webdriverio = { framework: 'webdriverio' } as const;

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});

runRule('require-ticket (Mocha)', requireTicket, {
  valid: withOptions(mocha, [
    "// SKIP: TRADE-1\nit.skip('fills a limit order', function () {});",
    "// SKIP: TRADE-1\nspecify.skip('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nxit('fills a limit order', () => {});",
    "// SKIP: TRADE-1\nxspecify('fills a limit order');",
    "// SKIP: TRADE-1\ndescribe.skip('order book', () => {});",
    "// SKIP: TRADE-1\ncontext.skip('when the market is closed', () => {});",
    "// SKIP: TRADE-1\nxdescribe('order book', () => {});\n// SKIP: TRADE-2\nxcontext('when the market is closed', () => {});",
    // Mocha skips a describe with no body without complaint.
    "// SKIP: TRADE-1\ndescribe.skip('order book');",
    // The TDD interface.
    "// SKIP: TRADE-1\nsuite.skip('order book', function () {});\n// SKIP: TRADE-2\ntest.skip('fills a limit order', function () {});",
    // Names imported or required from mocha, which exports the TDD names but not `context` or `specify`.
    "import { describe as block, it as check } from 'mocha';\n// SKIP: TRADE-1\ncheck.skip('fills', () => {});\n// SKIP: TRADE-2\nblock.skip('order book', () => {});",
    "const { it, suite } = require('mocha');\n// SKIP: TRADE-1\nit.skip('fills', () => {});\n// SKIP: TRADE-2\nsuite.skip('order book', () => {});",
    "import * as mocha from 'mocha';\n// SKIP: TRADE-1\nmocha.it.skip('fills', () => {});",
    // A member kept in a variable, as `const s = it.skip`, skips like the member itself.
    "const s = it.skip;\n// SKIP: TRADE-1\ns('fills a limit order', () => {});",
    "const { skip } = it;\n// SKIP: TRADE-1\nskip('fills a limit order', () => {});",
    "const d = describe.skip;\n// SKIP: TRADE-1\nd('order book', () => {});",
    // The default import is the module, as `require('mocha')` is.
    "import mocha from 'mocha';\n// SKIP: TRADE-1\nmocha.it.skip('fills', () => {});\nnew mocha({ ui: 'bdd' }).run();",
    // `this.skip()` in a test, with the marker above the call or above the test.
    "it('fills a limit order', function () {\n  // SKIP: TRADE-1\n  this.skip();\n});",
    "// SKIP: TRADE-1\nit('fills a limit order', async function () {\n  this.skip();\n});",
    // Under a condition it skips only sometimes.
    "it('fills a limit order', function () {\n  if (isMobile) this.skip();\n});",
    "it('fills a limit order', function () {\n  if (!process.env.BROKER_URL) {\n    return this.skip();\n  }\n});",
    // As in vscode's tests: the skip only runs when the file already exists.
    "it('renames a file', async function () {\n  try {\n    await fs.stat(target);\n    this.skip();\n  } catch (error) {\n    assertNotFound(error);\n  }\n});",
    // In a hook it skips the tests the hook runs for, so a marker above their describe covers it.
    "describe('order book', function () {\n  before(function () {\n    if (!broker) this.skip();\n  });\n});",
    "// SKIP: TRADE-1\ndescribe('order book', function () {\n  beforeEach('connect to the broker', function () {\n    this.skip();\n  });\n});",
    "suite('order book', function () {\n  setup(function () {\n    // SKIP: TRADE-1\n    this.skip();\n  });\n});",
    // Mocha's `this` has no `todo`.
    "it('settles at T+1', function () {\n  this.todo();\n});",
    // Not Mocha's `this`: an arrow body gets no test context, and a nested function, a describe body and
    // any other function have a `this` of their own.
    "it('fills a limit order', () => {\n  this.skip();\n});",
    "it('fills a limit order', function () {\n  orders.forEach(function () {\n    this.skip();\n  });\n});",
    "describe('order book', function () {\n  this.skip();\n});",
    'function skipAll() {\n  this.skip();\n}',
    'after(() => {\n  this.skip();\n});',
    // Mocha's other context methods change no state; `this.slow(ms)` only sets the speed threshold.
    "it('fills a limit order', function () {\n  this.slow(500);\n  this.timeout(5_000);\n  this.retries(2);\n  this.skip;\n});",
    // A test with only a title is pending: someone still has to write it, so it takes a TODO marker.
    "// TODO: TRADE-1\nit('settles at T+1');",
    "// TODO: TRADE-1\nspecify('settles at T+1');\n// TODO: TRADE-2\ntest(`cancels at the close`);",
    "const title = 'settles at T+1';\n// TODO: TRADE-1\nit(title);",
    { code: "it('settles at T+1');", settings: settings({ states: { todo: false } }) },
    // A title that isn't text could be a helper with the same name, so it isn't a test.
    'it(order);\ndescribe(order);\nit();',
    "describe('order book');",
    // A describe with only a title isn't one, so its tags put nothing in a state.
    { code: "describe('order book @new');", settings: settings({ lifecycleTags: true }) },
    // `this` in a describe body is the suite's, also when a condition picks the describe.
    "(isCI ? describe : describe.skip)('order book', function () {\n  this.skip();\n});",
    // `testFunctions` replaces `it`, `specify` and `test`; the other globals stay.
    {
      code: "it.skip('fills', () => {});\ntest.skip('cancels', () => {});",
      settings: settings({ testFunctions: ['check'] }),
    },
    // `.only` changes no state.
    "it.only('fills a limit order', () => {});\ndescribe.only('order book', () => {});\nsuite.only('quotes', () => {});",
    "(isCI ? it.skip : it)('fills a limit order', () => {});",
    // Not Mocha: Jest's and Vitest's members and globals, and names from other runners.
    "test.todo('settles at T+1');\nit.todo('cancels at the close');\nit.skipIf(isCI)('fills', () => {});",
    "fit('fills a limit order', () => {});\nxtest('fills a stop order', () => {});",
    "import { it } from 'vitest';\nit.skip('fills a limit order', () => {});",
    "import { test } from 'node:test';\ntest.skip('fills a limit order', () => {});",
  ]),
  invalid: withOptions(mocha, [
    { code: "it.skip('fills a limit order', function () {});", errors: [missing('skip', 'SKIP')] },
    { code: "specify.skip('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "xit('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    // A skipped test with no body is a skip, not a todo: `.skip` says what the author meant.
    { code: "xspecify('fills a limit order');", errors: [missing('skip', 'SKIP')] },
    { code: "it.skip('fills a limit order');", errors: [missing('skip', 'SKIP')] },
    { code: "const s = it.skip;\ns('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "const { skip } = it;\nskip('fills a limit order', () => {});", errors: [missing('skip', 'SKIP')] },
    {
      code: "const d = describe.skip;\nd('order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "describe.skip('order book', () => {});\ncontext.skip('when the market is closed', () => {});\nxdescribe('quotes', () => {});\nxcontext('when halted', () => {});",
      errors: [
        missing('skip', 'SKIP', 'This describe block'),
        missing('skip', 'SKIP', 'This describe block'),
        missing('skip', 'SKIP', 'This describe block'),
        missing('skip', 'SKIP', 'This describe block'),
      ],
    },
    {
      code: "suite.skip('order book', function () {});\ntest.skip('fills a limit order', function () {});",
      errors: [missing('skip', 'SKIP', 'This describe block'), missing('skip', 'SKIP')],
    },
    {
      code: "import { xit as later, xdescribe as laterBlock } from 'mocha';\nlater('fills', () => {});\nlaterBlock('order book', () => {});",
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "import * as mocha from 'mocha';\nmocha.describe.skip('order book', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "import mocha from 'mocha';\nmocha.describe.skip('order book', () => {});\nmocha.xit('fills', () => {});",
      errors: [missing('skip', 'SKIP', 'This describe block'), missing('skip', 'SKIP')],
    },
    {
      code: "it('fills a limit order', function () {\n  this.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "specify('fills a limit order', async function fill() {\n  await connect();\n  this.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 3 }],
    },
    // An arrow function inside the test body uses the test's `this`.
    {
      code: "it('fills a limit order', function () {\n  const skip = () => this.skip();\n  skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "(isCI ? it : it.only)('fills a limit order', function () {\n  this.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "before(function () {\n  this.skip();\n});\nit('fills a limit order', () => {});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "import { beforeEach as connect } from 'mocha';\ndescribe('order book', function () {\n  connect(function () {\n    this.skip();\n  });\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 4 }],
    },
    {
      code: "suite('order book', function () {\n  suiteSetup(function () {\n    this.skip();\n  });\n  teardown(function () {\n    this.skip();\n  });\n});",
      errors: [
        { ...missing('skip', 'SKIP', 'This skip call'), line: 3 },
        { ...missing('skip', 'SKIP', 'This skip call'), line: 6 },
      ],
    },
    {
      code: "it('fills a limit order', function () {\n  if (isMobile) this.skip();\n});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
    {
      code: "(isCI ? it.skip : it)('fills a limit order', () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP')],
    },
    { code: "it('settles at T+1');", errors: [missing('todo', 'TODO')] },
    { code: 'specify(`settles at T+1`);', errors: [missing('todo', 'TODO')] },
    { code: "test('settles at T+1');", errors: [missing('todo', 'TODO')] },
    { code: "describe.skip('order book');", errors: [missing('skip', 'SKIP', 'This describe block')] },
    // A title held in a variable and a body defined elsewhere.
    { code: 'it.skip(title, fillLimitOrder);', errors: [missing('skip', 'SKIP')] },
    {
      code: "import { it as check, test as tdd } from 'mocha';\ncheck.skip('fills', () => {});\ntdd.skip('cancels', () => {});",
      errors: [
        { ...missing('skip', 'SKIP'), line: 2 },
        { ...missing('skip', 'SKIP'), line: 3 },
      ],
    },
    {
      code: "check.skip('fills', () => {});\nxit('cancels', () => {});",
      settings: settings({ testFunctions: ['check'] }),
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP')],
    },
    {
      code: "describe('order book', function () {\n  after(function () {\n    this.skip();\n  });\n  afterEach(function () {\n    this.skip();\n  });\n});\nsuite('quotes', function () {\n  setup(function () {\n    this.skip();\n  });\n  suiteTeardown(function () {\n    this.skip();\n  });\n});",
      errors: [3, 6, 11, 14].map((line) => ({ ...missing('skip', 'SKIP', 'This skip call'), line })),
    },
    { code: "it.only('settles at T+1');", errors: [missing('todo', 'TODO')] },
    {
      code: "const title = 'settles at T+1';\nit(title);",
      errors: [{ ...missing('todo', 'TODO'), line: 2 }],
    },
    {
      code: "it('fills a limit order @new', () => {});\ndescribe('order book @quarantined', () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [missing('new', 'NEW'), missing('quarantined', 'QUARANTINED', 'This describe block')],
    },
    {
      code: "it.only('fills a limit order @new', () => {});\ndescribe.only('order book @new', () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [missing('new', 'NEW'), missing('new', 'NEW', 'This describe block')],
    },
  ]),
});

runRule('require-ticket (Cypress)', requireTicket, {
  valid: withOptions(cypress, [
    // Tags from @cypress/grep, which are written with their `@`.
    {
      code: "// NEW: TRADE-1\nit('fills a limit order', { tags: '@new' }, () => {});\n// NEW: TRADE-2\ndescribe('order book', { tags: ['@new', '@smoke'] }, () => {});",
      settings: settings({ lifecycleTags: true }),
    },
    { code: "it('fills a limit order', { tags: 'new' }, () => {});", settings: settings({ lifecycleTags: true }) },
    // `browser` runs the test only in some browsers: a conditional skip.
    "it('fills a limit order', { browser: '!webkit' }, () => {});",
    "describe('order book', { browser: ['chrome', 'firefox'] }, () => {});",
    "it('fills a limit order', { retries: 2, browser: false }, () => {});",
    "it('fills a limit order', function () {\n  if (Cypress.env('BROKER_URL') === undefined) this.skip();\n});",
    "(Cypress.env('CI') ? describe.skip : describe)('order book', () => {});",
    "// SKIP: TRADE-1\nit.skip('fills a limit order', () => {\n  cy.visit('/orders');\n});",
  ]),
  invalid: withOptions(cypress, [
    {
      code: "it.skip('fills a limit order', () => {\n  cy.visit('/orders');\n});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "it('fills a limit order', { browser: 'firefox' }, () => {});\ndescribe('order book', { browser: '!webkit' }, () => {});",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP'), missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "it('fills a limit order', { tags: ['@smoke', '@quarantined'] }, () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [missing('quarantined', 'QUARANTINED')],
    },
    {
      code: "it('fills a limit order', function () {\n  this.skip();\n});",
      errors: [{ ...missing('skip', 'SKIP', 'This skip call'), line: 2 }],
    },
  ]),
});

runRule('require-ticket (WebdriverIO)', requireTicket, {
  valid: withOptions(webdriverio, [
    "// SKIP: TRADE-1\nit.skip('fills a limit order', async () => {\n  await browser.url('/orders');\n});",
  ]),
  invalid: withOptions(webdriverio, [
    { code: "xit('fills a limit order', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "it('settles at T+1');", errors: [missing('todo', 'TODO')] },
  ]),
});

runRule('marker-matches-state (Mocha)', markerMatchesState, {
  valid: withOptions(mocha, ["// TODO: TRADE-1\nit('settles at T+1');"]),
  invalid: withOptions(mocha, [
    {
      code: "// SKIP: TRADE-1\nit('settles at T+1');",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'TODO', state: 'todo', subject: 'this test' },
          suggestions: [{ messageId: 'renameMarker', output: "// TODO: TRADE-1\nit('settles at T+1');" }],
        },
      ],
    },
  ]),
});

runRule('no-orphaned-marker (Mocha)', noOrphanedMarker, {
  valid: withOptions(mocha, [
    "// SKIP: TRADE-1\nit('fills a limit order', function () {\n  this.skip();\n});",
    "// SKIP: TRADE-1\nit('fills a limit order', { browser: '!webkit' }, () => {});",
  ]),
  invalid: withOptions(mocha, [
    {
      code: "// SKIP: TRADE-1\nit('fills a limit order', () => {\n  this.skip();\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [
            { messageId: 'removeMarker', output: "it('fills a limit order', () => {\n  this.skip();\n});" },
          ],
        },
      ],
    },
    {
      code: "// SKIP: TRADE-1\nit('fills a limit order', function () {\n  this.slow(500);\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "it('fills a limit order', function () {\n  this.slow(500);\n});",
            },
          ],
        },
      ],
    },
  ]),
});

runRule('no-conflicting-states (Mocha)', noConflictingStates, {
  valid: withOptions({ ...mocha, lifecycleTags: true }, [
    "it('fills a limit order @new', function () {\n  if (isMobile) this.skip();\n});",
  ]),
  invalid: withOptions({ ...mocha, lifecycleTags: true }, [
    { code: "it.skip('fills a limit order @new', () => {});", errors: [{ messageId: 'newSkipped' }] },
    {
      code: "it('fills a limit order @new', function () {\n  this.skip();\n});",
      errors: [{ messageId: 'newSkipped' }],
    },
    { code: "it('settles at T+1 @new');", errors: [{ messageId: 'newSkipped' }] },
    // A skipped test in a `@new` describe is a new test too.
    {
      code: "describe('order book @new', () => {\n  xit('fills a limit order', () => {});\n  xspecify('cancels an order');\n});",
      errors: [
        { messageId: 'newSkipped', line: 2 },
        { messageId: 'newSkipped', line: 3 },
      ],
    },
  ]),
});

// Only Mocha gives a test's `function` a `this` that can skip it.
for (const framework of ['playwright', 'jest', 'vitest'] as const) {
  runRule(`require-ticket (this.skip() in ${framework})`, requireTicket, {
    valid: withOptions({ framework }, [
      "test('fills a limit order', function () {\n  this.skip();\n});\nbeforeEach(function () {\n  this.skip();\n});",
    ]),
    invalid: [],
  });
}
