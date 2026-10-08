import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { ResolvedOptions, StateDef } from './options.ts';
import type { TicketCheck, TicketMatcher } from './tickets.ts';

type Node = TSESTree.Node;
type Comment = TSESTree.Comment;
type SourceCode = Readonly<TSESLint.SourceCode>;

const PLAYWRIGHT_MODULES = new Set(['@playwright/test', 'playwright/test']);
/** Other test runners. A name imported from one of these is never Playwright's `test`. */
const OTHER_FRAMEWORKS = new Set(['vitest', '@jest/globals', 'node:test', 'bun:test', 'mocha', 'ava', 'tap', 'uvu']);

/** `@playwright/test` and the component-testing packages such as `@playwright/experimental-ct-react`. */
function isPlaywrightModule(source: string): boolean {
  return PLAYWRIGHT_MODULES.has(source) || source.startsWith('@playwright/experimental-ct-');
}
const TEST_MODIFIERS = new Set(['only', 'skip', 'fixme', 'fail', 'slow']);
const DESCRIBE_MODIFIERS = new Set(['only', 'skip', 'fixme', 'serial', 'parallel']);
const RUNTIME_MODIFIERS = new Set(['skip', 'fixme', 'fail', 'slow']);
const SKIPPING_MODIFIERS = new Set(['skip', 'fixme']);
const MARKER_LINE_RE = /^\s*\*?\s*([A-Za-z][\w-]*)\s*:(.*)$/;
const TAG_RE = /(?<![\w@])@[\w-]+/g;

export interface MarkerTicket {
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
  node: TSESTree.Literal | TSESTree.TemplateLiteral;
}

export interface StateSource {
  state: StateDef;
  /** False for conditional skips unless `requireTicketForConditional` is set. */
  required: boolean;
}

export interface Subject {
  kind: 'test' | 'describe' | 'runtime';
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
  /** Whether the file uses Playwright at all: a Playwright import or a call to a test function. */
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
}

function memberName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.property.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;
  return undefined;
}

function chainOf(node: Node): Chain | undefined {
  const path: string[] = [];
  let current = node;
  while (current.type === 'MemberExpression') {
    const name = memberName(current);
    if (name === undefined) return undefined;
    path.unshift(name);
    current = current.object;
  }
  return current.type === 'Identifier' ? { root: current, path } : undefined;
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

function isFunction(node: Node | undefined): node is TSESTree.FunctionLike {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

/** Collects the top-level names that refer to Playwright's `test`. */
function collectTestNames(program: TSESTree.Program, configured: Set<string>): Set<string> {
  const names = new Set(configured);
  const mergeTests = new Set<string>();
  /** Names bound to another test runner, such as `ava` in `import ava from 'ava'`. */
  const others = new Set<string>();
  const isTestExpression = (node: Node): boolean => {
    const target = unwrap(node);
    if (target.type === 'Identifier') return names.has(target.name);
    if (target.type !== 'CallExpression') return false;
    // mergeTests(dbTest, a11yTest)
    if (target.callee.type === 'Identifier') return mergeTests.has(target.callee.name);
    if (target.callee.type !== 'MemberExpression') return false;
    return memberName(target.callee) === 'extend' && isTestExpression(target.callee.object);
  };
  // require('node:test'), ava, ava.serial or `ava as TestFn<Context>`
  const isOtherFramework = (node: Node): boolean => {
    const target = unwrap(node);
    const source = requireSource(target);
    if (source !== undefined) return OTHER_FRAMEWORKS.has(source);
    if (target.type === 'Identifier') return others.has(target.name);
    return target.type === 'MemberExpression' && isOtherFramework(target.object);
  };

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source.value;
      if (OTHER_FRAMEWORKS.has(source)) {
        for (const spec of statement.specifiers) {
          names.delete(spec.local.name);
          others.add(spec.local.name);
        }
      } else if (isPlaywrightModule(source)) {
        for (const spec of statement.specifiers) {
          if (spec.type === 'ImportDefaultSpecifier') names.add(spec.local.name);
          else if (spec.type === 'ImportSpecifier' && importedName(spec) === 'test') names.add(spec.local.name);
          else if (spec.type === 'ImportSpecifier' && importedName(spec) === 'mergeTests')
            mergeTests.add(spec.local.name);
        }
      }
      continue;
    }
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      const init = declarator.init && unwrap(declarator.init);
      if (!init) continue;
      if (declarator.id.type === 'Identifier' && init.type === 'CallExpression' && isTestExpression(init)) {
        names.add(declarator.id.name);
      } else if (declarator.id.type === 'Identifier' && isOtherFramework(init)) {
        // `const test = require('node:test')` is another runner's `test`, like an import from it.
        names.delete(declarator.id.name);
        others.add(declarator.id.name);
      } else if (declarator.id.type === 'ObjectPattern') {
        const source = requireSource(init);
        if (source === undefined) continue;
        for (const prop of declarator.id.properties) {
          if (prop.type !== 'Property' || prop.key.type !== 'Identifier' || prop.value.type !== 'Identifier') continue;
          if (OTHER_FRAMEWORKS.has(source)) {
            names.delete(prop.value.name);
            others.add(prop.value.name);
          } else if (isPlaywrightModule(source) && prop.key.name === 'test') names.add(prop.value.name);
        }
      }
    }
  }
  return names;
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
    if (scope.type === 'module' || scope.type === 'global') return false;
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

