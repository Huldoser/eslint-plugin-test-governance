# Framework syntax

[Getting started](../README.md#frameworks) · [Configuration](configuration.md) · [Troubleshooting](troubleshooting.md)

Choose the config for the runner that declares your tests. There is no default config. Scope each config
with `files`; the file pattern also distinguishes runners whose `it` and `describe` calls look alike.
Cypress and WebdriverIO's Mocha mode use Mocha syntax. For WebdriverIO's Jasmine mode, use `configs.jasmine`.
Karma users choose Jasmine or Mocha to match their adapter. Puppeteer users choose the config of their test runner.

A state is a condition the linter tracks, such as a skipped test or a tag configured in `customStates`.
A marker is the comment keyword for that state, such as `// SKIP:`. Tag rows below use the example
`customStates: { review: { when: '@needs-review', marker: 'REVIEW' } }`. Every tag policy is explicit;
see [Tag names](configuration.md#tag-names). The linter does not change which tests your runner executes.

## Playwright

- `test` imported from `@playwright/test`, `playwright/test` or a component-testing package such as
  `@playwright/experimental-ct-react`, including the default import, aliases such as
  `import { test as it }` or `const it = test`, and `const { test } = require('@playwright/test')`.
- `pw.test` on the whole module, after `import * as pw from '@playwright/test'`. The default import
  and `const pw = require('@playwright/test')` are `test` itself, so `pw.skip(...)` and
  `pw.test.skip(...)` both count.
- Fixtures made with `.extend()` or `mergeTests()` in the same file, such as
  `const test = base.extend({...})`.
- Any name in `testFunctions`, for fixtures imported from your own modules. The default `['test']`
  covers the common `import { test } from './fixtures'`.

| State                                       | Recognized syntax                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                         | `test.skip(...)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()`, `test.step.skip`, `step.skip()` |
| `fixme` (`// FIXME:`)                       | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                                                        |
| `fail` (`// FAIL:`), off by default         | `test.fail(...)`, `testInfo.fail()`                                                                                 |
| `slow` (`// SLOW:`), off by default         | `test.slow()`, `testInfo.slow()`                                                                                    |
| `retry` (`// RETRY:`), off by default       | `test.describe.configure({ retries })`                                                                              |
| conditional skip, no ticket by default      | `test.skip(condition)`, `if (...) test.skip()`, `(condition ? test.skip : test)(...)`                               |
| tags such as `@needs-review` (`// REVIEW:`) | the title, `{ tag }`                                                                                                |

Details-object tags and annotations require [Playwright 1.42+](https://playwright.dev/docs/api/class-test#test-describe).
Skipped steps require [1.50+](https://playwright.dev/docs/api/class-test#test-step-skip).
The rules also understand:

- `test.skip('title', fn)`, `test.fixme(...)`, `test.fail(...)`, with or without a details object,
  and with a body defined elsewhere, as in `test.skip('places a limit order', placeLimitOrder)`. The
  title can also be a `const` declared in the same file.
- `test.describe.skip(...)` and `test.describe.fixme(...)`, including `serial` and `parallel` variants,
  and `describe.skip(...)` after `const { describe } = test`. The state covers every test inside.
- Runtime calls inside a test, a describe or a hook such as `test.beforeEach`: `test.skip()`,
  `test.skip(true)`, `test.fixme()`, `test.fail()`, `test.slow()`, the same methods on `testInfo`,
  and `test.info().skip()`.
- Skipped steps: `test.step.skip('title', fn)`, and `step.skip()` on the `TestStepInfo` a step's body
  receives. Only the step is skipped, so a marker above the step or above a skipped test around it
  covers it.
- Tags in titles (string or template literal) and in `{ tag: '@needs-review' }` / `{ tag: [...] }`, inherited
  from enclosing describes. Tags, titles and details can also come from a `const` or an enum declared
  in the same file, as in `{ tag: TAGS.REVIEW }` after `const TAGS = { REVIEW: '@needs-review' } as const`, including
  arrays and spreads of them.

## Jest

- The globals `test`, `it`, `describe`, `xit`, `xtest`, `fit`, `xdescribe` and `fdescribe`,
  and the same names imported or required from `@jest/globals`, including aliases and namespace imports.

- Any name in `testFunctions`, which defaults to `['test', 'it']`.

| State                                       | Recognized syntax                                                    |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                         | `test.skip`, `it.skip`, `describe.skip`, `xit`, `xtest`, `xdescribe` |
| `todo` (`// TODO:`)                         | `test.todo`, `it.todo`                                               |
| `fail` (`// FAIL:`), off by default         | `test.failing`                                                       |
| `retry` (`// RETRY:`), off by default       | `jest.retryTimes()`                                                  |
| conditional skip, no ticket by default      | `(condition ? it.skip : it)(...)`                                    |
| tags such as `@needs-review` (`// REVIEW:`) | the title                                                            |

## Vitest

- The globals `test`, `it`, `describe` and `suite`, and the same names imported or required
  from `vitest`, including aliases and `import * as vi from 'vitest'`.
- Vitest fixtures made with `test.extend()` in the same file.
- Any name in `testFunctions`, which defaults to `['test', 'it']`.

| State                                       | Recognized syntax                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `skip` (`// SKIP:`)                         | `test.skip`, `it.skip`, `describe.skip`, `suite.skip`, `skipIf(true)`, `runIf(false)`, `{ skip: true }`, `context.skip()`, `context.skip('note')` or `skip()` in a body or in `beforeEach` |
| `todo` (`// TODO:`)                         | `test.todo`, `describe.todo`, `{ todo: true }`                                                                                                                                             |
| `fail` (`// FAIL:`), off by default         | `test.fails`, `{ fails: true }`                                                                                                                                                            |
| `retry` (`// RETRY:`), off by default       | `{ retry }`                                                                                                                                                                                |
| conditional skip, no ticket by default      | `skipIf(condition)`, `runIf(condition)`, `{ skip: condition }`, `context.skip(condition)`, `if (...) context.skip()`, `(condition ? it.skip : it)(...)`                                    |
| tags such as `@needs-review` (`// REVIEW:`) | the title, `{ tags }`, where `'needs-review'` and `'@needs-review'` both mean `@needs-review`                                                                                              |

`tags` and `meta` require [Vitest 4.1+](https://vitest.dev/api/test.html#meta).
Vitest writes tag names without the `@`: `{ tags: ['flaky'] }` matches the governance tag `@flaky`.
Define those tags in your [Vitest config](https://vitest.dev/guide/test-tags#defining-tags) too; this plugin's
`knownTags` does not register runner tags. A plain title containing `@flaky` is a separate convention.
Vitest's `.for` and `.each` table-driven forms count too.
Vitest also accepts a function as the name, as in `test.skip(function namedTest() {}, fn)`.
The name function is not executed; the separate body supplies the test context.

## Mocha

- The globals `it`, `specify`, `describe` and `context`, their `x` forms, the TDD names `suite` and
  `test`, and the hooks `before`, `beforeEach`, `after`, `afterEach`, `suiteSetup`, `setup`,
  `suiteTeardown` and `teardown`.
- The names imported or required from `mocha`, including aliases, and the whole module, as `mocha.it`
  after `import * as mocha from 'mocha'`, `import mocha from 'mocha'` or `const mocha = require('mocha')`.
- Any name in `testFunctions`, which defaults to `['it', 'specify', 'test']`.

| State                                       | Recognized syntax                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                         | `it.skip`, `specify.skip`, `describe.skip`, `context.skip`, `xit`, `xspecify`, `xdescribe`, `xcontext`, TDD `test.skip` and `suite.skip`, `this.skip()` in a test or hook |
| `todo` (`// TODO:`)                         | a test with only a title, `it('title')`, which Mocha runs as pending                                                                                                      |
| `retry` (`// RETRY:`), off by default       | `this.retries()` in a describe, test or hook written as a `function`                                                                                                      |
| conditional skip, no ticket by default      | `if (...) this.skip()`, `(condition ? it.skip : it)(...)`                                                                                                                 |
| tags such as `@needs-review` (`// REVIEW:`) | the title                                                                                                                                                                 |

Direct chained setters such as `it('name', fn).retries(3)` and `describe('name', fn).retries(3)`
also count for retry ticketing and [retry limits](rules/limit-retries.md).

`this.skip()` and `this.retries()` count in tests or hooks written as `function`; an arrow function
has no Mocha context. `this.slow(ms)` only sets the speed threshold and is not the `slow` state.
Mocha ignores arguments passed to `this.skip()`: `this.skip(false)` still skips, and an argument
does not supply a reason for a condition around the call.
A skipped test or describe with no body still counts as skipped.

## Cypress

Use the [Mocha syntax and imports](#mocha), plus the forms below.

| State                                       | Recognized syntax                        |
| ------------------------------------------- | ---------------------------------------- |
| `retry` (`// RETRY:`), off by default       | `{ retries }`                            |
| conditional skip, no ticket by default      | `{ browser: '!webkit' }`                 |
| tags such as `@needs-review` (`// REVIEW:`) | the title, `{ tags }` from @cypress/grep |

## WebdriverIO

Use the [Mocha syntax and imports](#mocha), plus the forms below.

| State                                       | Recognized syntax |
| ------------------------------------------- | ----------------- |
| tags such as `@needs-review` (`// REVIEW:`) | the title         |

## node-test

- `test`, `it`, `describe`, `suite`, the hooks `before`, `beforeEach`, `after` and `afterEach`, and
  the members exported by name, `skip`, `todo`, `only` and `expectFailure`, imported or required from
  `node:test`, including aliases and `import * as nodeTest from 'node:test'`. The module is `test`
  itself, so after `import test from 'node:test'` or `const test = require('node:test')`,
  `test.describe(...)` is a describe.
- Subtests: `t.test(...)` on the context a test's body receives.
- Any name in `testFunctions`, which defaults to `['test', 'it']`. `node:test` has no globals.

| State                                       | Recognized syntax                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                         | `test.skip`, `it.skip`, `describe.skip`, `suite.skip`, `skip()`, `{ skip: true }` or `{ skip: 'reason' }`, `t.skip()`, `t.skip('reason')` or `this.skip()` in a test, `beforeEach` or `afterEach` |
| `todo` (`// TODO:`)                         | `test.todo`, `it.todo`, `describe.todo`, `suite.todo`, `todo()`, `{ todo: true }` or `{ todo: 'reason' }`, `t.todo()`, `this.todo()`                                                              |
| `fail` (`// FAIL:`), off by default         | `test.expectFailure`, `expectFailure()`, `{ expectFailure }`                                                                                                                                      |
| conditional skip, no ticket by default      | `{ skip: condition }`, `{ todo: condition }`, `if (...) t.skip()`, `(condition ? it.skip : it)(...)`                                                                                              |
| tags such as `@needs-review` (`// REVIEW:`) | the title, `{ tags }`, as in Vitest                                                                                                                                                               |

`node:test` has no globals. Any option value except `false` or `undefined` counts as enabled, so
`{ skip: 'broker sandbox is down' }` always skips. `t.skip()` and `t.todo()` take a message, not a
condition; `this.skip()` and `this.todo()` do the same in a test or hook written as `function`.

Subtests declared with `t.test('title', options, fn)` are checked like tests. A test or describe can
omit its title, as in `test({ skip: true }, fn)`. A test without a body, `test('title')`, passes in
Node and is not a todo. A describe's body and its `before`/`after` hooks get the suite context, which
cannot skip. Node reports only one state, in the order skip, todo, expectFailure, so
`describe.skip('title', { todo: 'why' }, fn)` needs only a `// SKIP:` marker.

The `tags` option requires Node 26.2+. Like Vitest's tags, `['flaky']` matches `@flaky`.
A skipped test or describe without a body still counts as skipped.

## Jasmine

- The globals `it`, `xit`, `fit`, `describe`, `xdescribe`, `fdescribe`, and the hooks `beforeEach`,
  `afterEach`, `beforeAll` and `afterAll`. With the runner's `globals: false`, Jasmine 7 takes the same
  names from `jasmine-core`, so names imported or required from it count too, including aliases and
  the whole module, as `core.xit` after `const core = require('jasmine-core')`.
- `pending()` and `notApplicable()`, as globals or imported by name.
- Any name in `testFunctions`, which defaults to `['it']`. Jasmine has no `test`.

| State                                       | Recognized syntax                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `skip` (`// SKIP:`)                         | `xit`, `xdescribe`, `pending()`, `pending('reason')` or `notApplicable('reason')` in a test, `beforeEach` or `afterEach` |
| `todo` (`// TODO:`)                         | a test with only a title, `it('title')`, which Jasmine reports as pending                                                |
| conditional skip, no ticket by default      | `if (...) pending()`, `(condition ? xit : it)(...)`                                                                      |
| tags such as `@needs-review` (`// REVIEW:`) | the title                                                                                                                |

`notApplicable()` and imports from `jasmine-core` with globals disabled require Jasmine 7.
`pending()` and `notApplicable()` stop the current test in a test, `beforeEach` or `afterEach`.
In `beforeAll`, `afterAll` or a describe body they fail the suite instead, so the plugin leaves them
alone there. Their argument is a reason, not a condition. A local helper named `pending` is not
Jasmine's function. `xit('title')` without a body is skipped.

## Shared behavior

Table-driven forms such as `test.skip.each(table)(...)` and `describe.skip.each` count in runners
that support them. A conditional callee, `(isMobile ? test.skip : test)('title', fn)`, is a conditional
skip in every framework. Literal conditions decide the state: `skipIf(true)` and `runIf(false)`
always skip; `skipIf(false)`, `runIf(true)` and `{ skip: false }` never do. Vitest's `test.skip('title')`
and `describe.skip('title')` without a body still count as skipped.

A name imported or required from another test runner (Playwright, `vitest`, `@jest/globals`,
`node:test`, `jasmine-core`, `bun:test`, `mocha`, `ava`, `tap`, `uvu`), or a variable set from one such as
`const test = require('ava')`, is never treated as the framework's `test`, and neither is a local
variable or function declared inside a function that happens to be called `test`.

## Static analysis limits

The rules inspect the file without executing tests or resolving values from other modules.
Loops and dynamic titles do not prevent the rules from checking unconditional skip calls. However,
a computed title or imported details can hide tags; `reportUnreadableTags: true` reports unreadable
tag content when a tag state is enabled. String and template titles, including templates such as
`` `buys ${symbol} @needs-review` ``, retain their readable tags. See
[unreadable titles and tags](rules/require-ticket.md#titles-and-tags-that-cant-be-read).

These forms are not covered:

- Fixtures imported under a name absent from `testFunctions`.
- A Vitest test with only a title, which is a todo at runtime but resembles a helper named `test`.
- Cypress's @cypress/skip-test `skipOn()` and `onlyOn()`.
- `node:test`'s `getTestContext()`.
- Jasmine's `pending()` in a helper called by tests, or Jasmine 5/6's `jasmine-core.noGlobals()`.
- Other runners, such as Bun.

The plugin validates ticket text and placeholders, not whether an issue exists or is open. It makes
no issue-tracker requests and does not prevent focused tests such as `test.only`. Use your runner's
ESLint plugin for checks outside ticket governance.
