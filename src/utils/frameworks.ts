import type { BuiltinStateName, FrameworkName } from './constants.ts';

/** A state a test enters through its own code, as opposed to a tag. */
export type Modifier = 'skip' | 'fixme' | 'fail' | 'slow' | 'todo';

/**
 * What a name from a framework stands for: `xit` is a test with `skip`, `suite` a describe block, and
 * Vitest's `beforeEach` a hook whose callback gets the test context.
 */
export interface Root {
  kind: 'test' | 'describe' | 'hook';
  modifiers: readonly string[];
  /** Set for a hook whose body gets no test context, as node:test's `before` in a describe. */
  noContext?: true;
}

/**
 * The state a member puts a test in. A member called with a condition, like Vitest's `skipIf(...)`, puts it
 * in that state only when the condition is `when`: `skipIf(true)` always skips, `skipIf(false)` never does,
 * and `skipIf(isMobile)` sometimes does.
 */
interface Effect {
  modifier: Modifier;
  when?: boolean;
}

/** How a test framework declares tests and puts them in states. */
export interface Framework {
  name: FrameworkName;
  /** Whether `source` is one of the framework's own modules. */
  ownsModule(source: string): boolean;
  /** Test functions the framework's modules export, by exported name. */
  exports: ReadonlyMap<string, Root>;
  /** What a default import from the framework's module is. */
  defaultExport?: Root;
  /**
   * Whether the module itself is its default export with the other functions as members, as
   * `require('node:test')`, which is `test` and has `test.describe`.
   */
  moduleIsDefault: boolean;
  /** Test functions that exist without an import, besides `testFunctions`. */
  globals: ReadonlyMap<string, Root>;
  /** The default `testFunctions`. */
  testFunctions: readonly string[];
  /**
   * Members a test or describe call may have, as in `test.skip(...)`. A member that is called to build
   * the function, as in `test.each(table)('buys %s', fn)`, is written with parentheses: `each()`.
   */
  testMembers: ReadonlySet<string>;
  describeMembers: ReadonlySet<string>;
  /** Members that are called to build the function that declares the tests. */
  factories: ReadonlySet<string>;
  /** The state each member puts a test in. */
  effects: ReadonlyMap<string, Effect>;
  /** Keys of an options object that put a test in a state, as in Vitest's `{ skip: true }`. */
  optionEffects: ReadonlyMap<string, Modifier>;
  /**
   * Whether an option counts whatever its value, unless it is `false` or `undefined`, as node:test's
   * `{ skip: 'reason' }`. Otherwise only `true` always counts and other values are conditions.
   */
  anyOptionValue: boolean;
  /**
   * States a test is in only one of: the first that always applies, as node:test reports a skipped todo
   * test as skipped only. A state that applies only sometimes leaves the later ones for the other runs.
   */
  exclusiveStates: readonly Modifier[];
  /**
   * Whether the title can be left out, as node:test's `test(fn)` and `test({ skip: true }, fn)`, and an
   * options object then comes first.
   */
  optionalTitle: boolean;
  /** The key of the details or options object that holds tags. */
  tagKey?: string;
  /** Whether that key holds names without their `@`, as Vitest's `tags: ['flaky']`, which stand for `@flaky`. */
  plainTags: boolean;
  /**
   * The parameter of a test's body that can change its state at runtime, such as Playwright's
   * `testInfo` or Vitest's test context, and the methods it has for that.
   */
  info?: { param: number; methods: ReadonlySet<string> };
  /** Whether that parameter declares subtests with `t.test(...)`, as in node:test. */
  subtests: boolean;
  /** Whether `skip` with only a title declares a skipped test or describe, as Vitest's `test.skip('title')`. */
  skipWithoutBody: boolean;
  /**
   * Whether a runtime skip with only text always skips, the text being a note, as Vitest's
   * `context.skip('why')`. In Playwright the first argument is always a condition.
   */
  skipNotes: boolean;
  /**
   * The methods a test or hook written as a `function` can change its state with at runtime through `this`,
   * as Mocha's `this.skip()`. Empty when `this` can't.
   */
  thisMethods: ReadonlySet<string>;
  /** Whether a test with only a title written out is a todo, as Mocha's pending `it('title')`. */
  todoWithoutBody: boolean;
  /** Built-in states a test can be put in with this framework. */
  states: ReadonlySet<BuiltinStateName>;
  /** Playwright's own API on `test`: `test.describe`, `test.step`, `test.info()` and runtime `test.skip()`. */
  playwright: boolean;
}

const TEST: Root = { kind: 'test', modifiers: [] };
const DESCRIBE: Root = { kind: 'describe', modifiers: [] };
const HOOK: Root = { kind: 'hook', modifiers: [] };

const PLAYWRIGHT_MODULES = new Set(['@playwright/test', 'playwright/test']);
/** Test runners besides Playwright. A name imported from one of them belongs to that runner. */
const OTHER_RUNNERS = new Set(['vitest', '@jest/globals', 'node:test', 'bun:test', 'mocha', 'ava', 'tap', 'uvu']);

