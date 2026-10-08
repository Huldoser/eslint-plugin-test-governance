import type { TSESTree } from '@typescript-eslint/utils';
import { appliesTo, commentLines, isStateMarker, parseTickets } from '../utils/analyze.ts';
import { createRule } from '../utils/create-rule.ts';
import { compileTicketSpec } from '../utils/tickets.ts';

/** Recognises anything shaped like a ticket, to tell a wrong-format ticket from plain prose. */
const ticketShape = compileTicketSpec([{ preset: 'any' }], []);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require FIXME and TODO comments in test files to start with a ticket',
      recommended: 'error',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/require-ticket-in-comments.md',
    },
    hasSuggestions: true,
    schema: [],
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
  create(context, analysis, options) {
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
    // sentence that happens to start with "Todo" is not mistaken for a work comment. The keyword can
    // carry its ticket in parentheses, `TODO(TRADE-123): ...`, a common style that tools also use for
    // a name, `TODO(alice)`, which is not a ticket. Some teams put a space before the parenthesis.
    const alternatives = keywords.map(escapeRegExp).join('|');
    const keywordRe = new RegExp(`^(\\s*\\*?\\s*)(${alternatives})(?:\\s*\\(([^)]*)\\))?(?:\\s*:|(?=\\s|$))`, 'i');

    /**
     * `TODO(TRADE-1, TRADE-2): text`: the tickets are in the parentheses, and anything after them, from the
     * closing parenthesis on, is a note.
     */
    function parseParenthesized(
      line: string,
      start: number,
      open: number,
      inParens: string,
    ): ReturnType<typeof parseTickets> {
      const parsed = parseTickets(inParens, start + open + 1, matcher);
      const close = open + inParens.length + 2;
      const note = line
        .slice(close)
        .replace(/^\s*:?/, '')
        .trim();
      if (note === '' || parsed.extra) return parsed;
      return { ...parsed, extra: { text: note, range: [start + close, start + line.trimEnd().length] } };
    }

    for (const comment of sourceCode.getAllComments()) {
      if (owned.has(comment)) continue;
      for (const { text: line, start } of commentLines(comment)) {
        const match = keywordRe.exec(line);
        if (!match) continue;
        const [whole, indent, keyword] = match;
        // The parenthesised group is optional, so it can be undefined despite RegExpExecArray's typing.
        const inParens = match[3] as string | undefined;
        const upper = keyword.toUpperCase();
        if (keyword !== upper && !whole.endsWith(':')) continue;

        const { tickets, extra } =
          inParens === undefined
            ? parseTickets(line.slice(whole.length), start + whole.length, matcher)
            : parseParenthesized(line, start, whole.indexOf('(', indent.length + keyword.length), inParens);
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
