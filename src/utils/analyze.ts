import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { isOtherRunner, RUNTIME_MODIFIERS, type Framework, type Root } from './frameworks.ts';
import type { ResolvedOptions, StateDef } from './options.ts';
import type { TicketCheck, TicketMatcher } from './tickets.ts';

type Node = TSESTree.Node;
type Comment = TSESTree.Comment;
type SourceCode = Readonly<TSESLint.SourceCode>;

const TEST: Root = { kind: 'test', modifiers: [] };
/** Modifiers that keep a test from running. */
const SKIPPING_MODIFIERS = new Set(['skip', 'fixme', 'todo']);
/** What a step's `TestStepInfo` can do at runtime: `step.skip()`. */
const STEP_INFO_METHODS = new Set(['skip']);
const MARKER_LINE_RE = /^\s*\*?\s*([A-Za-z][\w-]*)\s*:(.*)$/;
const TAG_RE = /(?<![\w@])@[\w-]+/g;

interface MarkerTicket {
  text: string;
  result: TicketCheck;
}

export interface Marker {
  comment: Comment;
  /** The keyword as written, e.g. `SKIP` or `skip`. */
  keyword: string;
  /** Set when the keyword is exactly a state's marker. */
  state?: StateDef;
  /** Set when the keyword matches a state's marker only when case is ignored. */
  caseOf?: StateDef;
  tickets: MarkerTicket[];
  /** Text after the last ticket, such as a note or a stray separator, with its source range. */
  extra?: { text: string; range: TSESTree.Range };
}

/** A marker whose keyword is exactly a state's marker. */
export type StateMarker = Marker & { state: StateDef };

export function isStateMarker(marker: Marker): marker is StateMarker {
  return marker.state !== undefined;
}

export interface TagOccurrence {
  tag: string;
  /** Where to report the tag: the text it is written in, or the name it comes from, as `Tags.NEW`. */
  node: Node;
  /**
   * Where the tag is written in the source. Unset when it comes from a constant, or when an escape such
   * as `\u002D` comes before the tag or inside it, since the source then no longer lines up with the title.
   */
  range?: TSESTree.Range;
  /** Set for a Vitest tag name such as `'flaky'` in `tags`, which is written without its `@`. */
  plain?: true;
}

interface StateSource {
  state: StateDef;
  /** False for conditional skips unless `requireTicketForConditional` is set. */
  required: boolean;
}

export interface Subject {
  kind: 'test' | 'describe' | 'step' | 'runtime';
  node: TSESTree.CallExpression;
  /** The node the marker comment block sits above. */
  anchor: Node;
  parent?: Subject;
  /** States that start on this node: its modifier, its own tags, or a runtime call. */
  states: StateSource[];
  /** Names of states this node gets from enclosing describes. */
  inherited: Set<string>;
  /** Names of states added by runtime calls directly inside this test or describe. */
  runtimeStates: Set<string>;
  /** Every tag written on this node, known or not. */
  tags: TagOccurrence[];
  /** Tags this node inherits from enclosing describes. */
  inheritedTags: Set<string>;
  /** Tag values, or a whole details object, on this node that can't be read, as `{ tag: TAGS.NEW }` with `TAGS` imported. */
  unreadTags: Node[];
  /**
   * States this node may be in without the code showing it: tag states when tags can't be read, and
   * Vitest's option states when its options object can't. Includes those of enclosing describes.
   */
  unknownStates: Set<string>;
  /** True when this node is skipped or fixme'd by any means, whether or not those states are on. */
  skipped: boolean;
  ownSkip: boolean;
  markers: Marker[];
  dynamicTitle: boolean;
}

export interface Analysis {
  subjects: Subject[];
  /** Markers that are not in the comment block of any test, describe or runtime call. */
  detachedMarkers: StateMarker[];
  /** Whether the file uses the test framework at all: an import from it or a call to a test function. */
  isTestFile: boolean;
}

export type Evaluation =
  | { kind: 'ok' }
  | { kind: 'missing' }
  | { kind: 'case'; marker: Marker }
  | { kind: 'no-ticket'; marker: Marker }
  | { kind: 'bad-ticket'; marker: Marker; ticket: MarkerTicket };

interface Chain {
  root: TSESTree.Identifier;
  path: string[];
  /** The first argument of each member called to build the function: `isMobile` in `test.skipIf(isMobile)`. */
  args: Map<string, Node | undefined>;
}

/**
 * A name for what can change a test's state at runtime: a parameter such as `testInfo`, a step's
 * `TestStepInfo` or Vitest's test context, with its methods, or one of those methods taken out of it,
 * as `skip` in Vitest's `({ skip }) => ...`.
 */
type InfoName = {
  name: string;
  /** The step a `TestStepInfo` belongs to. Unset for the others, which act on the whole test. */
  step?: Subject;
} & ({ methods: ReadonlySet<string>; method?: undefined } | { method: string; methods?: undefined });

/** The names a parameter gives to runtime info: `testInfo`, or `skip` in `({ skip }) => ...`. */
function infoNames(param: TSESTree.Parameter | undefined, methods: ReadonlySet<string>, step?: Subject): InfoName[] {
  if (param?.type === 'Identifier') return [{ name: param.name, methods, step }];
  if (param?.type !== 'ObjectPattern') return [];
  return param.properties.flatMap((prop): InfoName[] => {
    if (prop.type !== 'Property' || prop.value.type !== 'Identifier') return [];
    const method = propertyName(prop);
    return method !== undefined && methods.has(method) ? [{ name: prop.value.name, method, step }] : [];
  });
}