function parseMarkers(comment: Comment, states: StateDef[]): Marker[] {
  const markers: Marker[] = [];
  // `//` and `/*` are both two characters, so the comment's value starts two characters in.
  let lineStart = comment.range[0] + 2;
  for (const line of comment.value.split(/\n/)) {
    const match = MARKER_LINE_RE.exec(line.replace(/\r$/, ''));
    const start = lineStart;
    lineStart += line.length + 1;
    if (!match) continue;
    const [, keyword, rest] = match;
    const state = states.find((s) => s.marker === keyword);
    if (state) {
      const restOffset = start + match[0].length - rest.length;
      markers.push({ comment, keyword, state, ...parseTickets(rest, restOffset, state.ticket) });
      continue;
    }
    const caseOf = states.find((s) => s.marker === keyword.toUpperCase());
    if (caseOf) markers.push({ comment, keyword, caseOf, tickets: [] });
  }
  return markers;
}

function scanTags(node: TSESTree.Literal | TSESTree.TemplateLiteral, out: TagOccurrence[]): void {
  const texts =
    node.type === 'Literal'
      ? [String(node.value)]
      : // `cooked` is only null in tagged templates, which are never titles.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- see above
        node.quasis.map((quasi) => quasi.value.cooked!);
  for (const text of texts) {
    for (const match of text.matchAll(TAG_RE)) out.push({ tag: match[0], node });
  }
}

