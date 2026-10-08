import rule from '../../src/rules/require-ticket-in-comments.ts';
import { runRule, settings } from '../helpers.ts';

const TEST = "\ntest('places an order', async () => {});";
const missing = (keyword: string, upper = keyword.toUpperCase(), example = 'PROJ-123') => ({
  messageId: 'missingTicket' as const,
  data: { keyword, upper, example },
});

runRule('require-ticket-in-comments', rule, {
  valid: [
    `// TODO: TRADE-1${TEST}`,
    `// FIXME: TRADE-1, TRADE-2\nconst retries = 2;${TEST}`,
    `/* TODO: TRADE-1 */${TEST}`,
    `/**\n * Places an order through the broker API.\n * TODO: TRADE-3\n */\nfunction placeOrder() {}${TEST}`,
    `// NOTE: anything goes here${TEST}`,
    // The ticket can go in parentheses.
    `// TODO(TRADE-1)${TEST}`,
    `// FIXME(TRADE-1, TRADE-2):${TEST}`,
    `/* TODO(https://github.com/acme/trading-engine/issues/12) */${TEST}`,
    // Some teams put a space before the parenthesis.
    `// TODO (TRADE-1)${TEST}`,
    `// FIXME (TRADE-1, TRADE-2):${TEST}`,
    { code: `// TODO(TRADE-1): remove after the migration${TEST}`, settings: settings({ allowNotes: true }) },
    // Prose that merely starts with the word, and keywords inside longer words.
    `// todo list for the next sprint${TEST}`,
    `// Fixme later maybe${TEST}`,
    `// TODOS: TRADE-1 is not a keyword${TEST}`,
    `// TODO-list: anything${TEST}`,
    // A marker directly above a test in that state belongs to require-ticket.
    "// FIXME: flaky\ntest.fixme('cancels an order', async () => {});",
    // Files that don't use Playwright are not checked.
    '// TODO: refactor this\nconst x = 1;',
    // Opting out.
    { code: `// TODO: later${TEST}`, settings: settings({ comments: false }) },
    { code: `// TODO: later\n// FIXME: TRADE-1${TEST}`, settings: settings({ comments: { keywords: ['FIXME'] } }) },
    { code: `// HACK: TRADE-1${TEST}`, settings: settings({ comments: { keywords: ['HACK'] } }) },
    { code: `// TODO: TRADE-1 remove after the migration${TEST}`, settings: settings({ allowNotes: true }) },
  ],
  invalid: [
    {
      code: `// TODO: fix later${TEST}`,
      errors: [{ ...missing('TODO'), line: 1, column: 4, endLine: 1, endColumn: 19 }],
    },
    { code: `// TODO fix later${TEST}`, errors: [missing('TODO')] },
    { code: `// FIXME${TEST}`, errors: [missing('FIXME')] },
    { code: `// FIXME:${TEST}`, errors: [missing('FIXME')] },
    { code: `// todo: fix later${TEST}`, errors: [missing('todo', 'TODO')] },
    { code: `// Fixme: the locator${TEST}`, errors: [missing('Fixme', 'FIXME')] },
    // A FIXME above a test that is not fixme'd is a work comment, so it needs a ticket too.
    { code: `// FIXME: refactor${TEST}`, errors: [missing('FIXME')] },
    {
      code: "test('buys shares', async ({ page }) => {\n  // FIXME: flaky locator\n  await page.click('#buy');\n});",
      errors: [{ ...missing('FIXME'), line: 2, column: 6 }],
    },
    {
      code: `/*\r\n * Context.\r\n * TODO: refactor\r\n */\r\ntest('rebalances the portfolio', async () => {});`,
      errors: [{ ...missing('TODO'), line: 3, column: 4, endLine: 3, endColumn: 18 }],
    },
    // A lone \r also ends a line.
    {
      code: `/*\r * TODO: refactor\r */\rtest('rebalances the portfolio', async () => {});`,
      errors: [{ ...missing('TODO'), line: 2, column: 4, endLine: 2, endColumn: 18 }],
    },
    {
      code: `/*\r * Context.\r * TODO: refactor\r */\rtest('rebalances the portfolio', async () => {});`,
      errors: [{ ...missing('TODO'), line: 3, column: 4, endLine: 3, endColumn: 18 }],
    },
    // So do a line separator and a paragraph separator.
    {
      code: `/*\u2028 * Context.\u2029 * TODO: refactor\u2028 */\ntest('rebalances the portfolio', async () => {});`,
      errors: [{ ...missing('TODO'), line: 3, column: 4, endLine: 3, endColumn: 18 }],
    },
    {
      code: `// TODO: TBD${TEST}`,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' } }],
    },
    {
      code: `// FIXME: TBD${TEST}`,
      errors: [{ message: "'TBD' is a placeholder, not a real ticket. Link the ticket that tracks this work." }],
    },
    {
      code: `// TODO: TRADE-1, nope${TEST}`,
      errors: [
        {
          messageId: 'invalidTicket',
          data: {
            ticket: 'nope',
            expected: 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL',
          },
        },
      ],
    },
    {
      code: `// TODO: OPS-1${TEST}`,
      settings: settings({ ticket: { preset: 'jira', projects: ['TRADE'] } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: { ticket: 'OPS-1', expected: 'a Jira key like TRADE-123 in project TRADE, or a Jira URL' },
        },
      ],
    },
    {
      code: `// FIXME: RISK-45${TEST}`,
      settings: settings({ ticket: { preset: 'jira', projects: ['TRADE'] } }),
      errors: [
        {
          message:
            "'RISK-45' is not a valid ticket. Expected a Jira key like TRADE-123 in project TRADE, or a Jira URL.",
        },
      ],
    },
    {
      code: `// TODO: refactor${TEST}`,
      settings: settings({ ticket: { preset: 'jira', projects: ['TRADE'] } }),
      errors: [missing('TODO', 'TODO', 'TRADE-123')],
    },
    {
      code: `// TODO: TRADE-1 remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 44,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO: TRADE-1${TEST}`,
            },
          ],
        },
      ],
    },
    // A name or nothing in parentheses is not a ticket.
    {
      code: `// TODO(alice): fix later${TEST}`,
      errors: [{ ...missing('TODO'), line: 1, column: 4, endLine: 1, endColumn: 26 }],
    },
    { code: `// FIXME(): later${TEST}`, errors: [missing('FIXME')] },
    { code: `// todo(alice): later${TEST}`, errors: [missing('todo', 'TODO')] },
    { code: `// TODO(TBD)${TEST}`, errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' } }] },
    { code: `// TODO (alice): later${TEST}`, errors: [missing('TODO')] },
    {
      code: `// TODO (TRADE-1): remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 18,
          endLine: 1,
          endColumn: 46,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO (TRADE-1)${TEST}`,
            },
          ],
        },
      ],
    },
    // Notes after the parentheses follow allowNotes, like notes after `TODO: TRADE-1`.
    {
      code: `// TODO(TRADE-1): remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 45,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO(TRADE-1)${TEST}`,
            },
          ],
        },
      ],
    },
    {
      code: `// TODO(TRADE-1):remove after the migration${TEST}`,
      errors: [
        {
          message:
            'Only ticket IDs are allowed after `TODO:`, separated by commas. Put details in the ticket instead of `remove after the migration`.',
          suggestions: [{ messageId: 'removeExtraText', output: `// TODO(TRADE-1)${TEST}` }],
        },
      ],
    },
    {
      code: `// FIXME(TRADE-1 see thread) later${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'FIXME', text: 'see thread' },
          suggestions: [{ messageId: 'removeExtraText', output: `// FIXME(TRADE-1) later${TEST}` }],
        },
      ],
    },
    {
      code: `// HACK: quick fix${TEST}`,
      settings: settings({ comments: { keywords: ['HACK', 'TODO'] } }),
      errors: [missing('HACK')],
    },
    {
      code: `// BUG: fills at the wrong price${TEST}`,
      settings: settings({ comments: { keywords: ['BUG'] } }),
      errors: [missing('BUG')],
    },
    // A Playwright import alone makes it a test file.
    {
      code: "import { expect } from '@playwright/test';\n// TODO: later\nexpect(1).toBe(1);",
      errors: [missing('TODO')],
    },
  ],
});
