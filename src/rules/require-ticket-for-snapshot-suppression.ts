import { snapshotSuppressions } from '../utils/analyze.ts';
import { checkSuppressionTickets, suppressionMessages } from '../utils/suppression-tickets.ts';
import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a ticket for Playwright snapshot suppression',
      recommended: 'off',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-for-snapshot-suppression.md',
    },
    schema: [],
    messages: {
      missingTicket: 'Disabling snapshot assertions needs a `// SUPPRESS: {{example}}` comment directly above it.',
      ...suppressionMessages,
    },
  },
  create(context, _analysis, options) {
    checkSuppressionTickets(context, snapshotSuppressions(context.sourceCode, options), options);
  },
});
