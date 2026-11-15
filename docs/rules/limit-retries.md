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

## Runner configuration files

Set `checkConfigRetries: true` on explicitly selected JavaScript or TypeScript runner config files.
It defaults to `false` and does not enable the rule by itself. This complete ESLint config checks
Playwright's JavaScript config with a ceiling of one retry, without applying test-ticket rules there:

<!-- config: config-retry-limit -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

const policy = testGovernance.configure({
  framework: 'playwright',
  maxRetries: 1,
  checkConfigRetries: true,
});

export default [
  {
    files: ['playwright.config.{js,mjs,cjs}'],
    plugins: policy.plugins,
    settings: policy.settings,
    rules: { 'test-governance/limit-retries': 'error' },
  },
];
```

For TypeScript runner configs, include their extensions in `files` and configure a
[TypeScript parser](../configuration.md#typescript). Use `framework: 'vitest'` with your Vitest/Vite
config paths, or `framework: 'cypress'` with your Cypress config paths.

With `checkConfigRetries: true` and the default ceiling of two, this config exceeds the limit:

<!-- example: invalid settings={"checkConfigRetries":true} -->

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({ retries: process.env.CI ? 3 : 0 });
```

This count meets the same limit:

<!-- example: valid settings={"checkConfigRetries":true} -->

```js
export default { retries: 2 };
```

| Framework  | Configuration paths checked                                                               |
| ---------- | ----------------------------------------------------------------------------------------- |
| Playwright | Root `retries` and each inline `projects` entry's `retries`                               |
| Vitest     | `test.retry`, including `{ count }`, and `test.projects` inline projects' `test.retry`    |
| Cypress    | Root, `e2e` and `component` `retries`, including separate `runMode` and `openMode` counts |

The rule reads ESM default exports and top-level `module.exports = ...`, including readable local
constants. It recognizes single-argument `defineConfig` calls imported from `@playwright/test`,
`playwright/test`, `vitest/config`, `vite` or `cypress` for the selected framework, plus Vitest's
`defineProject`. Named imports, namespace imports, CommonJS module imports and destructured
`require` imports work. Vitest config functions are readable when they return an expression directly
or contain only one return statement.

Unrelated nested options, such as `use`, `env` or `metadata`, are not retry policies. A config count
is checked where written, even if a project overrides it; the rule does not calculate the effective
inherited count. Global defaults do not create retry states or require tickets, including when
`states.retry` is enabled. Tickets never exempt a count from the ceiling.

## Static analysis limits

The rule reads numeric literals, unary `+` and `-` on numeric literals or local numeric constants,
and immutable constants and object members declared in the same file. It checks both branches of
a conditional expression such as `process.env.CI ? 3 : 0`, reporting each readable excessive count.
If the condition is a boolean literal or a readable local boolean constant, only its selected branch
is checked.

Negated boolean literals select their branch too. Immutable object and array destructuring can
supply local counts; destructuring defaults, rest bindings and getters are not evaluated.
Local boolean aliases and conditional boolean predicates select branches consistently. Static object
spreads and computed string keys can supply local counts; unknown properties remain unread.
TypeScript assertions, non-null assertions and `satisfies` around native retry calls preserve detection.

Imported values, mutable variables, arithmetic expressions and function results are not evaluated.
An unknown count is left alone; a clean lint run does not prove it meets the maximum. The rule
does not resolve inherited settings across files, command-line flags, or options supplied by a tag
definition. Config factories with multiple merged arguments, imported configs, arbitrary helper
calls, async config functions and functions with other statements are outside config support.
Config code is never executed. Assertion polling is outside this rule's scope.

## Options

Set these in [`configure()`](../configuration.md#options), not in the rule's option array:

- `maxRetries`: the largest permitted retry count, default `2`.
- `checkConfigRetries`: include supported runner config exports, default `false`.
- `framework` and `testFunctions`: which native calls belong to your test runner.

See [retry ticketing](require-ticket.md) for the separate policy that requires a tracking issue.
