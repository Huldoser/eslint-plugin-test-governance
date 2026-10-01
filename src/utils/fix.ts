import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

type SourceCode = Readonly<TSESLint.SourceCode>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Range of `keyword` where it is used as a marker (`KEYWORD:`) inside `comment`. */
export function keywordRange(sourceCode: SourceCode, comment: TSESTree.Comment, keyword: string): TSESTree.Range {
  const text = sourceCode.getText(comment);
  // Only called with a keyword that was parsed from this comment, so it always matches.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  const match = new RegExp(`(^|[^\\w-])(${escapeRegExp(keyword)})\\s*:`).exec(text)!;
  const start = comment.range[0] + match.index + match[1].length;
  return [start, start + keyword.length];
}

/** Removes a comment, and its whole line when nothing else is on it. */
export function removeComment(sourceCode: SourceCode, comment: TSESTree.Comment): TSESLint.RuleFix {
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

/** Range of the `index`-th occurrence of `tag` in the source text of `node`. */
export function tagRange(
  sourceCode: SourceCode,
  node: TSESTree.Node,
  tag: string,
  index: number,
): TSESTree.Range | undefined {
  const text = sourceCode.getText(node);
  const re = new RegExp(`(?<![\\w@])${escapeRegExp(tag)}(?![\\w-])`, 'g');
  const match = [...text.matchAll(re)].at(index);
  return match === undefined ? undefined : [node.range[0] + match.index, node.range[0] + match.index + tag.length];
}
