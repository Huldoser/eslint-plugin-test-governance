import { it } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import plugin from '../../src/index.ts';
import limitRetries from '../../src/rules/limit-retries.ts';
import { runRule, withOptions } from '../helpers.ts';

const excessive = (count = 3) => ({ messageId: 'excessiveRetries' as const, data: { count, max: 2 } });

it('reads TypeScript config wrappers without evaluating imported types or runtime code', () => {
  const config = plugin.configure({ framework: 'playwright', checkConfigRetries: true });
  config.rules['test-governance/limit-retries'] = 'error';
  const reports = new Linter().verify(
    "import type { Config } from './types'; const policy = { retries: 3 } satisfies Config; export default policy!;",
    { ...config, languageOptions: { parser: tsParser } },
  );
  assert.deepEqual(
    reports.map(({ messageId }) => messageId),
    ['excessiveRetries'],
  );
});

runRule('config retry ceilings (Playwright)', limitRetries, {
  valid: withOptions({ checkConfigRetries: true }, [
    'export default { retries: 2 };',
    'export default { retries: true ? 0 : 9 };',
    'export default { use: { retries: 9 }, metadata: { retries: 9 } };',
    'export default { retries: imported };',
    'export default { retries: 9, ...unknown };',
    'const policy = { retries: 9 }; policy.retries = 0; export default policy;',
    'const config = { retries: 9 }; consume(config);',
    'export const config = { retries: 9 };',
    'export default wrap({ retries: 9 });',
    'export default defineConfig();',
    'export default (() => ({}))({ retries: 9 });',
    'export default tool.other({ retries: 9 });',
    'export default tool.defineConfig({ retries: 9 });',
    'export default getTool().defineConfig({ retries: 9 });',
    "const require = other; module.exports = require('@playwright/test').defineConfig({ retries: 9 });",
    "import pw from '@playwright/test'; export default pw({ retries: 9 });",
    "import { other } from '@playwright/test'; export default other({ retries: 9 });",
    "let config = require('@playwright/test').defineConfig; export default config({ retries: 9 });",
    'function config(value) { return value; } export default config({ retries: 9 });',
    "const { other: config } = require('@playwright/test'); export default config({ retries: 9 });",
    "const { ...config } = require('@playwright/test'); export default config({ retries: 9 });",
    'const { defineConfig: config } = other; export default config({ retries: 9 });',
    "import * as pw from '@playwright/test'; pw.defineConfig = other; export default pw.defineConfig({ retries: 9 });",
    "const { defineConfig: config } = require('@playwright/test'); config = other; export default config({ retries: 9 });",
    'const first = second; const second = first; export default first({ retries: 9 });',
    'const config = config; export default config;',
    'const [config] = unknown; export default config({ retries: 9 });',
    'const config = { projects: [config] }; export default config;',
    "require = other; module.exports = require('@playwright/test').defineConfig({ retries: 9 });",
    'module = other; module.exports = { retries: 9 };',
    'module.exports += { retries: 9 };',
    "import { defineConfig } from '@playwright/test'; export default defineConfig({ retries: 9 }, { retries: 0 });",
    "import { defineConfig } from 'other'; export default defineConfig({ retries: 9 });",
    "import { defineConfig } from 'vitest/config'; export default defineConfig({ retries: 9 });",
    'function helper(module) { module.exports = { retries: 9 }; }',
    'const module = {}; module.exports = { retries: 9 };',
    'module.other = { retries: 9 };',
    'module.exports = imported;',
    'module.exports = { retries: "9" };',
    'export default { projects: [unknown, null, , ...unknown] };',
  ]),
  invalid: withOptions({ checkConfigRetries: true }, [
    { code: 'export default { retries: 3 };', errors: [excessive()] },
    {
      code: "const pw = require('@playwright/test'); const config = pw.defineConfig; export default config({ retries: 3 });",
      errors: [excessive()],
    },
    { code: "module.exports = require('@playwright/test').defineConfig({ retries: 3 });", errors: [excessive()] },
    { code: 'export default { projects: enabled ? [{ retries: 3 }] : [{ retries: 0 }] };', errors: [excessive()] },
    { code: 'export default false ? { retries: 0 } : { retries: 3 };', errors: [excessive()] },
    { code: 'module.exports = { retries: 3 };', errors: [excessive()] },
    { code: "module['exports'] = { retries: 3 };", errors: [excessive()] },
    { code: 'const n = 3; const config = { retries: +n }; export default config;', errors: [excessive()] },
    { code: 'export default { ...{ retries: 3 } };', errors: [excessive()] },
    { code: 'export default { retries: process.env.CI ? 3 : 0 };', errors: [excessive()] },
    { code: 'export default enabled ? { retries: 3 } : { retries: 4 };', errors: [excessive(), excessive(4)] },
    { code: 'export default { projects: [{ retries: 3 }, { retries: 4 }] };', errors: [excessive(), excessive(4)] },
    { code: 'const config = { retries: 3 }; export default { projects: [config, config] };', errors: [excessive()] },
    {
      code: "import { defineConfig as config } from '@playwright/test'; export default config({ retries: 3 });",
      errors: [excessive()],
    },
    {
      code: "import * as pw from '@playwright/test'; export default pw.defineConfig({ retries: 3 });",
      errors: [excessive()],
    },
    {
      code: "const { defineConfig } = require('@playwright/test'); module.exports = defineConfig({ retries: 3 });",
      errors: [excessive()],
    },
    {
      code: "const pw = require('@playwright/test'); module.exports = pw.defineConfig({ retries: 3 });",
      errors: [excessive()],
    },
  ]),
});

