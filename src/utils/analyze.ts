import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { isOtherRunner, RUNTIME_MODIFIERS, type Framework, type Modifier, type Root } from './frameworks.ts';
import type { ResolvedOptions, StateDef } from './options.ts';
import type { TicketCheck, TicketMatcher } from './tickets.ts';

type Node = TSESTree.Node;
type Comment = TSESTree.Comment;
type SourceCode = Readonly<TSESLint.SourceCode>;

const TEST: Root = { kind: 'test', modifiers: [] };
const DESCRIBE: Root = { kind: 'describe', modifiers: [] };
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
  /** Tickets read from annotations of the configured type on this call, with the node to report at. */
  annotationTickets: { text: string; node: Node }[];
  /** Annotation values of the configured type on this call whose ticket can't be read. */
  unreadTickets: Node[];
  dynamicTitle: boolean;
  /** For a runtime function such as Jasmine's `pending()`, its name; messages call the others by their state. */
  functionName?: string;
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
  root: TSESTree.Identifier | TSESTree.CallExpression;
  path: string[];
  /** The first argument of each member called to build the function: `isMobile` in `test.skipIf(isMobile)`. */
  args: Map<string, Node | undefined>;
}

/**
 * A name for what can change a test's state at runtime: a parameter such as `testInfo`, a step's
 * `TestStepInfo` or Vitest's test context, with its methods, one of those methods taken out of it, as
 * `skip` in Vitest's `({ skip }) => ...`, or a runtime function such as Jasmine's `pending`.
 */
type InfoName = {
  name: string;
  /** The step a `TestStepInfo` belongs to. Unset for the others, which act on the whole test. */
  step?: Subject;
  /** For a runtime function, its own name, as `pending` also when imported as `pend`, and how it is reached. */
  runtimeFunction?: { name: string; imported: boolean };
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

/** The key a member expression reads, including an array index as in `TAGS[1]`. */
function memberKey(node: TSESTree.MemberExpression): string | undefined {
  if (node.property.type === 'Literal' && typeof node.property.value === 'number') return String(node.property.value);
  return memberName(node);
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
  return current.type === 'Identifier' || current.type === 'CallExpression' ? { root: current, path, args } : undefined;
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

interface RuntimeFunction {
  name: string;
  modifier: Modifier;
}

interface TestNames {
  /** Names that refer to the framework's test functions, with what each one is. */
  roots: Map<string, Root>;
  /** Names bound to a whole framework module, as in `import * as pw`, whose `test` is `pw.test`. */
  modules: Set<string>;
  /** Names imported for the framework's runtime functions, as `pend` in `import { pending as pend }`. */
  runtime: Map<string, RuntimeFunction>;
}

/** Collects the top-level names that refer to the framework's test functions or to its module. */
function collectTestNames(program: TSESTree.Program, framework: Framework, configured: Set<string>): TestNames {
  /** The framework's `test` function, which is also its module when `moduleIsDefault`. */
  const testRoot = framework.defaultExport ?? TEST;
  const roots = new Map(framework.globals);
  for (const name of configured) roots.set(name, testRoot);
  const runtime = new Map<string, RuntimeFunction>();
  const modules = new Set<string>();
  const mergeTests = new Set<string>();
  /** Names bound to another test runner, such as `ava` in `import ava from 'ava'`. */
  const others = new Set<string>();
  /** The member name of `pw.test` or `pw.mergeTests` on a framework module. */
  const moduleMember = (node: Node): string | undefined =>
    node.type === 'MemberExpression' && node.object.type === 'Identifier' && modules.has(node.object.name)
      ? memberName(node)
      : undefined;
  /**
   * What a member of a test function is: `it.skip` is `it` in the skip state, and node:test's
   * `test.describe` is the `describe` export, since its module is also its `test`.
   */
  const memberRoot = (object: Root, name: string): Root | undefined => {
    if (framework.defaultExport !== undefined && object === framework.defaultExport) {
      const exported = framework.exports.get(name);
      if (exported !== undefined) return exported;
    }
    const effect = framework.effects.get(name);
    if (effect !== undefined && effect.when === undefined) {
      return { kind: object.kind, modifiers: [...object.modifiers, effect.modifier] };
    }
    return undefined;
  };
  /** The test function an expression is, such as `base.extend({...})`, `mergeTests(a, b)` or `it.skip`. */
  const resolve = (node: Node): Root | undefined => {
    const target = unwrap(node);
    if (target.type === 'Identifier') return roots.get(target.name);
    const member = moduleMember(target);
    if (member !== undefined) return framework.exports.get(member);
    if (target.type === 'MemberExpression') {
      const object = resolve(target.object);
      const name = memberName(target);
      return object === undefined || name === undefined ? undefined : memberRoot(object, name);
    }
    if (target.type !== 'CallExpression') return undefined;
    // mergeTests(dbTest, a11yTest) or pw.mergeTests(dbTest, a11yTest)
    if (target.callee.type === 'Identifier') return mergeTests.has(target.callee.name) ? testRoot : undefined;
    if (target.callee.type !== 'MemberExpression') return undefined;
    if (moduleMember(target.callee) === 'mergeTests') return testRoot;
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
  /** Takes `name` for the runtime function `imported`, as in `const { pending: pend } = require('jasmine-core')`. */
  const bindRuntime = (name: string, imported: string | undefined): void => {
    const modifier = imported === undefined ? undefined : framework.runtimeFunctions.get(imported);
    if (imported !== undefined && modifier !== undefined) runtime.set(name, { name: imported, modifier });
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
            // `import test from 'node:test'` also has `test.describe`, and `import mocha from 'mocha'` has `mocha.it`.
            if (framework.moduleIsDefault) modules.add(local);
          } else {
            const root = framework.exports.get(importedName(spec));
            bindRuntime(local, importedName(spec));
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
          // `const mocha = require('mocha')`, used as `mocha.it`, or `const pw = require('@playwright/test')`,
          // which is `test` itself, as `require('node:test')` is.
          const source = requireSource(init);
          if (source !== undefined && framework.ownsModule(source)) {
            modules.add(name);
            if (framework.moduleIsDefault && framework.defaultExport) roots.set(name, framework.defaultExport);
          }
        }
      } else if (declarator.id.type === 'ObjectPattern') {
        // `const { describe } = test` and `const { skip } = it`, used as `describe.skip(...)`.
        const base = resolve(init);
        if (base !== undefined) {
          for (const prop of declarator.id.properties) {
            if (prop.type !== 'Property' || prop.value.type !== 'Identifier') continue;
            const name = propertyName(prop);
            if (name === undefined) continue;
            const root = name === 'describe' && framework.playwright ? DESCRIBE : memberRoot(base, name);
            if (root) roots.set(prop.value.name, root);
          }
          continue;
        }
        const source = requireSource(init);
        if (source === undefined) continue;
        for (const prop of declarator.id.properties) {
          if (prop.type !== 'Property' || prop.value.type !== 'Identifier') continue;
          if (isOtherRunner(framework, source)) setOther(prop.value.name);
          else if (framework.ownsModule(source)) {
            const root = framework.exports.get(propertyName(prop) ?? '');
            bindRuntime(prop.value.name, propertyName(prop));
            if (root) roots.set(prop.value.name, root);
          }
        }
      }
    }
  }
  return { roots, modules, runtime };
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
 * Where the file declares what `id` refers to: `inside` a function or block, a parameter included, at the
 * `top` level, or nowhere, for a `global`.
 */
function declaredWhere(sourceCode: SourceCode, id: TSESTree.Identifier): 'inside' | 'top' | 'global' {
  for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(id); scope; scope = scope.upper) {
    const variable = scope.set.get(id.name);
    if (!variable) continue;
    if (scope.block.type !== 'Program') return 'inside';
    return variable.defs.length > 0 ? 'top' : 'global';
  }
  return 'global';
}

