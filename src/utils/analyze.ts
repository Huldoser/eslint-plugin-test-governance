import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { isOtherRunner, RUNTIME_MODIFIERS, type Framework, type Modifier, type Root } from './frameworks.ts';
import type { ResolvedOptions, StateDef } from './options.ts';
import type { TicketCheck, TicketMatcher } from './tickets.ts';

type Node = TSESTree.Node;
type Comment = TSESTree.Comment;
type SourceCode = Readonly<TSESLint.SourceCode>;

const TEST: Root = { kind: 'test', modifiers: [] };
const DESCRIBE: Root = { kind: 'describe', modifiers: [] };
/** What a step's `TestStepInfo` can do at runtime: `step.skip()`. */
const STEP_INFO_METHODS = new Set(['skip']);
const MARKER_LINE_RE = /^\s*\*?\s*([A-Za-z][\w-]*)\s*:(.*)$/;
const DIRECTIVE_RE = /^\s*(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable)(?=\s|$)/;
// ESLint splits a directive's description off at the first run of two or more dashes between spaces.
const DESCRIPTION_SEPARATOR_RE = /\s-{2,}\s/;
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
  /** The index of the marker's line in `commentLines(comment)`. */
  line: number;
  /** Where the keyword starts in the source. */
  keywordStart: number;
}

/** A marker whose keyword is exactly a state's marker. */
export type StateMarker = Marker & { state: StateDef };

export function isStateMarker(marker: Marker): marker is StateMarker {
  return marker.state !== undefined;
}

export interface Directive {
  kind: 'eslint-disable-next-line' | 'eslint-disable-line' | 'eslint-disable' | 'eslint-enable';
  /** The rules it names; none means every rule. */
  rules: string[];
  /** Where ` -- ` starts in the comment's value and where the description after it starts. */
  description?: { separator: number; start: number };
}

/** The ESLint directive a comment holds, read the way ESLint reads it, or undefined for any other comment. */
export function directiveOf(comment: Comment): Directive | undefined {
  const kind = DIRECTIVE_RE.exec(comment.value)?.[1] as Directive['kind'] | undefined;
  // ESLint reads `eslint-disable` and `eslint-enable` only from block comments.
  if (kind === undefined || (comment.type === 'Line' && !kind.endsWith('-line'))) return undefined;
  const separator = DESCRIPTION_SEPARATOR_RE.exec(comment.value);
  const rules = comment.value
    .slice(0, separator?.index)
    .trim()
    .slice(kind.length)
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean);
  if (!separator) return { kind, rules };
  return { kind, rules, description: { separator: separator.index, start: separator.index + separator[0].length } };
}