/** `@playwright/test` and the component-testing packages such as `@playwright/experimental-ct-react`. */
function isPlaywrightModule(source: string): boolean {
  return PLAYWRIGHT_MODULES.has(source) || source.startsWith('@playwright/experimental-ct-');
}

/** Methods on `testInfo` and on `test` itself that change a test's state at runtime. */
export const RUNTIME_MODIFIERS: ReadonlySet<string> = new Set(['skip', 'fixme', 'fail', 'slow']);

const effects = (entries: [string, Modifier, boolean?][]): ReadonlyMap<string, Effect> =>
  new Map(entries.map(([member, modifier, when]) => [member, { modifier, when }]));

const playwright: Framework = {
  name: 'playwright',
  ownsModule: isPlaywrightModule,
  exports: new Map([['test', TEST]]),
  defaultExport: TEST,
  moduleIsDefault: false,
  globals: new Map(),
  testFunctions: ['test'],
  testMembers: new Set(['only', 'skip', 'fixme', 'fail']),
  describeMembers: new Set(['only', 'skip', 'fixme', 'serial', 'parallel']),
  factories: new Set(),
  effects: effects([
    ['skip', 'skip'],
    ['fixme', 'fixme'],
    ['fail', 'fail'],
  ]),
  optionEffects: new Map(),
  anyOptionValue: false,
  exclusiveStates: [],
  optionalTitle: false,
  tagKey: 'tag',
  plainTags: false,
  info: { param: 1, methods: RUNTIME_MODIFIERS },
  subtests: false,
  skipWithoutBody: false,
  skipNotes: false,
  thisMethods: new Set(),
  todoWithoutBody: false,
  states: new Set(['skip', 'fixme', 'fail', 'slow', 'new', 'quarantined']),
  playwright: true,
};

const JEST_FUNCTIONS = new Map<string, Root>([
  ['test', TEST],
  ['it', TEST],
  ['xtest', { kind: 'test', modifiers: ['skip'] }],
  ['xit', { kind: 'test', modifiers: ['skip'] }],
  ['fit', { kind: 'test', modifiers: ['only'] }],
  ['describe', DESCRIBE],
  ['xdescribe', { kind: 'describe', modifiers: ['skip'] }],
  ['fdescribe', { kind: 'describe', modifiers: ['only'] }],
]);

const jest: Framework = {
  name: 'jest',
  ownsModule: (source) => source === '@jest/globals',
  exports: JEST_FUNCTIONS,
  moduleIsDefault: false,
  globals: new Map([...JEST_FUNCTIONS].filter(([name]) => name !== 'test' && name !== 'it')),
  testFunctions: ['test', 'it'],
  testMembers: new Set(['only', 'skip', 'todo', 'failing', 'concurrent', 'each()']),
  describeMembers: new Set(['only', 'skip', 'each()']),
  factories: new Set(['each']),
  effects: effects([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['failing', 'fail'],
  ]),
  optionEffects: new Map(),
  anyOptionValue: false,
  exclusiveStates: [],
  optionalTitle: false,
  plainTags: false,
  subtests: false,
  skipWithoutBody: false,
  skipNotes: false,
  thisMethods: new Set(),
  todoWithoutBody: false,
  states: new Set(['skip', 'todo', 'fail', 'new', 'quarantined']),
  playwright: false,
};

const VITEST_FACTORIES = ['each()', 'for()', 'skipIf()', 'runIf()'];

const vitest: Framework = {
  name: 'vitest',
  ownsModule: (source) => source === 'vitest',
  exports: new Map([
    ['test', TEST],
    ['it', TEST],
    ['describe', DESCRIBE],
    ['suite', DESCRIBE],
    ['beforeEach', HOOK],
  ]),
  moduleIsDefault: false,
  globals: new Map([
    ['describe', DESCRIBE],
    ['suite', DESCRIBE],
    ['beforeEach', HOOK],
  ]),
  testFunctions: ['test', 'it'],
  testMembers: new Set(['only', 'skip', 'todo', 'fails', 'concurrent', 'sequential', ...VITEST_FACTORIES]),
  describeMembers: new Set(['only', 'skip', 'todo', 'concurrent', 'sequential', 'shuffle', ...VITEST_FACTORIES]),
  factories: new Set(['each', 'for', 'skipIf', 'runIf']),
  effects: effects([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['fails', 'fail'],
    ['skipIf()', 'skip', true],
    ['runIf()', 'skip', false],
  ]),
  optionEffects: new Map([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['fails', 'fail'],
  ]),
  anyOptionValue: false,
  exclusiveStates: [],
  optionalTitle: false,
  tagKey: 'tags',
  plainTags: true,
  info: { param: 0, methods: new Set(['skip']) },
  subtests: false,
  skipWithoutBody: true,
  skipNotes: true,
  thisMethods: new Set(),
  todoWithoutBody: false,
  states: new Set(['skip', 'todo', 'fail', 'new', 'quarantined']),
  playwright: false,
};

