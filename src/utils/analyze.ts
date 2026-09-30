import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { ResolvedOptions, StateDef } from './options.js';
import type { TicketCheck } from './tickets.js';

type Node = TSESTree.Node;
type Comment = TSESTree.Comment;
type SourceCode = Readonly<TSESLint.SourceCode>;

const PLAYWRIGHT_MODULES = new Set(['@playwright/test', 'playwright/test']);
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
  detachedMarkers: Marker[];
}

export type Evaluation =
  | { kind: 'ok' }
  | { kind: 'missing' }
  | { kind: 'case'; marker: Marker }
  | { kind: 'no-ticket'; marker: Marker }
  | { kind: 'bad-ticket'; marker: Marker; ticket: MarkerTicket };

interface Chain {
  root: string;
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
  return current.type === 'Identifier' ? { root: current.name, path } : undefined;
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

/** Collects the local names that refer to Playwright's `test`. */
function collectTestNames(program: TSESTree.Program, configured: Set<string>): Set<string> {
  const names = new Set(configured);
  const isTestExpression = (node: Node): boolean => {
    const target = unwrap(node);
    if (target.type === 'Identifier') return names.has(target.name);
    if (target.type !== 'CallExpression' || target.callee.type !== 'MemberExpression') return false;
    return memberName(target.callee) === 'extend' && isTestExpression(target.callee.object);
  };

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      if (!PLAYWRIGHT_MODULES.has(statement.source.value)) continue;
      for (const spec of statement.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') names.add(spec.local.name);
        else if (spec.type === 'ImportSpecifier' && importedName(spec) === 'test') names.add(spec.local.name);
      }
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      const init = declarator.init && unwrap(declarator.init);
      if (!init) continue;
      if (declarator.id.type === 'Identifier' && init.type === 'CallExpression' && isTestExpression(init)) {
        names.add(declarator.id.name);
      } else if (declarator.id.type === 'ObjectPattern' && isPlaywrightRequire(init)) {
        for (const prop of declarator.id.properties) {
          if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === 'test' && prop.value.type === 'Identifier') {
            names.add(prop.value.name);
          }
        }
      }
    }
  }
  return names;
}

function importedName(spec: TSESTree.ImportSpecifier): string {
  return spec.imported.type === 'Identifier' ? spec.imported.name : String(spec.imported.value);
}

function isPlaywrightRequire(node: Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments[0]?.type === 'Literal' &&
    PLAYWRIGHT_MODULES.has(String(node.arguments[0].value))
  );
}

const STATEMENT_CONTAINERS = new Set(['Program', 'BlockStatement', 'StaticBlock', 'SwitchCase', 'TSModuleBlock']);

/** The statement a call belongs to; its marker block sits above that statement. */
function anchorOf(call: TSESTree.CallExpression): Node {
  let node: Node = call;
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
    if (before && before.loc.end.line === comment.loc.start.line) break;
    block.unshift(comment);
    nextLine = comment.loc.start.line;
  }
  return block;
}

function parseTickets(text: string, state: StateDef): MarkerTicket[] {
  const tickets: MarkerTicket[] = [];
  let rest = text.trim();
  while (rest) {
    const token = /^[^\s,]+/.exec(rest)?.[0];
    if (!token) break;
    const ticket = token.replace(/[.:;]+$/, '');
    tickets.push({ text: ticket, result: state.ticket.check(ticket) });
    rest = rest.slice(token.length);
    const separator = /^\s*,\s*/.exec(rest)?.[0];
    if (!separator) break;
    rest = rest.slice(separator.length);
  }
  return tickets;
}

function parseMarkers(comment: Comment, states: StateDef[]): Marker[] {
  const markers: Marker[] = [];
  for (const line of comment.value.split(/\r?\n/)) {
    const match = MARKER_LINE_RE.exec(line);
    if (!match) continue;
    const [, keyword, rest] = match;
    const state = states.find((s) => s.marker === keyword);
    if (state) {
      markers.push({ comment, keyword, state, tickets: parseTickets(rest, state) });
      continue;
    }
    const caseOf = states.find((s) => s.marker === keyword.toUpperCase());
    if (caseOf) markers.push({ comment, keyword, caseOf, tickets: [] });
  }
  return markers;
}

function scanTags(node: TSESTree.Literal | TSESTree.TemplateLiteral, out: TagOccurrence[]): void {
  const texts =
    node.type === 'Literal' ? [String(node.value)] : node.quasis.map((quasi) => quasi.value.cooked ?? '');
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
  const [first] = call.arguments;
  return first === undefined || (first.type === 'Literal' && first.value === true);
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
    for (const comment of block) claimed.add(comment);
    const ownTags = new Set(tagInfo.tags.map((t) => t.tag));
    const sources: StateSource[] = [];
    for (const state of states) {
      const matches = state.modifier !== undefined ? modifiers.includes(state.modifier) : ownTags.has(state.tag!);
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

    if (chain && testNames.has(chain.root)) {
      const { path } = chain;
      if (isFunction(last)) {
        const param = last.params[1];
        if (param?.type === 'Identifier') testInfo = param.name;
      }
      const isDeclaration = args.length >= 2 && isFunction(last) && !isFunction(args[0]);
      if (path.every((p) => TEST_MODIFIERS.has(p)) && isDeclaration) {
        return { subject: makeSubject('test', call, path, collectTags(call, true)), testInfo };
      }
      if (path[0] === 'describe' && path.slice(1).every((p) => DESCRIBE_MODIFIERS.has(p)) && isFunction(last)) {
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
              return inner !== undefined && testNames.has(inner.root) && inner.path.join('.') === 'info';
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
    .filter((marker) => marker.state !== undefined);

  return { subjects, detachedMarkers };
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
  let firstProblem: Evaluation | undefined;
  for (const marker of markers) {
    const bad = marker.tickets.find((t) => t.result !== 'ok');
    if (marker.tickets.length > 0 && !bad) return { kind: 'ok' };
    firstProblem ??= bad ? { kind: 'bad-ticket', marker, ticket: bad } : { kind: 'no-ticket', marker };
  }
  return firstProblem!;
}

/** Required states on `subject` that have no marker at all (not even a broken one). */
export function missingStates(subject: Subject): StateDef[] {
  return subject.states
    .filter((s) => s.required && evaluate(subject, s.state).kind === 'missing')
    .map((s) => s.state);
}

/** Markers in the subject's own block for states that don't apply to it. */
export function strayMarkers(subject: Subject): Marker[] {
  return subject.markers.filter((m) => m.state !== undefined && !appliesTo(subject, m.state.name));
}

export function describeSubject(subject: Subject): string {
  if (subject.kind === 'describe') return 'This describe block';
  if (subject.kind === 'runtime') return `This ${subject.states[0].state.modifier} call`;
  return 'This test';
}
