import noOrphanedMarker from '../../src/rules/no-orphaned-marker.ts';
import rule from '../../src/rules/require-ticket-for-commented-out-tests.ts';
import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const TEST = "\ntest('cancels an order', async () => {});";

const missing = (marker = 'SKIP', example = 'PROJ-123') => ({
  message: `This commented-out test has no \`// ${marker}: <ticket>\` comment, e.g. \`// ${marker}: ${example}\`. Track it like a skipped test, or delete it.`,
});

runRule('require-ticket-for-commented-out-tests', rule, {
  valid: [
    `// SKIP: TRADE-1\n// test('places an order', async () => {});${TEST}`,
    `// test('places an order', async () => {});\n// SKIP: TRADE-1${TEST}`,
    `/*\n * SKIP: TRADE-1\n * test.describe('orders', () => {\n *   test('places an order', async () => {});\n * });\n */${TEST}`,
    `// eslint-disable-next-line no-console -- SKIP: TRADE-1\n// test('places an order', async () => {});${TEST}`,
    // Prose that mentions a test function, a call to anything else, and a JSDoc example are not tests.
    `// The test('places an order') case is in orders.spec.ts.${TEST}`,
    `// expect(price).toBe(101.5);${TEST}`,
    // A sentence that goes on with a parenthesis after "it" or "test": code has no space before a call's `(`.
    `// test (see the setup above) for the margin case.${TEST}`,
    // Calls that configure tests or change one at runtime declare none.
    "test('places an order', async ({ page }) => {\n  // test.slow();\n  // test.skip();\n  await page.goto('/');\n});",
    `// test.use({ viewport: { width: 1280, height: 720 } });\n// test.describe.configure({ mode: 'serial' });\n// test.beforeEach(async ({ page }) => {});${TEST}`,
    `/**\n * @example\n * test('places an order', async () => {});\n */\nexport function placeOrder() {}${TEST}`,
    // A file that doesn't use the framework is not a test file.
    "// test('places an order', async () => {});\nexport const price = 1;",
    // The skip state's own marker and ticket format apply, and with the state off nothing is required.
    {
      code: `// PARKED: ORD-1\n// test('places an order', async () => {});${TEST}`,
      settings: settings({ states: { skip: { marker: 'PARKED', ticket: { preset: 'jira', projects: ['ORD'] } } } }),
    },
    { code: `// test('places an order', async () => {});${TEST}`, settings: settings({ states: { skip: false } }) },
    {
      code: `// SKIP: TRADE-1 flaky on CI\n// test('places an order', async () => {});${TEST}`,
      settings: settings({ allowNotes: true }),
    },
    ...withOptions({ framework: 'jest' }, [
      "// SKIP: TRADE-1\n// it('places an order', () => {});\n// describe('orders', () => {});\ntest('cancels an order', () => {});",
      "// it (the order above) settles first, so the cancel finds nothing.\ntest('cancels an order', () => {});",
    ]),
  ],
  invalid: [
    { code: `// test('places an order', async () => {});${TEST}`, errors: [{ ...missing(), line: 1, column: 4 }] },
    {
      name: 'a fixme marker does not track a commented-out test',
      code: `// FIXME: TRADE-1\n// test('places an order', async () => {});${TEST}`,
      errors: [missing()],
    },
    { code: `// test.describe.serial.only('orders', () => {});${TEST}`, errors: [missing()] },
    {
      code: "test('places an order', async () => {\n  // await test.step('fills the order', async () => {});\n});",
      errors: [{ ...missing(), line: 2 }],
    },
    // One report for a block of commented-out code, at its first test line.
    {
      code: `test('cancels an order', async () => {});\n// test.describe('orders', () => {\n//   test('places an order', async () => {});\n// });`,
      errors: [{ ...missing(), line: 2 }],
    },
    { code: `/*\ntest('places an order', async () => {});\n*/${TEST}`, errors: [{ ...missing(), line: 2, column: 1 }] },
    // A blank line ends a block, so each one needs its marker.
    {
      code: `// SKIP: TRADE-1\n// test('places an order', async () => {});\n\n// test('closes a position', async () => {});${TEST}`,
      errors: [{ ...missing(), line: 4 }],
    },
    {
      name: 'renders the invalid ticket diagnostic for a commented-out test',
      code: `// SKIP: nope\n// test('places an order', async () => {});${TEST}`,
      errors: [
        {
          message:
            "'nope' is not a valid ticket for the 'skip' state. Expected a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL.",
          line: 1,
        },
      ],
    },
    {
      name: 'renders the placeholder diagnostic for a commented-out test',
      code: `// SKIP: TBD\n// test('places an order', async () => {});${TEST}`,
      errors: [
        {
          message: "'TBD' is a placeholder, not a real ticket. Link the ticket that tracks this test.",
          line: 1,
        },
      ],
    },
    {
      code: `// SKIP: TRADE-1, TBD\n// test('places an order', async () => {});${TEST}`,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' }, line: 1 }],
    },
    // Only tickets follow the marker unless notes are allowed, as in any marker.
    {
      name: 'locates and explains extra text on a commented-out test marker',
      code: `// SKIP: TRADE-1 flaky on CI\n// test('places an order', async () => {});${TEST}`,
      errors: [
        {
          message:
            'Only ticket IDs are allowed after `SKIP:`, separated by commas. Put details in the ticket instead of `flaky on CI`.',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 29,
          suggestions: [
            {
              messageId: 'removeExtraText',
              output: `// SKIP: TRADE-1\n// test('places an order', async () => {});${TEST}`,
            },
          ],
        },
      ],
    },
    {
      name: 'renders the missing ticket diagnostic for a commented-out test',
      code: `// SKIP:\n// test('places an order', async () => {});${TEST}`,
      errors: [{ message: '`SKIP:` needs a ticket right after the colon, e.g. `// SKIP: PROJ-123`.', line: 1 }],
    },
    ...withOptions({ framework: 'jest' }, [
      { code: "// xit('places an order', () => {});\ntest('cancels an order', () => {});", errors: [missing()] },
      {
        code: "// it.each([[1]])('buys %i shares', () => {});\ntest('cancels an order', () => {});",
        errors: [missing()],
      },
    ]),
    ...withOptions({ framework: 'mocha' }, [
      { code: "// context('orders', function () {});\nit('cancels an order', () => {});", errors: [missing()] },
    ]),
    ...withOptions({ framework: 'node-test' }, [
      {
        code: "import { test } from 'node:test';\n// test('places an order', () => {});\ntest('cancels an order', () => {});",
        errors: [missing()],
      },
    ]),
  ],
});

// The marker of a commented-out test belongs to it, not to the test below it or to no test at all.
runRule('no-orphaned-marker (commented-out tests)', noOrphanedMarker, {
  valid: [
    `// SKIP: TRADE-1\n// test('places an order', async () => {});${TEST}`,
    `test('cancels an order', async () => {});\n// SKIP: TRADE-1\n// test('places an order', async () => {});`,
  ],
  invalid: [],
});

runRule('require-ticket (commented-out tests)', requireTicket, {
  // A commented-out call that declares no test leaves the marker to the test below it.
  valid: [
    "// SKIP: TRADE-1\n// test.describe.configure({ mode: 'serial' });\ntest.skip('cancels an order', async () => {});",
  ],
  // A skipped test below a commented-out one still needs its own marker.
  invalid: [
    {
      code: "// SKIP: TRADE-1\n// test('places an order', async () => {});\ntest.skip('cancels an order', async () => {});",
      errors: [{ messageId: 'missingMarker', line: 3 }],
    },
  ],
});
