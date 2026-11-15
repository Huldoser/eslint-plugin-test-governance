import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import suppression from '../../src/rules/require-ticket-for-error-suppression.ts';
import retries from '../../src/rules/limit-retries.ts';
import ticket from '../../src/rules/require-ticket.ts';
import orphan from '../../src/rules/no-orphaned-marker.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

runRule('require-ticket (destructured constants)', ticket, {
  valid: [
    ...withOptions({ ticketsFromReasons: true }, [
      "const { reason } = { reason: 'EXAMPLE-123' }; test.skip(true, reason);",
      "const [reason] = ['EXAMPLE-123']; test.skip(true, reason);",
    ]),
  ],
  invalid: [
    ...withOptions({ customStates: { hold: { when: '@hold', marker: 'HOLD' } } }, [
      {
        code: "const { tag } = { tag: '@hold' }; test('probe', { tag }, () => {});",
        errors: [{ messageId: 'missingMarker' }],
      },
      {
        code: "const { metadata: { tag } } = { metadata: { tag: '@hold' } }; test('probe', { tag }, () => {});",
        errors: [{ messageId: 'missingMarker' }],
      },
    ]),
  ],
});

runRule('limit-retries (destructured constants and negated conditions)', retries, {
  valid: [
    'test.describe.configure({ retries: !true ? 3 : 0 });',
    'test.describe.configure({ retries: !!false ? 3 : 0 });',
  ],
  invalid: [
    {
      code: 'const { count } = { count: 3 }; test.describe.configure({ retries: count });',
      errors: [{ messageId: 'excessiveRetries' }],
    },
    {
      code: 'const [count] = [3]; test.describe.configure({ retries: count });',
      errors: [{ messageId: 'excessiveRetries' }],
    },
    {
      code: 'test.describe.configure({ retries: !false ? 3 : 0 });',
      errors: [{ messageId: 'excessiveRetries' }],
    },
  ],
});

runRule('require-ticket (destructuring boundaries)', ticket, {
  valid: [],
  invalid: withOptions({ reportUnreadableTags: true, customStates: { hold: { when: '@hold', marker: 'HOLD' } } }, [
    ...[
      "const { ignored, tag } = { ignored: 1, tag: '@hold' };",
      "const { tag: alias } = { tag: '@hold' }; const tag = alias;",
      "const [, tag] = ['ignored', '@hold'];",
      "const [[tag]] = [['@hold']];",
      "const metadata = { tag: '@hold' }; const { tag } = metadata;",
    ].map((declaration) => ({
      code: `${declaration} test('probe', { tag }, () => {});`,
      errors: [{ messageId: 'missingMarker' }],
    })),
    ...[
      "const { ...tag } = { value: '@hold' };",
      "const { [key]: tag } = { value: '@hold' };",
      'const { tag } = {};',
      "const { tag = '@hold' } = {};",
      "const { tag = '@hold' } = external;",
      "const { tag } = { tag: '@hold', ...external };",
      "const { tag } = { get tag() { return '@hold'; } };",
      "const [tag] = [...external, '@hold'];",
      'const [tag] = [];',
      "const [, tag] = ['ignored'];",
      "const [...tag] = ['@hold'];",
      "const [tag = '@hold'] = [];",
      "const { tag } = '@hold';",
      "const [tag] = { value: '@hold' };",
      'const { tag } = { tag };',
      'const { tag } = { tag: alias }; const alias = tag;',
      'const { missing, tag } = { tag: unknown };',
      'const [, tag] = [null, null];',
      "const { tag } = { ['__proto__']: '@hold' };",
      "const { tag } = { tag: '@hold' }; tag.value = '@other';",
    ].map((declaration) => ({
      code: `${declaration} test('probe', { tag }, () => {});`,
      errors: [{ messageId: 'dynamicTags' }],
    })),
  ]),
});

runRule('limit-retries (unknown negated predicates)', retries, {
  valid: [],
  invalid: [
    {
      code: 'test.describe.configure({ retries: !unknown ? 3 : 0 });',
      errors: [{ messageId: 'excessiveRetries' }],
    },
  ],
});

const typed = new RuleTester({ languageOptions: { parser: tsParser } });
typed.run('require-ticket-for-error-suppression (erased TypeScript wrappers)', suppression as never, {
  valid: withOptions({ framework: 'cypress' }, [
    "const Cypress = helper; (Cypress as any).on('uncaught:exception', () => (false as const));",
    "(Cypress.on as Function)('uncaught:exception', () => (true as const));",
    "(Cypress.on as Function)('other:event', () => (false as const));",
  ]),
  invalid: withOptions({ framework: 'cypress' }, [
    ...[
      "Cypress.on('uncaught:exception', () => (false as const));",
      "(Cypress as any).on('uncaught:exception', () => false);",
      "(Cypress.on as Function)('uncaught:exception', () => false);",
      "Cypress.on('uncaught:exception', (() => false) as Function);",
    ].map((code) => ({ code, errors: [{ messageId: 'missingTicket' }] })),
  ]),
});

typed.run('limit-retries (erased TypeScript wrappers)', retries as never, {
  valid: [],
  invalid: [
    ...[
      ['jest', '(jest.retryTimes as Function)(3);'],
      ['jest', '(jest as any).retryTimes(3);'],
      ['mocha', "it('probe', function () { (this.retries as Function)(3); });"],
      ['mocha', "it('probe', function () { (this as any).retries(3); });"],
    ].map(([framework, code]) => ({
      code,
      settings: settings({ framework: framework as 'jest' | 'mocha' }),
      errors: [{ messageId: 'excessiveRetries' }],
    })),
  ],
});

runRule('no-orphaned-marker (local suppression marker ownership)', orphan, {
  valid: [
    {
      code: "it('probe', () => {\n// SUPPRESS: EXAMPLE-123\nCypress.on('uncaught:exception', () => false); });",
      settings: settings({
        framework: 'cypress',
        customStates: { suppress: { when: '@suppression', marker: 'SUPPRESS' } },
      }),
    },
  ],
  invalid: [
    {
      code: "it('probe', () => {\n// SUPPRESS: EXAMPLE-123\nhelper(); });",
      settings: settings({
        framework: 'cypress',
        customStates: { suppress: { when: '@suppression', marker: 'SUPPRESS' } },
      }),
      errors: [
        {
          messageId: 'detached',
          suggestions: [{ messageId: 'removeMarker', output: "it('probe', () => {\nhelper(); });" }],
        },
      ],
    },
    {
      code: "it('probe', () => {\n// SKIP: EXAMPLE-123\n// SUPPRESS: EXAMPLE-456\nCypress.on('uncaught:exception', () => false); });",
      settings: settings({
        framework: 'cypress',
        customStates: { suppress: { when: '@suppression', marker: 'SUPPRESS' } },
      }),
      errors: [
        {
          messageId: 'detached',
          suggestions: [
            {
              messageId: 'removeMarker',
              output:
                "it('probe', () => {\n// SUPPRESS: EXAMPLE-456\nCypress.on('uncaught:exception', () => false); });",
            },
          ],
        },
      ],
    },
  ],
});
