import { describeSubject, missingStates, strayMarkers, type Marker } from '../utils/analyze.js';
import { createRule } from '../utils/create-rule.js';
import { removeComment } from '../utils/fix.js';

export default createRule({
  name: 'no-orphaned-marker',
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'Disallow marker comments that no longer match a test state',
      recommended: 'warn',
    },
    messages: {
      orphaned: "`{{marker}}:` is left over: {{subject}} is not in the '{{state}}' state.",
      detached: '`{{marker}}:` is not directly above a test, describe or skip call, so it has no effect.',
      removeMarker: 'Remove this comment.',
    },
  },
  check(context, analysis) {
    const { sourceCode } = context;
    const markers: { marker: Marker; messageId: 'orphaned' | 'detached'; subject: string }[] =
      analysis.detachedMarkers.map((marker) => ({ marker, messageId: 'detached', subject: '' }));
    for (const subject of analysis.subjects) {
      // A stray marker next to a missing one is a mismatch, reported by marker-matches-state.
      if (missingStates(subject).length > 0) continue;
      const name = describeSubject(subject).replace(/^This/, 'this');
      for (const marker of strayMarkers(subject)) markers.push({ marker, messageId: 'orphaned', subject: name });
    }
    for (const { marker, messageId, subject } of markers) {
      context.report({
        loc: marker.comment.loc,
        messageId,
        data: { marker: marker.keyword, state: marker.state!.name, subject },
        suggest: [{ messageId: 'removeMarker', fix: () => removeComment(sourceCode, marker.comment) }],
      });
    }
  },
});