function memberName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.property.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;
  return undefined;
}

/**
 * The name a callee starts from and the members after it: `['describe', 'skip']` for
 * `test.describe.skip`. A member called to build the function, as `each` in `test.each(table)` or
 * ``test.each`...` ``, is written with parentheses: `['skip', 'each()']` for `test.skip.each(table)`.
 */
function chainOf(node: Node, factories: ReadonlySet<string>): Chain | undefined {
  const path: string[] = [];
  const args = new Map<string, Node | undefined>();
  let current = node;
  for (;;) {
    if (current.type === 'MemberExpression') {
      const name = memberName(current);
      if (name === undefined) return undefined;
      path.unshift(name);
      current = current.object;
      continue;
    }
    const factory =
      current.type === 'CallExpression'
        ? current.callee
        : current.type === 'TaggedTemplateExpression'
          ? current.tag
          : undefined;
    if (factory?.type !== 'MemberExpression') break;
    const name = memberName(factory);
    if (name === undefined || !factories.has(name)) return undefined;
    path.unshift(`${name}()`);
    if (current.type === 'CallExpression') args.set(`${name}()`, current.arguments.at(0));
    current = factory.object;
  }
  return current.type === 'Identifier' ? { root: current, path, args } : undefined;
}

function unwrap(node: Node): Node {
  let current = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSSatisfiesExpression'
  ) {
    current = current.expression;
  }
  return current;
}

function isFunction(node: Node | undefined): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

interface TestNames {
  /** Names that refer to the framework's test functions, with what each one is. */
  roots: Map<string, Root>;
  /** Names bound to a whole framework module, as in `import * as pw`, whose `test` is `pw.test`. */
  modules: Set<string>;
}

/** Collects the top-level names that refer to the framework's test functions or to its module. */
function collectTestNames(program: TSESTree.Program, framework: Framework, configured: Set<string>): TestNames {
  const roots = new Map(framework.globals);
  for (const name of configured) roots.set(name, TEST);
  const modules = new Set<string>();
  const mergeTests = new Set<string>();
  /** Names bound to another test runner, such as `ava` in `import ava from 'ava'`. */
  const others = new Set<string>();
  /** The member name of `pw.test` or `pw.mergeTests` on a framework module. */
  const moduleMember = (node: Node): string | undefined =>
    node.type === 'MemberExpression' && node.object.type === 'Identifier' && modules.has(node.object.name)
      ? memberName(node)
      : undefined;
  /** The test function an expression is, such as `base.extend({...})` or `mergeTests(a, b)`. */
  const resolve = (node: Node): Root | undefined => {
    const target = unwrap(node);
    if (target.type === 'Identifier') return roots.get(target.name);
    const member = moduleMember(target);
    if (member !== undefined) return framework.exports.get(member);
    if (target.type !== 'CallExpression') return undefined;
    // mergeTests(dbTest, a11yTest) or pw.mergeTests(dbTest, a11yTest)
    if (target.callee.type === 'Identifier') return mergeTests.has(target.callee.name) ? TEST : undefined;
    if (target.callee.type !== 'MemberExpression') return undefined;
    if (moduleMember(target.callee) === 'mergeTests') return TEST;
    return memberName(target.callee) === 'extend' ? resolve(target.callee.object) : undefined;
  };
  // require('node:test'), ava, ava.serial or `ava as TestFn<Context>`
  const isOtherFramework = (node: Node): boolean => {
    const target = unwrap(node);
    const source = requireSource(target);
    if (source !== undefined) return isOtherRunner(framework, source);
    if (target.type === 'Identifier') return others.has(target.name);
    return target.type === 'MemberExpression' && isOtherFramework(target.object);
  };
  const setOther = (name: string): void => {
    roots.delete(name);
    others.add(name);
  };

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source.value;
      if (isOtherRunner(framework, source)) {
        for (const spec of statement.specifiers) setOther(spec.local.name);
      } else if (framework.ownsModule(source)) {
        for (const spec of statement.specifiers) {
          const local = spec.local.name;
          if (spec.type === 'ImportNamespaceSpecifier') modules.add(local);
          else if (spec.type === 'ImportDefaultSpecifier') {
            if (framework.defaultExport) roots.set(local, framework.defaultExport);
          } else {
            const root = framework.exports.get(importedName(spec));
            if (root) roots.set(local, root);
            else if (importedName(spec) === 'mergeTests') mergeTests.add(local);
          }
        }
      }
      continue;
    }
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      const init = declarator.init && unwrap(declarator.init);
      if (!init) continue;
      if (declarator.id.type === 'Identifier') {
        const name = declarator.id.name;
        // `const t = base.extend({...})`, `const t = mergeTests(a, b)` or a plain alias, `const t = base`.
        const root = resolve(init);
        if (root) roots.set(name, root);
        // `const test = require('node:test')` is another runner's `test`, like an import from it.
        else if (isOtherFramework(init)) setOther(name);
        else {
          // `const pw = require('@playwright/test')`, used as `pw.test`.
          const source = requireSource(init);
          if (source !== undefined && framework.ownsModule(source)) modules.add(name);
        }
      } else if (declarator.id.type === 'ObjectPattern') {
        const source = requireSource(init);
        if (source === undefined) continue;
        for (const prop of declarator.id.properties) {
          if (prop.type !== 'Property' || prop.value.type !== 'Identifier') continue;
          if (isOtherRunner(framework, source)) setOther(prop.value.name);
          else if (framework.ownsModule(source)) {
            const root = framework.exports.get(propertyName(prop) ?? '');
            if (root) roots.set(prop.value.name, root);
          }
        }
      }
    }
  }
  return { roots, modules };
}

