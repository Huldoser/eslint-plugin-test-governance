import requireTicket from '../../src/rules/require-ticket.ts';
import commented from '../../src/rules/require-ticket-for-commented-out-tests.ts';
import orphan from '../../src/rules/no-orphaned-marker.ts';
import matching from '../../src/rules/marker-matches-state.ts';
import { runRule, settings } from '../helpers.ts';

runRule('require-ticket (alias, flow and annotation boundaries)', requireTicket, {
  valid: [
    {
      name: 'reassigned namespace aliases do not turn a helper copy into a runner module',
      code: "import * as pw from '@playwright/test'; let ns = pw; ns = helper; const copy = ns; copy.test.skip('fills', () => {});",
    },
    {
      name: 'unfinished cyclic destructured aliases do not recurse',
      code: "const { skip: check } = check; check('fills', () => {});",
      settings: settings({ framework: 'jest' }),
    },
    {
      name: 'unfinished cyclic Jest object aliases do not recurse',
      code: 'const first = second; const second = first; first.retryTimes(2);',
      settings: settings({ framework: 'jest', states: { retry: true } }),
    },
    {
      name: 'binding an unrelated helper does not turn it into a context method',
      code: "import { test } from 'node:test'; test('fills', t => { const skip = helper.bind(null); skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'a rest pattern alone does not expose a prototype context method',
      code: "import { test } from 'node:test'; test('fills', ({ ...rest }) => { rest.skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'for-in and for-of bodies only skip when an iteration exists',
      code: "test('fills', () => { for (const key in flags) test.skip(); for (const row of rows) test.skip(); });",
    },
    {
      name: 'a bound false Vitest condition does not skip',
      code: "test('fills', ctx => { const skip = ctx.skip.bind(ctx, false); skip(); });",
      settings: settings({ framework: 'vitest', requireReasonForConditional: true }),
    },
    {
      name: 'a bound skip under a logical guard remains conditional',
      code: "test('fills', ctx => { const skip = ctx.skip.bind(ctx, true); enabled && skip(); });",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'rendered template boundaries distinguish an email from a state tag',
      code: 'test(`fills ${"desk"}@new`, () => {}); test(`fills ${"@new"}er`, () => {});',
      settings: settings({ lifecycleTags: true }),
    },
    {
      name: 'Reassigning an alias to a helper stops it being a test',
      code: "let check = it.skip; check = helper; check('fills', () => {});",
      settings: settings({ framework: 'jest' }),
    },
    {
      name: 'An early return inside an unconditional nested block guards later calls',
      code: "test('fills', () => { { if (!enabled) return; } test.skip(); });",
      settings: settings({ framework: 'playwright' }),
    },
    {
      name: 'A while-loop condition guards a runtime skip',
      code: "test('fills', () => { while (enabled) { test.skip(); break; } });",
      settings: settings({ framework: 'playwright' }),
    },
    {
      name: 'A for-loop condition guards a runtime skip',
      code: "test('fills', () => { for (let i = 0; i < count; i++) { test.skip(); } });",
      settings: settings({ framework: 'playwright' }),
    },
    {
      name: 'An unread computed member can override an earlier tag constant',
      code: "const TAGS = { NEW: '@new', [key]: '@smoke' }; test('fills', { tag: TAGS.NEW }, () => {});",
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      name: 'An alias of an annotation object keeps its ticket',
      code: "const A = { type: 'issue', description: 'PROJ-1' }; const B = A; test.skip('fills', { annotation: B }, () => {});",
      settings: settings({ framework: 'playwright' }),
    },
    {
      name: 'An alias of annotation ticket text keeps its value',
      code: "const ID = 'PROJ-1'; const TICKET = ID; test.skip('fills', { annotation: { type: 'issue', description: TICKET } }, () => {});",
      settings: settings({ framework: 'playwright' }),
    },
  ],
  invalid: [
    {
      name: 'literal-true loop conditions do not make skips conditional',
      code: "test('one', () => { while (true) { test.skip(); break; } }); test('two', () => { for (; true;) { test.skip(); break; } });",
      errors: [{ messageId: 'missingMarker' }, { messageId: 'missingMarker' }],
    },
    {
      name: 'a bound title retains a valid diagnostic range at its alias call',
      code: "const check = it.skip.bind(null, 'fills');\ncheck(() => {});",
      settings: settings({ framework: 'jest' }),
      errors: [{ messageId: 'missingMarker', line: 2, column: 1, endLine: 2, endColumn: 6 }],
    },
    {
      name: 'a split template state tag is recognized from rendered text',
      code: 'test(`fills @${"new"}`, () => {});',
      settings: settings({ lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'a plain template tag is one value even with interpolations',
      code: 'test("fills", { tags: [`${"new"}`] }, () => {});',
      settings: settings({ framework: 'vitest', lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'inline object and array constants retain their state tags',
      code: "test('one', { tag: ({ NEW: '@new' }).NEW }, () => {}); test('two', { tag: ['@new'][0] }, () => {});",
      settings: settings({ lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }, { messageId: 'missingMarker' }],
    },
    {
      name: 'cyclic template definitions remain unread instead of overflowing',
      code: 'const TAG = `${TAG}`; test("fills", { tag: TAG }, () => {});',
      settings: settings({ lifecycleTags: true, reportUnreadableTags: true }),
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      name: 'cyclic interpolated title definitions are reported as unread',
      code: 'const TAG = `${TAG}`; test(`fills ${TAG}`, () => {});',
      settings: settings({ lifecycleTags: true, reportUnreadableTags: true }),
      errors: [{ messageId: 'dynamicTitle' }],
    },
    {
      name: 'Whole-module aliases retain test exports',
      code: "import * as pw from '@playwright/test'; const ns = pw; ns.test.skip('fills', () => {});",
      settings: settings({ framework: 'playwright' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Destructuring a namespace retains renamed test exports',
      code: "import * as pw from '@playwright/test'; const { test: check } = pw; check.skip('fills', () => {});",
      settings: settings({ framework: 'playwright' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Destructured local state aliases inside describes are checked',
      code: "describe('orders', () => { const { skip: check } = it; check('fills', () => {}); });",
      settings: settings({ framework: 'jest' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A locally bound test alias retains skip state',
      code: "const check = it.skip.bind(null); check('fills', () => {});",
      settings: settings({ framework: 'jest' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Nested conditional test selections retain possible skips',
      code: "(a ? it.skip : b ? it.skip : it)('fills', () => {});",
      settings: settings({ framework: 'jest', requireTicketForConditional: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A second alias of a context method retains skip state',
      code: "import { test } from 'node:test'; test('fills', t => { const s = t.skip; const again = s; again(); });",
      settings: settings({ framework: 'node-test' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A bound context method retains skip state',
      code: "import { test } from 'node:test'; test('fills', t => { const s = t.skip.bind(t); s(); });",
      settings: settings({ framework: 'node-test' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Multiple aliases of a context retain its runtime methods',
      code: "import { test } from 'node:test'; test('fills', t => { const one = t; const two = one; two.skip(); });",
      settings: settings({ framework: 'node-test' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A default value on a context parameter does not hide it',
      code: "import { test } from 'node:test'; test('fills', (t = {}) => { t.skip(); });",
      settings: settings({ framework: 'node-test' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A default value on a destructured context method does not hide it',
      code: "import { test } from 'node:test'; test('fills', ({ skip = helper }) => { skip(); });",
      settings: settings({ framework: 'node-test' }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Jest retry configuration is recognized through a renamed import',
      code: "import { jest as runner } from '@jest/globals'; runner.retryTimes(2); it('fills', () => {});",
      settings: settings({ framework: 'jest', states: { retry: true } }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Jest retry configuration is recognized through a namespace import',
      code: "import * as globals from '@jest/globals'; globals.jest.retryTimes(2); globals.it('fills', () => {});",
      settings: settings({ framework: 'jest', states: { retry: true } }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A picked Mocha describe still supplies the suite receiver for retries',
      code: "(enabled ? describe : describe.skip)('orders', function () { this.retries(2); it('fills', () => {}); });",
      settings: settings({ framework: 'mocha', states: { retry: true } }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Object aliases retain constant tag members',
      code: "const BASE = { NEW: '@new' }; const TAGS = BASE; test('fills', { tag: TAGS.NEW }, () => {});",
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Literal text interpolated into a title contributes its tag',
      code: 'test(`fills ${"@new"}`, () => {});',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Nested template text contributes its tag',
      code: 'const TAG = "@new"; test(`fills ${`${TAG}`}`, () => {});',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'A plain Vitest tag written as a static template is recognized',
      code: 'test("fills", { tags: [`new`] }, () => {});',
      settings: settings({ framework: 'vitest', lifecycleTags: true }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      name: 'Annotation-only mode still validates every supplied issue ticket',
      code: "test.skip('fills', { annotation: [{ type: 'issue', description: 'PROJ-1' }, { type: 'issue', description: 'TBD' }] }, () => {});",
      settings: settings({ framework: 'playwright', annotations: { only: true } }),
      errors: [{ messageId: 'invalidAnnotation' }],
    },
    {
      name: 'Moving a ticket escapes line breaks in annotation type strings',
      code: "// SKIP: PROJ-1\ntest.skip('fills', () => {});",
      settings: settings({ framework: 'playwright', annotations: { only: true, type: 'issue\ntracker' } }),
      errors: [
        {
          messageId: 'useAnnotation',
          suggestions: [
            {
              messageId: 'moveToAnnotation',
              output:
                "test.skip('fills', { annotation: { type: 'issue\\ntracker', description: 'PROJ-1' } }, () => {});",
            },
          ],
        },
      ],
    },
  ],
});

runRule('require-ticket-for-commented-out-tests (alias, flow and annotation boundaries)', commented, {
  valid: [],
  invalid: [
    {
      name: 'Commented tests recognize renamed imports from the runner',
      code: "import { it as check } from 'vitest';\n// check('fills', () => {});",
      settings: settings({ framework: 'vitest' }),
      errors: [{ messageId: 'missingMarker' }],
    },
  ],
});

runRule('no-orphaned-marker (alias, flow and annotation boundaries)', orphan, {
  valid: [],
  invalid: [
    {
      name: 'Removing an orphaned marker on CR lines removes the complete line',
      code: "test('one', () => {});\r// SKIP: PROJ-1\rtest('two', () => {});",
      settings: settings({ framework: 'playwright' }),
      errors: [
        {
          messageId: 'orphaned',
          suggestions: [{ messageId: 'removeMarker', output: "test('one', () => {});\rtest('two', () => {});" }],
        },
      ],
    },
  ],
});

runRule('marker-matches-state (alias, flow and annotation boundaries)', matching, {
  valid: [],
  invalid: [
    {
      name: 'A shared marker suggestion does not copy a ticket invalid for the target state',
      code: "// SKIP: PROJ-1\ntest.skip('fills @new', () => {});",
      settings: settings({
        framework: 'playwright',
        lifecycleTags: true,
        states: { new: { ticket: { preset: 'github' } } },
      }),
      errors: [{ messageId: 'sharedMarker', suggestions: [] }],
    },
  ],
});
