import rule from '../../src/rules/require-ticket-in-comments.ts';
import { runRule, settings } from '../helpers.ts';

const TEST = "\ntest('a', async () => {});";
const missing = (keyword: string, upper = keyword.toUpperCase(), example = 'PROJ-123') => ({
  messageId: 'missingTicket' as const,
  data: { keyword, upper, example },
});

runRule('require-ticket-in-comments', rule, {
  valid: [
    `// TODO: WEB-1${TEST}`,
    `// FIXME: WEB-1, WEB-2\nconst retries = 2;${TEST}`,
    `/* TODO: WEB-1 */${TEST}`,
    `/**\n * Logs in through the API.\n * TODO: WEB-3\n */\nfunction login() {}${TEST}`,
    `// NOTE: anything goes here${TEST}`,
    // The ticket can go in parentheses.
    `// TODO(WEB-1)${TEST}`,
    `// FIXME(WEB-1, WEB-2):${TEST}`,
    `/* TODO(https://github.com/acme/web/issues/12) */${TEST}`,
    // Some teams put a space before the parenthesis.
    `// TODO (WEB-1)${TEST}`,
    `// FIXME (WEB-1, WEB-2):${TEST}`,
    { code: `// TODO(WEB-1): remove after the migration${TEST}`, settings: settings({ allowNotes: true }) },
    // Prose that merely starts with the word, and keywords inside longer words.
    `// todo list for the next sprint${TEST}`,
    `// Fixme later maybe${TEST}`,
    `// TODOS: WEB-1 is not a keyword${TEST}`,
    `// TODO-list: anything${TEST}`,
    // A marker directly above a test in that state belongs to require-ticket.
    "// FIXME: flaky\ntest.fixme('a', async () => {});",
    // Files that don't use Playwright are not checked.
    '// TODO: refactor this\nconst x = 1;',
    // Opting out.
    { code: `// TODO: later${TEST}`, settings: settings({ comments: false }) },
    { code: `// TODO: later\n// FIXME: WEB-1${TEST}`, settings: settings({ comments: { keywords: ['FIXME'] } }) },
    { code: `// HACK: WEB-1${TEST}`, settings: settings({ comments: { keywords: ['HACK'] } }) },
    { code: `// TODO: WEB-1 remove after the migration${TEST}`, settings: settings({ allowNotes: true }) },
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
      code: "test('a', async ({ page }) => {\n  // FIXME: flaky locator\n  await page.click('#pay');\n});",
      errors: [{ ...missing('FIXME'), line: 2, column: 6 }],
    },
    {
      code: `/*\r\n * Context.\r\n * TODO: refactor\r\n */\r\ntest('a', async () => {});`,
      errors: [{ ...missing('TODO'), line: 3, column: 4, endLine: 3, endColumn: 18 }],
    },
    {
      code: `// TODO: TBD${TEST}`,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TBD' } }],
    },
    {
      code: `// TODO: WEB-1, nope${TEST}`,
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
      settings: settings({ ticket: { preset: 'jira', projects: ['WEB'] } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: { ticket: 'OPS-1', expected: 'a Jira key like WEB-123 in project WEB, or a Jira URL' },
        },
      ],
    },
    {
      code: `// TODO: refactor${TEST}`,
      settings: settings({ ticket: { preset: 'jira', projects: ['WEB'] } }),
      errors: [missing('TODO', 'TODO', 'WEB-123')],
    },
    {
      code: `// TODO: WEB-1 remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 42,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO: WEB-1${TEST}`,
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
      code: `// TODO (WEB-1): remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 44,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO (WEB-1)${TEST}`,
            },
          ],
        },
      ],
    },
    // Notes after the parentheses follow allowNotes, like notes after `TODO: WEB-1`.
    {
      code: `// TODO(WEB-1): remove after the migration${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'TODO', text: 'remove after the migration' },
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 43,
          suggestions: [
            {
              messageId: 'removeExtraText',
              data: { text: 'remove after the migration' },
              output: `// TODO(WEB-1)${TEST}`,
            },
          ],
        },
      ],
    },
    {
      code: `// FIXME(WEB-1 see thread) later${TEST}`,
      errors: [
        {
          messageId: 'extraText',
          data: { keyword: 'FIXME', text: 'see thread' },
          suggestions: [{ messageId: 'removeExtraText', output: `// FIXME(WEB-1) later${TEST}` }],
        },
      ],
    },
    {
      code: `// HACK: quick fix${TEST}`,
      settings: settings({ comments: { keywords: ['HACK', 'TODO'] } }),
      errors: [missing('HACK')],
    },
    // A Playwright import alone makes it a test file.
    {
      code: "import { expect } from '@playwright/test';\n// TODO: later\nexpect(1).toBe(1);",
      errors: [missing('TODO')],
    },
  ],
});