/** The name a property key spells out: `test` in `{ test }`, `{ 'test': t }` or `{ ['test']: t }`. */
function propertyName(prop: TSESTree.Property): string | undefined {
  if (prop.key.type === 'Literal') return typeof prop.key.value === 'string' ? prop.key.value : undefined;
  return prop.computed ? undefined : prop.key.name;
}

function importedName(spec: TSESTree.ImportSpecifier): string {
  return spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
}

/** The module name of `require('...')`, or undefined for anything else. */
function requireSource(node: Node): string | undefined {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'require')
    return undefined;
  const first = node.arguments.at(0);
  return first?.type === 'Literal' && typeof first.value === 'string' ? first.value : undefined;
}

/**
 * Whether `id` refers to a variable declared inside a function or block, such as a local helper that
 * happens to be called `test`. Top-level variables, imports, parameters and globals still count.
 */
function isLocalVariable(sourceCode: SourceCode, id: TSESTree.Identifier): boolean {
  for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(id); scope; scope = scope.upper) {
    const variable = scope.set.get(id.name);
    if (!variable) continue;
    // A top-level scope: the global scope, a module's scope, or in CommonJS the function scope that
    // wraps the module.
    if (scope.block.type === 'Program') return false;
    return variable.defs.some((def) => def.type === 'Variable');
  }
  return false;
}

const STATEMENT_CONTAINERS = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase', 'TSModuleBlock']);

/** The statement a call belongs to; its marker block sits above that statement. */
function anchorOf(call: TSESTree.CallExpression): Node {
  let node: Node = call;
  // A call always sits inside a statement container, so the walk stops before it runs out of parents.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  while (!STATEMENT_CONTAINERS.has(node.parent!.type)) node = node.parent!;
  return node;
}

/** The contiguous comment block directly above `anchor`. */
function commentBlock(sourceCode: SourceCode, anchor: Node, allowBlankLine: boolean): Comment[] {
  const comments = sourceCode.getCommentsBefore(anchor);
  const block: Comment[] = [];
  let nextLine = anchor.loc.start.line;
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (!allowBlankLine && nextLine - comment.loc.end.line > 1) break;
    const before = sourceCode.getTokenBefore(comment, { includeComments: false });
    if (before?.loc.end.line === comment.loc.start.line) break;
    block.unshift(comment);
    nextLine = comment.loc.start.line;
  }
  return block;
}

/**
 * Parses `TICKET[, TICKET...]` from the text after a marker's colon. `offset` is the source position
 * of `text[0]`. Anything after the last ticket, including a trailing comma, is returned as `extra`.
 */
export function parseTickets(text: string, offset: number, matcher: TicketMatcher): Pick<Marker, 'tickets' | 'extra'> {
  const tickets: MarkerTicket[] = [];
  let index = text.length - text.trimStart().length;
  let lastEnd = 0;
  for (;;) {
    const token = /^[^\s,]+/.exec(text.slice(index))?.[0];
    if (!token) break;
    // Punctuation right after a ticket (`TRADE-1:` or `TRADE-1.`) is not part of it.
    const ticket = token.replace(/[.:;]+$/, '');
    // Punctuation alone, as in `// SKIP: .`, is no ticket at all.
    if (ticket === '') break;
    tickets.push({ text: ticket, result: matcher.check(ticket) });
    index += ticket.length;
    lastEnd = index;
    const separator = /^\s*,\s*/.exec(text.slice(index))?.[0];
    if (!separator) break;
    index += separator.length;
  }
  const rest = text.slice(lastEnd).trimEnd();
  // A sentence-ending `TRADE-1.` has nothing after the ticket; `TRADE-1: flaky` has a note.
  if (tickets.length === 0 || /^[.:;]*$/.test(rest.trim())) return { tickets };
  return { tickets, extra: { text: rest.trim(), range: [offset + lastEnd, offset + lastEnd + rest.length] } };
}

const LINE_BREAK_RE = /\r\n|[\r\n\u2028\u2029]/g;

/** The lines of a comment and where each starts in the source, split at every line break JavaScript has. */
export function commentLines(comment: Comment): { text: string; start: number }[] {
  const lines: { text: string; start: number }[] = [];
  // `//` and `/*` are both two characters, so the comment's value starts two characters in.
  const valueStart = comment.range[0] + 2;
  let lineStart = 0;
  for (const lineBreak of comment.value.matchAll(LINE_BREAK_RE)) {
    lines.push({ text: comment.value.slice(lineStart, lineBreak.index), start: valueStart + lineStart });
    lineStart = lineBreak.index + lineBreak[0].length;
  }
  lines.push({ text: comment.value.slice(lineStart), start: valueStart + lineStart });
  return lines;
}

function parseMarkers(comment: Comment, states: StateDef[]): Marker[] {
  const markers: Marker[] = [];
  for (const { text, start } of commentLines(comment)) {
    const match = MARKER_LINE_RE.exec(text);
    if (!match) continue;
    const [, keyword, rest] = match;
    const restOffset = start + match[0].length - rest.length;
    const state = states.find((s) => s.marker === keyword);
    if (state) {
      markers.push({ comment, keyword, state, ...parseTickets(rest, restOffset, state.ticket) });
      continue;
    }
    const caseOf = states.find((s) => s.marker === keyword.toUpperCase());
    if (caseOf) markers.push({ comment, keyword, caseOf, ...parseTickets(rest, restOffset, caseOf.ticket) });
  }
  return markers;
}

type Text = TSESTree.StringLiteral | TSESTree.TemplateLiteral;