/** The variable a name resolves to, walking out through the enclosing scopes. */
function declaredVariable(sourceCode: SourceCode, id: TSESTree.Identifier): TSESLint.Scope.Variable | undefined {
  for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(id); scope; scope = scope.upper) {
    const variable = scope.set.get(id.name);
    if (variable) return variable;
  }
  return undefined;
}

/**
 * Whether `id` refers to a variable or function declared inside a function or block, such as a local
 * helper that happens to be called `test`. Top-level variables, imports, parameters and globals still count.
 */
function isLocalVariable(sourceCode: SourceCode, id: TSESTree.Identifier): boolean {
  for (let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(id); scope; scope = scope.upper) {
    const variable = scope.set.get(id.name);
    if (!variable) continue;
    // A top-level scope: the global scope, a module's scope, or in CommonJS the function scope that
    // wraps the module.
    if (scope.block.type === 'Program') return false;
    return variable.defs.some((def) => def.type === 'Variable' || def.type === 'FunctionName');
  }
  return false;
}

const STATEMENT_CONTAINERS = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase', 'TSModuleBlock']);

/** The statement a call belongs to; its marker block sits above that statement. */
/**
 * The declaration a call makes through `Function.prototype.call`, `apply` or `bind`, read as if it were
 * written plainly: `it.skip.call(null, 'title', fn)`, `it.skip.apply(null, ['title', fn])` and
 * `it.skip.bind(null)('title', fn)` all declare the test that `it.skip('title', fn)` declares. A call that
 * isn't read this way, such as an `apply` with a list this file can't see, comes back unchanged.
 */
function throughFunctionMethods(original: TSESTree.CallExpression): TSESTree.CallExpression {
  let call = original;
  // `it.skip.bind(null).call(null, 'title', fn)` unwraps twice; two more steps cost nothing and end the loop.
  for (let step = 0; step < 4; step += 1) {
    const callee = unwrap(call.callee);
    // `it.skip.call(null, ...)`: the first argument is the receiver the method is called on.
    if (callee.type === 'MemberExpression' && memberName(callee) === 'call') {
      call = { ...call, callee: callee.object, arguments: call.arguments.slice(1) };
      continue;
    }
    // `it.skip.apply(null, ['title', fn])`: the arguments are the elements of an array written here.
    if (callee.type === 'MemberExpression' && memberName(callee) === 'apply') {
      const list = call.arguments.at(1);
      const elements = list === undefined ? undefined : unwrap(list);
      if (
        elements?.type !== 'ArrayExpression' ||
        elements.elements.some((e) => e === null || e.type === 'SpreadElement')
      ) {
        return call;
      }
      call = { ...call, callee: callee.object, arguments: elements.elements.filter((e) => e !== null) };
      continue;
    }
    // `it.skip.bind(null, 'title', fn)()` and `it.skip.bind(null)('title', fn)`: `bind` returns the test
    // function with the arguments it was given already in place.
    if (callee.type === 'CallExpression') {
      const bind = unwrap(callee.callee);
      if (bind.type !== 'MemberExpression' || memberName(bind) !== 'bind') return call;
      call = { ...call, callee: bind.object, arguments: [...callee.arguments.slice(1), ...call.arguments] };
      continue;
    }
    return call;
  }
  return call;
}

