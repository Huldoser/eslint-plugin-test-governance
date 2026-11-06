import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { commentLines, directiveOf, isFunction, type Marker } from './analyze.ts';

type SourceCode = Readonly<TSESLint.SourceCode>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The lines of a marker's comment, which of them holds the marker, and where its keyword starts in that line.
 * The line is the one with the marker's keyword and tickets, so a keyword in prose above it is not taken.
 */
function markerLine(marker: Marker): {
  lines: ReturnType<typeof commentLines>;
  index: number;
  keywordStart: number;
} {
  const tickets = marker.tickets.map((ticket) => escapeRegExp(ticket.text)).join('\\s*,\\s*');
  // Tickets as parseTickets reads them. `(?=(\s*))\2` takes every space after the colon, so a marker without
  // tickets doesn't match a line that has some.
  const re = new RegExp(
    `^(\\s*\\*?\\s*)${escapeRegExp(marker.keyword)}\\s*:(?=(\\s*))\\2${tickets}(?=[.:;]*(?:[\\s,]|$))`,
  );
  const lines = commentLines(marker.comment);
  const index = lines.findIndex(({ text }) => re.test(text));
  // The marker was parsed from one of these lines, so one always matches.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  const keywordStart = lines[index].start + re.exec(lines[index].text)![1].length;
  return { lines, index, keywordStart };
}

/** Range of a marker's keyword on the marker's own line. */
export function keywordRange(marker: Marker): TSESTree.Range {
  const { keywordStart } = markerLine(marker);
  return [keywordStart, keywordStart + marker.keyword.length];
}

/**
 * Removes a marker. From a comment that says more, it removes only the marker's line. Otherwise it removes
 * the comment, and its whole line when nothing else is on it, or from an ESLint directive only the
 * description, so the directive keeps working.
 */
export function removeMarkerComment(sourceCode: SourceCode, marker: Marker): TSESLint.RuleFix {
  const { comment } = marker;
  const { lines, index } = markerLine(marker);
  if (lines.some(({ text }, i) => i !== index && /[^\s*]/.test(text))) {
    const { start, text } = lines[index];
    if (index === 0) {
      // A JSDoc comment keeps the `*` of its `/**`.
      return { range: [start + text.search(/[^*]/), start + text.length], text: '' };
    }
    const previous = lines[index - 1];
    const end = index === lines.length - 1 ? text.trimEnd().length : text.length;
    return { range: [previous.start + previous.text.length, start + end], text: '' };
  }
  const description = directiveOf(comment)?.description;
  if (description) {
    // `//` and `/*` are both two characters; a block comment keeps the space before its `*/`.
    const valueStart = comment.range[0] + 2;
    return { range: [valueStart + description.separator, valueStart + comment.value.trimEnd().length], text: '' };
  }
  const { text } = sourceCode;
  const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
  const newline = text.indexOf('\n', comment.range[1]);
  const lineEnd = newline === -1 ? text.length : newline + 1;
  const aloneOnLine =
    text.slice(lineStart, comment.range[0]).trim() === '' && text.slice(comment.range[1], lineEnd).trim() === '';
  return { range: aloneOnLine ? [lineStart, lineEnd] : comment.range, text: '' };
}

/** Indentation of the line `comment` starts on. */
export function indentOf(sourceCode: SourceCode, comment: TSESTree.Comment): string {
  const line = sourceCode.lines[comment.loc.start.line - 1];
  return line.slice(0, line.length - line.trimStart().length);
}

const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;

function quote(text: string): string {
  return `'${text.replace(/[\\']/g, '\\$&')}'`;
}

/**
 * Moves a marker's tickets into an annotation on `call`: Playwright's `annotation` or Vitest's `meta`,
 * written as the details object after the title or added to one written there. Undefined when that can't be
 * done cleanly: a directive or a note would be lost, the details are not an object written there, they
 * already have the key, or Vitest's `meta` would need more than one ticket under one key.
 */
export function moveToAnnotation(
  sourceCode: SourceCode,
  call: TSESTree.CallExpression,
  marker: Marker,
  source: { key: string; shape: 'annotation' | 'meta' },
  type: string,
): ((fixer: TSESLint.RuleFixer) => TSESLint.RuleFix[]) | undefined {
  const { comment, extra } = marker;
  const tickets = marker.tickets.map((ticket) => ticket.text);
  if (comment.type !== 'Line' || directiveOf(comment) || extra || tickets.length === 0) return undefined;
  if (source.shape === 'meta' && tickets.length > 1) return undefined;
  const one = (ticket: string): string => `{ type: ${quote(type)}, description: ${quote(ticket)} }`;
  const value =
    source.shape === 'meta'
      ? `{ ${IDENTIFIER_RE.test(type) ? type : quote(type)}: ${quote(tickets[0])} }`
      : tickets.length === 1
        ? one(tickets[0])
        : `[${tickets.map(one).join(', ')}]`;
  const property = `${source.key}: ${value}`;
  const [title] = call.arguments;
  // Vitest's `test.skip('title')` has no second argument.
  const details = call.arguments.at(1);
  if (isFunction(title)) return undefined;
  const remove = removeMarkerComment(sourceCode, marker);
  if (isFunction(details)) {
    return (fixer) => [remove, fixer.insertTextAfter(title, `, { ${property} }`)];
  }
  if (details?.type !== 'ObjectExpression') return undefined;
  const taken = details.properties.some(
    (prop) =>
      prop.type === 'SpreadElement' ||
      (!prop.computed && (prop.key.type === 'Identifier' ? prop.key.name : String(prop.key.value)) === source.key),
  );
  if (taken) return undefined;
  const last = details.properties.at(-1);
  return (fixer) => [
    remove,
    last === undefined ? fixer.replaceText(details, `{ ${property} }`) : fixer.insertTextAfter(last, `, ${property}`),
  ];
}