// A call at the start of a comment line, as `test('...'`, `test.describe.skip(` or `await test.step(`. Code has
// no space before a call's `(`, and a sentence such as `// it (see above) ...` has one. An empty call, as
// `test.skip()`, changes a test at runtime and declares none.
const COMMENTED_CALL_RE = /^(\s*\*?\s*)(?:await\s+)?([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)\((?!\))/;

/**
 * Blocks of comments that hold a test or describe written out as code: comments on consecutive lines with
 * no code before them, one of whose lines starts with a call of `names` whose members all declare tests,
 * as `test.describe.skip(`, unlike `test.use(`. A JSDoc comment is documentation, so a test in its example
 * doesn't count.
 */
function findCommentedOutTests(
  sourceCode: SourceCode,
  comments: Comment[],
  names: ReadonlySet<string>,
  members: ReadonlySet<string>,
  states: StateDef[],
): { found: CommentedOutTest[]; comments: Set<Comment> } {
  const blocks: Comment[][] = [];
  for (const comment of comments) {
    if (sourceCode.getTokenBefore(comment)?.loc.end.line === comment.loc.start.line) continue;
    const block = blocks.at(-1);
    const last = block?.at(-1);
    if (block && last && comment.loc.start.line === last.loc.end.line + 1) block.push(comment);
    else blocks.push([comment]);
  }
  const found: CommentedOutTest[] = [];
  const claimed = new Set<Comment>();
  for (const block of blocks) {
    const range = block
      .filter((comment) => comment.type === 'Line' || !comment.value.startsWith('*'))
      .flatMap(commentLines)
      .flatMap(({ text, start }): TSESTree.Range[] => {
        const match = COMMENTED_CALL_RE.exec(text);
        const declares =
          match !== null &&
          names.has(match[2]) &&
          match[3]
            .split('.')
            .slice(1)
            .every((member) => members.has(member));
        return declares ? [[start + match[1].length, start + text.trimEnd().length]] : [];
      })
      .at(0);
    if (range === undefined) continue;
    for (const comment of block) claimed.add(comment);
    found.push({ range, markers: block.flatMap((comment) => parseMarkers(comment, states)) });
  }
  return { found, comments: claimed };
}

interface Region {
  start: number;
  end: number;
  comment: Comment;
  markers: Marker[];
}

/**
 * The `eslint-disable` block comments with a description, each with the part of the file it covers: up
 * to the `eslint-enable` of one of its rules or of every rule, or the end of the file.
 */
function disableRegions(comments: Comment[], states: StateDef[]): Region[] {
  const directives = comments.flatMap((comment) => {
    const directive = directiveOf(comment);
    return directive ? [{ comment, ...directive }] : [];
  });
  return directives.flatMap((open, i): Region[] => {
    if (open.kind !== 'eslint-disable' || open.description === undefined) return [];
    const close = directives
      .slice(i + 1)
      .find((d) => d.kind === 'eslint-enable' && (d.rules.length === 0 || d.rules.some((r) => open.rules.includes(r))));
    const markers = parseMarkers(open.comment, states);
    return [{ start: open.comment.range[1], end: close?.comment.range[0] ?? Infinity, comment: open.comment, markers }];
  });
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
  /**
   * Set for a conditional state: whether something says why, a comment above it or its test, the reason its
   * call takes, or one its option gives.
   */
  reasoned?: boolean;
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
  /** Whether the comment block above this node holds any text, an `eslint-disable` description included. */
  commented: boolean;
  /** Every tag written on this node, known or not. */
  tags: TagOccurrence[];
  /** Tag values, or a whole details object, on this node that can't be read, as `{ tag: TAGS.NEW }` with `TAGS` imported. */
  unreadTags: Node[];
  /**
   * States this node may be in without the code showing it: tag states when tags can't be read, and
   * Vitest's option states when its options object can't. Includes those of enclosing describes.
   */
  unknownStates: Set<string>;
  /**
   * States of other subjects whose comment block is this one's, as a test that is the arrow body of a
   * describe, `describe('d', () => test.skip(...))`, so a marker for them isn't left over here.
   */
  sharedStates: Set<string>;
  markers: Marker[];
  /** Markers of the `eslint-disable` regions this node is in, other than those in its own block. */
  regionMarkers: Marker[];
  /** Tickets read from annotations of the configured type on this call, with the node to report at. */
  annotationTickets: { text: string; node: Node }[];
  /** Annotation values of the configured type on this call whose ticket can't be read. */
  unreadTickets: Node[];
  dynamicTitle: boolean;
  /** For a runtime function such as Jasmine's `pending()`, its name; messages call the others by their state. */
  functionName?: string;
}

/** A block of comments holding a test or describe written out as code, as `// test('places an order', ...)`. */
export interface CommentedOutTest {
  /** The first line that is a commented-out test or describe, without the comment's leading space or `*`. */
  range: TSESTree.Range;
  /** The markers anywhere in the block. */
  markers: Marker[];
}

export interface Analysis {
  subjects: Subject[];
  /** Statically readable native retry counts, collected even when retry ticketing is off. */
  retryCounts: { node: Node; count: number }[];
  /** Markers that are not in the comment block of any test, describe or runtime call. */
  detachedMarkers: StateMarker[];
  /** Markers of `eslint-disable` regions that cover tests, none of them in the marker's state. */
  idleRegionMarkers: StateMarker[];
  /** Commented-out tests; their comments are left out of the comment blocks of the tests around them. */
  commentedOutTests: CommentedOutTest[];
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
  /** The parameter binding, so a nested variable with the same name isn't a test context. */
  binding?: TSESTree.Identifier;
  /** Arguments supplied before the call by a bound runtime method. */
  boundArgs?: TSESTree.CallExpressionArgument[];
  /** The step a `TestStepInfo` belongs to. Unset for the others, which act on the whole test. */
  step?: Subject;
  /** The test whose context this binding represents, including inside nested subtests. */
  owner?: Subject;
  /** For a runtime function, its own name, as `pending` also when imported as `pend`, and how it is reached. */
  runtimeFunction?: { name: string; imported: boolean };
} & ({ methods: ReadonlySet<string>; method?: undefined } | { method: string; methods?: undefined });

/** The names a parameter gives to runtime info: `testInfo`, or `skip` in `({ skip }) => ...`. */
function infoNames(param: TSESTree.Parameter | undefined, methods: ReadonlySet<string>, step?: Subject): InfoName[] {
  const target = param?.type === 'AssignmentPattern' ? param.left : param;
  if (target?.type === 'Identifier') return [{ name: target.name, binding: target, methods, step }];
  if (target?.type !== 'ObjectPattern') return [];
  return target.properties.flatMap((prop): InfoName[] => {
    if (prop.type !== 'Property') return [];
    const value = prop.value.type === 'AssignmentPattern' ? prop.value.left : prop.value;
    if (value.type !== 'Identifier') return [];
    const method = propertyName(prop);
    return method !== undefined && methods.has(method) ? [{ name: value.name, binding: value, method, step }] : [];
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
  let current = unwrap(node);
  for (;;) {
    if (current.type === 'MemberExpression') {
      const name = memberName(current);
      if (name === undefined) return undefined;
      path.unshift(name);
      current = unwrap(current.object);
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
    if (current.type === 'CallExpression' && !args.has(`${name}()`)) args.set(`${name}()`, current.arguments.at(0));
    current = unwrap(factory.object);
  }
  return current.type === 'Identifier' || current.type === 'CallExpression' ? { root: current, path, args } : undefined;
}

function unwrap(node: Node): Node {
  let current = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSInstantiationExpression' ||
    current.type === 'SequenceExpression'
  ) {
    current =
      current.type === 'SequenceExpression' ? current.expressions[current.expressions.length - 1] : current.expression;
  }
  return current;
}

export function isFunction(
  node: Node | undefined,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

interface RuntimeFunction {
  name: string;
  modifier: Modifier;
}

interface TestNames {
  usesModule: boolean;
  /** Names that refer to the framework's test functions, with what each one is. */
  roots: Map<string, Root>;
  /** Names bound to a whole framework module, as in `import * as pw`, whose `test` is `pw.test`. */
  modules: Set<string>;
  /** Names imported for the framework's runtime functions, as `pend` in `import { pending as pend }`. */
  runtime: Map<string, RuntimeFunction>;
}

/** Collects the top-level names that refer to the framework's test functions or to its module. */
function collectTestNames(sourceCode: SourceCode, framework: Framework, configured: Set<string>): TestNames {
  const program = sourceCode.ast;
  /** The framework's `test` function, which is also its module when `moduleIsDefault`. */
  const testRoot = framework.defaultExport ?? TEST;
  const roots = new Map(framework.globals);
  for (const name of configured) roots.set(name, testRoot);
  const runtime = new Map<string, RuntimeFunction>();
  const modules = new Set<string>();
  let usesModule = false;
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
        usesModule = true;
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
            usesModule = true;
            modules.add(name);
            if (framework.moduleIsDefault && framework.defaultExport) roots.set(name, framework.defaultExport);
          } else if (init.type === 'Identifier' && modules.has(init.name) && !isReassigned(sourceCode, init)) {
            modules.add(name);
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
        const ownModule =
          (source !== undefined && framework.ownsModule(source)) ||
          (init.type === 'Identifier' && modules.has(init.name) && !isReassigned(sourceCode, init));
        if (source === undefined && !ownModule) continue;
        if (ownModule) usesModule = true;
        for (const prop of declarator.id.properties) {
          if (prop.type !== 'Property' || prop.value.type !== 'Identifier') continue;
          if (source !== undefined && isOtherRunner(framework, source)) setOther(prop.value.name);
          else if (ownModule) {
            const root = framework.exports.get(propertyName(prop) ?? '');
            bindRuntime(prop.value.name, propertyName(prop));
            if (root) roots.set(prop.value.name, root);
          }
        }
      }
    }
  }
  return { roots, modules, runtime, usesModule };
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

const reassignedBindings = new WeakMap<TSESLint.Scope.Variable, boolean>();

/** Whether the binding has writes beyond its initial declaration. */
function isReassigned(sourceCode: SourceCode, id: TSESTree.Identifier): boolean {
  const variable = declaredVariable(sourceCode, id);
  if (variable === undefined) return false;
  const cached = reassignedBindings.get(variable);
  if (cached !== undefined) return cached;
  const written = variable.references.some((reference) => reference.isWrite() && !reference.init);
  reassignedBindings.set(variable, written);
  return written;
}

const mutatedBindings = new WeakMap<TSESLint.Scope.Variable, boolean>();
const ARRAY_MUTATORS = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift']);
const OBJECT_MUTATORS = new Set(['assign', 'defineProperty', 'defineProperties']);
const REFLECT_MUTATORS = new Set(['set', 'deleteProperty', 'defineProperty']);

/** Whether a binding's object is written through a property, an array mutator or a local alias. */
function isMutated(
  sourceCode: SourceCode,
  id: TSESTree.Identifier,
  seen: readonly TSESLint.Scope.Variable[] = [],
): boolean {
  const variable = declaredVariable(sourceCode, id);
  if (variable === undefined || seen.includes(variable)) return false;
  const cached = mutatedBindings.get(variable);
  if (cached !== undefined) return cached;
  const written = variable.references.some((reference) => {
    let value: Node = reference.identifier;
    let parent = value.parent;
    while (
      parent.type !== 'Program' &&
      ((parent.type === 'MemberExpression' && parent.object === value) || unwrap(parent) === value)
    ) {
      value = parent;
      parent = value.parent;
    }
    if (parent.type === 'VariableDeclarator' && parent.init === value && parent.id.type === 'Identifier') {
      return isMutated(sourceCode, parent.id, [...seen, variable]);
    }
    if (parent.type === 'CallExpression' && parent.arguments[0] === value) {
      const callee = unwrap(parent.callee);
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        declaredWhere(sourceCode, callee.object) === 'global'
      ) {
        const methods =
          callee.object.name === 'Object'
            ? OBJECT_MUTATORS
            : callee.object.name === 'Reflect'
              ? REFLECT_MUTATORS
              : undefined;
        if (methods?.has(memberName(callee) ?? '')) return true;
      }
    }
    const member = unwrap(value);
    if (member.type !== 'MemberExpression') return false;
    return (
      (parent.type === 'AssignmentExpression' && parent.left === value) ||
      parent.type === 'UpdateExpression' ||
      (parent.type === 'UnaryExpression' && parent.operator === 'delete') ||
      (parent.type === 'CallExpression' && parent.callee === value && ARRAY_MUTATORS.has(memberName(member) ?? ''))
    );
  });
  mutatedBindings.set(variable, written);
  return written;
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

/** Values a constant can hold a test function in: `it.skip`, `it.skipIf(...)`, `` it.each`...` `` or `a ? b : c`. */
const ALIAS_VALUES = new Set([
  'MemberExpression',
  'CallExpression',
  'TaggedTemplateExpression',
  'ConditionalExpression',
]);

const STATEMENT_CONTAINERS = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase', 'TSModuleBlock']);

/** The statement a call, or a value, belongs to; its marker block sits above that statement. */
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

function anchorOf(call: Node): Node {
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

/**
 * The lines of a comment and where each starts in the source, split at every line break JavaScript has.
 * In an ESLint directive, only the description after ` -- ` is comment text.
 */
export function commentLines(comment: Comment): { text: string; start: number }[] {
  const directive = directiveOf(comment);
  if (directive && directive.description === undefined) return [];
  const from = directive?.description?.start ?? 0;
  const value = comment.value.slice(from);
  const lines: { text: string; start: number }[] = [];
  // `//` and `/*` are both two characters, so the comment's value starts two characters in.
  const valueStart = comment.range[0] + 2 + from;
  let lineStart = 0;
  for (const lineBreak of value.matchAll(LINE_BREAK_RE)) {
    lines.push({ text: value.slice(lineStart, lineBreak.index), start: valueStart + lineStart });
    lineStart = lineBreak.index + lineBreak[0].length;
  }
  lines.push({ text: value.slice(lineStart), start: valueStart + lineStart });
  return lines;
}

function parseMarkers(comment: Comment, states: StateDef[]): Marker[] {
  const markers: Marker[] = [];
  for (const [line, { text, start }] of commentLines(comment).entries()) {
    const match = MARKER_LINE_RE.exec(text);
    if (!match) continue;
    const [, keyword, rest] = match;
    const restOffset = start + match[0].length - rest.length;
    const at = { comment, keyword, line, keywordStart: start + text.indexOf(keyword) };
    const state = states.find((s) => s.marker === keyword);
    if (state) {
      markers.push({ ...at, state, ...parseTickets(rest, restOffset, state.ticket) });
      continue;
    }
    const caseOf = states.find((s) => s.marker === keyword.toUpperCase());
    if (caseOf) markers.push({ ...at, caseOf, ...parseTickets(rest, restOffset, caseOf.ticket) });
  }
  return markers;
}

type Text = TSESTree.StringLiteral | TSESTree.TemplateLiteral;

/** A piece of text a title or tag is made of. */
interface FoundText {
  text: Text;
  /** The name the text was reached through, such as `Tags.NEW`. Unset when the call itself holds the text. */
  via?: Node;
  /** The rest of a template around this text, so tag boundaries use its rendered title. */
  before?: string;
  after?: string;
  /** Text inside an interpolation is part of its outer tag value, not a separate plain tag. */
  embedded?: true;
}

/** Rendered template text and the offsets of its alternating literal and expression parts. */
function templateText(
  sourceCode: SourceCode,
  node: TSESTree.TemplateLiteral,
): { parts: string[]; text: string; offsets: number[] } {
  const parts = node.quasis.flatMap((quasi, i) => [
    // `cooked` is null only in tagged templates, which are not read as title or tag text.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
    quasi.value.cooked!,
    ...(i < node.expressions.length ? [interpolationText(sourceCode, node.expressions[i]) ?? ' '] : []),
  ]);
  let offset = 0;
  const offsets = parts.map((part) => {
    const start = offset;
    offset += part.length;
    return start;
  });
  return { parts, text: parts.join(''), offsets };
}

function scanTags(sourceCode: SourceCode, found: FoundText, out: TagOccurrence[]): void {
  const { text: node, via, before = '', after = '' } = found;
  const source = sourceCode.text;
  // Each piece of text with where it starts in the source, after its opening quote, backtick or `}`.
  let parts: { text: string; start: number; before: string; after: string }[];
  if (node.type === 'Literal') parts = [{ text: node.value, start: node.range[0] + 1, before, after }];
  else {
    const rendered = templateText(sourceCode, node);
    parts = node.quasis.map((quasi, i) => ({
      // `cooked` is only null in tagged templates, which are never titles.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
      text: quasi.value.cooked!,
      start: quasi.range[0] + 1,
      before: rendered.offsets[i * 2] === 0 ? before : rendered.text.charAt(rendered.offsets[i * 2] - 1),
      after: rendered.text.slice(rendered.offsets[i * 2] + rendered.parts[i * 2].length) + after,
    }));
  }
  for (const { text, start, before, after } of parts) {
    const prefix = before.slice(-1);
    const tagStart = text.lastIndexOf('@');
    const continuation =
      tagStart >= 0 && /^[\w-]*$/.test(text.slice(tagStart + 1)) ? (/^[\w-]+/.exec(after)?.[0] ?? '') : '';
    for (const match of (prefix + text + continuation).matchAll(TAG_RE)) {
      const index = match.index - prefix.length;
      if (index < 0 || index >= text.length) continue;
      const end = index + match[0].length;
      const written =
        via === undefined && end <= text.length && source.slice(start, start + end) === text.slice(0, end);
      out.push({ tag: match[0], node: via ?? node, ...(written && { range: [start + index, start + end] }) });
    }
  }
}

const PLAIN_TAG_RE = /^[\w-]+$/;

/** A Vitest tag name such as `'flaky'` in `tags`, which stands for the `@flaky` tag. */
function plainTag(sourceCode: SourceCode, { text, via, embedded }: FoundText): TagOccurrence | undefined {
  if (embedded) return undefined;
  const value = staticText(sourceCode, text);
  if (value === undefined || !PLAIN_TAG_RE.test(value)) return undefined;
  const start = text.range[0] + 1;
  const end = start + value.length;
  const written = via === undefined && sourceCode.text.slice(start, end) === value;
  return { tag: `@${value}`, node: via ?? text, plain: true, ...(written && { range: [start, end] }) };
}

function isStaticText(node: Node): node is Text {
  return (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral';
}

/**
 * The value a `const` or enum declared in this file gives a name: the `'@new'` of `const NEW = '@new'`,
 * or the enum itself. Undefined for any other name, such as an import, a parameter or a `let`.
 */
function declaredValue(sourceCode: SourceCode, id: TSESTree.Identifier): Node | undefined {
  if (isMutated(sourceCode, id)) return undefined;
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

function isPrototypeSetter(prop: TSESTree.Property): boolean {
  return (
    !prop.computed && !prop.shorthand && !prop.method && prop.kind === 'init' && propertyName(prop) === '__proto__'
  );
}

/** The value of the last property called `key`, or undefined when a spread written after it may replace it. */
function propertyValue(object: TSESTree.ObjectExpression, key: string): Node | undefined {
  for (let i = object.properties.length - 1; i >= 0; i--) {
    const prop = object.properties[i];
    if (prop.type === 'SpreadElement' || (prop.computed && propertyName(prop) === undefined)) return undefined;
    if (!isPrototypeSetter(prop) && propertyName(prop) === key) return prop.value;
  }
  return undefined;
}

/**
 * What a name or member stands for when it is a constant declared in this file: the `'@new'` of `NEW`
 * after `const NEW = '@new'`, or of `Tags.NEW` after `const Tags = { NEW: '@new' }` or
 * `enum Tags { NEW = '@new' }`.
 */
function constantValue(sourceCode: SourceCode, node: Node, seen: readonly Node[] = []): Node | undefined {
  if (seen.includes(node)) return undefined;
  const path = [...seen, node];
  const follow = (value: Node | undefined): Node | undefined => {
    if (value === undefined) return undefined;
    const target = unwrap(value);
    return target.type === 'Identifier' || target.type === 'MemberExpression'
      ? constantValue(sourceCode, target, path)
      : target;
  };
  if (node.type === 'Identifier') return follow(declaredValue(sourceCode, node));
  if (node.type !== 'MemberExpression') return undefined;
  const key = memberKey(node);
  const object = unwrap(node.object);
  const value =
    object.type === 'ObjectExpression' || object.type === 'ArrayExpression'
      ? object
      : constantValue(sourceCode, object, path);
  const owner = value && unwrap(value);
  if (key === undefined || owner === undefined) return undefined;
  if (owner.type === 'ObjectExpression') return follow(propertyValue(owner, key));
  if (owner.type === 'ArrayExpression') {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || String(index) !== key) return undefined;
    if (owner.elements.slice(0, index + 1).some((element) => element?.type === 'SpreadElement')) return undefined;
    const element = owner.elements.at(index);
    return element !== undefined && element !== null && element.type !== 'SpreadElement' ? follow(element) : undefined;
  }
  if (owner.type !== 'TSEnumDeclaration') return undefined;
  const member = owner.body.members.find((m) => (m.id.type === 'Identifier' ? m.id.name : m.id.value) === key);
  return follow(member?.initializer);
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
  context: Pick<FoundText, 'before' | 'after' | 'embedded'> = {},
): void {
  const target = unwrap(node);
  if (path.includes(target)) {
    out.unread.add(via ?? target);
    return;
  }
  if (isStaticText(target)) {
    out.texts.push({ text: target, via, ...context });
    // A template that holds a constant, as in `` `${TAG}` ``, reads the constant's text too.
    if (target.type === 'TemplateLiteral') {
      const rendered = templateText(sourceCode, target);
      for (const [i, expression] of target.expressions.entries()) {
        const own = unwrap(expression);
        const value = isStaticText(own) ? own : constantValue(sourceCode, own);
        const resolved = value && unwrap(value);
        if (resolved !== undefined && isStaticText(resolved)) {
          readTexts(sourceCode, resolved, out, via, [...path, target], {
            before:
              rendered.offsets[i * 2 + 1] === 0
                ? (context.before ?? '')
                : rendered.text.charAt(rendered.offsets[i * 2 + 1] - 1),
            after:
              rendered.text.slice(rendered.offsets[i * 2 + 1] + rendered.parts[i * 2 + 1].length) +
              (context.after ?? ''),
            embedded: true,
          });
        }
      }
    }
    return;
  }
  if (target.type === 'ArrayExpression') {
    for (const item of target.elements) {
      if (item)
        readTexts(
          sourceCode,
          item.type === 'SpreadElement' ? item.argument : item,
          out,
          via,
          [...path, target],
          context,
        );
    }
    return;
  }
  const value = constantValue(sourceCode, target);
  // `path` holds the constants already followed, so `const a = b; const b = a;` ends.
  if (value === undefined || path.includes(value)) out.unread.add(via ?? target);
  else readTexts(sourceCode, value, out, via ?? target, [...path, target], context);
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
  // `cooked` is only null in tagged templates, which a computed key isn't.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) return key.quasis[0].value.cooked!;
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
function objectDetails(
  sourceCode: SourceCode,
  object: TSESTree.ObjectExpression,
  unread: Node[],
  path: readonly Node[] = [],
): [string, Node][] {
  if (path.includes(object)) {
    unread.push(object);
    return [];
  }
  const entries = new Map<string, Node>();
  for (const prop of object.properties) {
    if (prop.type === 'SpreadElement') {
      const argument = unwrap(prop.argument);
      const value = argument.type === 'ObjectExpression' ? argument : constantValue(sourceCode, argument);
      const spread = value && unwrap(value);
      const before = unread.length;
      const values =
        spread?.type === 'ObjectExpression' ? objectDetails(sourceCode, spread, unread, [...path, object]) : [];
      if (spread?.type !== 'ObjectExpression') unread.push(prop.argument);
      // An unread spread may replace any earlier property; later known properties still win.
      if (unread.length > before) entries.clear();
      for (const [key, value] of values) entries.set(key, value);
      continue;
    }
    if (isPrototypeSetter(prop)) continue;
    const key = detailKey(sourceCode, prop, unread);
    if (key === undefined) entries.clear();
    else entries.set(key, prop.value);
  }
  return [...entries];
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
    // `test.skip('places an order', placeOrder)` has a body defined elsewhere and no details. Options
    // come first only when they are an object that can be read, so a name read here is the second argument.
    return call.arguments.slice(2).some(isFunction) ? { entries: [], unread: [details] } : { entries: [], unread: [] };
  }
  const unread: Node[] = [];
  return { entries: objectDetails(sourceCode, object, unread), unread };
}

/** Static string text, including templates whose expressions resolve to strings in this file. */
function staticText(sourceCode: SourceCode, node: Node, seen: readonly Node[] = []): string | undefined {
  if (seen.includes(node)) return undefined;
  const path = [...seen, node];
  const read = (value: Node): string | undefined => {
    if (value.type === 'Literal') return typeof value.value === 'string' ? value.value : undefined;
    if (value.type !== 'TemplateLiteral') return undefined;
    const expressions = value.expressions.map((expression) => interpolationText(sourceCode, expression, path));
    if (expressions.some((text) => text === undefined)) return undefined;
    // `cooked` is only null in tagged templates, which no annotation value is.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
    return value.quasis.map((quasi, i) => quasi.value.cooked! + (expressions[i] ?? '')).join('');
  };
  const target = unwrap(node);
  const own = read(target);
  if (own !== undefined) return own;
  const constant = constantValue(sourceCode, target);
  return constant === undefined ? undefined : read(unwrap(constant));
}

/** Static primitive interpolation text, without evaluating object coercion or user code. */
function interpolationText(sourceCode: SourceCode, node: Node, seen: readonly Node[] = []): string | undefined {
  const text = staticText(sourceCode, node, seen);
  if (text !== undefined) return text;
  const target = unwrap(node);
  const value = constantValue(sourceCode, target) ?? target;
  if (
    value.type === 'Identifier' &&
    declaredWhere(sourceCode, value) === 'global' &&
    ['undefined', 'NaN', 'Infinity'].includes(value.name)
  )
    return value.name;
  if (value.type === 'UnaryExpression') {
    if (value.operator === 'void') return 'undefined';
    const argument = unwrap(value.argument);
    if (
      value.operator === '-' &&
      argument.type === 'Literal' &&
      (typeof argument.value === 'number' || typeof argument.value === 'bigint')
    )
      return String(-argument.value);
  }
  if (
    value.type !== 'Literal' ||
    (value.value !== null && !['number', 'boolean', 'bigint'].includes(typeof value.value))
  )
    return undefined;
  return String(value.value);
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
  const readValue = (value: Node, path: readonly Node[] = []): void => {
    const carrier = annotationCarrier(sourceCode, value);
    if (carrier === 'unread') {
      unread.push(value);
      return;
    }
    if (carrier === undefined) return;
    if (path.includes(carrier)) {
      unread.push(value);
      return;
    }
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
        if (element === null) continue;
        if (element.type === 'SpreadElement') {
          readValue(element.argument, [...path, carrier]);
          continue;
        }
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
  /** Modifiers whose option gives its own reason, as node:test's `{ skip: isWindows && 'no symlinks' }`. */
  reasonedOptions: ReadonlySet<string>;
}

const NO_TAGS: TagInfo = {
  tags: [],
  dynamic: false,
  unread: [],
  opaqueDetails: false,
  annotations: [],
  unreadAnnotations: [],
  reasonedOptions: new Set(),
};

function collectTags(
  sourceCode: SourceCode,
  call: TSESTree.CallExpression,
  hasTitle: boolean,
  framework: Framework,
  details: Details,
): Omit<TagInfo, 'reasonedOptions'> {
  const tags: TagOccurrence[] = [];
  const title = { texts: [] as FoundText[], unread: new Set<Node>() };
  // node:test's `test({ tags: ['db'] }, fn)` has no title, only options.
  if (hasTitle) readTexts(sourceCode, call.arguments[0], title);
  for (const found of title.texts) scanTags(sourceCode, found, tags);
  const values = { texts: [] as FoundText[], unread: new Set<Node>() };
  for (const [key, value] of details.entries) {
    if (key === framework.tagKey) readTexts(sourceCode, value, values);
  }
  for (const found of values.texts) {
    const plain = framework.plainTags ? plainTag(sourceCode, found) : undefined;
    if (plain) tags.push(plain);
    else scanTags(sourceCode, found, tags);
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
  return (!framework.functionTitle && isFunction(first)) || (framework.optionalTitle && isObject(sourceCode, first));
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
  if (isFunction(first) && !framework.functionTitle) return kind === 'describe' || framework.optionalTitle;
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
  const value = node === undefined ? undefined : unwrap(node);
  return value?.type === 'Literal' && typeof value.value === 'boolean' ? value.value : undefined;
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

/** Keys of a retry options object that hold a count: Vitest's `count`, Cypress's `runMode` and `openMode`. */
const RETRY_COUNT_KEYS = new Set(['count', 'runMode', 'openMode']);
const VITEST_RETRY_COUNT_KEYS = new Set(['count']);
const CYPRESS_RETRY_COUNT_KEYS = new Set(['runMode', 'openMode']);

/**
 * Whether a retry count gives retries: anything but `0`, `false`, `null` or `undefined` written out, since a
 * count known only when the tests run, as `process.env.CI ? 2 : 0`, retries where flaky tests hide. An
 * object retries unless every count it holds is one of those.
 */
function retries(
  sourceCode: SourceCode,
  node: Node | undefined,
  keys: ReadonlySet<string> = RETRY_COUNT_KEYS,
  seen: readonly Node[] = [],
): boolean {
  if (node === undefined) return false;
  if (seen.includes(node)) return true;
  const own = unwrap(node);
  const value = constantValue(sourceCode, own) ?? own;
  if (value.type === 'Literal') return value.value !== 0 && value.value !== false && value.value !== null;
  if (value.type === 'Identifier') return value.name !== 'undefined';
  if (value.type !== 'ObjectExpression') return true;
  const unread: Node[] = [];
  const counts = objectDetails(sourceCode, value, unread).filter(([key]) => keys.has(key));
  if (unread.length > 0 && ![...keys].every((key) => counts.some(([name]) => name === key))) return true;
  return counts.length === 0 || counts.some(([, count]) => retries(sourceCode, count, keys, [...seen, node]));
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
function isUnconditional(sourceCode: SourceCode, call: TSESTree.CallExpression, framework: Framework): boolean {
  const first = call.arguments.at(0);
  const always =
    first === undefined ||
    booleanOf(first) === true ||
    // Mocha ignores arguments; Node and Jasmine take a reason rather than a condition.
    framework.reasonArgument === undefined ||
    framework.reasonArgument === 'only' ||
    (framework.skipNotes && (isStaticText(unwrap(first)) || staticText(sourceCode, first) !== undefined));
  return always && !isGuarded(call);
}

/**
 * Whether a comment says anything: a line with text other than a marker keyword alone, such as `SKIP:`. A
 * directive counts only by its description.
 */
function hasText(comment: Comment): boolean {
  return commentLines(comment).some(({ text }) => /[^\s*]/.test(text) && MARKER_LINE_RE.exec(text)?.[2].trim() !== '');
}

/**
 * Whether a reason argument says why: text that isn't blank, or a value known only when the tests run, as
 * `reason` or `` `${browserName} has no clipboard` ``, which is taken on trust.
 */
function saysWhy(sourceCode: SourceCode, node: Node): boolean {
  const text = staticText(sourceCode, node);
  if (text !== undefined) return text.trim() !== '';
  const value = unwrap(node);
  return value.type !== 'Literal' && !(value.type === 'Identifier' && value.name === 'undefined');
}

/**
 * Whether `node` is text that isn't blank, or a template with values in it, as `` `${browserName} has no
 * clipboard` ``, which is taken on trust.
 */
function isReasonText(sourceCode: SourceCode, node: Node): boolean {
  const text = staticText(sourceCode, node);
  return text === undefined ? unwrap(node).type === 'TemplateLiteral' : text.trim() !== '';
}

/** Whether a runtime call gives the reason for its state where its framework takes one (see `reasonArgument`). */
function callReason(
  sourceCode: SourceCode,
  call: TSESTree.CallExpression,
  where: NonNullable<Framework['reasonArgument']>,
): boolean {
  const first = call.arguments.at(0);
  const second = call.arguments.at(1);
  if (where === 'only') return first !== undefined && saysWhy(sourceCode, first);
  // Vitest's `context.skip(isMobile)` takes a condition, so only text first is a reason.
  const text =
    first !== undefined && (staticText(sourceCode, first) !== undefined || unwrap(first).type === 'TemplateLiteral');
  if (where === 'either' && text) {
    return isReasonText(sourceCode, first);
  }
  return second !== undefined && saysWhy(sourceCode, second);
}

/**
 * Whether a conditional option gives its reason, as node:test's `{ skip: isWindows && 'no symlinks' }` or
 * `{ skip: isWindows ? 'no symlinks' : false }`, where the text is what Node reports.
 */
function optionReason(sourceCode: SourceCode, node: Node): boolean {
  const value = unwrap(node);
  if (value.type === 'LogicalExpression') return value.operator === '&&' && isReasonText(sourceCode, value.right);
  if (value.type !== 'ConditionalExpression') return false;
  return isReasonText(sourceCode, value.consequent) || isReasonText(sourceCode, value.alternate);
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** Whether a statement can leave the enclosing body, without entering nested functions or loops. */
function exits(statement: TSESTree.Statement): boolean {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    statement.type === 'BreakStatement' ||
    statement.type === 'ContinueStatement'
  )
    return true;
  if (statement.type === 'IfStatement')
    return exits(statement.consequent) || (statement.alternate !== null && exits(statement.alternate));
  return statement.type === 'BlockStatement' && statement.body.some(exits);
}

/** `if (ready) return;` or `if (!ok) { throw error; }`: code after it only runs on some paths. */
function isEarlyExit(statement: TSESTree.Statement): boolean {
  if (statement.type === 'BlockStatement') return statement.body.some(isEarlyExit);
  return (
    statement.type === 'IfStatement' &&
    (exits(statement.consequent) || (statement.alternate !== null && exits(statement.alternate)))
  );
}

/**
 * Whether the call only runs on some paths of its function: under an `if`, a `switch` case, a ternary or a loop,
 * the right side of `&&`, `||` or `??`, in a `catch` block, after other code in a `try` block that has a
 * `catch`, or after an early exit such as `if (ready) return;`. `if (!enabled) test.skip()` is the same as `test.skip(!enabled)`, and
 * `catch { test.skip(true, 'service is down') }` only skips when the service is down.
 */
function isGuarded(call: TSESTree.CallExpression): boolean {
  let child: Node = call;
  for (let node: Node | undefined = call.parent; node && !FUNCTIONS.has(node.type); child = node, node = node.parent) {
    const same = (other: Node): boolean => child.range[0] === other.range[0] && child.range[1] === other.range[1];
    if ((node.type === 'IfStatement' || node.type === 'ConditionalExpression') && !same(node.test)) return true;
    if (node.type === 'SwitchCase' && (node.test === null || !same(node.test))) return true;
    if (node.type === 'LogicalExpression' && same(node.right)) return true;
    if (
      ((node.type === 'WhileStatement' || node.type === 'ForStatement') &&
        node.test !== null &&
        booleanOf(node.test) !== true &&
        child === node.body) ||
      ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && child === node.body)
    )
      return true;
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
  const testNames = collectTestNames(sourceCode, framework, options.testFunctions);
  /** Whole-module imports or requires, including constant aliases of them. */
  const moduleOf = (node: Node, seen: readonly Node[] = []): boolean => {
    const value = unwrap(node);
    if (seen.includes(value)) return false;
    if (value.type === 'Identifier') {
      if (isReassigned(sourceCode, value)) return false;
      if (testNames.modules.has(value.name) && declaredWhere(sourceCode, value) === 'top') return true;
      const alias = declaredValue(sourceCode, value);
      return alias !== undefined && moduleOf(alias, [...seen, value]);
    }
    const source = requireSource(value);
    return source !== undefined && framework.ownsModule(source);
  };
  /**
   * The test function a callee starts from and the members after it, such as `test` and
   * `['describe', 'skip']` for `test.describe.skip` or `pw.test.describe.skip`. Undefined when the callee
   * isn't one of the framework's test functions.
   */
  const target = (
    chain: Chain | undefined,
    seen: readonly Node[] = [],
  ): { root: Root; path: string[]; args: Chain['args'] } | undefined => {
    if (chain === undefined) return undefined;
    const { root, path, args } = chain;
    // `require('node:test').test.skip(...)`: the require call stands for the module, with its exports.
    if (root.type !== 'Identifier') {
      const source = requireSource(root);
      if (source === undefined || !framework.ownsModule(source) || path.length === 0) return undefined;
      const exported = framework.exports.get(path[0]);
      return exported === undefined ? undefined : { root: exported, path: path.slice(1), args };
    }
    if (isReassigned(sourceCode, root)) return undefined;
    let base = testNames.roots.get(root.name);
    let rest = path;
    // `pw.test.skip`, or node:test's `test.describe`, whose module is also its `test` even when
    // `test` was imported by name.
    const moduleLike = moduleOf(root) || (framework.defaultExport !== undefined && base === framework.defaultExport);
    const member = moduleLike ? framework.exports.get(path[0]) : undefined;
    if (member !== undefined || base === undefined) {
      base = member;
      rest = path.slice(1);
    }
    if (base !== undefined && !isLocalVariable(sourceCode, root)) return { root: base, path: rest, args };
    const definition = declaredVariable(sourceCode, root)?.defs.find((def) => def.type === 'Variable');
    const declarator = definition?.node;
    if (
      declarator?.type === 'VariableDeclarator' &&
      declarator.id.type === 'ObjectPattern' &&
      declarator.init !== null
    ) {
      if (seen.includes(declarator)) return undefined;
      const property = declarator.id.properties.find((prop) => {
        if (prop.type !== 'Property') return false;
        const binding = prop.value.type === 'AssignmentPattern' ? prop.value.left : prop.value;
        return binding.type === 'Identifier' && binding.name === root.name;
      });
      const key = property?.type === 'Property' ? propertyName(property) : undefined;
      const init = chainOf(unwrap(declarator.init), framework.factories);
      return key === undefined || init === undefined
        ? undefined
        : target({ ...init, path: [...init.path, key, ...path], args: new Map([...init.args, ...args]) }, [
            ...seen,
            declarator,
          ]);
    }
    const value = declaredValue(sourceCode, root);
    if (value === undefined || seen.includes(value)) return undefined;
    const alias = target(chainOf(unwrap(value), framework.factories), [...seen, value]);
    return alias && { root: alias.root, path: [...alias.path, ...path], args: new Map([...alias.args, ...args]) };
  };
  let usesTest = testNames.usesModule;
  const subjects: Subject[] = [];
  const retryCounts: Analysis['retryCounts'] = [];
  /** Follows local constants and conditional branches without executing a runtime expression. */
  const recordRetryCounts = (node: Node | undefined, keys?: ReadonlySet<string>, seen: readonly Node[] = []): void => {
    if (node === undefined) return;
    const own = unwrap(node);
    const value = constantValue(sourceCode, own) ?? own;
    if (seen.includes(value)) return;
    const path = [...seen, value];
    if (value.type === 'Literal' && typeof value.value === 'number') {
      retryCounts.push({ node: own, count: value.value });
    } else if (value.type === 'UnaryExpression' && (value.operator === '+' || value.operator === '-')) {
      const argument = constantValue(sourceCode, unwrap(value.argument)) ?? unwrap(value.argument);
      if (argument.type === 'Literal' && typeof argument.value === 'number') {
        retryCounts.push({ node: own, count: value.operator === '-' ? -argument.value : argument.value });
      }
    } else if (value.type === 'ConditionalExpression') {
      const condition = booleanOf(constantValue(sourceCode, unwrap(value.test)) ?? value.test);
      if (condition !== false) recordRetryCounts(value.consequent, keys, path);
      if (condition !== true) recordRetryCounts(value.alternate, keys, path);
    } else if (value.type === 'ObjectExpression' && keys !== undefined) {
      for (const [key, count] of objectDetails(sourceCode, value, [])) {
        if (keys.has(key)) recordRetryCounts(count, undefined, path);
      }
    }
  };
  const claimed = new Set<Comment>();
  const allComments = sourceCode.getAllComments();
  const commentedOut = findCommentedOutTests(
    sourceCode,
    allComments,
    new Set([
      ...options.testFunctions,
      ...[...testNames.roots].flatMap(([name, root]) => (root.kind === 'hook' ? [] : [name])),
      ...[...framework.exports, ...framework.globals].flatMap(([name, root]) => (root.kind === 'hook' ? [] : [name])),
    ]),
    new Set(
      [...framework.testMembers, ...framework.describeMembers, 'describe', 'step'].map((m) => m.replace('()', '')),
    ),
    states,
  );
  const comments = allComments.filter((comment) => !commentedOut.comments.has(comment));
  const regions = disableRegions(comments, states);
  // A region's marker covers every test up to its `eslint-enable`, so it is never the own marker of the first.
  const regionComments = new Set(regions.map((r) => r.comment));
  // `test.skip(...); // eslint-disable-line rule -- SKIP: TRADE-1` holds its marker on the test's own line.
  const lineDirectives = new Map<number, Comment[]>();
  for (const comment of comments) {
    if (directiveOf(comment)?.kind !== 'eslint-disable-line') continue;
    lineDirectives.set(comment.loc.start.line, [...(lineDirectives.get(comment.loc.start.line) ?? []), comment]);
  }
  const stack: Subject[] = [];
  const infos: InfoName[] = [];
  const infoOf = (id: TSESTree.Identifier): InfoName | undefined => {
    const info = infos.findLast((entry) => entry.name === id.name);
    return info?.binding !== undefined &&
      declaredVariable(sourceCode, id) !== declaredVariable(sourceCode, info.binding)
      ? undefined
      : info;
  };
  const keys = sourceCode.visitorKeys as Record<string, readonly string[] | undefined>;
  /** States an options object can put a test in, such as `skip` for Vitest's `{ skip: true }`. */
  const optionModifiers = new Set<string>(framework.optionEffects.values());
  if (framework.retryOption !== undefined) optionModifiers.add('retry');
  /** Bodies of Mocha tests and hooks written as a `function`, where `this.skip()` skips at runtime. */
  const thisBodies = new Set<Node>();
  /** Describe bodies written as a `function`, whose `this` is Mocha's suite, which `this.retries()` acts on. */
  const suiteBodies = new Set<Node>();

  /**
   * Whether `anchor` or a statement around it has a comment that says something above it or at the end of its
   * first line, as `// why` above an `if` or after its `{`, up to `owner`, the test or describe the call acts on. The walk goes on through a callback passed to another
   * call, such as a hook's or a step's, but stops at a function declared some other way.
   */
  const commentedAround = (anchor: Node, owner: Node | undefined): boolean => {
    for (let node: Node | undefined = anchor; node; node = node.parent) {
      if (FUNCTIONS.has(node.type)) {
        const call: Node | undefined = node.parent;
        if (call?.type !== 'CallExpression' || call === owner || !(call.arguments as Node[]).includes(node)) {
          return false;
        }
        continue;
      }
      const container = node.parent;
      if (!container || !STATEMENT_CONTAINERS.has(container.type)) continue;
      const block = commentBlock(sourceCode, node, options.allowBlankLine);
      if (block.some((c) => !commentedOut.comments.has(c) && !regionComments.has(c) && hasText(c))) return true;
      // `if (isMobile) { // why`: a comment at the end of the line the statement starts on.
      const first = sourceCode.getCommentsInside(node).at(0);
      if (first?.loc.start.line === node.loc.start.line && hasText(first)) return true;
    }
    return false;
  };

  /** Whether a comment that says something ends the line `node` ends on, as `test.skip(isMobile); // why`. */
  const trailingText = (node: Node): boolean =>
    sourceCode
      .getCommentsAfter(node)
      .some((comment) => comment.loc.start.line === node.loc.end.line && hasText(comment));

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
    const block = commentBlock(sourceCode, anchor, options.allowBlankLine).filter(
      (comment) => !commentedOut.comments.has(comment),
    );
    // `symbols.forEach((symbol) =>\n  // SKIP: TRADE-1\n  test.skip(...))`: the marker sits above the call itself.
    if (call.parent.type === 'ArrowFunctionExpression' && call.parent.body === call) {
      block.push(
        ...commentBlock(sourceCode, call, options.allowBlankLine).filter((c) => !commentedOut.comments.has(c)),
      );
    }
    block.push(...(lineDirectives.get(call.loc.start.line) ?? []));
    const inRegions = regions.filter((r) => r.start <= call.range[0] && call.range[0] < r.end);
    for (const comment of [...block, ...inRegions.map((r) => r.comment)]) claimed.add(comment);
    // A region's description says why a rule is off, not why a test is skipped; its marker's ticket counts.
    const commented = block.some((comment) => !regionComments.has(comment) && hasText(comment));
    // A comment at the end of the line also says why. A runtime call can also say why above the statements
    // around it in its function, above its test, or in its arguments.
    const reasonedCall = (): boolean =>
      trailingText(anchor) ||
      (kind === 'runtime' &&
        ((framework.reasonArgument !== undefined && callReason(sourceCode, call, framework.reasonArgument)) ||
          parent?.commented === true ||
          commentedAround(anchor, parent?.node)));
    const ownTags = new Set(tagInfo.tags.map((t) => t.tag));
    const sources: StateSource[] = [];
    for (const state of states) {
      if (state.modifier === undefined) {
        if (ownTags.has(state.tag)) sources.push({ state, required: true });
        continue;
      }
      const always = modifiers.get(state.modifier);
      if (always === undefined) continue;
      const source: StateSource = { state, required: always || options.requireTicketForConditional };
      if (!always) source.reasoned = commented || tagInfo.reasonedOptions.has(state.modifier) || reasonedCall();
      sources.push(source);
    }
    const inherited = new Set<string>();
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
    const subject: Subject = {
      kind,
      node: call,
      anchor,
      parent,
      states: sources,
      commented,
      inherited,
      runtimeStates: new Set(),
      tags: tagInfo.tags,
      unreadTags: tagInfo.unread,
      unknownStates,
      sharedStates: new Set(),
      markers: block.flatMap((comment) => (regionComments.has(comment) ? [] : parseMarkers(comment, states))),
      regionMarkers: inRegions.flatMap((r) => r.markers),
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
      if (condition === undefined) modifiers.set(effect.modifier, false);
      else if (condition === effect.when) modifiers.set(effect.modifier, true);
      else modifiers.delete(effect.modifier);
    }
    // `{ skip: true }` always skips, `{ skip: isMobile }` only sometimes, `{ skip: false }` never.
    for (const [key, value] of details) {
      if (key === framework.retryOption) {
        if (
          retries(sourceCode, value, framework.name === 'vitest' ? VITEST_RETRY_COUNT_KEYS : CYPRESS_RETRY_COUNT_KEYS)
        )
          add('retry', true);
        continue;
      }
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
  const bodyInfos = (args: TSESTree.CallExpressionArgument[], path: string[], declaration = false): InfoName[] => {
    const body = args.slice(framework.functionTitle && declaration ? 1 : 0).findLast(isFunction);
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
  const pickedDeclaration = (
    call: TSESTree.CallExpression,
    picker: Node,
  ): { subject: Subject; infos: InfoName[] } | undefined => {
    const callee = unwrap(picker);
    if (callee.type !== 'ConditionalExpression') return undefined;
    const choices = (node: Node): Declaration[] | undefined => {
      const value = unwrap(node);
      if (value.type === 'ConditionalExpression') {
        const yes = choices(value.consequent);
        const no = choices(value.alternate);
        return yes === undefined || no === undefined ? undefined : [...yes, ...no];
      }
      const picked = target(chainOf(value, framework.factories));
      const declaration = picked && declarationOf(picked);
      return declaration && [declaration];
    };
    const alternatives = choices(callee);
    const args = call.arguments;
    if (alternatives === undefined) return undefined;
    const [first] = alternatives;
    if (!alternatives.every((choice) => choice.kind === first.kind && declares(choice, args))) return undefined;
    usesTest = true;
    const { details, tagInfo } = headOf(call);
    const branches = alternatives.map(({ members, args: conditions }) =>
      declarationModifiers(first.kind, args, modifiersOf(members, details.entries, conditions)),
    );
    if (first.kind === 'test') addThisBody(args);
    const body = args.findLast(isFunction);
    if (first.kind === 'describe' && body?.type === 'FunctionExpression') suiteBodies.add(body);
    const modifiers = new Map<string, boolean>();
    for (const modifier of new Set(branches.flatMap((branch) => [...branch.keys()]))) {
      modifiers.set(
        modifier,
        branches.every((branch) => branch.get(modifier) === true),
      );
    }
    const infos = first.kind === 'test' ? bodyInfos(args, first.members, true) : [];
    return { subject: makeSubject(first.kind, call, modifiers, tagInfo), infos };
  };

  /** The details, tags and annotations of a declaration; node:test lets it leave out its title. */
  const headOf = (call: TSESTree.CallExpression): { details: Details; tagInfo: TagInfo } => {
    const args = call.arguments;
    const untitled = leavesOutTitle(sourceCode, framework, args);
    const details = detailsOf(sourceCode, call, untitled && !isFunction(args[0]));
    if (framework.name === 'vitest' || framework.name === 'cypress') {
      const count = details.entries.findLast(([key]) => key === framework.retryOption);
      recordRetryCounts(count?.[1], framework.name === 'vitest' ? VITEST_RETRY_COUNT_KEYS : CYPRESS_RETRY_COUNT_KEYS);
    }
    const annotations =
      options.annotations === undefined || framework.annotations === undefined
        ? { annotations: [], unreadAnnotations: [] }
        : collectAnnotations(sourceCode, details, framework.annotations, options.annotations);
    const reasonedOptions = new Set<string>();
    if (framework.anyOptionValue) {
      for (const [key, value] of details.entries) {
        const modifier = framework.optionEffects.get(key);
        if (modifier && optionReason(sourceCode, value)) reasonedOptions.add(modifier);
      }
    }
    return {
      details,
      tagInfo: { ...collectTags(sourceCode, call, !untitled, framework, details), ...annotations, reasonedOptions },
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
    const body = args.findLast(isFunction);
    if (kind === 'describe' && body?.type === 'FunctionExpression') suiteBodies.add(body);
    return { subject: makeSubject(kind, call, modifiers, tagInfo), infos };
  };

  /** A context or runtime method, following stable local aliases and bound methods. */
  const resolveInfo = (node: Node, seen: readonly Node[] = []): InfoName | undefined => {
    const value = unwrap(node);
    if (seen.includes(value)) return undefined;
    const path = [...seen, value];
    if (value.type === 'CallExpression') {
      const bind = unwrap(value.callee);
      if (bind.type !== 'MemberExpression' || memberName(bind) !== 'bind') return undefined;
      const source = resolveInfo(bind.object, path);
      return source?.method === undefined
        ? undefined
        : { ...source, boundArgs: [...(source.boundArgs ?? []), ...value.arguments.slice(1)] };
    }
    if (value.type === 'MemberExpression') {
      const name = memberName(value);
      if (name === undefined) return undefined;
      if (value.object.type === 'ThisExpression') {
        const owner = thisFunction(value);
        return owner !== undefined && thisBodies.has(owner) && framework.thisMethods.has(name)
          ? { name, method: name }
          : undefined;
      }
      const object = resolveInfo(value.object, path);
      return object?.methods?.has(name) ? { name, method: name, step: object.step, owner: object.owner } : undefined;
    }
    if (value.type !== 'Identifier' || isReassigned(sourceCode, value)) return undefined;
    const direct = infoOf(value);
    if (direct !== undefined) {
      const fn = direct.runtimeFunction;
      return fn && declaredWhere(sourceCode, value) !== (fn.imported ? 'top' : 'global') ? undefined : direct;
    }
    const definition = declaredVariable(sourceCode, value)?.defs.find((def) => def.type === 'Variable');
    const declarator = definition?.node;
    if (declarator?.type !== 'VariableDeclarator' || declarator.init === null) return undefined;
    const source = resolveInfo(declarator.init, path);
    if (source === undefined) return undefined;
    if (declarator.id.type === 'Identifier') return { ...source, name: value.name, runtimeFunction: undefined };
    if (declarator.id.type !== 'ObjectPattern' || source.methods === undefined) return undefined;
    const property = declarator.id.properties.find(
      (prop) => prop.type === 'Property' && prop.value.type === 'Identifier' && prop.value.name === value.name,
    );
    const name = property?.type === 'Property' ? propertyName(property) : undefined;
    return name !== undefined && source.methods.has(name)
      ? { name: value.name, method: name, step: source.step, owner: source.owner }
      : undefined;
  };

  /** node:test's `t.test('title', fn)`: a subtest declared through the context of the test around it. */
  const subtestOf = (call: TSESTree.CallExpression): { subject: Subject; infos: InfoName[] } | undefined => {
    const { callee } = call;
    if (!framework.subtests || callee.type !== 'MemberExpression' || memberName(callee) !== 'test') return undefined;
    const { object } = callee;
    if (object.type !== 'Identifier' || !resolveInfo(object)?.methods) return undefined;
    const declaration: Declaration = { kind: 'test', members: [], written: [], args: new Map() };
    return declares(declaration, call.arguments)
      ? declare(call, declaration, bodyInfos(call.arguments, []))
      : undefined;
  };

  /**
   * The value of a constant that holds a test function the collected names can't: one a condition picks, as
   * `const itIf = isCI ? it.skip : it`, one a factory builds, as `const d = describe.runIf(hasDocker)`, or any
   * declared inside a function.
   */
  const aliasValue = (callee: Node): Node | undefined => {
    if (callee.type !== 'Identifier' || testNames.roots.has(callee.name)) return undefined;
    const seen = new Set<Node>();
    let value = declaredValue(sourceCode, callee);
    while (value !== undefined && !seen.has(value)) {
      seen.add(value);
      const expression = unwrap(value);
      if (expression.type !== 'Identifier') return ALIAS_VALUES.has(expression.type) ? value : undefined;
      value = declaredValue(sourceCode, expression);
    }
    return undefined;
  };

  /**
   * Whether the declaration of a constant that holds a test function says why above it or at the end of its
   * line, as `// no symlinks on Windows` above `const posixTest = isWindows ? test.skip : test`.
   */
  const aliasCommented = (value: Node): boolean => {
    const statement = anchorOf(value);
    const block = commentBlock(sourceCode, statement, options.allowBlankLine);
    return (
      block.some((c) => !commentedOut.comments.has(c) && !regionComments.has(c) && hasText(c)) ||
      trailingText(statement)
    );
  };

  const visitCall = (original: TSESTree.CallExpression): { subject?: Subject; infos?: InfoName[] } => {
    const alias = aliasValue(throughFunctionMethods(original).callee);
    const visited = visitDeclaredCall(original, alias);
    if (alias && visited.subject && aliasCommented(alias)) {
      for (const source of visited.subject.states) if (source.reasoned === false) source.reasoned = true;
    }
    return visited;
  };

  const visitDeclaredCall = (
    original: TSESTree.CallExpression,
    alias: Node | undefined,
  ): { subject?: Subject; infos?: InfoName[] } => {
    const normalized = throughFunctionMethods(original);
    const expanded =
      alias === undefined
        ? normalized
        : throughFunctionMethods({ ...normalized, callee: alias as TSESTree.Expression });
    const call =
      expanded.arguments === normalized.arguments ? normalized : { ...normalized, arguments: expanded.arguments };
    const written = expanded.callee;
    const callee = target(chainOf(written, framework.factories));
    if (callee === undefined) {
      return (
        subtestOf(call) ??
        pickedDeclaration(call, written) ?? { subject: runtimeCall(call) ?? retryCall({ ...call, callee: written }) }
      );
    }
    usesTest = true;
    const args = call.arguments;
    const { path } = callee;
    // `test.describe.configure(...)`, or `describe.configure(...)` with `const { describe } = test`.
    const configure =
      path.join('.') === 'describe.configure' || (callee.root === DESCRIBE && path.join('.') === 'configure');
    if (framework.retryCall === 'describe.configure' && configure) {
      const count = detailsOf(sourceCode, call, true).entries.findLast(([key]) => key === 'retries');
      return { subject: retrySubject(call, count?.[1], 'configure') };
    }
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
    const declared = declares(declaration, args);
    const bodyInfo = kind === 'describe' ? [] : bodyInfos(args, path, declared);
    if (declared) return declare(call, declaration, bodyInfo);
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
    const info = resolveInfo(callee);
    if (info?.method !== undefined) {
      const applied =
        info.boundArgs === undefined ? call : { ...call, arguments: [...info.boundArgs, ...call.arguments] };
      const subject = runtimeSubject(applied, info.method, info.step ?? info.owner);
      if (subject) subject.functionName = info.runtimeFunction?.name;
      return subject;
    }
    const member = unwrap(callee);
    if (member.type !== 'MemberExpression') return undefined;
    const name = memberName(member);
    if (name === undefined) return undefined;
    const object = unwrap(member.object);
    const isTestInfo =
      RUNTIME_MODIFIERS.has(name) &&
      object.type === 'CallExpression' &&
      target(chainOf(object.callee, framework.factories))?.path.join('.') === 'info';
    return isTestInfo ? runtimeSubject(call, name) : undefined;
  };

  /**
   * Mocha's `this.retries(2)` in a describe, test or hook written as a `function`, and Jest's
   * `jest.retryTimes(3)` with Jest's own `jest`.
   */
  const retryCall = (call: TSESTree.CallExpression): Subject | undefined => {
    const { callee } = call;
    if (callee.type !== 'MemberExpression') return undefined;
    const name = memberName(callee);
    const { object } = callee;
    if (framework.retryCall === 'this.retries' && name === 'retries') {
      if (object.type === 'ThisExpression') {
        const owner = thisFunction(call);
        const ownsThis = owner !== undefined && (thisBodies.has(owner) || suiteBodies.has(owner));
        return ownsThis ? retrySubject(call, call.arguments.at(0), name) : undefined;
      }
      if (object.type === 'CallExpression') {
        const callee = target(chainOf(object.callee, framework.factories));
        const declaration = callee && declarationOf(callee);
        if (declaration && declares(declaration, object.arguments)) {
          return retrySubject(call, call.arguments.at(0), name);
        }
      }
      return undefined;
    }
    if (framework.retryCall !== 'jest.retryTimes' || name !== 'retryTimes') {
      return undefined;
    }
    const isJestObject = (value: Node, seen: readonly Node[] = []): boolean => {
      if (seen.includes(value)) return false;
      if (value.type === 'MemberExpression') return memberName(value) === 'jest' && moduleOf(value.object);
      if (value.type !== 'Identifier' || isReassigned(sourceCode, value)) return false;
      const def = declaredVariable(sourceCode, value)?.defs.at(0);
      if (def === undefined) return value.name === 'jest';
      if (def.type === 'ImportBinding')
        return (
          def.node.type === 'ImportSpecifier' &&
          importedName(def.node) === 'jest' &&
          def.parent.type === 'ImportDeclaration' &&
          framework.ownsModule(def.parent.source.value)
        );
      if (def.type === 'Variable' && def.node.id.type === 'ObjectPattern' && def.node.init !== null) {
        const property = def.node.id.properties.find(
          (prop) => prop.type === 'Property' && prop.value.type === 'Identifier' && prop.value.name === value.name,
        );
        return property?.type === 'Property' && propertyName(property) === 'jest' && moduleOf(def.node.init);
      }
      const alias = declaredValue(sourceCode, value);
      return alias !== undefined && isJestObject(unwrap(alias), [...seen, value]);
    };
    const isJest = isJestObject(object);
    return isJest ? retrySubject(call, call.arguments.at(0), name) : undefined;
  };

  /** A call that gives retries when `count` does; retries need a ticket even when only some runs get them. */
  const retrySubject = (call: TSESTree.CallExpression, count: Node | undefined, name: string): Subject | undefined => {
    recordRetryCounts(count);
    if (!retries(sourceCode, count)) return undefined;
    const subject = runtimeSubject(call, 'retry', undefined, true);
    if (subject) subject.functionName = name;
    return subject;
  };

  /** `step` is set for `step.skip()`, which skips only its step; the other calls act on the whole test. */
  const runtimeSubject = (
    call: TSESTree.CallExpression,
    modifier: string,
    step?: Subject,
    always = isUnconditional(sourceCode, call, framework),
  ): Subject | undefined => {
    if (!states.some((s) => s.modifier === modifier)) return undefined;
    if (
      framework.reasonArgument !== undefined &&
      framework.reasonArgument !== 'only' &&
      booleanOf(call.arguments.at(0)) === false
    )
      return undefined;
    const subject = makeSubject(
      'runtime',
      call,
      new Map([[modifier, always]]),
      NO_TAGS,
      step ?? stack.findLast((s) => s.kind !== 'step'),
    );
    const parent = subject.parent;
    if (parent) {
      parent.runtimeStates.add(subject.states[0].state.name);
    }
    return subject;
  };

  const functionTitles = new Set<Node>();
  const walk = (node: Node): void => {
    if (functionTitles.has(node)) return;
    let pushedSubject = false;
    let pushedInfos = 0;
    if (node.type === 'CallExpression') {
      const visit = visitCall(node);
      if (visit.subject && visit.subject.kind !== 'runtime') {
        stack.push(visit.subject);
        pushedSubject = true;
        const title = visit.subject.node.arguments[0];
        if (framework.functionTitle && isFunction(title)) functionTitles.add(title);
      }
      for (const info of visit.infos ?? []) {
        if (!info.runtimeFunction && info.step === undefined && visit.subject?.kind === 'test')
          info.owner = visit.subject;
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

  const detachedMarkers = comments
    .filter((comment) => !claimed.has(comment))
    .flatMap((comment) => parseMarkers(comment, states))
    .filter(isStateMarker);

  const byAnchor = new Map<Node, Subject[]>();
  for (const subject of subjects) byAnchor.set(subject.anchor, [...(byAnchor.get(subject.anchor) ?? []), subject]);
  for (const subject of subjects) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- every subject's anchor is a key
    for (const other of byAnchor.get(subject.anchor)!) {
      if (other === subject) continue;
      for (const marker of subject.markers) {
        if (marker.state && appliesTo(other, marker.state.name)) subject.sharedStates.add(marker.state.name);
      }
    }
  }

  const idleRegionMarkers = regions
    .flatMap((region) => region.markers)
    .filter(isStateMarker)
    .filter((marker) => {
      const covered = subjects.filter((subject) => subject.regionMarkers.includes(marker));
      return (
        covered.length > 0 &&
        !isWorkComment(marker, options) &&
        !covered.some((s) => appliesTo(s, marker.state.name) || s.unknownStates.has(marker.state.name))
      );
    });

  return {
    subjects,
    retryCounts,
    detachedMarkers,
    idleRegionMarkers,
    commentedOutTests: commentedOut.found,
    isTestFile: usesTest,
  };
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
 * Markers that can satisfy `state` for `subject`: its own block and the `eslint-disable` regions it is
 * in, then the blocks of enclosing describes that are in the same state. A runtime call can also use any
 * enclosing test or describe.
 */
function candidateMarkers(subject: Subject, state: StateDef): Marker[] {
  const found = [...subject.markers, ...subject.regionMarkers].filter((m) => m.state === state);
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
    const marker = [...subject.markers, ...subject.regionMarkers].find((m) => m.caseOf === state);
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
    if (
      state === undefined ||
      appliesTo(subject, state.name) ||
      subject.unknownStates.has(state.name) ||
      subject.sharedStates.has(state.name)
    ) {
      return [];
    }
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
  return {
    start: node.callee.loc.start,
    end: (title && title.range[1] > node.callee.range[1] ? title : node.callee).loc.end,
  };
}

export function describeSubject(subject: Subject): string {
  if (subject.kind === 'describe') return 'This describe block';
  if (subject.kind === 'step') return 'This step';
  if (subject.kind === 'runtime') return `This ${subject.functionName ?? subject.states[0].state.modifier} call`;
  return 'This test';
}