/** A piece of text a title or tag is made of. */
interface FoundText {
  text: Text;
  /** The name the text was reached through, such as `Tags.NEW`. Unset when the call itself holds the text. */
  via?: Node;
}

function scanTags(source: string, { text: node, via }: FoundText, out: TagOccurrence[]): void {
  // Each piece of text with where it starts in the source, after its opening quote, backtick or `}`.
  const parts =
    node.type === 'Literal'
      ? [{ text: node.value, start: node.range[0] + 1 }]
      : node.quasis.map((quasi) => ({
          // `cooked` is only null in tagged templates, which are never titles.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
          text: quasi.value.cooked!,
          start: quasi.range[0] + 1,
        }));
  for (const { text, start } of parts) {
    for (const match of text.matchAll(TAG_RE)) {
      const end = match.index + match[0].length;
      const written = via === undefined && source.slice(start, start + end) === text.slice(0, end);
      out.push({ tag: match[0], node: via ?? node, ...(written && { range: [start + match.index, start + end] }) });
    }
  }
}

const PLAIN_TAG_RE = /^[\w-]+$/;

/** A Vitest tag name such as `'flaky'` in `tags`, which stands for the `@flaky` tag. */
function plainTag(source: string, { text, via }: FoundText): TagOccurrence | undefined {
  if (text.type !== 'Literal' || !PLAIN_TAG_RE.test(text.value)) return undefined;
  const start = text.range[0] + 1;
  const end = start + text.value.length;
  const written = via === undefined && source.slice(start, end) === text.value;
  return { tag: `@${text.value}`, node: via ?? text, plain: true, ...(written && { range: [start, end] }) };
}

function isStaticText(node: Node): node is Text {
  return (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral';
}

/**
 * The value a `const` or enum declared in this file gives a name: the `'@new'` of `const NEW = '@new'`,
 * or the enum itself. Undefined for any other name, such as an import, a parameter or a `let`.
 */
function declaredValue(sourceCode: SourceCode, id: TSESTree.Identifier): Node | undefined {
  for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(id); scope; scope = scope.upper) {
    const variable = scope.set.get(id.name);
    if (!variable) continue;
    // A name declared more than once, as a merged enum, has no single value.
    if (variable.defs.length !== 1) return undefined;
    const [def] = variable.defs;
    if (def.type === 'TSEnumName') return def.node;
    const declarator = def.type === 'Variable' && def.parent.kind === 'const' ? def.node : undefined;
    return declarator?.id.type === 'Identifier' ? (declarator.init ?? undefined) : undefined;
  }
  return undefined;
}

/** The value of the last property called `key`, or undefined when a spread written after it may replace it. */
function propertyValue(object: TSESTree.ObjectExpression, key: string): Node | undefined {
  for (let i = object.properties.length - 1; i >= 0; i--) {
    const prop = object.properties[i];
    if (prop.type === 'SpreadElement') return undefined;
    if (propertyName(prop) === key) return prop.value;
  }
  return undefined;
}

/**
 * What a name or member stands for when it is a constant declared in this file: the `'@new'` of `NEW`
 * after `const NEW = '@new'`, or of `Tags.NEW` after `const Tags = { NEW: '@new' }` or
 * `enum Tags { NEW = '@new' }`.
 */
function constantValue(sourceCode: SourceCode, node: Node): Node | undefined {
  if (node.type === 'Identifier') return declaredValue(sourceCode, node);
  if (node.type !== 'MemberExpression') return undefined;
  const key = memberName(node);
  const value = constantValue(sourceCode, unwrap(node.object));
  const owner = value && unwrap(value);
  if (key === undefined || owner === undefined) return undefined;
  if (owner.type === 'ObjectExpression') return propertyValue(owner, key);
  if (owner.type !== 'TSEnumDeclaration') return undefined;
  const member = owner.body.members.find((m) => (m.id.type === 'Identifier' ? m.id.name : m.id.value) === key);
  return member?.initializer;
}

/**
 * Reads the text a title or tag value is made of: strings, template literals and arrays of them,
 * following constants declared in this file. What can't be read, such as a name imported from another
 * file, goes in `unread`: the name the call uses, or the value itself.
 */
function readTexts(
  sourceCode: SourceCode,
  node: Node,
  out: { texts: FoundText[]; unread: Set<Node> },
  via?: Node,
  path: readonly Node[] = [],
): void {
  const target = unwrap(node);
  if (isStaticText(target)) {
    out.texts.push({ text: target, via });
    return;
  }
  if (target.type === 'ArrayExpression') {
    for (const item of target.elements) {
      if (item) readTexts(sourceCode, item.type === 'SpreadElement' ? item.argument : item, out, via, path);
    }
    return;
  }
  const value = constantValue(sourceCode, target);
  // `path` holds the constants already followed, so `const a = b; const b = a;` ends.
  if (value === undefined || path.includes(value)) out.unread.add(via ?? target);
  else readTexts(sourceCode, value, out, via ?? target, [...path, value]);
}

interface Details {
  /** The plain-keyed properties. */
  entries: [string, Node][];
  /** The details argument, when it can't be read. */
  unread?: Node;
}

/**
 * The details or options object of a declaration, the second argument in
 * `test('title', { tag: '@smoke' }, fn)` or Vitest's `test('title', { skip: true }, fn)`, also when it
 * is a constant declared in this file.
 */