function anchorOf(call: TSESTree.CallExpression): Node {
  let node: Node = call;
  // A call always sits inside a statement container, so the walk stops before it runs out of parents.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  while (!STATEMENT_CONTAINERS.has(node.parent!.type)) node = node.parent!;
  return node;
}

/** The contiguous comment block directly above `anchor`. */
function commentBlock(sourceCode: SourceCode, anchor: Node, allowBlankLine: boolean): Comment[] {
  // Code without semicolons starts a line that opens with `(` with one: `;(isCI ? describe.skip : describe)(...)`.
  const semicolon = sourceCode.getTokenBefore(anchor);
  const leading =
    semicolon?.value === ';' &&
    semicolon.loc.start.line === anchor.loc.start.line &&
    sourceCode.getTokenBefore(semicolon)?.loc.end.line !== semicolon.loc.start.line;
  const comments = sourceCode.getCommentsBefore(leading ? semicolon : anchor);
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
  const key = memberKey(node);
  const value = constantValue(sourceCode, unwrap(node.object));
  const owner = value && unwrap(value);
  if (key === undefined || owner === undefined) return undefined;
  if (owner.type === 'ObjectExpression') return propertyValue(owner, key);
  if (owner.type === 'ArrayExpression') {
    const index = Number(key);
    if (!Number.isInteger(index)) return undefined;
    const element = owner.elements[index];
    return element !== null && element.type !== 'SpreadElement' ? element : undefined;
  }
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
    // A template that holds a constant, as in `` `${TAG}` ``, reads the constant's text too.
    if (target.type === 'TemplateLiteral') {
      for (const expression of target.expressions) {
        const value = constantValue(sourceCode, unwrap(expression));
        const resolved = value && unwrap(value);
        if (resolved !== undefined && isStaticText(resolved)) out.texts.push({ text: resolved, via });
      }
    }
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
  /** The plain-keyed properties, with spread objects that can be read folded in. */
  entries: [string, Node][];
  /** Values spread into the object that can't be read, such as an object imported from another file. */
  unread: Node[];
}

/**
 * The key of a details property, following a computed string key declared in this file. A computed key that
 * can't be read, as in `{ [key]: '@new' }`, goes in `unread`, since it may be the tag or an option.
 */
function detailKey(sourceCode: SourceCode, prop: TSESTree.Property, unread: Node[]): string | undefined {
  const key = unwrap(prop.key);
  if (!prop.computed) {
    return key.type === 'Identifier' ? key.name : String((key as TSESTree.Literal).value);
  }
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) return key.quasis[0]?.value.cooked ?? undefined;
  const value = constantValue(sourceCode, key);
  const resolved = value && unwrap(value);
  if (resolved?.type === 'Literal' && typeof resolved.value === 'string') return resolved.value;
  unread.push(prop.key);
  return undefined;
}

/**
 * The plain-keyed properties of a details object, following spread objects declared in this file and
 * collecting the ones that can't be read.
 */
function objectDetails(sourceCode: SourceCode, object: TSESTree.ObjectExpression, unread: Node[]): [string, Node][] {
  return object.properties.flatMap((prop): [string, Node][] => {
    if (prop.type === 'SpreadElement') {
      const argument = unwrap(prop.argument);
      const value = argument.type === 'ObjectExpression' ? argument : constantValue(sourceCode, argument);
      const spread = value && unwrap(value);
      if (spread?.type === 'ObjectExpression') return objectDetails(sourceCode, spread, unread);
      unread.push(prop.argument);
      return [];
    }
    const key = detailKey(sourceCode, prop, unread);
    return key === undefined ? [] : [[key, prop.value]];
  });
}

/**
 * The details or options object of a declaration, the second argument in
 * `test('title', { tag: '@smoke' }, fn)` or Vitest's `test('title', { skip: true }, fn)`, also when it
 * is a constant declared in this file. With `optionsFirst`, the first: node:test's `test({ skip: true }, fn)`.
 */
function detailsOf(sourceCode: SourceCode, call: TSESTree.CallExpression, optionsFirst: boolean): Details {
  const details = call.arguments.at(optionsFirst ? 0 : 1);
  if (details === undefined || isFunction(details)) return { entries: [], unread: [] };
  const target = unwrap(details);
  const value = target.type === 'ObjectExpression' ? target : constantValue(sourceCode, target);
  const object = value && unwrap(value);
  if (object?.type !== 'ObjectExpression') {
    // A name that can't be read is the details object only when a body comes after it:
    // `test.skip('places an order', placeOrder)` has a body defined elsewhere and no details.
    return call.arguments.slice(optionsFirst ? 1 : 2).some(isFunction)
      ? { entries: [], unread: [details] }
      : { entries: [], unread: [] };
  }
  const unread: Node[] = [];
  return { entries: objectDetails(sourceCode, object, unread), unread };
}

