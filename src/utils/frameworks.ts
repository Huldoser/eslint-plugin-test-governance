import type { BuiltinStateName, FrameworkName } from './constants.ts';

/** A state a test enters through its own code, as opposed to a tag. */
export type Modifier = 'skip' | 'fixme' | 'fail' | 'slow' | 'todo';

/** What a name from a framework stands for: `xit` is a test with `skip`, `suite` a describe block. */
export interface Root {
  kind: 'test' | 'describe';
  modifiers: readonly string[];
}

/** The state a member puts a test in. A conditional one, like Vitest's `skipIf(...)`, may not apply. */
interface Effect {
  modifier: Modifier;
  conditional: boolean;
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
  /** The key of the details or options object that holds tags. */
  tagKey?: string;
  /**
   * The parameter of a test's body that can change its state at runtime, such as Playwright's
   * `testInfo` or Vitest's test context, and the methods it has for that.
   */
  info?: { param: number; methods: ReadonlySet<string> };
  /** Built-in states a test can be put in with this framework. */
  states: ReadonlySet<BuiltinStateName>;
  /** Playwright's own API on `test`: `test.describe`, `test.step`, `test.info()` and runtime `test.skip()`. */
  playwright: boolean;
}

const TEST: Root = { kind: 'test', modifiers: [] };
const DESCRIBE: Root = { kind: 'describe', modifiers: [] };

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
  new Map(entries.map(([member, modifier, conditional = false]) => [member, { modifier, conditional }]));

const playwright: Framework = {
  name: 'playwright',
  ownsModule: isPlaywrightModule,
  exports: new Map([['test', TEST]]),
  defaultExport: TEST,
  globals: new Map(),
  testFunctions: ['test'],
  testMembers: new Set(['only', 'skip', 'fixme', 'fail', 'slow']),
  describeMembers: new Set(['only', 'skip', 'fixme', 'serial', 'parallel']),
  factories: new Set(),
  effects: effects([
    ['skip', 'skip'],
    ['fixme', 'fixme'],
    ['fail', 'fail'],
    ['slow', 'slow'],
  ]),
  optionEffects: new Map(),
  tagKey: 'tag',
  info: { param: 1, methods: RUNTIME_MODIFIERS },
  states: new Set(['skip', 'fixme', 'fail', 'slow', 'new', 'unstable']),
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
  states: new Set(['skip', 'todo', 'fail', 'new', 'unstable']),
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
  ]),
  globals: new Map([
    ['describe', DESCRIBE],
    ['suite', DESCRIBE],
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
    ['runIf()', 'skip', true],
  ]),
  optionEffects: new Map([
    ['skip', 'skip'],
    ['todo', 'todo'],
    ['fails', 'fail'],
  ]),
  tagKey: 'tags',
  info: { param: 0, methods: new Set(['skip']) },
  states: new Set(['skip', 'todo', 'fail', 'new', 'unstable']),
  playwright: false,
};

export const FRAMEWORKS: Record<FrameworkName, Framework> = { playwright, jest, vitest };

/** Whether `source` belongs to a test runner other than `framework`, so its names are never tests here. */
export function isOtherRunner(framework: Framework, source: string): boolean {
  return (isPlaywrightModule(source) || OTHER_RUNNERS.has(source)) && !framework.ownsModule(source);
}