function detailsOf(sourceCode: SourceCode, call: TSESTree.CallExpression): Details {
  const details = call.arguments.at(1);
  if (details === undefined || isFunction(details)) return { entries: [] };
  const target = unwrap(details);
  const value = target.type === 'ObjectExpression' ? target : constantValue(sourceCode, target);
  const object = value && unwrap(value);
  if (object?.type !== 'ObjectExpression') {
    // A name that can't be read is the details object only when a body comes after it:
    // `test.skip('places an order', placeOrder)` has a body defined elsewhere and no details.
    return call.arguments.slice(2).some(isFunction) ? { entries: [], unread: details } : { entries: [] };
  }
  const entries = object.properties.flatMap((prop): [string, Node][] => {
    if (prop.type !== 'Property' || prop.computed) return [];
    const key = prop.key.type === 'Identifier' ? prop.key.name : String((prop.key as TSESTree.Literal).value);
    return [[key, prop.value]];
  });
  return { entries };
}

interface TagInfo {
  tags: TagOccurrence[];
  /** Whether the title isn't text, so its tags can't be read. */
  dynamic: boolean;
  /** Tag values, or a whole details object, that can't be read. */
  unread: Node[];
  /** Whether the details or options object can't be read, so it may hold Vitest's `{ skip: true }`. */
  opaqueDetails: boolean;
}

const NO_TAGS: TagInfo = { tags: [], dynamic: false, unread: [], opaqueDetails: false };

function collectTags(
  sourceCode: SourceCode,
  call: TSESTree.CallExpression,
  hasTitle: boolean,
  framework: Framework,
  details: Details,
): TagInfo {
  if (!hasTitle) return NO_TAGS;
  const source = sourceCode.text;
  const tags: TagOccurrence[] = [];
  const title = { texts: [] as FoundText[], unread: new Set<Node>() };
  readTexts(sourceCode, call.arguments[0], title);
  for (const found of title.texts) scanTags(source, found, tags);
  const values = { texts: [] as FoundText[], unread: new Set<Node>() };
  for (const [key, value] of details.entries) {
    if (key === framework.tagKey) readTexts(sourceCode, value, values);
  }
  for (const found of values.texts) {
    const plain = framework.plainTags ? plainTag(source, found) : undefined;
    if (plain) tags.push(plain);
    else scanTags(source, found, tags);
  }
  const unread = [...values.unread];
  if (details.unread && framework.tagKey !== undefined) unread.push(details.unread);
  return { tags, dynamic: title.unread.size > 0, unread, opaqueDetails: details.unread !== undefined };
}

/**
 * Whether a call declares a test or describe block: a title and a body, as in `test('title', fn)` or
 * `test('title', details, fn)`, a static title with a body defined elsewhere, as in
 * `test.skip('pays', payWithCard)`, a describe with only a body, or a `todo` with only a title. A string
 * title tells `test.skip('pays', payWithCard)` apart from a runtime `test.skip(isMobile, 'why')`.
 */
function isDeclaration(kind: Root['kind'], args: TSESTree.CallExpressionArgument[], todo: boolean): boolean {
  const first = args.at(0);
  if (isFunction(first)) return kind === 'describe';
  if (first === undefined) return false;
  if (args.length === 1) return todo;
  return isStaticText(first) || args.slice(1).some(isFunction);
}

/** The value of a `true` or `false` literal; undefined for anything else. */
function booleanOf(node: Node | undefined): boolean | undefined {
  return node?.type === 'Literal' && typeof node.value === 'boolean' ? node.value : undefined;
}