function isStaticText(node: Node): node is TSESTree.StringLiteral | TSESTree.TemplateLiteral {
  return (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral';
}

function collectTags(call: TSESTree.CallExpression, hasTitle: boolean): { tags: TagOccurrence[]; dynamic: boolean } {
  const tags: TagOccurrence[] = [];
  if (!hasTitle) return { tags, dynamic: false };
  const [title, details] = call.arguments;
  const dynamic = !isStaticText(title);
  if (!dynamic) scanTags(title, tags);
  if (call.arguments.length >= 3 && details.type === 'ObjectExpression') {
    for (const prop of details.properties) {
      if (prop.type !== 'Property' || prop.computed) continue;
      const key = prop.key.type === 'Identifier' ? prop.key.name : String((prop.key as TSESTree.Literal).value);
      if (key !== 'tag') continue;
      const values = prop.value.type === 'ArrayExpression' ? prop.value.elements : [prop.value];
      for (const value of values) {
        if (value && isStaticText(value)) scanTags(value, tags);
      }
    }
  }
  return { tags, dynamic };
}

function isUnconditional(call: TSESTree.CallExpression): boolean {
  const first = call.arguments.at(0);
  return (first === undefined || (first.type === 'Literal' && first.value === true)) && !isGuarded(call);
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
  const { states } = options;
  const testNames = collectTestNames(sourceCode.ast, options.testFunctions);
  let usesTest = sourceCode.ast.body.some(
    (statement) => statement.type === 'ImportDeclaration' && isPlaywrightModule(statement.source.value),
  );
  const subjects: Subject[] = [];
  const claimed = new Set<Comment>();
  const stack: Subject[] = [];
  const testInfoNames: string[] = [];
  const keys = sourceCode.visitorKeys as Record<string, readonly string[] | undefined>;

  const makeSubject = (
    kind: Subject['kind'],
    call: TSESTree.CallExpression,
    modifiers: string[],
    tagInfo: { tags: TagOccurrence[]; dynamic: boolean },
    required = true,
  ): Subject => {
    const parent = stack.at(-1);
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
      const matches = state.modifier !== undefined ? modifiers.includes(state.modifier) : ownTags.has(state.tag);
      if (matches) sources.push({ state, required });
    }
    const inherited = new Set<string>();
    const inheritedTags = new Set<string>();
    if (parent && kind !== 'runtime') {
      for (const name of parent.inherited) inherited.add(name);
      for (const source of parent.states) inherited.add(source.state.name);
      for (const tag of parent.inheritedTags) inheritedTags.add(tag);
      for (const tag of parent.tags) inheritedTags.add(tag.tag);
    }
    const ownSkip = modifiers.some((m) => SKIPPING_MODIFIERS.has(m));
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
      skipped: ownSkip || (kind !== 'runtime' && parent?.skipped === true),
      ownSkip,
      markers: block.flatMap((comment) => parseMarkers(comment, states)),
      dynamicTitle: tagInfo.dynamic,
    };
    subjects.push(subject);
    return subject;
  };

  const visitCall = (call: TSESTree.CallExpression): { subject?: Subject; testInfo?: string } => {
    const chain = chainOf(call.callee);
    const args = call.arguments;
    const last = args.at(-1);
    let testInfo: string | undefined;

    if (chain && testNames.has(chain.root.name) && !isLocalVariable(sourceCode, chain.root)) {
      usesTest = true;
      const { path } = chain;
      if (isFunction(last)) {
        const param = last.params.at(1);
        if (param?.type === 'Identifier') testInfo = param.name;
      }
      // The body is usually written inline, but can be a function defined elsewhere:
      // `test.skip('pays', payWithCard)`. A string title tells that apart from `test.skip(cond, 'why')`.
      const titled = args.length >= 2 && isStaticText(args[0]);
      const isDeclaration = args.length >= 2 && !isFunction(args[0]) && (isFunction(last) || titled);
      if (path.every((p) => TEST_MODIFIERS.has(p)) && isDeclaration) {
        return { subject: makeSubject('test', call, path, collectTags(call, true)), testInfo };
      }
      if (
        path[0] === 'describe' &&
        path.slice(1).every((p) => DESCRIBE_MODIFIERS.has(p)) &&
        (isFunction(last) || titled)
      ) {
        const tagInfo = collectTags(call, args.length >= 2);
        return { subject: makeSubject('describe', call, path.slice(1), tagInfo), testInfo };
      }
      if (path.length === 1 && RUNTIME_MODIFIERS.has(path[0])) {
        return { subject: runtimeSubject(call, path[0]), testInfo };
      }
      return { testInfo };
    }

    // testInfo.skip() and test.info().skip()
    if (call.callee.type === 'MemberExpression') {
      const name = memberName(call.callee);
      const object = call.callee.object;
      if (name !== undefined && RUNTIME_MODIFIERS.has(name)) {
        const isTestInfo =
          (object.type === 'Identifier' && testInfoNames.includes(object.name)) ||
          (object.type === 'CallExpression' &&
            (() => {
              const inner = chainOf(object.callee);
              return inner !== undefined && testNames.has(inner.root.name) && inner.path.join('.') === 'info';
            })());
        if (isTestInfo) return { subject: runtimeSubject(call, name) };
      }
    }
    return {};
  };

  const runtimeSubject = (call: TSESTree.CallExpression, modifier: string): Subject | undefined => {
    if (!states.some((s) => s.modifier === modifier)) return undefined;
    const unconditional = isUnconditional(call);
    const subject = makeSubject(
      'runtime',
      call,
      [modifier],
      { tags: [], dynamic: false },
      unconditional || options.requireTicketForConditional,
    );
    subject.skipped = unconditional && SKIPPING_MODIFIERS.has(modifier);
    const parent = subject.parent;
    if (parent) {
      parent.runtimeStates.add(subject.states[0].state.name);
      if (subject.skipped) parent.skipped = true;
    }
    return subject;
  };

  const walk = (node: Node): void => {
    let pushedSubject = false;
    let pushedInfo = false;
    if (node.type === 'CallExpression') {
      const { subject, testInfo } = visitCall(node);
      if (subject && subject.kind !== 'runtime') {
        stack.push(subject);
        pushedSubject = true;
      }
      if (testInfo !== undefined) {
        testInfoNames.push(testInfo);
        pushedInfo = true;
      }
    }
    // Parsers provide visitor keys for every node type they produce; the fallback is only defensive.
    /* node:coverage ignore next */
    for (const key of keys[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) if (item) walk(item as Node);
      } else if (child && typeof (child as Node).type === 'string') {
        walk(child as Node);
      }
    }
    if (pushedSubject) stack.pop();
    if (pushedInfo) testInfoNames.pop();
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
export function isWorkComment(marker: Marker, options: ResolvedOptions): boolean {
  return options.workCommentKeywords.has(marker.keyword.toUpperCase()) && marker.tickets.at(0)?.result !== 'ok';
}

/** Markers in the subject's own block for states that don't apply to it, leaving out work comments. */
export function strayMarkers(subject: Subject, options: ResolvedOptions): StateMarker[] {
  return subject.markers
    .filter(isStateMarker)
    .filter((m) => !appliesTo(subject, m.state.name) && !isWorkComment(m, options));
}

/**
 * Where to report a problem with a test or describe: from the callee to the end of the title
 * (`test.skip('places a limit order'`), so editors underline the declaration rather than the whole body.
 * Runtime calls such as `test.skip()` are short, so they are reported whole.
 */
export function headLoc(subject: Subject): TSESTree.SourceLocation {
  const { node } = subject;
  if (subject.kind === 'runtime') return node.loc;
  const title = node.arguments.length > 1 ? node.arguments[0] : undefined;
  return { start: node.callee.loc.start, end: (title ?? node.callee).loc.end };
}

export function describeSubject(subject: Subject): string {
  if (subject.kind === 'describe') return 'This describe block';
  if (subject.kind === 'runtime') return `This ${subject.states[0].state.modifier} call`;
  return 'This test';
}
