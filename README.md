# eslint-plugin-test-governance

[![npm](https://img.shields.io/npm/v/eslint-plugin-test-governance)](https://www.npmjs.com/package/eslint-plugin-test-governance)
[![CI](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml/badge.svg)](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/eslint-plugin-test-governance)](LICENSE)

ESLint rules that keep a Playwright, Jest, Vitest, Mocha, Cypress, WebdriverIO or `node:test` suite honest. Every skipped, fixme, todo, `@new`
or `@quarantined` test must point at the ticket that tracks it:

<!-- example: valid -->

```ts
// SKIP: TRADE-123
test.skip('rejects a margin order above the buying power', async ({ page }) => {
  // ...
});
```

Without the comment, `test-governance/require-ticket` fails the lint. When the test is fixed and the
skip removed, `no-orphaned-marker` flags the leftover comment. The markers are plain
comments, so `grep -rn "SKIP:" tests/` lists every disabled test and its ticket.

> **Status:** early release (0.x). Options may still change before 1.0. Coming from 0.5?
> [Upgrading to 0.6](docs/upgrading.md#upgrading-to-06) shows what to change.

## Install

```sh
npm install --save-dev eslint-plugin-test-governance
```

Requires ESLint 9 or 10 with flat config, and Node.js 22.12 or later. For TypeScript specs, also install
`@typescript-eslint/parser` (or `typescript-eslint`).

## Usage

Pick the config for the framework your tests use, `configs.playwright`, `configs.jest`,
`configs.vitest`, `configs.mocha`, `configs.cypress`, `configs.webdriverio` or `configs['node-test']` for
Node's built-in runner, and point it at those test files with `files`:

```js
// eslint.config.js
import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configs.playwright,
  },
];
```

There is no default config. Each framework declares, skips and tags tests its own way, so the rules
need to know which one a file uses. In a Jest, Vitest or Mocha config, `test`, `it` and `describe` belong
to that framework, whether they are globals or imported from `@jest/globals`, `vitest` or `mocha`, the
way the Jest, Vitest and Mocha ESLint plugins are set up. `node:test` has no globals, so in its config
they are the names imported or required from `node:test`, and `test` and `it` from `testFunctions`.

Cypress and WebdriverIO run their tests on Mocha, so `configs.cypress` and `configs.webdriverio` read the
same calls as `configs.mocha`. `webdriverio` means WebdriverIO's Mocha framework; its Jasmine framework
isn't supported yet. Puppeteer has no test functions of its own, so use the config of the runner its
tests run on: `configs.jest` for jest-puppeteer, or `configs.vitest`, `configs.mocha` or
`configs['node-test']`.

With ESLint's `defineConfig()` (ESLint 9.22 or later), put the config in `extends`:

```js
// eslint.config.js
import { defineConfig } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default defineConfig([
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    extends: [testGovernance.configs.playwright],
  },
]);
```

Any flat config file works. The package is ESM, and `require('eslint-plugin-test-governance')` in an
`eslint.config.cjs` returns the plugin itself. Inside `defineConfig()`, once the plugin is registered
under `plugins`, the string form `extends: ['test-governance/playwright']` works too. ESLint loads
an `eslint.config.ts` through [`jiti`](https://github.com/unjs/jiti), so install it as a dev
dependency too.

To change the defaults, use `configure()`. It takes the framework and your options, and returns that
framework's config with the options stored in `settings['test-governance']`, which all the rules read:

```js
export default [
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      framework: 'playwright',
      // Only accept Jira keys from these projects (or Jira URLs).
      ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
      // Turn on the @new and @quarantined states.
      lifecycleTags: true,
      // Any tag your team uses, with the same rules as the built-ins.
      customStates: {
        'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' },
      },
    }),
  },
];
```

`configure()` validates the options when the config file loads, so a mistake fails immediately
with a clear message rather than being ignored:

```text
eslint-plugin-test-governance: invalid options:
  - lifecycleTag is not a known option; did you mean "lifecycleTags"?
  - ticket.preset must be one of "any", "jira", "github", … (got "jria")
```

### Frameworks

A project with tests in more than one framework gives each framework its own config, pointed at its
files. To share options between them, pass the same options to each `configure()`:

```js
const options = { ticket: { preset: 'jira', projects: ['TRADE'] } };

export default [
  // The e2e specs run on Playwright, the unit tests on Vitest.
  { files: ['e2e/**/*.spec.ts'], ...testGovernance.configure({ framework: 'playwright', ...options }) },
  { files: ['src/**/*.test.ts'], ...testGovernance.configure({ framework: 'vitest', ...options }) },
];
```

Each framework's config, such as `configs.playwright`, sets only the framework, so one listed after a
`configure()` for the same files keeps that config's options and changes only the framework. They all
turn on the same rules. What puts a test in a state in each framework:

| State (marker)                         | Playwright                                                                                                          | Jest                                                                 | Vitest                                                                                                                                                                                     | Mocha                                                                                                                                                                     | Cypress                                  | WebdriverIO | node-test                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                    | `test.skip(...)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()`, `test.step.skip`, `step.skip()` | `test.skip`, `it.skip`, `describe.skip`, `xit`, `xtest`, `xdescribe` | `test.skip`, `it.skip`, `describe.skip`, `suite.skip`, `skipIf(true)`, `runIf(false)`, `{ skip: true }`, `context.skip()`, `context.skip('note')` or `skip()` in a body or in `beforeEach` | `it.skip`, `specify.skip`, `describe.skip`, `context.skip`, `xit`, `xspecify`, `xdescribe`, `xcontext`, TDD `test.skip` and `suite.skip`, `this.skip()` in a test or hook | as Mocha                                 | as Mocha    | `test.skip`, `it.skip`, `describe.skip`, `suite.skip`, `skip()`, `{ skip: true }` or `{ skip: 'reason' }`, `t.skip()`, `t.skip('reason')` or `this.skip()` in a test, `beforeEach` or `afterEach` |
| `todo` (`// TODO:`)                    |                                                                                                                     | `test.todo`, `it.todo`                                               | `test.todo`, `describe.todo`, `{ todo: true }`                                                                                                                                             | a test with only a title, `it('title')`, which Mocha runs as pending                                                                                                      | as Mocha                                 | as Mocha    | `test.todo`, `it.todo`, `describe.todo`, `suite.todo`, `todo()`, `{ todo: true }` or `{ todo: 'reason' }`, `t.todo()`, `this.todo()`                                                              |
| `fixme` (`// FIXME:`)                  | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                                                        |                                                                      |                                                                                                                                                                                            |                                                                                                                                                                           |                                          |             |                                                                                                                                                                                                   |
| `fail` (`// FAIL:`), off by default    | `test.fail(...)`, `testInfo.fail()`                                                                                 | `test.failing`                                                       | `test.fails`, `{ fails: true }`                                                                                                                                                            |                                                                                                                                                                           |                                          |             | `test.expectFailure`, `expectFailure()`, `{ expectFailure }`                                                                                                                                      |
| `slow` (`// SLOW:`), off by default    | `test.slow()`, `testInfo.slow()`                                                                                    |                                                                      |                                                                                                                                                                                            |                                                                                                                                                                           |                                          |             |                                                                                                                                                                                                   |
| conditional skip, no ticket by default | `test.skip(condition)`, `if (...) test.skip()`, `(condition ? test.skip : test)(...)`                               | `(condition ? it.skip : it)(...)`                                    | `skipIf(condition)`, `runIf(condition)`, `{ skip: condition }`, `context.skip(condition)`, `if (...) context.skip()`, `(condition ? it.skip : it)(...)`                                    | `if (...) this.skip()`, `(condition ? it.skip : it)(...)`                                                                                                                 | as Mocha, and `{ browser: '!webkit' }`   | as Mocha    | `{ skip: condition }`, `{ todo: condition }`, `if (...) t.skip()`, `(condition ? it.skip : it)(...)`                                                                                              |
| tags such as `@new` (`// NEW:`)        | the title, `{ tag }`                                                                                                | the title                                                            | the title, `{ tags }`, where `'new'` and `'@new'` both mean `@new`                                                                                                                         | the title                                                                                                                                                                 | the title, `{ tags }` from @cypress/grep | the title   | the title                                                                                                                                                                                         |

Table-driven tests count too: `test.skip.each(table)(...)`, `describe.skip.each` and Vitest's `.for`.
A test or describe whose function a condition picks, as in `(isMobile ? test.skip : test)('title', fn)`,
is a conditional skip in every framework.
A literal condition decides on its own: `skipIf(true)` and `runIf(false)` always skip, and `skipIf(false)`,
`runIf(true)` and `{ skip: false }` never do.
In Vitest, Mocha and `node:test`, `test.skip('title')` and `describe.skip('title')` with no body are skipped too.
In Mocha, `this.skip()` counts in a test or hook written as a `function`; an arrow function gets no
Mocha context, so its `this` is not the test's. `this.slow(ms)` only sets Mocha's speed threshold, so
it isn't the `slow` state.
Vitest writes tag names without the `@`, as in `{ tags: ['flaky'] }`, so a name in `tags` counts as the
tag with an `@` in front: `'flaky'` is `@flaky`, and a custom state with `when: '@flaky'` matches it.
In `node:test`, an option counts with any value but `false` or `undefined`, as Node reads it, so
`{ skip: 'broker sandbox is down' }` always skips. `t.skip()` and `t.todo()` take a message, not a
condition, and in a test or hook written as a `function`, `this.skip()` and `this.todo()` do the same.
Subtests declared with `t.test('title', options, fn)` are checked like tests, and a test or describe can
leave out its title and start with its options or body, as in `test({ skip: true }, fn)`.
A test with no function, `test('title')`, passes in Node, so it isn't a todo. A describe's body, and
`before` and `after` inside it, get the suite's context, which can't skip. Node reports a test in one
state only, skip before todo before `expectFailure`, so `describe.skip('title', { todo: 'why' }, fn)`
needs only a `// SKIP:` marker.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) enabled in.\
⚠️ [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) set to warn in.\
🌲 Set in the `cypress` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🃏 Set in the `jest` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
☕ Set in the `mocha` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🟢 Set in the `node-test` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🎭 Set in the `playwright` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
⚡ Set in the `vitest` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🤖 Set in the `webdriverio` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💡 Manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

| Name                                                                   | Description                                                                       | 💼                   | ⚠️                   | 🔧  | 💡  |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :------------------- | :------------------- | :-- | :-- |
| [marker-matches-state](docs/rules/marker-matches-state.md)             | Require the marker keyword to match the test's state                              | 🌲 🃏 ☕ 🟢 🎭 ⚡ 🤖 |                      |     | 💡  |
| [no-conflicting-states](docs/rules/no-conflicting-states.md)           | Disallow state tags that contradict each other, differ in case or look like typos |                      | 🌲 🃏 ☕ 🟢 🎭 ⚡ 🤖 | 🔧  |     |
| [no-orphaned-marker](docs/rules/no-orphaned-marker.md)                 | Disallow marker comments that no longer match a test state                        | 🌲 🃏 ☕ 🟢 🎭 ⚡ 🤖 |                      |     | 💡  |
| [require-ticket](docs/rules/require-ticket.md)                         | Require a ticket marker comment above skipped, fixme and tagged tests             | 🌲 🃏 ☕ 🟢 🎭 ⚡ 🤖 |                      |     | 💡  |
| [require-ticket-in-comments](docs/rules/require-ticket-in-comments.md) | Require FIXME and TODO comments in test files to start with a ticket              | 🌲 🃏 ☕ 🟢 🎭 ⚡ 🤖 |                      |     | 💡  |

<!-- end auto-generated rules list -->

## Defaults

The defaults follow how most teams already work, so each framework config is useful with no options.

| Setting                                                                                                   | Default                                                                      | Why                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| States that need a ticket                                                                                 | `skip`, `fixme`; in the other frameworks `skip`, `todo`                      | Every team skips tests. Chromium DevTools, GitLab and Slack all require a bug link on disabled tests.                    |
| `@new`, `@quarantined`                                                                                    | off; `lifecycleTags: true` turns both on                                     | A promotion workflow is not universal. Teams that say `@flaky` instead [rename the tag](#tag-names).                     |
| Conditional skips (`test.skip(browserName === 'webkit', ...)`, `if (...) test.skip()`, a skip in `catch`) | no ticket needed                                                             | These are usually permanent platform limits, not bugs. `requireTicketForConditional: true` changes this.                 |
| `test.fail`, `test.slow`, Jest's `test.failing`, Vitest's `test.fails`                                    | off                                                                          | They don't remove coverage. Turn them on with `states: { fail: true, slow: true }`.                                      |
| Marker format                                                                                             | `// SKIP: TRADE-123` or `// SKIP: TRADE-123, TRADE-124`                      | Uppercase keyword and colon, like `TODO:`. Easy to grep.                                                                 |
| Notes after the ticket                                                                                    | not allowed; `allowNotes: true` allows them                                  | The ticket is the source of truth. A note in a comment goes stale while the ticket stays current.                        |
| `FIXME` / `TODO` comments                                                                                 | must start with a ticket, e.g. `// TODO: TRADE-123` or `// TODO(TRADE-123)`  | The ticket is the source of truth; an untracked `TODO` is never done. `comments: false` turns this off.                  |
| Placement                                                                                                 | comment block directly above; other comments allowed; a blank line breaks it | Survives `eslint-disable-next-line` and Prettier.                                                                        |
| Ticket format                                                                                             | `any`: `PROJ-123`, `#123`, `owner/repo#123`, or an http(s) URL               | Works for Jira, Linear, GitHub and GitLab out of the box. Narrow it with a preset.                                       |
| Placeholder tickets                                                                                       | rejected: `TODO`, `TBD`, `XXX-*`, and any ticket numbered 0 (`PROJ-0`, `#0`) | A fake ticket is worse than none, and no tracker issues number 0.                                                        |
| Describe blocks                                                                                           | a marker on a skipped or tagged describe covers its tests                    | One ticket per skipped suite.                                                                                            |
| Severity                                                                                                  | `no-conflicting-states`: warn; every other rule: error                       | A marker must always match a real state, so a missing, wrong or leftover marker fails the lint. Tag spelling is cleanup. |

## Options

All options go in `configure({...})`, or in `settings['test-governance']` if you build the config
yourself. `framework` is required, and every other option has a default. The rules have no options
of their own: they all read these shared settings, so they always agree on ticket formats, states
and markers. To turn a rule off, set it to `'off'` as usual.

| Option                        | Type                                                                          | Default                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framework`                   | `'playwright' \| 'jest' \| 'vitest' \| 'mocha' \| 'cypress' \| 'webdriverio'` | required                          | The test framework of the files the config applies to. Each framework's config, such as `configs.playwright`, sets it, and `configure()` needs it. See [Frameworks](#frameworks).                                                                                                                                                                                                                                                                                                                                                            |
| `ticket`                      | `TicketSpec \| TicketSpec[]`                                                  | `{ preset: 'any' }`               | Accepted ticket formats. An array accepts a ticket that matches any entry. See [Ticket presets](#ticket-presets).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `placeholders`                | `string[]`                                                                    | see above                         | Tickets rejected as placeholders. `*` matches any characters. Case-insensitive; a leading `#` is ignored. Your list replaces the default one, so repeat the defaults you want to keep. Tickets numbered 0 are always rejected.                                                                                                                                                                                                                                                                                                               |
| `lifecycleTags`               | `boolean`                                                                     | `false`                           | Turns on the `new` (`@new`) and `quarantined` (`@quarantined`) states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `states`                      | `{ [state]: boolean \| { enabled?, tag?, marker?, ticket? } }`                | `skip`, `fixme` and `todo` on     | Turns built-in states (`skip`, `fixme`, `fail`, `slow`, `todo`, `new`, `quarantined`) on or off, renames their tag or marker, or gives them their own ticket format. `fail` and `slow` are off by default; a setting for `new` or `quarantined` here wins over `lifecycleTags`. Only `new` and `quarantined` have a tag to rename; see [Tag names](#tag-names). `fixme` and `slow` exist only in Playwright, `todo` in every framework but Playwright, and `fail` in Playwright, Jest and Vitest, so turning one on elsewhere has no effect. |
| `customStates`                | `{ [name]: { when, marker, ticket? } }`                                       | `{}`                              | Adds a state for a tag, e.g. `{ 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } }`. `when` is a tag and `marker` an uppercase keyword; neither can be shared with another state.                                                                                                                                                                                                                                                                                                                                                 |
| `requireTicketForConditional` | `boolean`                                                                     | `false`                           | Require a ticket for conditional skips too: `test.skip(condition, ...)`, `if (...) test.skip()`, `(condition ? test.skip : test)(...)`, a skip in a `catch` block, after other code in a `try` block with a `catch`, or after an early `return` or `throw`.                                                                                                                                                                                                                                                                                  |
| `allowBlankLine`              | `boolean`                                                                     | `false`                           | Let blank lines separate a marker from its test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `allowNotes`                  | `boolean`                                                                     | `false`                           | Allow free text after the tickets, e.g. `// SKIP: TRADE-123 flaky on CI`. Applies to markers and to `FIXME` / `TODO` comments.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `comments`                    | `false \| { keywords?: string[] }`                                            | `{ keywords: ['FIXME', 'TODO'] }` | Comment keywords that must start with a ticket anywhere in a test file, e.g. `// TODO: TRADE-123`. Your keywords replace the default ones. `false` allows free-form comments.                                                                                                                                                                                                                                                                                                                                                                |
| `testFunctions`               | `string[]`                                                                    | `['test']`                        | Names treated as the framework's `test`. Jest and Vitest default to `['test', 'it']`, and Mocha, Cypress and WebdriverIO to `['it', 'specify', 'test']`. Your list replaces the default one, so include those names if you still need them. See below.                                                                                                                                                                                                                                                                                       |
| `reportUnreadableTags`        | `boolean`                                                                     | `false`                           | When a tag state is on, report titles that aren't static text, and tags or details that can't be read in the file, such as ones imported from another module, since their tags can't be checked.                                                                                                                                                                                                                                                                                                                                             |

### Tag names

Teams name the stages of a test differently, so `states` can rename the tag of `new` and
`quarantined`. The marker keeps its name unless you rename it too:

```js
testGovernance.configure({
  framework: 'playwright',
  lifecycleTags: true,
  states: { quarantined: { tag: '@flaky', marker: 'FLAKY' } },
});
```

<!-- example: valid settings={"lifecycleTags":true,"states":{"quarantined":{"tag":"@flaky","marker":"FLAKY"}}} -->

```ts
// FLAKY: TRADE-311
test('streams level 2 quotes @flaky', async ({ page }) => {
  // ...
});
```

The new tag replaces the default one, so `@quarantined` no longer puts a test in the state, and the
rules check `@flaky` as they checked `@quarantined`: `@new` together with `@flaky` is reported, and so
is a near-miss such as `@flakey`. For a tag that isn't one of these stages, such as `@needs-data`, add
a `customStates` entry.

### Ticket presets

| Preset         | Accepts                                                                                                                                       | Options                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `any`          | `PROJ-123`, `#123`, `owner/repo#123`, any http(s) URL                                                                                         |                                                                                      |
| `jira`         | `TRADE-123`, `https://<host>/browse/TRADE-123` (also under a path, as in `/jira/browse/TRADE-123`), board URLs with `selectedIssue=TRADE-123` | `projects`; `host` (any host by default)                                             |
| `github`       | `#123`, `owner/repo#123`, `https://github.com/owner/repo/issues/123` (or `/pull/`)                                                            | `host` for GitHub Enterprise (`github.com` by default)                               |
| `gitlab`       | `#123`, `group/project#123`, `https://gitlab.com/group/project/-/issues/123`                                                                  | `host` for self-managed (`gitlab.com` by default)                                    |
| `linear`       | `RISK-123`, `https://linear.app/<workspace>/issue/RISK-123/...`                                                                               | `teams`                                                                              |
| `azure-devops` | `AB#123`, `https://dev.azure.com/<org>/<project>/_workitems/edit/123`                                                                         | `host` for Azure DevOps Server (`dev.azure.com` and `*.visualstudio.com` by default) |
| `numeric`      | `4821`                                                                                                                                        | `minLength` (1), `maxLength` (20)                                                    |
| `pattern`      | anything matching your regex, anchored at both ends                                                                                           | `pattern`, `flags`                                                                   |

`projects` (Jira) and `teams` (Linear) are keys as they appear in tickets, in uppercase: `TRADE` for
`TRADE-123`. Each preset takes only its own options, so `host` on the `any` preset fails with a clear
message instead of being ignored. A `pattern` always matches the whole ticket, so the `g` and `y`
flags make no difference and are ignored.

Presets combine, and each state can have its own format. For example, bugs in Jira and flaky-test
reports in GitHub:

```js
testGovernance.configure({
  framework: 'playwright',
  ticket: { preset: 'jira', projects: ['TRADE'] },
  lifecycleTags: true,
  states: { quarantined: { ticket: { preset: 'github' } } },
});
```

The built-in presets are written to run in linear time. A `pattern` preset runs your regex as given,
so keep it free of nested quantifiers.

### Which functions count as `test`

In Playwright files:

- `test` imported from `@playwright/test`, `playwright/test` or a component-testing package such as
  `@playwright/experimental-ct-react`, including the default import, aliases such as
  `import { test as it }` or `const it = test`, and `const { test } = require('@playwright/test')`.
- `pw.test` on the whole module, after `import * as pw from '@playwright/test'` or
  `const pw = require('@playwright/test')`.
- Fixtures made with `.extend()` or `mergeTests()` in the same file, such as
  `const test = base.extend({...})`.
- Any name in `testFunctions`, for fixtures imported from your own modules. The default `['test']`
  covers the common `import { test } from './fixtures'`.

In Jest and Vitest files:

- The globals `test`, `it` and `describe`, Jest's `xit`, `xtest`, `fit`, `xdescribe` and
  `fdescribe`, and Vitest's `suite`, and the same names imported or required from `@jest/globals` or
  `vitest`, including aliases and `import * as vi from 'vitest'`.
- Vitest fixtures made with `test.extend()` in the same file.
- Any name in `testFunctions`, which defaults to `['test', 'it']`.

In Mocha, Cypress and WebdriverIO files:

- The globals `it`, `specify`, `describe` and `context`, their `x` forms, the TDD names `suite` and
  `test`, and the hooks `before`, `beforeEach`, `after`, `afterEach`, `suiteSetup`, `setup`,
  `suiteTeardown` and `teardown`.
- The names imported or required from `mocha`, including aliases and `import * as mocha from 'mocha'`.
- Any name in `testFunctions`, which defaults to `['it', 'specify', 'test']`.

In `node:test` files:

- `test`, `it`, `describe`, `suite`, the hooks `before`, `beforeEach`, `after` and `afterEach`, and
  the members exported by name, `skip`, `todo`, `only` and `expectFailure`, imported or required from
  `node:test`, including aliases and `import * as nodeTest from 'node:test'`. The module is `test`
  itself, so after `import test from 'node:test'` or `const test = require('node:test')`,
  `test.describe(...)` is a describe.
- Subtests: `t.test(...)` on the context a test's body receives.
- Any name in `testFunctions`, which defaults to `['test', 'it']`. `node:test` has no globals.

A name imported or required from another test runner (Playwright, `vitest`, `@jest/globals`,
`node:test`, `bun:test`, `mocha`, `ava`, `tap`, `uvu`), or a variable set from one such as
`const test = require('ava')`, is never treated as the framework's `test`, and neither is a local
variable or function declared inside a function that happens to be called `test`.

### Syntax the rules understand

The [Frameworks](#frameworks) table lists what each framework's tests can do. In Playwright:

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
- Tags in titles (string or template literal) and in `{ tag: '@new' }` / `{ tag: [...] }`, inherited
  from enclosing describes. Tags, titles and details can also come from a `const` or an enum declared
  in the same file, as in `{ tag: TAGS.NEW }` after `const TAGS = { NEW: '@new' } as const`, including
  arrays and spreads of them.

Not covered in this version: tests generated in loops with dynamic titles, and tags or details imported
from other modules (see `reportUnreadableTags`), fixtures imported from other modules under a name not in
`testFunctions`, a Vitest test with only a title, which Vitest runs as a todo but which looks the same as a
helper called `test`, Playwright annotations as markers, Cypress tests skipped with @cypress/skip-test's
`skipOn()` and `onlyOn()`, `node:test`'s experimental `tags` option and `getTestContext()`, and other
runners such as Jasmine and Bun.

## TypeScript

The package ships its own type declarations, which work with TypeScript 5.0 or later. Besides the
plugin, it exports these types: `GovernanceOptions` (the options of `configure()`), `TicketSpec`,
`CustomState`, `StateOverride`, `FrameworkName`, `RuleName`, `ConfigName`, `FlatConfig` and
`TestGovernancePlugin`.

```ts
// eslint.config.ts
import tsParser from '@typescript-eslint/parser';
import testGovernance, { type GovernanceOptions } from 'eslint-plugin-test-governance';

const options: GovernanceOptions = {
  framework: 'playwright',
  lifecycleTags: true,
  ticket: { preset: 'jira', projects: ['TRADE'] },
};

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  { files: ['tests/**/*.ts'], ...testGovernance.configure(options) },
];
```

## Contributing

Bug reports and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains the setup and
the checks every pull request runs, and [CHANGELOG.md](CHANGELOG.md) lists the changes in each release.

## License

[MIT](LICENSE)
