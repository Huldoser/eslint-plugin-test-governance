import rule from '../../src/rules/require-ticket-for-snapshot-suppression.ts';
import { runRule, withOptions } from '../helpers.ts';

runRule('Playwright snapshot suppression', rule, {
  valid: [
    'export default {ignoreSnapshots:false};',
    'export default {use:{ignoreSnapshots:true}, ignoreSnapshots:ci};',
    'const other = {ignoreSnapshots:true};',
    'export default {ignoreSnapshots:true,...unknown};',
    'export default {\n// SUPPRESS: EXAMPLE-12\nignoreSnapshots:true};',
    ...withOptions({ framework: 'vitest' }, ['export default {ignoreSnapshots:true};']),
  ],
  invalid: [
    { code: 'export default {ignoreSnapshots:true};', errors: [{ messageId: 'missingTicket' }] },
    {
      code: "import {defineConfig} from '@playwright/test'; const project = {ignoreSnapshots:true}; export default defineConfig({projects:[project,project]});",
      errors: [{ messageId: 'missingTicket' }],
    },
    {
      code: 'export default {\n// SUPPRESS: TBD\nignoreSnapshots:true};',
      errors: [{ messageId: 'placeholderTicket' }],
    },
    {
      code: 'export default {\n// SUPPRESS: EXAMPLE-1\n\nignoreSnapshots:true};',
      errors: [{ messageId: 'missingTicket' }],
    },
  ],
});
