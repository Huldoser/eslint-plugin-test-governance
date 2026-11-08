import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { commentLines, directiveOf, isFunction, type Marker } from './analyze.ts';

type SourceCode = Readonly<TSESLint.SourceCode>;

/** Range of a marker's keyword on the marker's own line. */
export function keywordRange(marker: Marker): TSESTree.Range {
  return [marker.keywordStart, marker.keywordStart + marker.keyword.length];
}

/**
 * Removes a marker. From a comment that says more, it removes only the marker's line. Otherwise it removes
 * the comment, and its whole line when nothing else is on it, or from an ESLint directive only the
 * description, so the directive keeps working.
 */
export function removeMarkerComment(sourceCode: SourceCode, marker: Marker): TSESLint.RuleFix {
  const { comment, line: index } = marker;
  const lines = commentLines(comment);
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

/** The line break that ends the line `comment` ends on. */
export function lineBreakAfter(sourceCode: SourceCode, comment: TSESTree.Comment): string {
  // A line comment above a test always ends at a line break.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  return /^(?:\r\n|[\r\n\u2028\u2029])/.exec(sourceCode.text.slice(comment.range[1]))![0];
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
    // Vitest reads a timeout or options after the function only as the third argument.
    if (call.arguments.length > 2) return undefined;
    return (fixer) => [remove, fixer.insertTextAfter(title, `, { ${property} }`)];
  }
  if (details?.type !== 'ObjectExpression') return undefined;
  const taken = details.properties.some(
    (prop) =>
      prop.type === 'SpreadElement' ||
      prop.computed ||
      (prop.key.type === 'Identifier' ? prop.key.name : String(prop.key.value)) === source.key,
  );
  if (taken) return undefined;
  const last = details.properties.at(-1);
  return (fixer) => [
    remove,
    last === undefined
      ? fixer.insertTextBeforeRange([details.range[1] - 1, details.range[1]], ` ${property} `)
      : fixer.insertTextAfter(last, `, ${property}`),
  ];
}
