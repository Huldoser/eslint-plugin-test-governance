# eslint-plugin-test-governance

[![npm](https://img.shields.io/npm/v/eslint-plugin-test-governance)](https://www.npmjs.com/package/eslint-plugin-test-governance)
[![CI](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml/badge.svg)](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/eslint-plugin-test-governance)](LICENSE)

ESLint rules that keep a Playwright, Jest or Vitest suite honest. Every skipped, fixme, todo, `@new`
or `@unstable` test must point at the ticket that tracks it:

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

> **Status:** early release (0.x). Options may still change before 1.0.

## Install

```sh
npm install --save-dev eslint-plugin-test-governance
```

Requires ESLint 9 or 10 with flat config, and Node.js 22.12 or later. For TypeScript specs, also install
`@typescript-eslint/parser` (or `typescript-eslint`).

## Usage

```js
// eslint.config.js
import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configs.recommended,
  },
];
```

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
    extends: [testGovernance.configs.recommended],
  },
]);
```

Any flat config file works. The package is ESM, and `require('eslint-plugin-test-governance')` in an
`eslint.config.cjs` returns the plugin itself. Inside `defineConfig()`, once the plugin is registered
under `plugins`, the string form `extends: ['test-governance/recommended']` works too. ESLint loads
an `eslint.config.ts` through [`jiti`](https://github.com/unjs/jiti), so install it as a dev
dependency too.

To change the defaults, use `configure()`. It returns the same recommended config with your options
stored in `settings['test-governance']`, which all the rules read:

```js
export default [
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      // Only accept Jira keys from these projects (or Jira URLs).
      ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
      // Turn on the @new and @unstable states.
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

### Jest and Vitest

`recommended` is for Playwright. For Jest and Vitest, use `configs.jest` or `configs.vitest` and
point it at those test files with `files`, the way the Jest and Vitest ESLint plugins are set up.
In those files, `test`, `it` and `describe` belong to that framework, whether they are globals or
imported from `@jest/globals` or `vitest`. Each framework config sets only the framework, so the
options of an earlier `configure()` still apply to its files:

```js
export default [
  {
    files: ['e2e/**/*.spec.ts', 'src/**/*.test.ts'],
    ...testGovernance.configure({ ticket: { preset: 'jira', projects: ['TRADE'] } }),
  },
  // Unit tests run on Vitest; the e2e specs stay on Playwright.
  { files: ['src/**/*.test.ts'], ...testGovernance.configs.vitest },
];
```

`configure({ framework: 'jest', ... })` gives the Jest config with options in one call, and
`configs.playwright` is the Playwright config with its framework set, for a file list that needs it.
All four configs turn on the same rules. What puts a test in a state in each framework:

| State (marker)                         | Playwright                                                                                                          | Jest                                                                 | Vitest                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `skip` (`// SKIP:`)                    | `test.skip(...)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()`, `test.step.skip`, `step.skip()` | `test.skip`, `it.skip`, `describe.skip`, `xit`, `xtest`, `xdescribe` | `test.skip`, `it.skip`, `describe.skip`, `suite.skip`, `{ skip: true }`, `context.skip()` or `skip()` in a body |
| `todo` (`// TODO:`)                    |                                                                                                                     | `test.todo`, `it.todo`                                               | `test.todo`, `describe.todo`, `{ todo: true }`                                                                  |
| `fixme` (`// FIXME:`)                  | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                                                        |                                                                      |                                                                                                                 |
| `fail` (`// FAIL:`), off by default    | `test.fail(...)`, `testInfo.fail()`                                                                                 | `test.failing`                                                       | `test.fails`, `{ fails: true }`                                                                                 |
| `slow` (`// SLOW:`), off by default    | `test.slow()`, `testInfo.slow()`                                                                                    |                                                                      |                                                                                                                 |
| conditional skip, no ticket by default | `test.skip(condition)`, `if (...) test.skip()`                                                                      |                                                                      | `skipIf(...)`, `runIf(...)`, `{ skip: condition }`, `context.skip(condition)`, `if (...) context.skip()`        |
| tags such as `@new` (`// NEW:`)        | the title, `{ tag }`                                                                                                | the title                                                            | the title, `{ tags }`                                                                                           |

Table-driven tests count too: `test.skip.each(table)(...)`, `describe.skip.each` and Vitest's `.for`.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) enabled in.\
⚠️ [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) set to warn in.\
✅ Set in the `recommended` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💡 Manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

| Name                                                                   | Description                                                                       | 💼  | ⚠️  | 🔧  | 💡  |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :-- | :-- | :-- | :-- |
| [marker-matches-state](docs/rules/marker-matches-state.md)             | Require the marker keyword to match the test's state                              | ✅  |     |     | 💡  |
| [no-conflicting-states](docs/rules/no-conflicting-states.md)           | Disallow state tags that contradict each other, differ in case or look like typos |     | ✅  | 🔧  |     |
| [no-orphaned-marker](docs/rules/no-orphaned-marker.md)                 | Disallow marker comments that no longer match a test state                        | ✅  |     |     | 💡  |
| [require-ticket](docs/rules/require-ticket.md)                         | Require a ticket marker comment above skipped, fixme and tagged tests             | ✅  |     |     | 💡  |
| [require-ticket-in-comments](docs/rules/require-ticket-in-comments.md) | Require FIXME and TODO comments in test files to start with a ticket              | ✅  |     |     | 💡  |

<!-- end auto-generated rules list -->

## Defaults

The defaults follow how most teams already work, so `recommended` is useful with no options.

| Setting                                                                                                   | Default                                                                      | Why                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| States that need a ticket                                                                                 | `skip`, `fixme`; in Jest and Vitest `skip`, `todo`                           | Every team skips tests. Chromium, GitLab and Slack all require a bug link on disabled tests.                             |
| `@new`, `@unstable`                                                                                       | off; `lifecycleTags: true` turns both on                                     | A promotion workflow is not universal. Teams that call it `@flaky` or `@quarantine` use `customStates`.                  |
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
yourself. The rules have no options of their own: they all read these shared settings, so they
always agree on ticket formats, states and markers. To turn a rule off, set it to `'off'` as usual.

| Option                        | Type                                                     | Default                           | Description                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framework`                   | `'playwright' \| 'jest' \| 'vitest'`                     | `'playwright'`                    | The test framework of the files the config applies to. `configs.jest` and `configs.vitest` set it. See [Jest and Vitest](#jest-and-vitest).                                                                                                                                                                                                                                                   |
| `ticket`                      | `TicketSpec \| TicketSpec[]`                             | `{ preset: 'any' }`               | Accepted ticket formats. An array accepts a ticket that matches any entry. See [Ticket presets](#ticket-presets).                                                                                                                                                                                                                                                                             |
| `placeholders`                | `string[]`                                               | see above                         | Tickets rejected as placeholders. `*` matches any characters. Case-insensitive; a leading `#` is ignored. Your list replaces the default one, so repeat the defaults you want to keep. Tickets numbered 0 are always rejected.                                                                                                                                                                |
| `lifecycleTags`               | `boolean`                                                | `false`                           | Turns on the `new` (`@new`) and `unstable` (`@unstable`) states.                                                                                                                                                                                                                                                                                                                              |
| `states`                      | `{ [state]: boolean \| { enabled?, marker?, ticket? } }` | `skip`, `fixme` and `todo` on     | Turns built-in states (`skip`, `fixme`, `fail`, `slow`, `todo`, `new`, `unstable`) on or off, renames their marker, or gives them their own ticket format. `fail` and `slow` are off by default; a setting for `new` or `unstable` here wins over `lifecycleTags`. `fixme` and `slow` exist only in Playwright and `todo` only in Jest and Vitest, so turning one on elsewhere has no effect. |
| `customStates`                | `{ [name]: { when, marker, ticket? } }`                  | `{}`                              | Adds a state for a tag, e.g. `{ quarantine: { when: '@quarantine', marker: 'QUARANTINE' } }`. `when` is a tag and `marker` an uppercase keyword; neither can be shared with another state.                                                                                                                                                                                                    |
| `requireTicketForConditional` | `boolean`                                                | `false`                           | Require a ticket for conditional skips too: `test.skip(condition, ...)`, `if (...) test.skip()`, a skip in a `catch` block or after an early `return` or `throw`.                                                                                                                                                                                                                             |
| `allowBlankLine`              | `boolean`                                                | `false`                           | Let blank lines separate a marker from its test.                                                                                                                                                                                                                                                                                                                                              |
| `allowNotes`                  | `boolean`                                                | `false`                           | Allow free text after the tickets, e.g. `// SKIP: TRADE-123 flaky on CI`. Applies to markers and to `FIXME` / `TODO` comments.                                                                                                                                                                                                                                                                |
| `comments`                    | `false \| { keywords?: string[] }`                       | `{ keywords: ['FIXME', 'TODO'] }` | Comment keywords that must start with a ticket anywhere in a test file, e.g. `// TODO: TRADE-123`. Your keywords replace the default ones. `false` allows free-form comments.                                                                                                                                                                                                                 |
| `testFunctions`               | `string[]`                                               | `['test']`                        | Names treated as the framework's `test`. Jest and Vitest default to `['test', 'it']`. Your list replaces the default one, so include those names if you still need them. See below.                                                                                                                                                                                                           |
| `reportDynamicTitles`         | `boolean`                                                | `false`                           | When a tag state is on, report titles that aren't static text, since their tags can't be read.                                                                                                                                                                                                                                                                                                |

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
  ticket: { preset: 'jira', projects: ['TRADE'] },
  lifecycleTags: true,
  states: { unstable: { ticket: { preset: 'github' } } },
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

A name imported or required from another test runner (Playwright, `vitest`, `@jest/globals`,
`node:test`, `bun:test`, `mocha`, `ava`, `tap`, `uvu`), or a variable set from one such as
`const test = require('ava')`, is never treated as the framework's `test`, and neither is a local
variable declared inside a function that happens to be called `test`.

### Syntax the rules understand

The [Jest and Vitest](#jest-and-vitest) table lists what each framework's tests can do. In Playwright:

- `test.skip('title', fn)`, `test.fixme(...)`, `test.fail(...)`, with or without a details object,
  and with a body defined elsewhere, as in `test.skip('places a limit order', placeLimitOrder)`.
- `test.describe.skip(...)` and `test.describe.fixme(...)`, including `serial` and `parallel` variants.
  The state covers every test inside.
- Runtime calls inside a test, a describe or a hook such as `test.beforeEach`: `test.skip()`,
  `test.skip(true)`, `test.fixme()`, `test.fail()`, `test.slow()`, the same methods on `testInfo`,
  and `test.info().skip()`.
- Skipped steps: `test.step.skip('title', fn)`, and `step.skip()` on the `TestStepInfo` a step's body
  receives. Only the step is skipped, so a marker above the step or above a skipped test around it
  covers it.
- Tags in titles (string or template literal) and in `{ tag: '@new' }` / `{ tag: [...] }`, inherited
  from enclosing describes.

Not covered in this version: tests generated in loops with dynamic titles (see
`reportDynamicTitles`), fixtures imported from other modules under a name not in `testFunctions`,
Playwright annotations as markers, Vitest's `context.skip()` in a global `beforeEach` (the one on
`test.beforeEach` is covered), and other runners such as Mocha, Bun and `node:test`.

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