function isUnconditional(call: TSESTree.CallExpression): boolean {
  const first = call.arguments.at(0);
  return (first === undefined || booleanOf(first) === true) && !isGuarded(call);
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** Whether a statement always leaves the function or block: `return`, `throw`, or a block containing one. */
function exits(statement: TSESTree.Statement): boolean {
  if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') return true;
  return statement.type === 'BlockStatement' && statement.body.some(exits);
}

/** `if (ready) return;` or `if (!ok) { throw error; }`: code after it only runs on some paths. */
function isEarlyExit(statement: TSESTree.Statement): boolean {
  return (
    statement.type === 'IfStatement' &&
    (exits(statement.consequent) || (statement.alternate !== null && exits(statement.alternate)))
  );
}

/**
 * Whether the call only runs on some paths of its function: under an `if`, a `switch` case, a ternary,
 * the right side of `&&`, `||` or `??`, in a `catch` block, or after an early exit such as
 * `if (ready) return;`. `if (!enabled) test.skip()` is the same as `test.skip(!enabled)`, and
 * `catch { test.skip(true, 'service is down') }` only skips when the service is down.
 */
function isGuarded(call: TSESTree.CallExpression): boolean {
  let child: Node = call;
  for (let node: Node | undefined = call.parent; node && !FUNCTIONS.has(node.type); child = node, node = node.parent) {
    if ((node.type === 'IfStatement' || node.type === 'ConditionalExpression') && child !== node.test) return true;
    if (node.type === 'SwitchCase' && child !== node.test) return true;
    if (node.type === 'LogicalExpression' && child === node.right) return true;
    if (node.type === 'CatchClause') return true;
    if (node.type === 'BlockStatement') {
      const index = node.body.indexOf(child as TSESTree.Statement);
      if (node.body.slice(0, index).some(isEarlyExit)) return true;
    }
  }
  return false;
}

/** Keys that point back up the tree or at comments rather than at child nodes. */
const NON_CHILD_KEYS = new Set(['parent', 'leadingComments', 'trailingComments']);

/**
 * The keys of a node type that the parser gave no visitor keys for, read from the node itself, as
 * ESLint's own traverser does. Without this, tests inside such a node would go unchecked.
 */
function ownKeys(node: Node): string[] {
  return Object.keys(node).filter((key) => !NON_CHILD_KEYS.has(key) && !key.startsWith('_'));
}

function isNode(value: unknown): value is Node {
  return typeof (value as Partial<Node> | null)?.type === 'string';
}

const cache = new WeakMap<object, WeakMap<ResolvedOptions, Analysis>>();

export function analyze(sourceCode: SourceCode, options: ResolvedOptions): Analysis {
  let byOptions = cache.get(sourceCode);
  if (!byOptions) {
    byOptions = new WeakMap();
    cache.set(sourceCode, byOptions);
  }
  let analysis = byOptions.get(options);
  if (!analysis) {
    analysis = runAnalysis(sourceCode, options);
    byOptions.set(options, analysis);
  }
  return analysis;
}

function runAnalysis(sourceCode: SourceCode, options: ResolvedOptions): Analysis {
  const { states, framework } = options;
  const testNames = collectTestNames(sourceCode.ast, framework, options.testFunctions);
  /**
   * The test function a callee starts from and the members after it, such as `test` and
   * `['describe', 'skip']` for `test.describe.skip` or `pw.test.describe.skip`. Undefined when the callee
   * isn't one of the framework's test functions.
   */
  const target = (chain: Chain | undefined): { root: Root; path: string[]; args: Chain['args'] } | undefined => {
    if (chain === undefined) return undefined;
    const { root, path, args } = chain;
    let base = testNames.roots.get(root.name);
    let rest = path;
    if (base === undefined && testNames.modules.has(root.name)) {
      base = framework.exports.get(path[0]);
      rest = path.slice(1);
    }
    return base !== undefined && !isLocalVariable(sourceCode, root) ? { root: base, path: rest, args } : undefined;
  };
  let usesTest = sourceCode.ast.body.some(
    (statement) => statement.type === 'ImportDeclaration' && framework.ownsModule(statement.source.value),
  );
  const subjects: Subject[] = [];
  const claimed = new Set<Comment>();
  const stack: Subject[] = [];
  const infos: InfoName[] = [];
  const keys = sourceCode.visitorKeys as Record<string, readonly string[] | undefined>;
  /** States an options object can put a test in, such as `skip` for Vitest's `{ skip: true }`. */
  const optionModifiers = new Set<string>(framework.optionEffects.values());

  /**
   * `modifiers` maps each state modifier the call has to whether it always applies; a conditional one,
   * like `test.skip(isMobile)` or Vitest's `skipIf(...)`, needs a ticket only with `requireTicketForConditional`.
   */
  const makeSubject = (
    kind: Subject['kind'],
    call: TSESTree.CallExpression,
    modifiers: ReadonlyMap<string, boolean>,
    tagInfo: TagInfo,
    parent = stack.at(-1),
  ): Subject => {
    const anchor = anchorOf(call);
    const block = commentBlock(sourceCode, anchor, options.allowBlankLine);
    // `symbols.forEach((symbol) =>\n  // SKIP: TRADE-1\n  test.skip(...))`: the marker sits above the call itself.
    if (call.parent.type === 'ArrowFunctionExpression' && call.parent.body === call) {
      block.push(...commentBlock(sourceCode, call, options.allowBlankLine));
    }
    for (const comment of block) claimed.add(comment);
    const ownTags = new Set(tagInfo.tags.map((t) => t.tag));
    const sources: StateSource[] = [];
    for (const state of states) {
      if (state.modifier === undefined) {
        if (ownTags.has(state.tag)) sources.push({ state, required: true });
        continue;
      }
      const always = modifiers.get(state.modifier);
      if (always !== undefined) sources.push({ state, required: always || options.requireTicketForConditional });
    }
    const inherited = new Set<string>();
    const inheritedTags = new Set<string>();
    const unknownStates = new Set<string>();
    if (parent && kind !== 'runtime') {
      for (const name of parent.inherited) inherited.add(name);
      for (const source of parent.states) inherited.add(source.state.name);
      for (const name of parent.unknownStates) unknownStates.add(name);
    }
    for (const state of states) {
      const unknown =
        state.modifier === undefined
          ? tagInfo.unread.length > 0
          : tagInfo.opaqueDetails && optionModifiers.has(state.modifier);
      if (unknown) unknownStates.add(state.name);
    }
    // Tags belong to tests: a step in a `@new` test is not itself new.
    if (parent && (kind === 'test' || kind === 'describe')) {
      for (const tag of parent.inheritedTags) inheritedTags.add(tag);
      for (const tag of parent.tags) inheritedTags.add(tag.tag);
    }
    const ownSkip = [...modifiers].some(([modifier, always]) => always && SKIPPING_MODIFIERS.has(modifier));
    const subject: Subject = {
      kind,
      node: call,
      anchor,
      parent,
      states: sources,
      inherited,
      runtimeStates: new Set(),
      tags: tagInfo.tags,
      inheritedTags,
      unreadTags: tagInfo.unread,
      unknownStates,
      skipped: ownSkip || (kind !== 'runtime' && parent?.skipped === true),
      ownSkip,
      markers: block.flatMap((comment) => parseMarkers(comment, states)),
      dynamicTitle: tagInfo.dynamic,
    };
    subjects.push(subject);
    return subject;
  };

  /**
   * The state modifiers of a declaration, from its members and, in Vitest, its options object. `args`
   * holds the conditions of members such as `skipIf()`.
   */
  const modifiersOf = (members: string[], details: [string, Node][], args: Chain['args']): Map<string, boolean> => {
    const modifiers = new Map<string, boolean>();
    const add = (modifier: string, always: boolean): void => {
      if (!modifiers.get(modifier)) modifiers.set(modifier, always);
    };
    for (const member of members) {
      const effect = framework.effects.get(member);
      if (!effect) continue;
      if (effect.when === undefined) {
        add(effect.modifier, true);
        continue;
      }
      // `skipIf(true)` always skips and `skipIf(false)` never does, like `{ skip: true }` and `{ skip: false }`.
      const condition = booleanOf(args.get(member));
      if (condition === undefined) add(effect.modifier, false);
      else if (condition === effect.when) add(effect.modifier, true);
    }
    // `{ skip: true }` always skips, `{ skip: isMobile }` only sometimes, `{ skip: false }` never.
    for (const [key, value] of details) {
      const modifier = framework.optionEffects.get(key);
      const literal = booleanOf(value);
      if (modifier && literal !== false) add(modifier, literal === true);
    }
    return modifiers;
  };

  /** What a body can change the test's state with: Playwright's `testInfo` or Vitest's test context. */
  const bodyInfos = (args: TSESTree.CallExpressionArgument[], path: string[]): InfoName[] => {
    const body = args.findLast(isFunction);
    // `test.each(table)` passes the row to the body, and `test.for(cases)` passes it before the context.
    if (!framework.info || !body || path.includes('each()')) return [];
    const param = body.params.at(framework.info.param + (path.includes('for()') ? 1 : 0));
    return infoNames(param, framework.info.methods);
  };

  const visitCall = (call: TSESTree.CallExpression): { subject?: Subject; infos?: InfoName[] } => {
    const callee = target(chainOf(call.callee, framework.factories));
    if (callee === undefined) return { subject: runtimeCall(call) };
    usesTest = true;
    const args = call.arguments;
    const { root } = callee;
    let { path } = callee;
    // Vitest's `beforeEach((context) => context.skip())` skips the tests it runs before.
    if (root.kind === 'hook') return { infos: bodyInfos(args, path) };

    if (framework.playwright) {
      // `test.step('fills the order', async (step) => {...})` or `test.step.skip(...)`. The step's body
      // gets a `TestStepInfo` that can skip the step at runtime.
      const step = path.join('.');
      if ((step === 'step' || step === 'step.skip') && args.length >= 2) {
        const subject = makeSubject('step', call, modifiersOf(path.slice(1), [], callee.args), NO_TAGS);
        const body = args[1];
        const param = isFunction(body) ? body.params.at(0) : undefined;
        return { subject, infos: infoNames(param, STEP_INFO_METHODS, subject) };
      }
    }
    const bodyInfo = bodyInfos(args, path);
    let { kind } = root;
    if (framework.playwright && path[0] === 'describe') {
      kind = 'describe';
      path = path.slice(1);
    }
    const members = [...root.modifiers, ...path];
    const allowed = kind === 'test' ? framework.testMembers : framework.describeMembers;
    if (members.every((m) => allowed.has(m)) && isDeclaration(kind, args, members.includes('todo'))) {
      // A declaration always has a first argument: its title, or the body of a describe without one.
      const details = detailsOf(sourceCode, call);
      const tagInfo = collectTags(sourceCode, call, !isFunction(args[0]), framework, details);
      return {
        subject: makeSubject(kind, call, modifiersOf(members, details.entries, callee.args), tagInfo),
        infos: bodyInfo,
      };
    }
    // test.skip(), test.fixme(), test.fail() and test.slow() in a test, a describe or a hook.
    if (framework.playwright && path.length === 1 && RUNTIME_MODIFIERS.has(path[0])) {
      return { subject: runtimeSubject(call, path[0]), infos: bodyInfo };
    }
    return { infos: bodyInfo };
  };

  /** `testInfo.skip()`, `step.skip()`, `test.info().skip()`, and Vitest's `context.skip()` or `skip()`. */
  const runtimeCall = (call: TSESTree.CallExpression): Subject | undefined => {
    const { callee } = call;
    // The innermost parameter with a name is the one the call uses.
    const innermost = (name: string): InfoName | undefined => infos.findLast((info) => info.name === name);
    if (callee.type === 'Identifier') {
      const info = innermost(callee.name);
      return info?.method !== undefined ? runtimeSubject(call, info.method, info.step) : undefined;
    }
    if (callee.type !== 'MemberExpression') return undefined;
    const name = memberName(callee);
    if (name === undefined || !RUNTIME_MODIFIERS.has(name)) return undefined;
    const { object } = callee;
    if (object.type === 'Identifier') {
      const info = innermost(object.name);
      return info?.methods?.has(name) ? runtimeSubject(call, name, info.step) : undefined;
    }
    const isTestInfo =
      object.type === 'CallExpression' &&
      target(chainOf(object.callee, framework.factories))?.path.join('.') === 'info';
    return isTestInfo ? runtimeSubject(call, name) : undefined;
  };

  /** `step` is set for `step.skip()`, which skips only its step; the other calls act on the whole test. */
  const runtimeSubject = (call: TSESTree.CallExpression, modifier: string, step?: Subject): Subject | undefined => {
    if (!states.some((s) => s.modifier === modifier)) return undefined;
    const subject = makeSubject(
      'runtime',
      call,
      new Map([[modifier, isUnconditional(call)]]),
      NO_TAGS,
      step ?? stack.findLast((s) => s.kind !== 'step'),
    );
    const parent = subject.parent;
    if (parent) {
      parent.runtimeStates.add(subject.states[0].state.name);
      if (subject.skipped) parent.skipped = true;
    }
    return subject;
  };

  const walk = (node: Node): void => {
    let pushedSubject = false;
    let pushedInfos = 0;
    if (node.type === 'CallExpression') {
      const visit = visitCall(node);
      if (visit.subject && visit.subject.kind !== 'runtime') {
        stack.push(visit.subject);
        pushedSubject = true;
      }
      for (const info of visit.infos ?? []) {
        infos.push(info);
        pushedInfos++;
      }
    }
    for (const key of keys[node.type] ?? ownKeys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key];
      for (const item of Array.isArray(child) ? child : [child]) if (isNode(item)) walk(item);
    }
    if (pushedSubject) stack.pop();
    infos.splice(infos.length - pushedInfos, pushedInfos);
  };
  walk(sourceCode.ast);

  const detachedMarkers = sourceCode
    .getAllComments()
    .filter((comment) => !claimed.has(comment))
    .flatMap((comment) => parseMarkers(comment, states))
    .filter(isStateMarker);

  return { subjects, detachedMarkers, isTestFile: usesTest };
}

