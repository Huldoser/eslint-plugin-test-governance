import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { commentLines, parseTickets } from './analyze.ts';
import type { ResolvedOptions } from './options.ts';

export const commentTicketMessages = {
  invalidTicket: "'{{ticket}}' is not a valid ticket. Expected {{expected}}.",
  placeholderTicket: "'{{ticket}}' is a placeholder, not a tracking ticket.",
  markerCase: 'Write the marker in uppercase: `{{marker}}:`.',
  extraText: 'Only tickets are allowed after `{{marker}}:` unless allowNotes is enabled.',
};
export function checkCommentTickets(
  context: Readonly<TSESLint.RuleContext<keyof typeof commentTicketMessages | 'missingTicket', []>>,
  declarations: readonly { node: TSESTree.Node; comments: TSESTree.Comment[] }[],
  options: ResolvedOptions,
  keyword: 'SUPPRESS' | 'SERIAL' | 'EXCLUDE',
): void {
  const matcher = options.commentTicket;
  const markerPattern = new RegExp(`^\\s*\\*?\\s*${keyword}\\s*:`, 'i');
  const markerData = { marker: keyword };
  for (const { node, comments } of declarations) {
    const lines = comments.flatMap(commentLines);
    const marker = lines.findLast(({ text }) => markerPattern.test(text));
    if (!marker) {
      context.report({ node, messageId: 'missingTicket', data: { example: matcher.example } });
      continue;
    }
    const colon = marker.text.indexOf(':');
    const loc = {
      start: context.sourceCode.getLocFromIndex(marker.start),
      end: context.sourceCode.getLocFromIndex(marker.start + marker.text.length),
    };
    if (!marker.text.slice(0, colon).includes(keyword)) {
      context.report({ loc, messageId: 'markerCase', data: markerData });
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
      context.report({ loc, messageId: 'extraText', data: markerData });
    }
  }
}
