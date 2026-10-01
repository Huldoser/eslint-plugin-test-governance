import type { TSESTree } from '@typescript-eslint/utils';
import { appliesTo, isStateMarker, parseTickets } from '../utils/analyze.js';
import { createRule } from '../utils/create-rule.js';
import { compileTicketSpec } from '../utils/tickets.js';

/** Recognises anything shaped like a ticket, to tell a wrong-format ticket from plain prose. */
const ticketShape = compileTicketSpec([{ preset: 'any' }], []);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default createRule({
  name: 'require-ticket-in-comments',
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'Require FIXME and TODO comments in test files to start with a ticket',
      recommended: 'error',
    },
    messages: {
      missingTicket:
        '`{{keyword}}` comments must start with a ticket, e.g. `// {{upper}}: {{example}}`. Put the details in the ticket.',
      invalidTicket: "'{{ticket}}' is not a valid ticket. Expected {{expected}}.",
      placeholderTicket: "'{{ticket}}' is a placeholder, not a real ticket. Link the ticket that tracks this work.",
      extraText:
        'Only ticket IDs are allowed after `{{keyword}}:`, separated by commas. Put details in the ticket instead of `{{text}}`.',
      removeExtraText: 'Remove `{{text}}`.',
    },
  },
  check(context, analysis, options) {
    const keywords = options.commentKeywords;
    if (keywords.length === 0 || !analysis.isTestFile) return;
    const { sourceCode } = context;
    const matcher = options.commentTicket;

    // A marker directly above a test in that state belongs to require-ticket.
    const owned = new Set<TSESTree.Comment>();
    for (const subject of analysis.subjects) {
      for (const marker of subject.markers) {
        if (isStateMarker(marker) && appliesTo(subject, marker.state.name)) owned.add(marker.comment);
      }
    }

    // `TODO`/`FIXME` in capitals counts with or without a colon. Other casings need the colon, so a
    // sentence that happens to start with "Todo" is not mistaken for a work comment.
    const alternatives = keywords.map(escapeRegExp).join('|');
    const keywordRe = new RegExp(`^(\\s*\\*?\\s*)(${alternatives})(?:\\s*:|(?=\\s|$))`, 'i');

    for (const comment of sourceCode.getAllComments()) {
      if (owned.has(comment)) continue;
      // `//` and `/*` are both two characters, so the comment's value starts two characters in.
      let lineStart = comment.range[0] + 2;
      for (const rawLine of comment.value.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        const start = lineStart;
        lineStart += rawLine.length + 1;

        const match = keywordRe.exec(line);
        if (!match) continue;
        const [whole, indent, keyword] = match;
        const upper = keyword.toUpperCase();
        if (keyword !== upper && !whole.endsWith(':')) continue;

        const { tickets, extra } = parseTickets(line.slice(whole.length), start + whole.length, matcher);
        const loc = {
          start: sourceCode.getLocFromIndex(start + indent.length),
          end: sourceCode.getLocFromIndex(start + line.trimEnd().length),
        };
        const data = { keyword, upper, example: matcher.example };
        const first = tickets.at(0);
        const bad = tickets.find((t) => t.result !== 'ok');

        if (first === undefined || (first.result === 'format' && ticketShape.check(first.text) !== 'ok')) {
          context.report({ loc, messageId: 'missingTicket', data });
        } else if (bad) {
          context.report({
            loc,
            messageId: bad.result === 'placeholder' ? 'placeholderTicket' : 'invalidTicket',
            data: { ...data, ticket: bad.text, expected: matcher.expected },
          });
        } else if (extra && !options.allowNotes) {
          context.report({
            loc: { start: sourceCode.getLocFromIndex(extra.range[0]), end: sourceCode.getLocFromIndex(extra.range[1]) },
            messageId: 'extraText',
            data: { keyword, text: extra.text },
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
    }
  },
});