/** Whether `subject` is in `stateName` at all, required or not, including inherited and runtime states. */
export function appliesTo(subject: Subject, stateName: string): boolean {
  return (
    subject.states.some((s) => s.state.name === stateName) ||
    subject.inherited.has(stateName) ||
    subject.runtimeStates.has(stateName)
  );
}

/**
 * Markers that can satisfy `state` for `subject`: its own block, then the blocks of enclosing
 * describes that are in the same state. A runtime call can also use any enclosing test or describe.
 */
function candidateMarkers(subject: Subject, state: StateDef): Marker[] {
  const found = subject.markers.filter((m) => m.state === state);
  let current = subject.parent;
  while (current && (subject.kind === 'runtime' || appliesTo(current, state.name))) {
    found.push(...current.markers.filter((m) => m.state === state));
    current = current.parent;
  }
  return found;
}

export function evaluate(subject: Subject, state: StateDef): Evaluation {
  const markers = candidateMarkers(subject, state);
  if (markers.length === 0) {
    const marker = subject.markers.find((m) => m.caseOf === state);
    return marker ? { kind: 'case', marker } : { kind: 'missing' };
  }
  const isValid = (m: Marker): boolean => m.tickets.length > 0 && m.tickets.every((t) => t.result === 'ok');
  // A broken marker in the subject's own block is reported even when another marker is valid: in
  // `// SKIP: TRADE-1` + `// SKIP: nope`, the second line is still wrong. Broken markers further up
  // are reported for the test or describe they sit above.
  const brokenOwn = markers.find((m) => subject.markers.includes(m) && !isValid(m));
  if (!brokenOwn && markers.some(isValid)) return { kind: 'ok' };
  // Report the problem with the closest broken marker.
  const marker = brokenOwn ?? markers[0];
  const bad = marker.tickets.find((t) => t.result !== 'ok');
  return bad ? { kind: 'bad-ticket', marker, ticket: bad } : { kind: 'no-ticket', marker };
}

