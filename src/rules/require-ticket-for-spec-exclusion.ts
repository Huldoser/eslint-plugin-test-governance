import { specExclusions } from '../utils/analyze.ts';
import { checkCommentTickets, commentTicketMessages } from '../utils/comment-tickets.ts';
import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a ticket for excluded Playwright spec files',
      recommended: 'off',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-for-spec-exclusion.md',
    },
    schema: [],
    messages: {
      missingTicket: 'Excluding this spec needs an `// EXCLUDE: {{example}}` comment directly above it.',
      ...commentTicketMessages,
    },
  },
  create(context, _analysis, options) {
    checkCommentTickets(context, specExclusions(context.sourceCode, options), options, 'EXCLUDE');
  },
});
