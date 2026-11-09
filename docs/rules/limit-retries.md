# Enforce a maximum retry count for tests (`test-governance/limit-retries`)

Disabled in every [framework config](../../README.md#frameworks); enable it explicitly.

Reports problems without fixes.

<!-- end auto-generated rule header -->

A tracking ticket explains why a test needs retries, but does not limit how often it can run.
This rule reports a readable native retry count above `maxRetries`, even when the test has a valid
ticket. It works independently of `states.retry` and is off in every framework config.

## Enable the rule

Options use the plugin's shared settings. `maxRetries` defaults to `2`; set it to a non-negative
integer. `0` forbids positive retry counts. This complete config enables a maximum of one retry:

<!-- config: retry-limit -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

const policy = testGovernance.configure({ framework: 'playwright', maxRetries: 1 });

export default [
  {
    files: ['tests/**/*.js'],
    ...policy,
    rules: { ...policy.rules, 'test-governance/limit-retries': 'error' },
  },
];
```

Setting `maxRetries` alone does not enable the rule. To require tickets as well, enable
`states: { retry: true }`. A ticket does not exempt a retry count from the maximum.

## Examples

With the default maximum of two retries, these counts are allowed:

<!-- example: valid -->

```js
test.describe.configure({ retries: 2 });
```

The following count is too high:

<!-- example: invalid -->

```js
test.describe.configure({ retries: 3 });
```

The limit counts retries after the first attempt, not total attempts. For example, two retries
allow up to three attempts. The rule reports configuration where it is written, not once for
each test that inherits it. It does not change the runner's configuration or offer an automatic fix.

## Supported syntax

| Framework                   | Retry count                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright                  | `test.describe.configure({ retries: 3 })`                                                                                              |
| Jest                        | `jest.retryTimes(3)`                                                                                                                   |
| Vitest                      | A test or describe's `{ retry: 3 }` or `{ retry: { count: 3 } }`                                                                       |
| Mocha, Cypress, WebdriverIO | `this.retries(3)` in a suite, test or hook written as `function`, and `it('name', fn).retries(3)` or `describe('name', fn).retries(3)` |
| Cypress                     | A test or describe's `{ retries: 3 }` or `{ retries: { runMode: 3, openMode: 0 } }`                                                    |

Cypress's run and open counts are checked separately; Vitest's `delay` is not a retry count.
Imports, local aliases and custom test functions follow the [framework reference](../frameworks.md).
`node:test` and Jasmine have no native retries, so this rule has nothing to check in those configs.

## Static analysis limits

The rule reads numeric literals, unary `+` and `-` on numeric literals or local numeric constants,
and immutable constants and object members declared in the same file. It checks both branches of
a conditional expression such as `process.env.CI ? 3 : 0`, reporting each readable excessive count.
If the condition is a boolean literal or a readable local boolean constant, only its selected branch
is checked.

Imported values, mutable variables, arithmetic expressions and function results are not evaluated.
An unknown count is left alone; a clean lint run does not prove it meets the maximum. The rule
does not resolve inherited settings across files, runner configuration files, command-line flags,
or options supplied by a tag definition. Assertion polling is outside its scope.

## Options

Set these in [`configure()`](../configuration.md#options), not in the rule's option array:

- `maxRetries`: the largest permitted retry count, default `2`.
- `framework` and `testFunctions`: which native calls belong to your test runner.

See [retry ticketing](require-ticket.md) for the separate policy that requires a tracking issue.
