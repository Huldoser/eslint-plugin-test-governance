import { appliesTo, describeSubject, evaluate } from '../utils/analyze.js';
import { createRule } from '../utils/create-rule.js';

export default createRule({
  name: 'require-ticket',
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Require a ticket marker comment above skipped, fixme and tagged tests',
      recommended: 'error',
    },
    messages: {
      missingMarker:
        "{{subject}} is in the '{{state}}' state but has no `// {{marker}}: <ticket>` comment directly above it, e.g. `// {{marker}}: {{example}}`.",
      missingTicket: '`{{marker}}:` needs a ticket right after the colon, e.g. `// {{marker}}: {{example}}`.',
      invalidTicket: "'{{ticket}}' is not a valid ticket for the '{{state}}' state. Expected {{expected}}.",
      placeholderTicket: "'{{ticket}}' is a placeholder, not a real ticket. Link the ticket that tracks this test.",
      markerCase: 'Write the marker keyword in uppercase: `{{marker}}:` instead of `{{found}}:`.',
      extraText:
        'Only ticket IDs are allowed after `{{marker}}:`, separated by commas. Put details in the ticket instead of `{{text}}`.',
      removeExtraText: 'Remove `{{text}}`.',
      dynamicTitle: "This title isn't static text, so its tags can't be checked. Use a string or template literal.",
    },
  },
  check(context, analysis, options) {
    const hasTagStates = options.states.some((s) => s.tag !== undefined);
    // A broken marker on a describe can be reached from several tests; report it once.
    const reported = new Set<string>();
    const reportOnce = (key: string): boolean => !reported.has(key) && Boolean(reported.add(key));
    for (const subject of analysis.subjects) {
      if (subject.dynamicTitle && options.reportDynamicTitles && hasTagStates) {
        context.report({ node: subject.node.arguments[0], messageId: 'dynamicTitle' });
      }
      for (const { state, required } of subject.states) {
        if (!required) continue;
        const result = evaluate(subject, state);
        if (result.kind !== 'ok' && result.kind !== 'missing' && !reportOnce(`${result.marker.comment.range[0]}:${state.name}`)) {
          continue;
        }
        const data = { state: state.name, marker: state.marker, example: state.ticket.example };
        switch (result.kind) {
          case 'ok':
            break;
          case 'missing':
            context.report({
              node: subject.node,
              messageId: 'missingMarker',
              data: { ...data, subject: describeSubject(subject) },
            });
            break;
          case 'case':
            context.report({
              loc: result.marker.comment.loc,
              messageId: 'markerCase',
              data: { marker: state.marker, found: result.marker.keyword },
            });
            break;
          case 'no-ticket':
            context.report({ loc: result.marker.comment.loc, messageId: 'missingTicket', data });
            break;
          case 'bad-ticket':
            context.report({
              loc: result.marker.comment.loc,
              messageId: result.ticket.result === 'placeholder' ? 'placeholderTicket' : 'invalidTicket',
              data: { ...data, ticket: result.ticket.text, expected: state.ticket.expected },
            });
            break;
        }
      }

      // Markers are ticket-only unless notes are allowed. A marker with a broken ticket is
      // already reported above, so its extra text waits until the ticket is fixed.
      if (options.allowNotes) continue;
      for (const marker of subject.markers) {
        const { extra, state } = marker;
        if (!extra || !state || !appliesTo(subject, state.name)) continue;
        if (marker.tickets.some((t) => t.result !== 'ok') || !reportOnce(`extra:${extra.range[0]}`)) continue;
        context.report({
          loc: {
            start: context.sourceCode.getLocFromIndex(extra.range[0]),
            end: context.sourceCode.getLocFromIndex(extra.range[1]),
          },
          messageId: 'extraText',
          data: { marker: state.marker, text: extra.text },
          suggest: [
            {
              messageId: 'removeExtraText',
              data: { text: extra.text },
              fix: (fixer) => fixer.removeRange(extra.range),
            },
          ],
        });
      }
    }
  },
});
