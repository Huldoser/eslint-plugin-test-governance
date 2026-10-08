import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-ticket.ts';
import { PLAYWRIGHT_SETTINGS } from '../helpers.ts'; // also runs each case as its own test

// A parser for a language extension can produce node types that its visitor keys leave out.
// ESLint then reads the child nodes from the node itself, and the rules must find tests there too.
const wrappingParser = {
  meta: { name: 'wrapping-parser' },
  parseForESLint(code: string, options?: tsParser.ParserOptions) {
    const result = tsParser.parseForESLint(code, options);
    const { body } = result.ast;
    result.ast.body = body.map(
      (statement) =>
        ({
          type: 'WrappedStatement',
          statement,
          range: statement.range,
          loc: statement.loc,
        }) as unknown as typeof statement,
    );
    return result;
  },
};

const tester = new RuleTester({ languageOptions: { parser: wrappingParser }, settings: PLAYWRIGHT_SETTINGS });

tester.run('require-ticket (node types without visitor keys)', rule as never, {
  valid: ["// SKIP: TRADE-1\ntest.skip('places an order', async () => {});"],
  invalid: [
    {
      code: "test.describe('order entry', () => {\n  test.skip('places an order', async () => {});\n});",
      errors: [{ messageId: 'missingMarker', line: 2, column: 3, endLine: 2, endColumn: 30 }],
    },
  ],
});
