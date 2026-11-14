import { commentLines, parseTickets } from '../utils/analyze.ts';
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
      invalidTicket: "'{{ticket}}' is not a valid ticket. Expected {{expected}}.",
      placeholderTicket: "'{{ticket}}' is a placeholder, not a tracking ticket.",
      markerCase: 'Write the marker in uppercase: `SUPPRESS:`.',
      extraText: 'Only tickets are allowed after `SUPPRESS:` unless allowNotes is enabled.',
    },
  },
  create(context, analysis, options) {
    const matcher = options.commentTicket;
    for (const { node, comments } of analysis.errorSuppressions) {
      const lines = comments.flatMap(commentLines);
      const marker = lines.findLast(({ text }) => /^\s*\*?\s*SUPPRESS\s*:/i.test(text));
      if (!marker) {
        context.report({ node, messageId: 'missingTicket', data: { example: matcher.example } });
        continue;
      }
      const colon = marker.text.indexOf(':');
      const loc = {
        start: context.sourceCode.getLocFromIndex(marker.start),
        end: context.sourceCode.getLocFromIndex(marker.start + marker.text.length),
      };
      if (!marker.text.slice(0, colon).includes('SUPPRESS')) {
        context.report({ loc, messageId: 'markerCase' });
        continue;
      }
      const { tickets, extra } = parseTickets(marker.text.slice(colon + 1), marker.start + colon + 1, matcher);
      const bad = tickets.find((ticket) => ticket.result !== 'ok');
      if (tickets.length === 0) {
        context.report({ loc, messageId: 'missingTicket', data: { example: matcher.example } });
      } else if (bad) {
        context.report({
          loc,
          messageId: bad.result === 'placeholder' ? 'placeholderTicket' : 'invalidTicket',
          data: { ticket: bad.text, expected: matcher.expected },
        });
      } else if (extra && !options.allowNotes) {
        context.report({ loc, messageId: 'extraText' });
      }
    }
  },
});
