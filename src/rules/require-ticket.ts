import type { StateDef } from '../utils/options.ts';
import {
  annotationTicketsOf,
  appliesTo,
  describeSubject,
  evaluate,
  hasAnnotationTicket,
  headLoc,
  unreadAnnotationsOf,
  type Subject,
} from '../utils/analyze.ts';
import { createRule } from '../utils/create-rule.ts';
import { moveToAnnotation } from '../utils/fix.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a ticket for skipped, fixme, todo, retried and tagged tests',
      recommended: 'error',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      missingMarker:
        "{{subject}} is in the '{{state}}' state but has no `// {{marker}}: <ticket>` comment directly above it, e.g. `// {{marker}}: {{example}}`.",
      missingReason:
        "{{subject}} is in the '{{state}}' state only under a condition and doesn't say why. Write the reason in a comment above it{{argument}}.",
      missingTicket: '`{{marker}}:` needs a ticket right after the colon, e.g. `// {{marker}}: {{example}}`.',
      invalidTicket: "'{{ticket}}' is not a valid ticket for the '{{state}}' state. Expected {{expected}}.",
      placeholderTicket: "'{{ticket}}' is a placeholder, not a real ticket. Link the ticket that tracks this test.",
      markerCase: 'Write the marker keyword in uppercase: `{{marker}}:` instead of `{{found}}:`.',
      extraText:
        'Only ticket IDs are allowed after `{{marker}}:`, separated by commas. Put details in the ticket instead of `{{text}}`.',
      removeExtraText: 'Remove `{{text}}`.',
      dynamicTitle: "This title isn't static text, so its tags can't be checked. Use a string or template literal.",
      dynamicTags:
        "These tags can't be read in this file, so they can't be checked. Use strings, or constants declared in this file.",
      invalidAnnotation: "'{{ticket}}' is not a valid ticket for the '{{state}}' state. Expected {{expected}}.",
      useAnnotation:
        'Put the ticket in an `{{type}}` annotation instead of a comment, so it reaches the test report, e.g. `{{example}}`.',
      missingAnnotation:
        "{{subject}} is in the '{{state}}' state but has no `{{type}}` annotation with a ticket, e.g. `{{example}}`.",
      moveToAnnotation: 'Move the ticket into an `{{type}}` annotation.',
      unreadAnnotation:
        "This annotation's ticket isn't static text, so it can't be checked. Use a string, or a constant declared in this file.",
    },
  },
  create(context, analysis, options) {
    const hasTagStates = options.states.some((s) => s.tag !== undefined);
    // A broken marker on a describe can be reached from several tests; report it once.
    const reported = new Set<string>();
    const reportOnce = (key: string): boolean => !reported.has(key) && Boolean(reported.add(key));

    // With `annotations.only`, a test or describe takes its ticket from an annotation only; runtime skips
    // and steps can't carry one, so their comments still count.
    const only =
      options.annotations?.only === true && options.framework.annotations !== undefined
        ? { source: options.framework.annotations, type: options.annotations.type }
        : undefined;

    /** Reports the comment markers that should be annotations, or the missing annotation when there is none. */
    const reportAnnotationOnly = (
      subject: Subject,
      state: StateDef,
      { source, type }: NonNullable<typeof only>,
    ): void => {
      const example =
        source.shape === 'meta'
          ? `meta: { ${type}: '${state.ticket.example}' }`
          : `annotation: { type: '${type}', description: '${state.ticket.example}' }`;
      const markers = [...subject.markers, ...subject.regionMarkers].filter((m) => m.state === state);
      for (const marker of markers) {
        if (!reportOnce(`only:${marker.comment.range[0]}`)) continue;
        const fix = subject.markers.includes(marker)
          ? moveToAnnotation(context.sourceCode, subject.node, marker, source, type)
          : undefined;
        context.report({
          loc: marker.comment.loc,
          messageId: 'useAnnotation',
          data: { type, example },
          suggest: fix ? [{ messageId: 'moveToAnnotation', data: { type }, fix }] : [],
        });
      }
      if (markers.length > 0 || hasAnnotationTicket(subject, state, options)) return;
      context.report({
        loc: headLoc(subject),
        messageId: 'missingAnnotation',
        data: { subject: describeSubject(subject), state: state.name, type, example },
      });
    };
    /** Reports a conditional state that gives no reason and has no ticket, which would say why as well. */
    const reportReason = (subject: Subject, state: StateDef): void => {
      if (evaluate(subject, state).kind === 'ok' || hasAnnotationTicket(subject, state, options)) return;
      const callee = context.sourceCode.getText(subject.node.callee).replace(/\s+/g, '');
      const first = subject.node.arguments.at(0);
      const where = options.framework.reasonArgument;
      // Vitest's `context.skip()` takes either a reason alone or a condition and then the reason.
      const reasonOnly =
        where === 'only' ||
        (where === 'either' && (first === undefined || first.type === 'Literal' || first.type === 'TemplateLiteral'));
      const example = reasonOnly ? `${callee}('why')` : `${callee}(condition, 'why')`;
      const argument =
        subject.kind === 'runtime' && where !== undefined ? `, or pass it to the call: \`${example}\`` : '';
      context.report({
        loc: headLoc(subject),
        messageId: 'missingReason',
        data: { subject: describeSubject(subject), state: state.name, argument },
      });
    };

    for (const subject of analysis.subjects) {
      const needsTicket = subject.states.some((s) => s.required);
      if (options.reportUnreadableTags && hasTagStates) {
        if (subject.dynamicTitle) context.report({ node: subject.node.arguments[0], messageId: 'dynamicTitle' });
        for (const node of subject.unreadTags) context.report({ node, messageId: 'dynamicTags' });
      }
      // An annotation whose ticket can't be read may be the one that was supposed to cover the test.
      if (options.reportUnreadableTags && needsTicket) {
        for (const node of unreadAnnotationsOf(subject)) {
          if (reportOnce(`annotation-unread:${node.range[0]}`)) {
            context.report({ node, messageId: 'unreadAnnotation' });
          }
        }
      }
      const annotationOnly = only && (subject.kind === 'test' || subject.kind === 'describe') ? only : undefined;
      for (const { state, required, reasoned } of subject.states) {
        if (!required) {
          if (options.requireReasonForConditional && reasoned === false) reportReason(subject, state);
          continue;
        }
        if (annotationOnly) {
          reportAnnotationOnly(subject, state, annotationOnly);
          continue;
        }
        const result = evaluate(subject, state);
        // Annotations are checked whenever a ticket is needed, whatever the markers say.
        for (const ticket of annotationTicketsOf(subject)) {
          if (state.ticket.check(ticket.text) !== 'ok' && reportOnce(`annotation:${ticket.node.range[0]}`)) {
            context.report({
              node: ticket.node,
              messageId: 'invalidAnnotation',
              data: { ticket: ticket.text, state: state.name, expected: state.ticket.expected },
            });
          }
        }
        if (result.kind === 'missing' && hasAnnotationTicket(subject, state, options)) continue;
        if (
          result.kind !== 'ok' &&
          result.kind !== 'missing' &&
          !reportOnce(`${result.marker.comment.range[0]}:${state.name}`)
        ) {
          continue;
        }
        switch (result.kind) {
          case 'ok':
            break;
          case 'missing':
            context.report({
              loc: headLoc(subject),
              messageId: 'missingMarker',
              data: {
                subject: describeSubject(subject),
                state: state.name,
                marker: state.marker,
                example: state.ticket.example,
              },
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
            context.report({
              loc: result.marker.comment.loc,
              messageId: 'missingTicket',
              data: { marker: state.marker, example: state.ticket.example },
            });
            break;
          case 'bad-ticket':
            context.report({
              loc: result.marker.comment.loc,
              messageId: result.ticket.result === 'placeholder' ? 'placeholderTicket' : 'invalidTicket',
              data: { ticket: result.ticket.text, state: state.name, expected: state.ticket.expected },
            });
            break;
        }
      }

      // Markers are ticket-only unless notes are allowed. A marker with a broken ticket is
      // already reported above, so its extra text waits until the ticket is fixed.
      if (options.allowNotes || annotationOnly) continue;
      for (const marker of [...subject.markers, ...subject.regionMarkers]) {
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
