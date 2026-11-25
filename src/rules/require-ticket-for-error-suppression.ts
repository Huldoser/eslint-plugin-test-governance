import { checkCommentTickets, commentTicketMessages } from '../utils/comment-tickets.ts';
import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a ticket for blanket Cypress error suppression',
      recommended: 'off',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-for-error-suppression.md',
    },
    schema: [],
    messages: {
      missingTicket: 'This blanket error suppression needs a `// SUPPRESS: {{example}}` comment directly above it.',
      ...commentTicketMessages,
    },
  },
  create(context, analysis, options) {
    checkCommentTickets(context, analysis.errorSuppressions, options, 'SUPPRESS');
  },
});
