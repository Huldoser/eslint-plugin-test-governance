import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings } from '../helpers.ts';

const missing = (state: string, subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker: state.toUpperCase(), example: 'PROJ-123' },
});

runRule('require-ticket (imported Vitest todos)', requireTicket, {
  valid: [
    {
      name: 'does not infer a missing body from an unread callback',
      code: "import { test } from 'vitest'; test('example', callback);",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'accepts a todo ticket from metadata when only options are supplied',
      code: "import { test } from 'vitest'; test('example', { meta: { issue: 'EXAMPLE-123' } });",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'leaves an ambiguous global test without a body alone',
      code: "test('needs implementation');",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'does not infer an imported runner from an unrelated Vitest import',
      code: "import { expect } from 'vitest'; test('helper');",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'accepts a ticket on an imported implicit todo',
      code: "import { test } from 'vitest';\n// TODO: EXAMPLE-123\ntest('needs implementation');",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'keeps an imported explicit skip without a body a skip',
      code: "import { test } from 'vitest';\n// SKIP: EXAMPLE-123\ntest.skip('not available');",
      settings: settings({ framework: 'vitest' }),
    },
    {
      name: 'does not mistake a nested helper for the imported test',
      code: "import { test } from 'vitest'; function helper() { const test = log; test('message'); }",
      settings: settings({ framework: 'vitest' }),
    },
  ],
  invalid: [
    ...["test('example', { timeout: 5000 })", 'test(function namedExample() {})'].map((call) => ({
      name: `recognizes an imported Vitest todo with the overload ${call}`,
      code: `import { test } from 'vitest'; ${call};`,
      settings: settings({ framework: 'vitest' }),
      errors: [missing('todo')],
    })),
    ...[
      ["import { test } from 'vitest';", 'test'],
      ["import { it as check } from 'vitest';", 'check'],
      ["import * as runner from 'vitest';", 'runner.test'],
      ["const { test: check } = require('vitest');", 'check'],
      ["const runner = require('vitest');", 'runner.it'],
      ["import { test } from 'vitest'; const check = test;", 'check'],
      ["import { test } from 'vitest';", 'test.only'],
      ["import { test } from 'vitest';", 'test.skipIf(false)'],
    ].map(([prefix, callee]) => ({
      name: `requires a ticket for an implicit todo through ${callee} from ${prefix}`,
      code: `${prefix}\n${callee}('needs implementation');`,
      settings: settings({ framework: 'vitest' }),
      errors: [missing('todo')],
    })),
  ],
});

runRule('require-ticket (Node getTestContext)', requireTicket, {
  valid: [
    {
      name: 'does not follow cyclic getter aliases',
      code: "import { test } from 'node:test'; const first = second; const second = first; test('example', () => { first().skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'ignores a getter alias reassigned to a helper',
      code: "import { test, getTestContext } from 'node:test'; let current = getTestContext; current = helper; test('example', () => { current().skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'does not treat an unknown returned function as a context getter',
      code: "import { test } from 'node:test'; test('example', () => { factory()().skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'ignores context getters outside a test',
      code: "import { getTestContext } from 'node:test'; getTestContext().skip();",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'ignores a suite context and its before hook',
      code: "import { describe, before, getTestContext } from 'node:test'; describe('suite', () => { getTestContext().skip(); before(() => getTestContext().todo()); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'ignores an unrelated getter with the same name',
      code: "import { test } from 'node:test'; test('example', () => { const getTestContext = helper; getTestContext().skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'does not assign a deferred helper its enclosing test context',
      code: "import { test, getTestContext } from 'node:test'; test('example', () => { function helper() { getTestContext().skip(); } });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'accepts the enclosing test marker for its context skip',
      code: "import { test, getTestContext } from 'node:test';\n// SKIP: EXAMPLE-123\ntest('example', () => { getTestContext().skip(); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'retains the context owner when an alias is used inside a subtest',
      code: "import { test, getTestContext } from 'node:test';\n// SKIP: EXAMPLE-123\ntest('outer', async t => { const context = getTestContext(); await t.test('inner', () => { context.skip(); }); });",
      settings: settings({ framework: 'node-test' }),
    },
  ],
  invalid: (['skip', 'todo'] as const).flatMap((state) =>
    [
      ["import { test, getTestContext } from 'node:test';", `getTestContext().${state}();`],
      ["import { test, getTestContext as current } from 'node:test';", `current().${state}('reason');`],
      ["import * as runner from 'node:test'; const test = runner.test;", `runner.getTestContext().${state}();`],
      ["const { test, getTestContext } = require('node:test');", `getTestContext().${state}();`],
      ["import { test, getTestContext } from 'node:test';", `const context = getTestContext(); context.${state}();`],
      ["import { test, getTestContext } from 'node:test';", `const { ${state}: mark } = getTestContext(); mark();`],
      ["import { test, getTestContext } from 'node:test';", `const current = getTestContext; current().${state}();`],
    ].map(([prefix, body]) => ({
      name: `requires a ${state} ticket for ${body} through ${prefix}`,
      code: `${prefix}\ntest('example', () => { ${body} });`,
      settings: settings({ framework: 'node-test' }),
      errors: [missing(state, `This ${state} call`)],
    })),
  ),
});
