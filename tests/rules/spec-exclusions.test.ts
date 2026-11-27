import rule from '../../src/rules/require-ticket-for-spec-exclusion.ts';
import { runRule, settings } from '../helpers.ts';

const missing = { messageId: 'missingTicket' as const };

runRule('Playwright named spec exclusions', rule, {
  valid: [
    "export default {testIgnore:['service-worker/**','**/*.spec.ts','test-?.test.js',/order.spec.ts/,dynamic,,...others], use:{testIgnore:'order.spec.ts'}};",
    "export default {\n// EXCLUDE: EXAMPLE-12\ntestIgnore:'order.spec.ts'};",
    "export default {testIgnore:[\n// EXCLUDE: EXAMPLE-12\n'**/ui/order.spec.ts']};",
    {
      code: "export default {testIgnore:['setup.test.mjs']};",
      settings: settings({ allowedSpecExclusions: ['setup.test.mjs'] }),
    },
    { code: "export default {testIgnore:'order.spec.ts'};", settings: settings({ framework: 'jest' }) },
    "export default {testIgnore:['order.spec.ts'], ...unknown};",
  ],
  invalid: [
    { code: "module.exports = {testIgnore:'order.spec.ts'};", errors: [missing] },
    {
      code: "const firefox={testIgnore:['inline/order.spec.ts','other.test.jsx']}; export default {projects:[firefox,firefox]};",
      errors: [missing, missing],
    },
    {
      code: "export default {\n// EXCLUDE: EXAMPLE-12\ntestIgnore: [\n'order.spec.ts',\n// EXCLUDE: EXAMPLE-12\n'other.spec.ts']};",
      errors: [missing],
    },
    {
      code: "export default {testIgnore:[\n// EXCLUDE: TBD\n'**/order.spec.ts']};",
      errors: [{ messageId: 'placeholderTicket' }],
    },
    {
      code: "export default {testIgnore:['**/order.spec.ts']};",
      settings: settings({ allowedSpecExclusions: ['order.spec.ts'] }),
      errors: [missing],
    },
  ],
});