runRule('config retry ceilings (Vitest)', limitRetries, {
  valid: withOptions({ framework: 'vitest', checkConfigRetries: true }, [
    'export default { retry: 9, test: { retry: { delay: 99 } } };',
    'export default { test: { retry: { count: 2, condition: /network/, delay: 99 } } };',
    'export default { test: { projects: ["./unit", { test: { retry: 0 } }] } };',
    'export default { test: { retry: 9 }, ...unknown };',
    'export default async () => ({ test: { retry: 9 } });',
    'export default function* () { return { test: { retry: 9 } }; };',
    'export default () => { prepare(); return { test: { retry: 9 } }; };',
    'export default () => { prepare(); };',
    'export default () => { return; };',
  ]),
  invalid: withOptions({ framework: 'vitest', checkConfigRetries: true }, [
    {
      code: "import { defineConfig } from 'vitest/config'; export default defineConfig({ test: { retry: 3 } });",
      errors: [excessive()],
    },
    {
      code: "import { defineConfig } from 'vite'; export default defineConfig({ test: { retry: { count: 3, delay: 99 } } });",
      errors: [excessive()],
    },
    {
      code: "import { defineProject } from 'vitest/config'; export default defineProject({ test: { retry: 3 } });",
      errors: [excessive()],
    },
    { code: 'export default { test: { projects: [{ test: { retry: 3 } }] } };', errors: [excessive()] },
    {
      code: "import { defineConfig } from 'vitest/config'; export default defineConfig(() => ({ test: { retry: 3 } }));",
      errors: [excessive()],
    },
    { code: 'export default () => { return { test: { retry: 3 } }; };', errors: [excessive()] },
  ]),
});

runRule('config retry ceilings (Cypress)', limitRetries, {
  valid: withOptions({ framework: 'cypress', checkConfigRetries: true }, [
    'export default { retries: { count: 9 }, env: { retries: 9 } };',
    'export default { e2e: { retries: { runMode: 2, openMode: 0 } } };',
    'export default { component: { retries: 9, ...unknown } };',
  ]),
  invalid: withOptions({ framework: 'cypress', checkConfigRetries: true }, [
    {
      code: "import { defineConfig } from 'cypress'; export default defineConfig({ retries: 3 });",
      errors: [excessive()],
    },
    {
      code: "const { defineConfig: config } = require('cypress'); module.exports = config({ e2e: { retries: { runMode: 3, openMode: 4 } } });",
      errors: [excessive(), excessive(4)],
    },
    { code: 'export default { component: { retries: 3 } };', errors: [excessive()] },
  ]),
});

it('config checks are opt-in and do not create retry ticket requirements', () => {
  const linter = new Linter();
  const policy = plugin.configure({ framework: 'playwright', states: { retry: true } });
  policy.rules['test-governance/limit-retries'] = 'error';
  assert.deepEqual(linter.verify('export default { retries: 3 };', policy), []);
  const optedIn = plugin.configure({ framework: 'playwright', checkConfigRetries: true, states: { retry: true } });
  optedIn.rules['test-governance/limit-retries'] = 'error';
  const reports = linter.verify('export default { retries: 3 };', optedIn);
  assert.deepEqual(
    reports.map(({ ruleId }) => ruleId),
    ['test-governance/limit-retries'],
  );
});
