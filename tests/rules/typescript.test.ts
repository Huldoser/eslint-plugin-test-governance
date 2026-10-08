import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-ticket.ts';
import { PLAYWRIGHT_SETTINGS, settings } from '../helpers.ts';

// Syntax only the TypeScript parser understands.
const tester = new RuleTester({ languageOptions: { parser: tsParser }, settings: PLAYWRIGHT_SETTINGS });
const lifecycle = settings({ lifecycleTags: true });

tester.run('require-ticket (TypeScript syntax)', rule as never, {
  valid: [
    "// SKIP: TRADE-1\ntest.skip('places an order', async ({ page }: { page: Page }) => {});",
    // AVA's typed test function is not Playwright's.
    "import anyTest, { type TestFn } from 'ava';\nconst test = anyTest as TestFn<{ broker: string }>;\ntest.skip('shows live prices', async (t) => {});",
    // A marker inside a namespace sits above the test.
    "namespace OrderEntry {\n  // SKIP: TRADE-1\n  test.skip('places an order', async () => {});\n}",
    // Tags in constants written with `as const` or `satisfies`, and in enums.
    {
      code: "const TAGS = { NEW: '@new' } as const satisfies Record<string, string>;\n// NEW: TRADE-1\ntest('places an order', { tag: [(TAGS as typeof TAGS).NEW] as const }, async () => {});",
      name: 'tags in a constant written with as const and satisfies',
      settings: lifecycle,
    },
    {
      code: "enum Tag { Smoke = '@smoke', 'New' = '@new' }\n// NEW: TRADE-1\ntest('places an order', { tag: [Tag.Smoke, Tag.New] }, async () => {});",
      name: 'tags in an enum',
      settings: lifecycle,
    },
    {
      code: "const details = { tag: '@new' } satisfies TestDetails;\n// NEW: TRADE-1\ntest('places an order', details!, async () => {});",
      name: 'details in a constant written with satisfies',
      settings: lifecycle,
    },
  ],
  invalid: [
    {
      code: [
        "import { test as base } from '@playwright/test';",
        'type Fixtures = { account: string };',
        'export const accountTest = base.extend<Fixtures>({ account: async ({}, use) => use("acct-1") });',
        'export const orderTest = accountTest.extend({}) as typeof accountTest;',
        'const riskTest = orderTest!.extend({}) satisfies typeof orderTest;',
        "riskTest.skip('cancels an open order', async () => {});",
      ].join('\n'),
      errors: [{ messageId: 'missingMarker', line: 6, column: 1, endLine: 6, endColumn: 38 }],
      name: 'fixtures extended with TypeScript type arguments, as, ! and satisfies',
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "namespace OrderEntry {\n  test.skip('places an order', async () => {});\n}",
      errors: [{ messageId: 'missingMarker', line: 2, column: 3, endLine: 2, endColumn: 30 }],
    },
    {
      code: "enum Tag { New = '@new' }\ntest('places an order', { tag: Tag.New as Tag }, async () => {});",
      errors: [{ messageId: 'missingMarker', line: 2, column: 1, endLine: 2, endColumn: 23 }],
      name: 'a missing marker for a tag from an enum',
      settings: lifecycle,
    },
    // An enum member without a string, a merged enum and a missing member can't be read.
    {
      code: [
        'enum Level { Low, High }',
        "enum Region { Us = '@us' }",
        "enum Region { Eu = '@eu' }",
        "enum Tag { New = '@new' }",
        "test('places an order', { tag: [Level.Low, Region.Us, Tag.Old, Tag.New] }, async () => {});",
      ].join('\n'),
      errors: [
        { messageId: 'missingMarker', line: 5, column: 1, endLine: 5, endColumn: 23 },
        { messageId: 'dynamicTags', line: 5, column: 33, endLine: 5, endColumn: 42 },
        { messageId: 'dynamicTags', line: 5, column: 44, endLine: 5, endColumn: 53 },
        { messageId: 'dynamicTags', line: 5, column: 55, endLine: 5, endColumn: 62 },
      ],
      name: 'enum members without a string, merged enums and missing members',
      settings: settings({ lifecycleTags: true, reportDynamicTitles: true }),
    },
  ],
});
