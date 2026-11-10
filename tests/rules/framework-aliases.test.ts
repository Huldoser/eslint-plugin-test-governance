import rule from '../../src/rules/require-ticket.ts';
import { runRule, settings } from '../helpers.ts';

const missing = (state: string, marker: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example: 'PROJ-123' },
});
const lifecycle = { customStates: { new: { when: '@new', marker: 'NEW' } } } as const;

runRule('require-ticket (framework aliases)', rule, {
  valid: [
    {
      name: 'does not treat a Jasmine import as a configured Playwright test',
      code: "import { it as test } from 'jasmine-core';\ntest.skip('fills an order', () => {});",
    },
    {
      name: 'does not treat a method on Playwright testInfo as a Node subtest',
      code: "test('fills an order', async ({}, info) => {\n  info.test('helper @new', () => {});\n});",
      settings: settings(lifecycle),
    },
    ...(['before', 'after'] as const).map((hook) => ({
      name: `does not give an aliased Node ${hook} hook a test context`,
      code: `import { ${hook} as setup } from 'node:test';\nconst test = setup;\ntest((context) => { context.skip(); });`,
      settings: settings({ framework: 'node-test' }),
    })),
    ...(['beforeAll', 'afterAll'] as const).map((hook) => ({
      name: `does not treat pending in an aliased Jasmine ${hook} as a test skip`,
      code: `const it = ${hook};\nit(() => { pending(); });`,
      settings: settings({ framework: 'jasmine' }),
    })),
  ],
  invalid: [
    {
      name: 'recognizes the Jest xtest failing alias as a skipped test',
      code: "xtest.failing('rejects an order', () => {});",
      settings: settings({ framework: 'jest' }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      name: 'recognizes the Jest fit failing alias as an expected failure',
      code: "fit.failing('rejects an order', () => {});",
      settings: settings({ framework: 'jest', states: { fail: true } }),
      errors: [missing('fail', 'FAIL')],
    },
    {
      name: 'recognizes an imported Jasmine it alias without a body',
      code: "import { it as spec } from 'jasmine-core';\nspec('needs implementation');",
      settings: settings({ framework: 'jasmine' }),
      errors: [missing('todo', 'TODO')],
    },
    {
      name: 'checks custom tags on a focused Jasmine suite',
      code: "fdescribe('orders @new', () => {});",
      settings: settings({ framework: 'jasmine', ...lifecycle }),
      errors: [missing('new', 'NEW', 'This describe block')],
    },
    {
      name: 'recognizes a Node test with a dynamic title and a separately defined body',
      code: "import { test } from 'node:test';\nconst title = getTitle();\nconst body = () => {};\ntest(title, { skip: true }, body);",
      settings: settings({ framework: 'node-test' }),
      errors: [missing('skip', 'SKIP')],
    },
  ],
});