/** The static text a value gives: a string literal, a template with no expressions, or one of those held in a constant declared in this file. */
function staticText(sourceCode: SourceCode, node: Node): string | undefined {
  const read = (value: Node): string | undefined => {
    if (value.type === 'Literal') return typeof value.value === 'string' ? value.value : undefined;
    if (value.type !== 'TemplateLiteral' || value.expressions.length !== 0) return undefined;
    // `cooked` is only null in tagged templates, which no annotation value is.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
    return value.quasis[0].value.cooked!;
  };
  const target = unwrap(node);
  const own = read(target);
  if (own !== undefined) return own;
  const constant = constantValue(sourceCode, target);
  return constant === undefined ? undefined : read(unwrap(constant));
}

/**
 * The object or array a details value is, following a constant declared in this file: a carrier for
 * annotations. Undefined for a value that plainly can't hold one, `'unread'` for one that can't be read.
 */
function annotationCarrier(
  sourceCode: SourceCode,
  node: Node,
): TSESTree.ObjectExpression | TSESTree.ArrayExpression | 'unread' | undefined {
  const target = unwrap(node);
  if (target.type === 'ObjectExpression' || target.type === 'ArrayExpression') return target;
  const constant = constantValue(sourceCode, target);
  const resolved = constant === undefined ? undefined : unwrap(constant);
  if (resolved?.type === 'ObjectExpression' || resolved?.type === 'ArrayExpression') return resolved;
  // A scalar that can be read holds no annotation; a value that can't be read might.
  return target.type === 'Literal' || resolved !== undefined ? undefined : 'unread';
}

/**
 * Tickets from annotations of the configured type in a declaration's details: Playwright's `annotation`
 * option, whose value is one `{ type, description }` or an array of them, and Vitest's `meta` object,
 * with the ticket under the key named by the type. Only literal text is read; a value of the right
 * type whose ticket can't be read is returned as unread, since it may carry the ticket.
 */
function collectAnnotations(
  sourceCode: SourceCode,
  details: Details,
  source: { key: string; shape: 'annotation' | 'meta' },
  annotations: { type: string },
): Pick<TagInfo, 'annotations' | 'unreadAnnotations'> {
  const tickets: { text: string; node: Node }[] = [];
  const unread: Node[] = [];
  const readPlaywright = (object: TSESTree.ObjectExpression): void => {
    const unreadKeys: Node[] = [];
    const entries = objectDetails(sourceCode, object, unreadKeys);
    const type = entries.find(([key]) => key === 'type');
    if (type === undefined) return;
    const written = staticText(sourceCode, type[1]);
    if (written === undefined) {
      // The type might be the configured one, so the whole annotation may carry the ticket.
      unread.push(type[1], ...unreadKeys);
      return;
    }
    if (written !== annotations.type) return;
    const description = entries.find(([key]) => key === 'description');
    if (description === undefined) {
      // A key that can't be read may be the description.
      unread.push(...unreadKeys);
      return;
    }
    const text = staticText(sourceCode, description[1]);
    if (text === undefined) {
      unread.push(...unreadKeys, description[1]);
      return;
    }
    tickets.push({ text, node: description[1] });
  };
  const readValue = (value: Node): void => {
    const carrier = annotationCarrier(sourceCode, value);
    if (carrier === 'unread') {
      unread.push(value);
      return;
    }
    if (carrier === undefined) return;
    if (source.shape === 'meta') {
      if (carrier.type === 'ObjectExpression') {
        const unreadKeys: Node[] = [];
        const entries = objectDetails(sourceCode, carrier, unreadKeys);
        const entry = entries.find(([key]) => key === annotations.type);
        if (entry === undefined) unread.push(...unreadKeys);
        else {
          const text = staticText(sourceCode, entry[1]);
          if (text !== undefined) tickets.push({ text, node: entry[1] });
          else unread.push(...unreadKeys, entry[1]);
        }
      }
      return;
    }
    if (carrier.type === 'ObjectExpression') readPlaywright(carrier);
    else {
      for (const element of carrier.elements) {
        if (element === null || element.type === 'SpreadElement') continue;
        const inner = annotationCarrier(sourceCode, element);
        if (inner === 'unread') unread.push(element);
        else if (inner?.type === 'ObjectExpression') readPlaywright(inner);
      }
    }
  };
  for (const [key, value] of details.entries) {
    if (key === source.key) readValue(value);
  }
  return { annotations: tickets, unreadAnnotations: unread };
}

interface TagInfo {
  tags: TagOccurrence[];
  /** Whether the title isn't text, so its tags can't be read. */
  dynamic: boolean;
  /** Tag values, or a whole details object, that can't be read. */
  unread: Node[];
  /** Whether the details or options object can't be read, so it may hold Vitest's `{ skip: true }`. */
  opaqueDetails: boolean;
  /** Tickets read from annotations of the configured type, with the node to report at. */
  annotations: { text: string; node: Node }[];
  /** Annotation values of the configured type whose ticket can't be read. */
  unreadAnnotations: Node[];
}

