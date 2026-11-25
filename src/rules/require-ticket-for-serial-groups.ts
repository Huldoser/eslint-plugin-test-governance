import { checkCommentTickets, commentTicketMessages } from '../utils/comment-tickets.ts';
import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a ticket for Playwright serial groups',
      recommended: 'off',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-for-serial-groups.md',
    },
    schema: [],
    messages: {
      missingTicket: 'Playwright serial mode needs a `// SERIAL: {{example}}` comment directly above its declaration.',
      ...commentTicketMessages,
    },
  },
  create(context, analysis, options) {
    checkCommentTickets(context, analysis.serialGroups, options, 'SERIAL');
  },
});
