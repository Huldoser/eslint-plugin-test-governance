import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-ticket.ts';
import { settings } from '../helpers.ts';

// Syntax only the TypeScript parser understands.
const tester = new RuleTester({ languageOptions: { parser: tsParser } });

tester.run('require-ticket (TypeScript syntax)', rule as never, {
  valid: ["// SKIP: WEB-1\ntest.skip('a', async ({ page }: { page: Page }) => {});"],
  invalid: [
    {
      code: [
        "import { test as base } from '@playwright/test';",
        'type Fixtures = { user: string };',
        'export const a = base.extend<Fixtures>({ user: async ({}, use) => use("u") });',
        'export const b = a.extend({}) as typeof a;',
        'const c = b!.extend({}) satisfies typeof b;',
        "c.skip('x', async () => {});",
      ].join('\n'),
      errors: [{ messageId: 'missingMarker', line: 6, column: 1, endLine: 6, endColumn: 11 }],
      name: 'fixtures extended with TypeScript type arguments, as, ! and satisfies',
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "namespace Suite {\n  test.skip('a', async () => {});\n}",
      errors: [{ messageId: 'missingMarker', line: 2, column: 3, endLine: 2, endColumn: 16 }],
    },
  ],
});