const NO_TAGS: TagInfo = {
  tags: [],
  dynamic: false,
  unread: [],
  opaqueDetails: false,
  annotations: [],
  unreadAnnotations: [],
};

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
  if (details.unread.length > 0 && framework.tagKey !== undefined) unread.push(...details.unread);
  // headOf replaces these with the annotations it reads, since collectTags has no options.
  return {
    tags,
    dynamic: title.unread.size > 0,
    unread,
    opaqueDetails: details.unread.length > 0,
    annotations: [],
    unreadAnnotations: [],
  };
}

/** Whether `node` is an object written out or held in a constant declared in this file. */
function isObject(sourceCode: SourceCode, node: Node): boolean {
  const target = unwrap(node);
  const value = target.type === 'ObjectExpression' ? target : constantValue(sourceCode, target);
  return value !== undefined && unwrap(value).type === 'ObjectExpression';
}

/**
 * Whether a declaration leaves out its title: a describe with only a body, or in node:test any test or
 * describe that starts with its body or its options.
 */
function leavesOutTitle(
  sourceCode: SourceCode,
  framework: Framework,
  args: TSESTree.CallExpressionArgument[],
): boolean {
  const [first] = args;
  return isFunction(first) || (framework.optionalTitle && isObject(sourceCode, first));
}

/** Whether a title is text, written out or held in a constant declared in this file. */
function isTextTitle(sourceCode: SourceCode, node: Node): boolean {
  const title = unwrap(node);
  const value = constantValue(sourceCode, title);
  return isStaticText(title) || (value !== undefined && isStaticText(unwrap(value)));
}

/**
 * Whether a call declares a test or describe block: a title and a body, as in `test('title', fn)`,
 * `test('title', details, fn)` or `test.skip(title, payWithCard)` with the body defined elsewhere, a
 * describe with only a body, or a `todo` with only a title, in Vitest, Mocha and node:test a `skip` with
 * only a title, in Mocha a test with only a title written out, which it runs as pending, and in node:test
 * a test or describe with no title.
 * Only Playwright has a runtime `test.skip(isMobile, 'why')`; there a title, written out or held in a
 * constant, or a body written in place tells the two apart.
 */
function isDeclaration(
  sourceCode: SourceCode,
  framework: Framework,
  kind: Root['kind'],
  args: TSESTree.CallExpressionArgument[],
  members: string[],
): boolean {
  const first = args.at(0);
  if (isFunction(first)) return kind === 'describe' || framework.optionalTitle;
  if (first === undefined) return false;
  // node:test's `test({ skip: true }, fn)`, or `test({ name, fn })` with everything in the options.
  if (framework.optionalTitle && isObject(sourceCode, first)) return true;
  if (args.length === 1) {
    if (members.includes('todo') || (framework.skipWithoutBody && members.includes('skip'))) return true;
    return framework.todoWithoutBody && kind === 'test' && isTextTitle(sourceCode, first);
  }
  if (!framework.playwright) return true;
  return isTextTitle(sourceCode, first) || args.slice(1).some(isFunction);
}

/** The function whose `this` a call sees: the nearest one around it that isn't an arrow function. */
function thisFunction(node: Node): Node | undefined {
  let current = node.parent;
  while (current && (current.type === 'ArrowFunctionExpression' || !FUNCTIONS.has(current.type))) {
    current = current.parent;
  }
  return current;
}

/** The value of a `true` or `false` literal; undefined for anything else. */
function booleanOf(node: Node | undefined): boolean | undefined {
  return node?.type === 'Literal' && typeof node.value === 'boolean' ? node.value : undefined;
}

/**
 * Whether a node:test option applies: Node counts any value but `false` and `undefined`, so a reason such
 * as `{ skip: 'flaky' }`, `''`, `0`, `null`, and an `expectFailure` pattern or matcher always do. Undefined
 * for a value only known when the test runs, such as `{ skip: isWindows }`.
 */
function optionApplies(node: Node): boolean | undefined {
  const value = unwrap(node);
  if (value.type === 'Identifier' && value.name === 'undefined') return false;
  if (value.type === 'Literal') return value.value !== false;
  return OPTION_VALUES.has(value.type) ? true : undefined;
}

/** Values that are never `false` or `undefined`. */
const OPTION_VALUES = new Set([
  'TemplateLiteral',
  'ObjectExpression',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'NewExpression',
]);

/**
 * Whether a runtime call always applies: it has no condition, or `true`, or with `notes` only a note, as
 * Vitest's `context.skip('Broker sandbox is down')`, and nothing around it makes it conditional.
 */
