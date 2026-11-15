import requireTicket from '../../src/rules/require-ticket.ts';
import limitRetries from '../../src/rules/limit-retries.ts';
import { runRule, withOptions } from '../helpers.ts';

runRule('require-ticket (mutations through stored and destructured aliases)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true }, [
    "const metadata = { reason: 'EXAMPLE-843' }; const { reason } = metadata; test.skip(true, reason);",
    "const metadata = { reason: 'EXAMPLE-843' }; const wrapper = { metadata }; test.skip(true, wrapper.metadata.reason);",
  ]),
  invalid: withOptions({ ticketsFromReasons: true }, [
    {
      code: "const metadata = { reason: 'EXAMPLE-843' }; const { metadata: alias } = { metadata }; alias.reason = 'TBD'; test.skip(true, metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const metadata = { reason: 'EXAMPLE-843' }; const [alias] = [metadata]; alias.reason = 'TBD'; test.skip(true, metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const metadata = { reason: 'EXAMPLE-843' }; const wrapper = { nested: [metadata] }; Reflect.set(wrapper.nested[0], 'reason', 'TBD'); test.skip(true, metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const wrapper = { metadata: { reason: 'EXAMPLE-843' } }; const { metadata } = wrapper; delete metadata.reason; test.skip(true, wrapper.metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const wrapper = [{ reason: 'EXAMPLE-843' }]; const [metadata] = wrapper; Object.assign(metadata, { reason: 'TBD' }); test.skip(true, wrapper[0].reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

runRule('limit-retries (mutated alias counts)', limitRetries, {
  valid: [
    'const metadata = { retries: 7 }; const holder = [metadata]; holder[0].retries = 1; test.describe.configure(metadata);',
    'const metadata = { retries: 7 }; const { item: alias } = { item: metadata }; alias.retries = 1; test.describe.configure(metadata);',
  ],
  invalid: [
    {
      code: 'const metadata = { retries: 7 }; const holder = [metadata]; test.describe.configure(holder[0]);',
      errors: [{ messageId: 'excessiveRetries' }],
    },
  ],
});

runRule('require-ticket (primitive no-op spreads)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true }, [
    "const metadata = { reason: 'EXAMPLE-843', ...null }; test.skip(true, metadata.reason);",
    "const metadata = { reason: 'EXAMPLE-843', ...undefined }; test.skip(true, metadata.reason);",
    "const metadata = { reason: 'EXAMPLE-843', ...false }; test.skip(true, metadata.reason);",
    "const metadata = { reason: 'EXAMPLE-843', ...0 }; test.skip(true, metadata.reason);",
    "const metadata = { reason: 'EXAMPLE-843', ...'' }; test.skip(true, metadata.reason);",
  ]),
  invalid: withOptions({ ticketsFromReasons: true }, [
    {
      code: "function check(undefined) { const metadata = { reason: 'EXAMPLE-843', ...undefined }; test.skip(true, metadata.reason); }",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const metadata = { reason: 'EXAMPLE-843', ...unknown }; test.skip(true, metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const metadata = { reason: 'EXAMPLE-843', ...'text' }; test.skip(true, metadata.reason);",
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

for (const [framework, skip, normal] of [
  ['playwright', 'test.skip', 'test'],
  ['jest', 'it.skip', 'it'],
  ['vitest', 'test.skip', 'test'],
  ['mocha', 'it.skip', 'it'],
  ['node-test', 'test.skip', 'test'],
  ['jasmine', 'xit', 'it'],
] as const) {
  const header = framework === 'node-test' ? "import { test } from 'node:test';\n" : '';
  runRule(`require-ticket (${framework} constant runner selection)`, requireTicket, {
    valid: withOptions({ framework, requireTicketForConditional: true }, [
      `${header}(false ? ${skip} : ${normal})('reachable', () => {});`,
      `${header}const flag = false; const selected = flag ? ${skip} : ${normal}; selected('reachable', () => {});`,
      `${header}(true ? ${normal} : ${skip}).call(null, 'reachable', () => {});`,
      `${header}// SKIP: EXAMPLE-843\n(true ? ${skip} : ${normal})('tracked', () => {});`,
    ]),
    invalid: withOptions({ framework }, [
      {
        code: `${header}(true ? ${skip} : ${normal})('untracked', () => {});`,
        errors: [{ messageId: 'missingMarker' }],
      },
      {
        code: `${header}const flag = true; const selected = flag ? ${skip} : ${normal}; selected('untracked', () => {});`,
        errors: [{ messageId: 'missingMarker' }],
      },
      {
        code: `${header}(false ? ${normal} : ${skip}).apply(null, ['untracked', () => {}]);`,
        errors: [{ messageId: 'missingMarker' }],
      },
    ]),
  });
}
