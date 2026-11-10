import rule from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const missing = (subject = 'This test') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state: 'skip', marker: 'SKIP', example: 'PROJ-123' },
});

runRule('require-ticket (Vitest function titles)', rule, {
  valid: withOptions({ framework: 'vitest' }, [
    '// SKIP: EXAMPLE-1\ntest.skip(function namedTest() {}, () => {});',
    '// SKIP: EXAMPLE-1\ntest.skip(function namedTest() {});',
    'test(function namedTest(context) { context.skip(); }, () => {});',
    'describe(function namedSuite() { test.skip("not executed", () => {}); }, () => {});',
    'describe.call(null, function namedSuite() { test.skip("not executed", () => {}); }, () => {});',
    'describe.apply(null, [function namedSuite() { test.skip("not executed", () => {}); }, () => {}]);',
    'test(function namedTest() {}, { skip: false }, () => {});',
    "test.skip(function namedTest() {}, { meta: { issue: 'EXAMPLE-1' } }, () => {});",
  ]),
  invalid: withOptions({ framework: 'vitest' }, [
    {
      name: 'recognizes a skipped test with a function name and a separate body',
      code: 'test.skip(function namedTest() {}, () => {});',
      errors: [missing()],
    },
    {
      name: 'recognizes a skipped test with only a function name',
      code: 'test.skip(function namedTest() {});',
      errors: [missing()],
    },
    {
      name: 'recognizes a function-named test invoked with call',
      code: 'test.skip.call(null, function namedTest() {}, () => {});',
      errors: [missing()],
    },
    {
      name: 'recognizes a function-named test invoked with apply',
      code: 'test.skip.apply(null, [function namedTest() {}, () => {}]);',
      errors: [missing()],
    },
    {
      name: 'reads options after a function name',
      code: 'test(function namedTest() {}, { skip: true }, () => {});',
      errors: [missing()],
    },
    {
      name: 'recognizes a skipped suite with a function name',
      code: 'describe.skip(function namedSuite() {}, () => {});',
      errors: [missing('This describe block')],
    },
    {
      name: 'reads the context from the body rather than the function name',
      code: 'test(function namedTest() {}, (context) => { context.skip(); });',
      errors: [missing('This skip call')],
    },
    {
      name: 'recognizes conditional selection with a function name',
      code: '(condition ? test.skip : test)(function namedTest() {}, () => {});',
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing()],
    },
    {
      name: 'moves a function-named test ticket into meta',
      code: '// SKIP: EXAMPLE-1\ntest.skip(function namedTest() {}, () => {});',
      settings: settings({ annotations: { only: true } }),
      errors: [
        {
          messageId: 'useAnnotation' as const,
          data: { type: 'issue', example: "meta: { issue: 'PROJ-123' }" },
          suggestions: [
            {
              messageId: 'moveToAnnotation' as const,
              data: { type: 'issue' },
              output: "test.skip(function namedTest() {}, { meta: { issue: 'EXAMPLE-1' } }, () => {});",
            },
          ],
        },
      ],
    },
  ]),
});
