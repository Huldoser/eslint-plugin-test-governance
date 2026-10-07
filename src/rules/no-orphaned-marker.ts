import { describeSubject, isProse, missingStates, strayMarkers, type StateMarker } from '../utils/analyze.ts';
import { createRule } from '../utils/create-rule.ts';
import { removeComment } from '../utils/fix.ts';

export default createRule({
  name: 'no-orphaned-marker',
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Disallow marker comments that no longer match a test state',
      recommended: 'error',
    },
    messages: {
      orphaned: "`{{marker}}:` is left over: {{subject}} is not in the '{{state}}' state.",
      detached: '`{{marker}}:` is not directly above a test, describe or skip call, so it has no effect.',
      removeMarker: 'Remove this comment.',
    },
  },
  check(context, analysis, options) {
    // Files without Playwright tests, such as application code, have no markers to check.
    if (!analysis.isTestFile) return;
    const { sourceCode } = context;
    const markers: { marker: StateMarker; messageId: 'orphaned' | 'detached'; subject: string }[] = [];
    for (const marker of analysis.detachedMarkers) {
      // `// FIXME: TRADE-12` above a helper is a tracked work comment, checked by require-ticket-in-comments.
      if (options.workCommentKeywords.has(marker.keyword)) continue;
      markers.push({ marker, messageId: 'detached', subject: '' });
    }
    for (const subject of analysis.subjects) {
      // A stray marker next to a missing one is a mismatch, reported by marker-matches-state.
      if (missingStates(subject).length > 0) continue;
      const name = describeSubject(subject).replace(/^This/, 'this');
      for (const marker of strayMarkers(subject, options))
        markers.push({ marker, messageId: 'orphaned', subject: name });
    }
    for (const { marker, messageId, subject } of markers) {
      // `// SKIP: this is flaky` is prose, not a leftover ticket.
      if (isProse(marker)) continue;
      context.report({
        loc: marker.comment.loc,
        messageId,
        data: { marker: marker.keyword, state: marker.state.name, subject },
        suggest: [{ messageId: 'removeMarker', fix: () => removeComment(sourceCode, marker.comment) }],
      });
    }
  },
});
