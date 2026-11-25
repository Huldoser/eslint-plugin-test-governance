# Require a ticket for Playwright serial groups (`test-governance/require-ticket-for-serial-groups`)

Disabled in every [framework config](../../README.md#frameworks); enable it explicitly.

Reports problems without fixes.

<!-- end auto-generated rule header -->

When a Playwright test in a [serial group](https://playwright.dev/docs/test-parallel#serial-mode)
fails, Playwright skips the rest of the group and retries the group together when retries are enabled.
Use this rule to track why tests need to share state until they can run independently.

Enable the rule on your Playwright test files. For TypeScript tests, include your
[TypeScript parser](../configuration.md#typescript) in the matching ESLint config.

<!-- config: serial-groups -->

```js
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['e2e/**/*.spec.js'],
    ...testGovernance.configs.playwright,
    rules: {
      ...testGovernance.configs.playwright.rules,
      'test-governance/require-ticket-for-serial-groups': 'error',
    },
  },
];
```

## Examples

This configuration enables serial mode for the file without a tracking ticket.

<!-- example: invalid -->

```js
import { test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
```

Place the marker above the call that enables serial mode. For a nested group using
`test.describe.configure`, put the marker inside the group, above the configuration call.

<!-- example: valid -->

```js
import { test } from '@playwright/test';

test.describe('shared order', () => {
  // SERIAL: EXAMPLE-123
  test.describe.configure({ mode: 'serial' });
});

// SERIAL: EXAMPLE-124
test.describe.serial('shared inventory', () => {});
```

The rule checks `test.describe.serial()`, `test.describe.serial.only()`, and
`test.describe.configure()` when it can read a `mode` of `'serial'` from the call or a local constant.
It reports once per serial declaration. Default or parallel execution, worker counts, and mode
values that depend on imports or runtime data are outside the check.

## Options

- `framework`: select Playwright.
- `testFunctions`: name test functions supplied by your own fixtures.
- `ticket` and `placeholders`: validate tickets after `SERIAL:`.
- `allowBlankLine` and `allowNotes`: apply the shared marker spacing and notes policy.
