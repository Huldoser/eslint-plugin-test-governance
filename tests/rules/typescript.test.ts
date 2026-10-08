import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-ticket.ts';
import { settings } from '../helpers.ts';

// Syntax only the TypeScript parser understands.
const tester = new RuleTester({ languageOptions: { parser: tsParser } });

tester.run('require-ticket (TypeScript syntax)', rule as never, {
  valid: [
    "// SKIP: TRADE-1\ntest.skip('places an order', async ({ page }: { page: Page }) => {});",
    // AVA's typed test function is not Playwright's.
    "import anyTest, { type TestFn } from 'ava';\nconst test = anyTest as TestFn<{ broker: string }>;\ntest.skip('shows live prices', async (t) => {});",
    // A marker inside a namespace sits above the test.
    "namespace OrderEntry {\n  // SKIP: TRADE-1\n  test.skip('places an order', async () => {});\n}",
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
  ],
});
