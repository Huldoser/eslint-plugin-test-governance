import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require a ticket marker on commented-out tests',
      recommended: 'warn',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-for-commented-out-tests.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      missingMarker:
        'This commented-out test has no `// {{marker}}: <ticket>` comment, e.g. `// {{marker}}: {{example}}`. Track it like a skipped test, or delete it.',
      missingTicket: '`{{marker}}:` needs a ticket right after the colon, e.g. `// {{marker}}: {{example}}`.',
      invalidTicket: "'{{ticket}}' is not a valid ticket for the 'skip' state. Expected {{expected}}.",
      placeholderTicket: "'{{ticket}}' is a placeholder, not a real ticket. Link the ticket that tracks this test.",
      extraText:
        'Only ticket IDs are allowed after `{{marker}}:`, separated by commas. Put details in the ticket instead of `{{text}}`.',
      removeExtraText: 'Remove `{{text}}`.',
    },
  },
  create(context, analysis, options) {
    // Commenting a test out skips it by hand, so it takes the skip state's marker and ticket format.
    const skip = options.states.find((state) => state.name === 'skip');
    if (!analysis.isTestFile || skip === undefined) return;
    const { sourceCode } = context;
    for (const { range, markers } of analysis.commentedOutTests) {
      const own = markers.filter((marker) => marker.state === skip);
      const data = { marker: skip.marker, example: skip.ticket.example };
      if (own.length === 0) {
        const loc = { start: sourceCode.getLocFromIndex(range[0]), end: sourceCode.getLocFromIndex(range[1]) };
        context.report({ loc, messageId: 'missingMarker', data });
        continue;
      }
      const valid = own.find((m) => m.tickets.length > 0 && m.tickets.every((t) => t.result === 'ok'));
      if (valid) {
        const { extra } = valid;
        if (extra === undefined || options.allowNotes) continue;
        context.report({
          loc: { start: sourceCode.getLocFromIndex(extra.range[0]), end: sourceCode.getLocFromIndex(extra.range[1]) },
          messageId: 'extraText',
          data: { marker: skip.marker, text: extra.text },
          suggest: [
            {
              messageId: 'removeExtraText',
              data: { text: extra.text },
              fix: (fixer) => fixer.removeRange(extra.range),
            },
          ],
        });
        continue;
      }
      const [marker] = own;
      const bad = marker.tickets.find((t) => t.result !== 'ok');
      if (bad === undefined) {
        context.report({ loc: marker.comment.loc, messageId: 'missingTicket', data });
        continue;
      }
      context.report({
        loc: marker.comment.loc,
        messageId: bad.result === 'placeholder' ? 'placeholderTicket' : 'invalidTicket',
        data: { ticket: bad.text, expected: skip.ticket.expected },
      });
    }
  },
});
