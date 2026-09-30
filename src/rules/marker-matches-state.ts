import { describeSubject, missingStates, strayMarkers } from '../utils/analyze.js';
import { createRule } from '../utils/create-rule.js';
import { indentOf, keywordRange } from '../utils/fix.js';

export default createRule({
  name: 'marker-matches-state',
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: "Require the marker keyword to match the test's state",
      recommended: 'error',
    },
    messages: {
      wrongMarker:
        "`{{found}}:` doesn't match this code: {{subject}} is in the '{{state}}' state, so the marker should be `{{expected}}:`.",
      sharedMarker:
        "`{{found}}:` covers only the '{{foundState}}' state. {{subject}} is also in the '{{state}}' state, which needs its own `// {{expected}}: <ticket>` marker.",
      renameMarker: 'Rename the marker to `{{expected}}:`.',
      addMarker: 'Add `// {{expected}}: {{tickets}}` with the same ticket.',
    },
  },
  check(context, analysis) {
    const { sourceCode } = context;
    for (const subject of analysis.subjects) {
      const missing = missingStates(subject);
      if (missing.length === 0) continue;
      const stray = strayMarkers(subject);
      const subjectName = describeSubject(subject).replace(/^This/, 'this');

      for (const marker of stray) {
        context.report({
          loc: marker.comment.loc,
          messageId: 'wrongMarker',
          data: { found: marker.keyword, expected: missing[0].marker, state: missing[0].name, subject: subjectName },
          suggest: missing.map((state) => ({
            messageId: 'renameMarker' as const,
            data: { expected: state.marker },
            fix: (fixer) => fixer.replaceTextRange(keywordRange(sourceCode, marker.comment, marker.keyword), state.marker),
          })),
        });
      }
      if (stray.length > 0) continue;

      // One marker written for a test that is in two states.
      const present = subject.markers.find((m) => m.state !== undefined && m.state !== missing[0]);
      if (!present) continue;
      for (const state of missing) {
        const tickets = present.tickets.map((t) => t.text).join(', ');
        context.report({
          loc: present.comment.loc,
          messageId: 'sharedMarker',
          data: {
            found: present.keyword,
            foundState: present.state!.name,
            expected: state.marker,
            state: state.name,
            subject: subjectName,
          },
          suggest:
            present.comment.type === 'Line' && tickets !== ''
              ? [
                  {
                    messageId: 'addMarker' as const,
                    data: { expected: state.marker, tickets },
                    fix: (fixer) =>
                      fixer.insertTextAfterRange(
                        present.comment.range,
                        `\n${indentOf(sourceCode, present.comment)}// ${state.marker}: ${tickets}`,
                      ),
                  },
                ]
              : [],
        });
      }
    }
  },
});