const SKIPPED_TEST: Root = { kind: 'test', modifiers: ['skip'] };
const SKIPPED_DESCRIBE: Root = { kind: 'describe', modifiers: ['skip'] };

/** What the `mocha` module exports, the BDD and TDD names alike. `context` and `specify` are only globals. */
const MOCHA_EXPORTS = new Map<string, Root>([
  ['it', TEST],
  ['test', TEST],
  ['xit', SKIPPED_TEST],
  ['describe', DESCRIBE],
  ['suite', DESCRIBE],
  ['xdescribe', SKIPPED_DESCRIBE],
  ...['before', 'beforeEach', 'after', 'afterEach', 'suiteSetup', 'setup', 'suiteTeardown', 'teardown'].map(
    (name): [string, Root] => [name, HOOK],
  ),
]);

/** Mocha, and Cypress and WebdriverIO, which run their tests on Mocha. */
const mocha: Omit<Framework, 'name'> = {
  ownsModule: (source) => source === 'mocha',
  exports: MOCHA_EXPORTS,
  moduleIsDefault: false,
  globals: new Map([
    ...[...MOCHA_EXPORTS].filter(([name]) => name !== 'it' && name !== 'test'),
    ['context', DESCRIBE],
    ['xcontext', SKIPPED_DESCRIBE],
    ['xspecify', SKIPPED_TEST],
  ]),
  testFunctions: ['it', 'specify', 'test'],
  testMembers: new Set(['only', 'skip']),
  describeMembers: new Set(['only', 'skip']),
  factories: new Set(),
  effects: effects([['skip', 'skip']]),
  // Cypress's `{ browser: '!webkit' }` runs the test only in some browsers.
  optionEffects: new Map([['browser', 'skip']]),
  anyOptionValue: false,
  exclusiveStates: [],
  optionalTitle: false,
  // @cypress/grep's `{ tags: '@smoke' }`, written with the `@`.
  tagKey: 'tags',
  plainTags: false,
  subtests: false,
  skipWithoutBody: true,
  skipNotes: false,
  thisMethods: new Set(['skip']),
  todoWithoutBody: true,
  states: new Set(['skip', 'todo', 'new', 'quarantined']),
  playwright: false,
};

const NODE_TEST_MEMBERS = new Set(['only', 'skip', 'todo', 'expectFailure']);
/** What a test's context can do to it, as `t.skip()`, or as `this.skip()` in a `function`. */
const NODE_TEST_CONTEXT = new Set(['skip', 'todo']);

/**
 * Node's built-in runner. `test` and `it` are one function, as are `describe` and `suite`, and the state
 * members are exported by name too. Only `beforeEach` and `afterEach` get the test's context, as a test
 * does: as their first parameter, and as `this` when written as a `function`. `before`, `after` and the
 * describe itself get the suite's, which can't skip.
 */
const nodeTest: Framework = {
  name: 'node-test',
  ownsModule: (source) => source === 'node:test',
  exports: new Map([
    ['test', TEST],
    ['it', TEST],
    ['describe', DESCRIBE],
    ['suite', DESCRIBE],
    ...[...NODE_TEST_MEMBERS].map((member): [string, Root] => [member, { kind: 'test', modifiers: [member] }]),
    ['before', { kind: 'hook', modifiers: [], noContext: true }],
    ['after', { kind: 'hook', modifiers: [], noContext: true }],
    ['beforeEach', HOOK],
    ['afterEach', HOOK],
  ]),
  defaultExport: TEST,
  moduleIsDefault: true,
  globals: new Map(),
  testFunctions: ['test', 'it'],
  testMembers: NODE_TEST_MEMBERS,
  describeMembers: NODE_TEST_MEMBERS,
  factories: new Set(),
  effects: effects([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['expectFailure', 'fail'],
  ]),
  optionEffects: new Map([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['expectFailure', 'fail'],
  ]),
  anyOptionValue: true,
  exclusiveStates: ['skip', 'todo', 'fail'],
  optionalTitle: true,
  plainTags: false,
  info: { param: 0, methods: NODE_TEST_CONTEXT },
  subtests: true,
  skipWithoutBody: true,
  // `t.skip('why')` takes a message, not a condition.
  skipNotes: true,
  thisMethods: NODE_TEST_CONTEXT,
  todoWithoutBody: false,
  states: new Set(['skip', 'todo', 'fail', 'new', 'quarantined']),
  playwright: false,
};

export const FRAMEWORKS: Record<FrameworkName, Framework> = {
  playwright,
  jest,
  vitest,
  mocha: { name: 'mocha', ...mocha },
  cypress: { name: 'cypress', ...mocha },
  webdriverio: { name: 'webdriverio', ...mocha },
  'node-test': nodeTest,
};

/** Whether `source` belongs to a test runner other than `framework`, so its names are never tests here. */
export function isOtherRunner(framework: Framework, source: string): boolean {
  return (isPlaywrightModule(source) || OTHER_RUNNERS.has(source)) && !framework.ownsModule(source);
}
