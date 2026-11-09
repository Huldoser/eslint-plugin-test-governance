import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import requireTicket from '../../src/rules/require-ticket.ts';
import orphan from '../../src/rules/no-orphaned-marker.ts';
import conflicting from '../../src/rules/consistent-tag-names.ts';
import { runRule, settings } from '../helpers.ts';

runRule('require-ticket (mutation and early-exit controls)', requireTicket, {
  valid: [
    "const { unused, ...rest } = helper; rest.skip('fills', () => {});",
    {
      code: "const T = ['@new']; T.map(read);\n// NEW: PROJ-1\ntest('fills', { tag: T[0] }, () => {});",
      settings: settings({
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    "test('fills', () => { if (a) { if (b) work(); else return; } test.skip(); });",
    "test('fills', () => { if (a) { if (b) work(); } else throw error; test.skip(); });",
  ],
  invalid: [
    {
      code: "const T = { tag: '@new' }; T.tag++; test('fills', { tag: T.tag }, () => {});",
      settings: settings({
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const T = ['@new']; T[method](); test('fills', { tag: T[0] }, () => {});",
      settings: settings({
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      errors: [{ messageId: 'missingMarker' }],
    },
  ],
});

runRule('require-ticket (second bug-hunt boundaries)', requireTicket, {
  valid: [
    { code: "(test.skip, helper)('fills', () => {});", name: 'A sequence ending in a helper is excluded' },
    {
      code: "const { skip: check = it.skip } = helper; check('fills', () => {});",
      name: 'Destructured modifier defaults do not make unrelated objects runners',
      settings: settings({ framework: 'jest' }),
    },
    {
      code: "test.skipIf(false).skipIf(false)('fills', () => {});",
      name: 'Repeated skipIf factories can remain disabled',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test('fills', { skip: false }, () => {});",
      name: 'A literal-false skip option leaves a plain test active',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "const check = test.skipIf(false); check('fills', () => {});",
      name: 'A skipIf factory alias retains a false condition',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test('fills', () => { if (a) { if (b) return; } test.skip(); });",
      name: 'Nested conditional returns guard a later skip',
    },
    {
      code: "test('fills', () => { if (a) { if (b) throw error; } test.skip(); });",
      name: 'Nested conditional throws guard a later skip',
    },
    {
      code: "test('fills', () => { do { if (a) continue; test.skip(); } while (b); });",
      name: 'Conditional continue guards the remaining loop body',
    },
    {
      code: "test('fills', () => { while (true) { if (a) break; test.skip(); } });",
      name: 'Conditional break guards the remaining loop body',
    },
    {
      code: 'function f(jest) { jest.retryTimes(2); }',
      name: 'A local shadow of the Jest object is excluded',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'let retry = jest.retryTimes; retry = helper; retry(2);',
      name: 'A reassigned retry method alias is excluded',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: "import { jest as runner } from '@jest/globals'; runner.retryTimes(0);",
      name: 'Zero retries through a named Jest alias remain disabled',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: "import * as globals from 'helper'; globals.jest.retryTimes(2);",
      name: 'A non-Jest namespace named globals is excluded',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'test(`${1}@new`, () => {});',
      name: 'A numeric interpolation adjacent to a tag prevents its word boundary',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: 'test(`${true}@new`, () => {});',
      name: 'A boolean interpolation adjacent to a tag prevents its word boundary',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: 'test(`${null}@new`, () => {});',
      name: 'A null interpolation adjacent to a tag prevents its word boundary',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: 'test(`fills @new${1}`, () => {});',
      name: 'A numeric suffix makes a different state tag',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "test.skip('fills', { meta: { ['__proto__']: 'PROJ-1' } }, () => {});",
      name: 'A computed prototype-named metadata key supplies a ticket',
      settings: settings({ framework: 'vitest', annotations: { type: '__proto__' } }),
    },
    {
      code: "const ID = 'PROJ-1'; test.skip('fills', { meta: { ['issue']: ID } }, () => {});",
      name: 'A metadata ticket alias is read with its computed key',
      settings: settings({ framework: 'vitest' }),
    },
  ],
  invalid: [
    {
      code: "const T = { tag: '@new' }; T.tag = '@smoke'; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'A written object member is not its initializer',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = ['@new']; T[0] = '@smoke'; test('fills', { tag: T[0] }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'An updated array slot is unread',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { tag: '@new' }; delete T.tag; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'Deleting a property invalidates its original text',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { tag: '@new' }; const A = T; A.tag = '@smoke'; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'Mutating through a constant alias invalidates shared text',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = ['@new', '@smoke']; T.shift(); test('fills', { tag: T[0] }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'An array shift invalidates its first tag',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { tag: '@new' }; log(T.tag); test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'Reading a property has no mutation effect',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { tag: '@new' }; function f(T) { T.tag = '@smoke'; } test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A shadowed object mutation leaves the outer constant usable',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { tag: '@new', ...other }; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'An unknown spread cannot prove an earlier object value',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { ...other, tag: '@new' }; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A later explicit property wins over an opaque spread',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const WHY = 'sandbox unavailable'; test('fills', ctx => { ctx.skip(WHY); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A constant Vitest skip note still requires a ticket',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "const WHY = ''; test('fills', ctx => { ctx.skip(WHY); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A constant empty Vitest skip note is still unconditional',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: 'test("fills", ctx => { ctx.skip(`sandbox ${platform}`); });',
      errors: [{ messageId: 'missingMarker' }],
      name: 'A dynamic template note skips unconditionally',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "(0, test.skip)('fills', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A sequence callee uses its final runner function',
    },
    {
      code: "describe('suite', () => { const { skip: check = helper } = it; check('fills', () => {}); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A local destructured modifier with a default retains its binding',
      settings: settings({ framework: 'jest' }),
    },
    {
      code: "test.skipIf(false).skipIf(true)('fills', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'Repeated skipIf factories retain the final condition',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test.runIf(true).runIf(false)('fills', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'Repeated runIf factories retain the final false condition',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test.skipIf(true).skip('fills', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A true skipIf followed by skip remains skipped',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test.skipIf(true).each([[1]])('fills %s', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A parameterized conditional skip retains its table condition',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test.skip('fills', { skip: undefined }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'An undefined skip option does not erase the skip chain',
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test('fills', () => { switch (a) { case 1: break; } test.skip(); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A break from a nested switch does not guard following code',
    },
    {
      code: "test('fills', () => { const f = () => { if (a) return; }; test.skip(); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'An inner function return does not guard the outer skip',
    },
    {
      code: "test('fills', () => { test.skip() && work(); });",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A logical left operand always evaluates its skip',
    },
    {
      code: "const { jest: runner } = require('@jest/globals'); runner.retryTimes(2);",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A destructured CommonJS Jest object configures retries',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'const retry = jest.retryTimes; retry(2);',
      errors: [{ messageId: 'missingMarker' }],
      name: 'A local retryTimes alias configures retries',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'const retry = jest.retryTimes.bind(jest, 2); retry();',
      errors: [{ messageId: 'missingMarker' }],
      name: 'A bound retryTimes alias configures retries',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: "const globals = require('@jest/globals'); globals.jest.retryTimes(2);",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A CommonJS namespace Jest object configures retries',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'const first = jest; const second = first; second.retryTimes(2);',
      errors: [{ messageId: 'missingMarker' }],
      name: 'A local stable Jest object copy configures retries',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      code: 'test(`fills ${"@new"}.`, () => {});',
      errors: [{ messageId: 'missingMarker' }],
      name: 'A static template tag followed by punctuation retains its boundary',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { __proto__: '@new' }; test('fills', { tag: T.__proto__ }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'An object prototype setter is not an own tag property',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { ['__proto__']: '@new' }; test('fills', { tag: T.__proto__ }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A computed prototype-named property remains an own tag value',
      settings: settings({
        framework: 'playwright',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = { get tag() { throw Error(); } }; test('fills', { tag: T.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'A getter is unread without executing user code',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "const T = ['@new']; test('fills', { tag: T[-1] }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
      name: 'An array negative index is unread',
      settings: settings({
        framework: 'playwright',
        reportUnreadableTags: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "test.skip('fills', { meta: { __proto__: 'PROJ-1' } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'A prototype setter does not supply a Vitest metadata ticket',
      settings: settings({ framework: 'vitest', annotations: { type: '__proto__' } }),
    },
  ],
});
runRule('no-orphaned-marker (second bug-hunt boundaries)', orphan, {
  valid: [
    {
      code: "import { test } from 'node:test';\n// SKIP: PROJ-1\ntest('outer', t => { t.test('inner', inner => { t.skip(); }); });",
      name: 'An outer context skip inside a subtest belongs to the outer marker',
      settings: settings({ framework: 'node-test' }),
    },
    {
      code: "import { test } from 'node:test';\n// SKIP: PROJ-1\ntest('outer', t => { const outer = t; t.test('inner', inner => { outer.skip(); }); });",
      name: 'An aliased outer context still owns its nested skip',
      settings: settings({ framework: 'node-test' }),
    },
    {
      code: "import { test } from 'node:test';\n// SKIP: PROJ-1\ntest('outer', t => { const skip = t.skip.bind(t); t.test('inner', inner => { skip(); }); });",
      name: 'A bound outer skip retains its owner',
      settings: settings({ framework: 'node-test' }),
    },
  ],
  invalid: [],
});
runRule('consistent-tag-names (second bug-hunt boundaries)', conflicting, {
  valid: [
    {
      code: "import { test } from 'node:test'; test('outer', t => { t.test('inner @new', inner => { t.skip(); }); });",
      name: 'Skipping the outer context leaves a new child runnable',
      settings: settings({
        framework: 'node-test',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
    {
      code: "test('fills @new', { todo: true }, () => {});",
      name: 'Node todo runs a new test rather than skipping it',
      settings: settings({
        framework: 'node-test',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },

    // Custom tags do not impose lifecycle conflicts.
    {
      code: "import { test } from 'node:test'; test('outer @new', t => { t.test('inner', inner => { inner.skip(); }); });",
      name: 'A custom tag inherited by a child permits its skip',
      settings: settings({
        framework: 'node-test',
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
    },
  ],
  invalid: [],
});
new RuleTester({ languageOptions: { parser: tsParser }, settings: settings({ framework: 'playwright' }) }).run(
  'require-ticket (additional TypeScript boundaries)',
  requireTicket as never,
  {
    valid: [],
    invalid: [
      {
        code: "(<any>test.skip)('fills', () => {});",
        errors: [{ messageId: 'missingMarker', line: 1, column: 2, endLine: 1, endColumn: 25 }],
        name: 'Angle-bracket assertions preserve skipped callees',
      },
      {
        code: "const check = test.skip<string>; check('fills', () => {});",
        errors: [{ messageId: 'missingMarker', line: 1, column: 34, endLine: 1, endColumn: 47 }],
        name: 'Type instantiation preserves a skipped callee',
      },
    ],
  },
);
