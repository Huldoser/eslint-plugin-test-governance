import rule from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

const only = { annotations: { only: true } } as const;
const issue = (ticket: string) => `{ type: 'issue', description: '${ticket}' }`;

const useAnnotation = (output?: string, example = `annotation: ${issue('PROJ-123')}`) => ({
  messageId: 'useAnnotation' as const,
  data: { type: 'issue', example },
  suggestions:
    output === undefined ? [] : [{ messageId: 'moveToAnnotation' as const, data: { type: 'issue' }, output }],
});

const missingAnnotation = (subject = 'This test', example = `annotation: ${issue('PROJ-123')}`) => ({
  messageId: 'missingAnnotation' as const,
  data: { subject, state: 'skip', type: 'issue', example },
});

runRule('require-ticket (annotations.only, Playwright)', rule, {
  valid: withOptions(only, [
    `test.skip('places an order', { annotation: ${issue('TRADE-1')} }, async () => {});`,
    `test.describe.skip('orders', { annotation: ${issue('TRADE-1')} }, () => {\n  test('places an order', async () => {});\n});`,
    // A runtime skip and a step can't carry a declaration's annotation, so their comment still counts.
    "test('places an order', async () => {\n  // SKIP: TRADE-1\n  test.skip();\n});",
    "test('places an order', async () => {\n  // SKIP: TRADE-1\n  await test.step.skip('fills the order', async () => {});\n});",
  ]),
  invalid: withOptions(only, [
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', {/* keep this explanation */}, async () => {});",
      errors: [
        useAnnotation(
          `test.skip('places an order', {/* keep this explanation */ annotation: ${issue('TRADE-1')} }, async () => {});`,
        ),
      ],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [
        {
          ...useAnnotation(`test.skip('places an order', { annotation: ${issue('TRADE-1')} }, async () => {});`),
          line: 1,
        },
      ],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { tag: '@smoke' }, async () => {});",
      errors: [
        useAnnotation(
          `test.skip('places an order', { tag: '@smoke', annotation: ${issue('TRADE-1')} }, async () => {});`,
        ),
      ],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', {}, async () => {});",
      errors: [useAnnotation(`test.skip('places an order', { annotation: ${issue('TRADE-1')} }, async () => {});`)],
    },
    {
      code: "// SKIP: TRADE-1, TRADE-2\ntest.skip('places an order', async () => {});",
      errors: [
        useAnnotation(
          `test.skip('places an order', { annotation: [${issue('TRADE-1')}, ${issue('TRADE-2')}] }, async () => {});`,
        ),
      ],
    },
    {
      code: "// SKIP: TRADE-1\ntest.describe.skip('orders', () => {});",
      errors: [useAnnotation(`test.describe.skip('orders', { annotation: ${issue('TRADE-1')} }, () => {});`)],
    },
    // No suggestion where moving the ticket would mean merging annotations, losing a note, or touching a directive.
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { annotation: { type: 'perf', description: 'slow' } }, async () => {});",
      errors: [useAnnotation()],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { 'annotation': { type: 'perf', description: 'slow' } }, async () => {});",
      errors: [useAnnotation()],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { ['annotation']: { type: 'perf', description: 'slow' } }, async () => {});",
      errors: [useAnnotation()],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { ...base }, async () => {});",
      errors: [useAnnotation()],
    },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', details, async () => {});",
      errors: [useAnnotation()],
    },
    { code: '// SKIP: TRADE-1\ntest.describe.skip(() => {});', errors: [useAnnotation()] },
    // A region's marker covers several tests, so it is reported once and has no single place to move to.
    {
      code: "/* eslint-disable no-console -- SKIP: TRADE-1 */\n\ntest.skip('places an order', async () => {});\ntest.skip('cancels an order', async () => {});",
      errors: [useAnnotation()],
    },
    {
      code: "// SKIP: TRADE-1 flaky\ntest.skip('places an order', async () => {});",
      settings: { 'test-governance': { allowNotes: true } },
      errors: [useAnnotation()],
    },
    {
      code: "// eslint-disable-next-line no-console -- SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
      errors: [useAnnotation()],
    },
    { code: "test.skip('places an order', async () => {});", errors: [missingAnnotation()] },
    {
      code: "test.describe.skip('orders', () => {});",
      errors: [missingAnnotation('This describe block')],
    },
    // The annotation type comes from the option.
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', async () => {});",
      settings: { 'test-governance': { annotations: { type: 'jira', only: true } } },
      errors: [
        {
          messageId: 'useAnnotation',
          suggestions: [
            {
              messageId: 'moveToAnnotation',
              output:
                "test.skip('places an order', { annotation: { type: 'jira', description: 'TRADE-1' } }, async () => {});",
            },
          ],
        },
      ],
    },
  ]),
});

const vitest = { framework: 'vitest', ...only } as const;
const meta = (output?: string) => useAnnotation(output, "meta: { issue: 'PROJ-123' }");

runRule('require-ticket (annotations.only, Vitest)', rule, {
  valid: withOptions(vitest, [
    "test.skip('places an order', { meta: { issue: 'TRADE-1' } }, () => {});",
    "test('places an order', (context) => {\n  // SKIP: TRADE-1\n  context.skip();\n});",
  ]),
  invalid: withOptions(vitest, [
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', () => {});",
      errors: [meta("test.skip('places an order', { meta: { issue: 'TRADE-1' } }, () => {});")],
    },
    { code: "// SKIP: TRADE-1\ntest.skip('places an order');", errors: [meta()] },
    // Details added before a timeout would push it to an argument Vitest doesn't read.
    { code: "// SKIP: TRADE-1\ntest.skip('places an order', () => {}, 5000);", errors: [meta()] },
    // `meta` holds one value per key, and a `meta` already written is left alone.
    { code: "// SKIP: TRADE-1, TRADE-2\ntest.skip('places an order', () => {});", errors: [meta()] },
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', { meta: { owner: 'payments' } }, () => {});",
      errors: [meta()],
    },
    {
      code: "test.skip('places an order', () => {});",
      errors: [missingAnnotation('This test', "meta: { issue: 'PROJ-123' }")],
    },
    // A type that isn't a plain name is quoted as a key.
    {
      code: "// SKIP: TRADE-1\ntest.skip('places an order', () => {});",
      settings: { 'test-governance': { annotations: { type: 'jira-key', only: true } } },
      errors: [
        {
          messageId: 'useAnnotation',
          suggestions: [
            {
              messageId: 'moveToAnnotation',
              output: "test.skip('places an order', { meta: { 'jira-key': 'TRADE-1' } }, () => {});",
            },
          ],
        },
      ],
    },
  ]),
});
