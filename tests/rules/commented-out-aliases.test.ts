import rule from '../../src/rules/require-ticket-for-commented-out-tests.ts';
import { runRule, settings } from '../helpers.ts';

const missing = {
  messageId: 'missingMarker' as const,
  data: { marker: 'SKIP', example: 'PROJ-123' },
};

runRule('require-ticket-for-commented-out-tests (module aliases)', rule, {
  valid: [
    {
      name: 'leaves ordinary destructured helpers alone in a test file',
      code: "import { test } from '@playwright/test';\nconst { test: helper } = helpers;\n// helper.skip('example', () => {});",
    },
    {
      name: 'leaves destructured names from another runner alone',
      code: "import { test } from '@playwright/test';\nimport * as runner from 'vitest';\nconst { test: spec } = runner;\n// spec.skip('example', () => {});",
    },
    {
      name: 'leaves namespace hook aliases out of commented-out tests',
      code: "import * as runner from 'node:test';\nconst { before: setup } = runner;\n// setup(() => {});",
      settings: settings({ framework: 'node-test' }),
    },
    {
      name: 'leaves destructured helpers from a reassigned namespace alias alone',
      code: "import * as pw from '@playwright/test';\nlet runner = pw;\nrunner = helpers;\nconst { test: spec } = runner;\n// spec.skip('example', () => {});",
    },
    "import * as pw from '@playwright/test';\nconst { test: spec } = pw;\n// SKIP: EXAMPLE-1\n// spec.skip('example', () => {});",
    "const { test: spec } = require('@playwright/test');\n// SKIP: EXAMPLE-1\n// spec.skip('example', () => {});",
  ],
  invalid: [
    {
      name: 'finds a commented-out test destructured from a namespace import',
      code: "import * as pw from '@playwright/test';\nconst { test: spec } = pw;\n// spec.skip('example', () => {});",
      errors: [missing],
    },
    {
      name: 'follows a namespace module alias before destructuring',
      code: "import * as pw from '@playwright/test';\nconst runner = pw;\nconst { test: spec } = runner;\n// spec.skip('example', () => {});",
      errors: [missing],
    },
    ...(
      [
        ['playwright', '@playwright/test', 'test'],
        ['jest', '@jest/globals', 'test'],
        ['node-test', 'node:test', 'test'],
        ['jasmine', 'jasmine-core', 'it'],
      ] as const
    ).map(([framework, module, exported]) => ({
      name: `recognizes a ${framework} file with only a required alias and a commented-out test`,
      code: `const { ${exported}: spec } = require('${module}');\n// spec('example', () => {});`,
      settings: settings({ framework }),
      errors: [missing],
    })),
  ],
});
