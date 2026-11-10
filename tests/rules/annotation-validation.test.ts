import rule from '../../src/rules/require-ticket.ts';
import { runRule, settings } from '../helpers.ts';

const only = settings({ annotations: { only: true } });
const unread =
  "This annotation's ticket isn't static text, so it can't be checked. Use a string, or a constant declared in this file.";
const move =
  "Put the ticket in an `issue` annotation instead of a comment, so it reaches the test report, e.g. `annotation: { type: 'issue', description: 'PROJ-123' }`.";

runRule('require-ticket (annotation validation)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a wrong-state marker cannot replace the required annotation',
      code: "// FIXME: EXAMPLE-123\ntest.skip('fills an order', () => {});",
      settings: only,
      errors: [
        {
          message:
            "This test is in the 'skip' state but has no `issue` annotation with a ticket, e.g. `annotation: { type: 'issue', description: 'PROJ-123' }`.",
        },
      ],
    },
    {
      name: 'reports annotation-only markers on each test',
      code: "/* SKIP: EXAMPLE-123 */\ntest.skip('fills an order', () => {});\n/* SKIP: EXAMPLE-456 */\ntest.skip('cancels an order', () => {});",
      settings: only,
      errors: [
        { message: move, suggestions: [] },
        { message: move, suggestions: [] },
      ],
    },
    {
      name: 'reports every invalid annotation ticket despite a valid comment marker',
      code: "// SKIP: EXAMPLE-123\ntest.skip('fills an order', { annotation: [{ type: 'issue', description: 'EXAMPLE-0' }, { type: 'issue', description: 'EXAMPLE-00' }] }, () => {});",
      errors: [
        {
          message:
            "'EXAMPLE-0' is not a valid ticket for the 'skip' state. Expected a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL.",
        },
        {
          message:
            "'EXAMPLE-00' is not a valid ticket for the 'skip' state. Expected a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL.",
        },
      ],
    },
    {
      name: 'a valid annotation does not hide a broken comment marker',
      code: "// SKIP: EXAMPLE-0\ntest.skip('fills an order', { annotation: { type: 'issue', description: 'EXAMPLE-123' } }, () => {});",
      errors: [{ message: "'EXAMPLE-0' is a placeholder, not a real ticket. Link the ticket that tracks this test." }],
    },
    {
      name: 'checks unreadable annotations when a required tag coexists with a conditional skip',
      code: "// NEW: EXAMPLE-123\ntest('fills an order @new', { skip: condition, meta: { issue: ticket } }, () => {});",
      settings: settings({
        framework: 'vitest',
        reportUnreadableTags: true,
        customStates: { new: { when: '@new', marker: 'NEW' } },
      }),
      errors: [{ message: unread }],
    },
    {
      name: 'reports one unreadable annotation shared by multiple tests only once',
      code: "const details = { annotation: { type: 'issue', description: ticket } };\n// SKIP: EXAMPLE-123\ntest.skip('fills an order', details, () => {});\n// SKIP: EXAMPLE-456\ntest.skip('cancels an order', details, () => {});",
      settings: settings({ reportUnreadableTags: true }),
      errors: [{ message: unread }],
    },
  ],
});