/** Required states on `subject` that have no marker at all (not even a broken one). */
export function missingStates(subject: Subject): StateDef[] {
  return subject.states.filter((s) => s.required && evaluate(subject, s.state).kind === 'missing').map((s) => s.state);
}

/**
 * Whether a marker reads as an ordinary comment rather than a ticket reference, such as
 * `// FIXME: this breaks on slow machines`: it starts with something that is not a ticket and goes on
 * after it.
 */
export function isProse(marker: Marker): boolean {
  return marker.extra !== undefined && marker.tickets[0].result !== 'ok';
}

/**
 * Whether a marker is really an ordinary work comment such as `// FIXME: refactor this`: its keyword
 * is also a work-comment keyword and it doesn't start with a valid ticket. `require-ticket-in-comments`
 * reports those; the marker rules leave them alone.
 */
function isWorkComment(marker: Marker, options: ResolvedOptions): boolean {
  return options.workCommentKeywords.has(marker.keyword.toUpperCase()) && marker.tickets.at(0)?.result !== 'ok';
}

/**
 * Markers in the subject's own block for states that don't apply to it, leaving out work comments and
 * states its code may hide, such as a tag from a constant imported from another file. A marker in the
 * wrong case, as `// skip: TRADE-1`, counts when it starts with a valid ticket.
 */
export function strayMarkers(subject: Subject, options: ResolvedOptions): StateMarker[] {
  return subject.markers.flatMap((marker): StateMarker[] => {
    const state = marker.state ?? (marker.tickets.at(0)?.result === 'ok' ? marker.caseOf : undefined);
    if (state === undefined || appliesTo(subject, state.name) || subject.unknownStates.has(state.name)) return [];
    return isWorkComment(marker, options) ? [] : [{ ...marker, state }];
  });
}

/**
 * Where to report a problem with a test or describe: from the callee to the end of the title
 * (`test.skip('places a limit order'`), so editors underline the declaration rather than the whole body.
 * Runtime calls such as `test.skip()` are short, so they are reported whole.
 */
export function headLoc(subject: Subject): TSESTree.SourceLocation {
  const { node } = subject;
  if (subject.kind === 'runtime') return node.loc;
  // A describe can have a body and no title. A todo test has only a title.
  const [first] = node.arguments;
  const title = isFunction(first) ? undefined : first;
  return { start: node.callee.loc.start, end: (title ?? node.callee).loc.end };
}

export function describeSubject(subject: Subject): string {
  if (subject.kind === 'describe') return 'This describe block';
  if (subject.kind === 'step') return 'This step';
  if (subject.kind === 'runtime') return `This ${subject.states[0].state.modifier} call`;
  return 'This test';
}