function isUnconditional(call: TSESTree.CallExpression, notes: boolean): boolean {
  const first = call.arguments.at(0);
  const always = first === undefined || booleanOf(first) === true || (notes && isStaticText(first));
  return always && !isGuarded(call);
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
 * the right side of `&&`, `||` or `??`, in a `catch` block, after other code in a `try` block that has a
 * `catch`, or after an early exit such as `if (ready) return;`. `if (!enabled) test.skip()` is the same as `test.skip(!enabled)`, and
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
      // `try { await stat(target); test.skip(); } catch {}`: an error before the skip jumps to the catch.
      const owner: Node = node.parent;
      if (index > 0 && owner.type === 'TryStatement' && owner.block === node && owner.handler) return true;
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
    // `require('node:test').test.skip(...)`: the require call stands for the module, with its exports.
    if (root.type !== 'Identifier') {
      const source = requireSource(root);
      if (source === undefined || !framework.ownsModule(source) || path.length === 0) return undefined;
      const exported = framework.exports.get(path[0]);
      return exported === undefined ? undefined : { root: exported, path: path.slice(1), args };
    }
    let base = testNames.roots.get(root.name);
    let rest = path;
    // `pw.test.skip`, or node:test's `test.describe`, whose module is also its `test` even when
    // `test` was imported by name.
    const moduleLike =
      testNames.modules.has(root.name) || (framework.defaultExport !== undefined && base === framework.defaultExport);
    const member = moduleLike ? framework.exports.get(path[0]) : undefined;
    if (member !== undefined || base === undefined) {
      base = member;
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
  /** Bodies of Mocha tests and hooks written as a `function`, where `this.skip()` skips at runtime. */
  const thisBodies = new Set<Node>();

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
      annotationTickets: tagInfo.annotations,
      unreadTickets: tagInfo.unreadAnnotations,
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
      const always = framework.anyOptionValue ? optionApplies(value) : booleanOf(value);
      if (modifier && always !== false) add(modifier, always === true);
    }
    const first = framework.exclusiveStates.findIndex((state) => modifiers.get(state) === true);
    if (first !== -1) for (const state of framework.exclusiveStates.slice(first + 1)) modifiers.delete(state);
    return modifiers;
  };

  /**
   * The modifiers of a declaration, with `todo` for a Mocha test that has only a title, which Mocha runs as
   * pending: someone has yet to write it. A skipped one, as `it.skip('title')`, stays a skip.
   */
  const declarationModifiers = (
    kind: Root['kind'],
    args: TSESTree.CallExpressionArgument[],
    modifiers: Map<string, boolean>,
  ): Map<string, boolean> => {
    if (framework.todoWithoutBody && kind === 'test' && args.length === 1 && !modifiers.has('skip')) {
      modifiers.set('todo', true);
    }
    return modifiers;
  };

  /** Keeps the body of a test or hook written as a `function`, whose `this` can skip it, as in Mocha. */
  const addThisBody = (args: TSESTree.CallExpressionArgument[]): void => {
    const body = args.findLast(isFunction);
    if (body?.type === 'FunctionExpression') thisBodies.add(body);
  };

  /**
   * What a body can change the test's state with: Playwright's `testInfo`, Vitest's test context, or
   * Jasmine's `pending()`.
   */
  const bodyInfos = (args: TSESTree.CallExpressionArgument[], path: string[]): InfoName[] => {
    const body = args.findLast(isFunction);
    if (!body) return [];
    const functions = [
      ...[...framework.runtimeFunctions].map(([name, modifier]): InfoName => ({
        name,
        method: modifier,
        runtimeFunction: { name, imported: false },
      })),
      ...[...testNames.runtime].map(([local, fn]): InfoName => ({
        name: local,
        method: fn.modifier,
        runtimeFunction: { name: fn.name, imported: true },
      })),
    ];
    // `test.each(table)` passes the row to the body, and `test.for(cases)` passes it before the context.
    if (!framework.info || path.includes('each()')) return functions;
    const param = body.params.at(framework.info.param + (path.includes('for()') ? 1 : 0));
    return [...functions, ...infoNames(param, framework.info.methods)];
  };

  /**
   * What a callee declares and with which members: `describe` and `['skip']` for `test.describe.skip`.
   * Undefined for a hook.
   */
  const declarationOf = ({ root, path, args }: NonNullable<ReturnType<typeof target>>) => {
    if (root.kind === 'hook') return undefined;
    const playwrightDescribe = framework.playwright && path[0] === 'describe';
    const kind = playwrightDescribe ? 'describe' : root.kind;
    const written = playwrightDescribe ? path.slice(1) : path;
    return { kind, members: [...root.modifiers, ...written], written, args };
  };
  type Declaration = NonNullable<ReturnType<typeof declarationOf>>;

  /**
   * Whether a call with these members and arguments declares a test or describe of this kind. Only the
   * members written after the name must exist: Jasmine's `xit` skips, but it has no `it.skip`.
   */
  const declares = ({ kind, members, written }: Declaration, args: TSESTree.CallExpressionArgument[]): boolean => {
    const allowed = kind === 'test' ? framework.testMembers : framework.describeMembers;
    return written.every((m) => allowed.has(m)) && isDeclaration(sourceCode, framework, kind, args, members);
  };

  /**
   * `(isCI ? describe.skip : describe)('order entry', ...)`: a test or describe whose function is picked by
   * a condition. A state that only one side has depends on the condition, like `test.skip(isCI)`.
   */
  const pickedDeclaration = (call: TSESTree.CallExpression): { subject: Subject; infos: InfoName[] } | undefined => {
    const callee = unwrap(call.callee);
    if (callee.type !== 'ConditionalExpression') return undefined;
    const [yes, no] = [callee.consequent, callee.alternate].map((side) => {
      const picked = target(chainOf(unwrap(side), framework.factories));
      return picked && declarationOf(picked);
    });
    const args = call.arguments;
    if (yes === undefined || no === undefined) return undefined;
    if (yes.kind !== no.kind || !declares(yes, args) || !declares(no, args)) return undefined;
    usesTest = true;
    const { details, tagInfo } = headOf(call);
    const [ifYes, ifNo] = [yes, no].map(({ members, args: conditions }) =>
      declarationModifiers(yes.kind, args, modifiersOf(members, details.entries, conditions)),
    );
    if (yes.kind === 'test') addThisBody(args);
    const modifiers = new Map<string, boolean>();
    for (const modifier of new Set([...ifYes.keys(), ...ifNo.keys()])) {
      modifiers.set(modifier, ifYes.get(modifier) === true && ifNo.get(modifier) === true);
    }
    const infos = yes.kind === 'test' ? bodyInfos(args, yes.members) : [];
    return { subject: makeSubject(yes.kind, call, modifiers, tagInfo), infos };
  };

  /** The details, tags and annotations of a declaration; node:test lets it leave out its title. */
  const headOf = (call: TSESTree.CallExpression): { details: Details; tagInfo: TagInfo } => {
    const args = call.arguments;
    const untitled = leavesOutTitle(sourceCode, framework, args);
    const details = detailsOf(sourceCode, call, untitled && !isFunction(args[0]));
    const annotations =
      options.annotations === undefined || framework.annotations === undefined
        ? { annotations: [], unreadAnnotations: [] }
        : collectAnnotations(sourceCode, details, framework.annotations, options.annotations);
    return {
      details,
      tagInfo: { ...collectTags(sourceCode, call, !untitled, framework, details), ...annotations },
    };
  };

  const declare = (
    call: TSESTree.CallExpression,
    { kind, members, args: conditions }: Declaration,
    infos: InfoName[],
  ): { subject: Subject; infos: InfoName[] } => {
    const args = call.arguments;
    const { details, tagInfo } = headOf(call);
    const modifiers = declarationModifiers(kind, args, modifiersOf(members, details.entries, conditions));
    if (kind === 'test') addThisBody(args);
    return { subject: makeSubject(kind, call, modifiers, tagInfo), infos };
  };

  /** node:test's `t.test('title', fn)`: a subtest declared through the context of the test around it. */
  const subtestOf = (call: TSESTree.CallExpression): { subject: Subject; infos: InfoName[] } | undefined => {
    const { callee } = call;
    if (!framework.subtests || callee.type !== 'MemberExpression' || memberName(callee) !== 'test') return undefined;
    const { object } = callee;
    if (object.type !== 'Identifier' || !infos.findLast((info) => info.name === object.name)?.methods) return undefined;
    const declaration: Declaration = { kind: 'test', members: [], written: [], args: new Map() };
    return declares(declaration, call.arguments)
      ? declare(call, declaration, bodyInfos(call.arguments, []))
      : undefined;
  };

  const visitCall = (original: TSESTree.CallExpression): { subject?: Subject; infos?: InfoName[] } => {
    const call = throughFunctionMethods(original);
    const callee = target(chainOf(call.callee, framework.factories));
    if (callee === undefined) return subtestOf(call) ?? pickedDeclaration(call) ?? { subject: runtimeCall(call) };
    usesTest = true;
    const args = call.arguments;
    const { path } = callee;
    const declaration = declarationOf(callee);
    // Vitest's `beforeEach((context) => context.skip())` and Mocha's `before(function () { this.skip(); })`
    // skip the tests they run for.
    if (declaration === undefined) {
      if (callee.root.noContext) return { infos: [] };
      addThisBody(args);
      return { infos: bodyInfos(args, path) };
    }

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
    const { kind, members } = declaration;
    // A describe's body gets no test context: node:test passes one that can't skip.
    const bodyInfo = kind === 'describe' ? [] : bodyInfos(args, path);
    if (declares(declaration, args)) return declare(call, declaration, bodyInfo);
    // test.skip(), test.fixme(), test.fail() and test.slow() in a test, a describe or a hook.
    if (framework.playwright && members.length === 1 && RUNTIME_MODIFIERS.has(members[0])) {
      return { subject: runtimeSubject(call, members[0]), infos: bodyInfo };
    }
    return { infos: bodyInfo };
  };

  /**
   * `testInfo.skip()`, `step.skip()`, `test.info().skip()`, Vitest's `context.skip()` or `skip()`,
   * Mocha's `this.skip()`, node:test's `t.skip()` and `t.todo()`, and Jasmine's `pending()`.
   */
  const runtimeCall = (call: TSESTree.CallExpression): Subject | undefined => {
    const { callee } = call;
    // The innermost parameter with a name is the one the call uses.
    const innermost = (name: string): InfoName | undefined => infos.findLast((info) => info.name === name);
    /**
     * What a name stands for: a context in scope, or a local constant that keeps one of its methods, as
     * `const skip = testInfo.skip`, `const { skip } = t` or `const p = pending`.
     */
    const resolveInfo = (id: TSESTree.Identifier): InfoName | undefined => {
      const direct = innermost(id.name);
      if (direct !== undefined) return direct;
      const definition = declaredVariable(sourceCode, id)?.defs.find((def) => def.type === 'Variable');
      const declarator = definition?.node;
      if (declarator?.type !== 'VariableDeclarator' || declarator.init === null) return undefined;
      const init = unwrap(declarator.init);
      if (declarator.id.type === 'Identifier') {
        if (init.type === 'MemberExpression') {
          const name = memberName(init);
          if (name === undefined) return undefined;
          if (init.object.type === 'ThisExpression') {
            const owner = thisFunction(declarator);
            return owner !== undefined && thisBodies.has(owner) && framework.thisMethods.has(name)
              ? { name: id.name, method: name }
              : undefined;
          }
          const object = init.object.type === 'Identifier' ? innermost(init.object.name) : undefined;
          return object?.methods?.has(name) ? { name: id.name, method: name, step: object.step } : undefined;
        }
        if (init.type !== 'Identifier') return undefined;
        const source = innermost(init.name);
        if (source === undefined) return undefined;
        const fn = source.runtimeFunction;
        if (fn && declaredWhere(sourceCode, init) !== (fn.imported ? 'top' : 'global')) return undefined;
        if (source.method !== undefined) return { name: id.name, method: source.method, step: source.step };
        return { name: id.name, methods: source.methods, step: source.step };
      }
      if (declarator.id.type !== 'ObjectPattern' || init.type !== 'Identifier') return undefined;
      const source = innermost(init.name);
      if (source?.methods === undefined) return undefined;
      const property = declarator.id.properties.find(
        (prop) => prop.type === 'Property' && prop.value.type === 'Identifier' && prop.value.name === id.name,
      );
      if (property?.type !== 'Property') return undefined;
      const name = propertyName(property);
      return name !== undefined && source.methods.has(name)
        ? { name: id.name, method: name, step: source.step }
        : undefined;
    };
    if (callee.type === 'Identifier') {
      const info = resolveInfo(callee);
      if (info?.method === undefined) return undefined;
      // A global such as Jasmine's `pending` counts unless the file declares the name itself; an import of
      // one counts unless a function or block declares the name again.
      const fn = info.runtimeFunction;
      if (fn && declaredWhere(sourceCode, callee) !== (fn.imported ? 'top' : 'global')) return undefined;
      const subject = runtimeSubject(call, info.method, info.step);
      if (subject) subject.functionName = fn?.name;
      return subject;
    }
    if (callee.type !== 'MemberExpression') return undefined;
    const name = memberName(callee);
    if (name === undefined) return undefined;
    const { object } = callee;
    // Mocha's `this.skip()` or node:test's `this.todo()`, in a test or hook whose `function` gives it the
    // test's `this`.
    if (object.type === 'ThisExpression') {
      const owner = framework.thisMethods.has(name) ? thisFunction(call) : undefined;
      return owner !== undefined && thisBodies.has(owner) ? runtimeSubject(call, name) : undefined;
    }
    if (object.type === 'Identifier') {
      const info = resolveInfo(object);
      return info?.methods?.has(name) ? runtimeSubject(call, name, info.step) : undefined;
    }
    const isTestInfo =
      RUNTIME_MODIFIERS.has(name) &&
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
      new Map([[modifier, isUnconditional(call, framework.skipNotes)]]),
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

/** Annotation tickets that can cover `subject`: its own and those of enclosing describes and tests. */
export function annotationTicketsOf(subject: Subject): { text: string; node: Node }[] {
  const found = [...subject.annotationTickets];
  let current = subject.parent;
  while (current) {
    found.push(...current.annotationTickets);
    current = current.parent;
  }
  return found;
}

/** Annotation values whose ticket can't be read, `subject`'s own and those of enclosing describes and tests. */
export function unreadAnnotationsOf(subject: Subject): Node[] {
  const found = [...subject.unreadTickets];
  let current = subject.parent;
  while (current) {
    found.push(...current.unreadTickets);
    current = current.parent;
  }
  return found;
}

/** Whether a valid annotation ticket covers `state` for `subject`. */
export function hasAnnotationTicket(subject: Subject, state: StateDef, options: ResolvedOptions): boolean {
  if (options.annotations === undefined) return false;
  return annotationTicketsOf(subject).some((ticket) => state.ticket.check(ticket.text) === 'ok');
}

/**
 * Required states on `subject` that have no ticket at all: no marker, not even a broken one, and no
 * valid annotation.
 */
export function missingStates(subject: Subject, options: ResolvedOptions): StateDef[] {
  return subject.states
    .filter(
      (s) =>
        s.required && evaluate(subject, s.state).kind === 'missing' && !hasAnnotationTicket(subject, s.state, options),
    )
    .map((s) => s.state);
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
  // A describe, or in node:test any declaration, can start with its body or options and have no title. A
  // todo test has only a title.
  const [first] = node.arguments;
  const title = isFunction(first) || first.type === 'ObjectExpression' ? undefined : first;
  return { start: node.callee.loc.start, end: (title ?? node.callee).loc.end };
}

export function describeSubject(subject: Subject): string {
  if (subject.kind === 'describe') return 'This describe block';
  if (subject.kind === 'step') return 'This step';
  if (subject.kind === 'runtime') return `This ${subject.functionName ?? subject.states[0].state.modifier} call`;
  return 'This test';
}
