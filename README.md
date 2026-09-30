# eslint-plugin-test-governance

ESLint rules that keep a Playwright suite honest. Every skipped, fixme, `@new` or `@unstable` test
must point at the ticket that tracks it:

```ts
// SKIP: WEB-123
test.skip('pays with PayPal', async ({ page }) => {
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

Any flat config file works. The package is ESM, and `require('eslint-plugin-test-governance')` in an
`eslint.config.cjs` returns the plugin itself. With `defineConfig`, register the plugin and use
`extends: ['test-governance/recommended']`. ESLint loads an `eslint.config.ts` through
[`jiti`](https://github.com/unjs/jiti), so install it as a dev dependency too.

To change the defaults, use `configure()`. It returns the same recommended config with your options
stored in `settings['test-governance']`, which all four rules read:

```js
export default [
  {
    files: ['tests/**/*.{js,ts}'],
    ...testGovernance.configure({
      // Only accept Jira keys from these projects (or Jira URLs).
      ticket: { preset: 'jira', projects: ['WEB', 'QA'] },
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

`configure()` validates the options when the config file loads, so a typo fails immediately rather
than on the first lint.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) enabled in.\
⚠️ [Configurations](https://github.com/Huldoser/eslint-plugin-test-governance#usage) set to warn in.\
✅ Set in the `recommended` [configuration](https://github.com/Huldoser/eslint-plugin-test-governance#usage).\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💡 Manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

| Name                                                         | Description                                                                       | 💼 | ⚠️ | 🔧 | 💡 |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------- | :- | :- | :- | :- |
| [marker-matches-state](docs/rules/marker-matches-state.md)   | Require the marker keyword to match the test's state                              | ✅  |    |    | 💡 |
| [no-conflicting-states](docs/rules/no-conflicting-states.md) | Disallow state tags that contradict each other, differ in case or look like typos |    | ✅  | 🔧 |    |
| [no-orphaned-marker](docs/rules/no-orphaned-marker.md)       | Disallow marker comments that no longer match a test state                        | ✅  |    |    | 💡 |
| [require-ticket](docs/rules/require-ticket.md)               | Require a ticket marker comment above skipped, fixme and tagged tests             | ✅  |    |    | 💡 |

<!-- end auto-generated rules list -->

## Defaults

The defaults follow how most teams already work, so `recommended` is useful with no options.

| Setting | Default | Why |
| --- | --- | --- |
| States that need a ticket | `skip`, `fixme` | Every team skips tests. Chromium, GitLab and Slack all require a bug link on disabled tests. |
| `@new`, `@unstable` | off; `lifecycleTags: true` turns both on | A promotion workflow is not universal. Teams that call it `@flaky` or `@quarantine` use `customStates`. |
| Conditional skips (`test.skip(browserName === 'webkit', ...)`) | no ticket needed | These are usually permanent platform limits, not bugs. `requireTicketForConditional: true` changes this. |
| `test.fail`, `test.slow` | off | They don't remove coverage. Turn them on with `states: { fail: true, slow: true }`. |
| Marker format | `// SKIP: WEB-123` or `// SKIP: WEB-123, WEB-124` | Uppercase keyword and colon, like `TODO:`. Easy to grep. |
| Notes after the ticket | not allowed; `allowNotes: true` allows them | The ticket is the source of truth. A note in a comment goes stale while the ticket stays current. |
| Placement | comment block directly above; other comments allowed; a blank line breaks it | Survives `eslint-disable-next-line` and Prettier. |
| Ticket format | `any`: `PROJ-123`, `#123`, `owner/repo#123`, or an http(s) URL | Works for Jira, Linear, GitHub and GitLab out of the box. Narrow it with a preset. |
| Placeholder tickets | rejected: `TODO`, `TBD`, `XXX-*`, `0`, `123`, `1234`, `12345`, and any ticket numbered 0 (`PROJ-0`, `#0`) | A fake ticket is worse than none, and no tracker issues number 0. |
| Describe blocks | a marker on a skipped or tagged describe covers its tests | One ticket per skipped suite. |
| Severity | `require-ticket`, `marker-matches-state`, `no-orphaned-marker`: error; `no-conflicting-states`: warn | A marker must always match a real state, so a missing, wrong or leftover marker fails the lint. Tag spelling is cleanup. |

## Options

All options go in `configure({...})`, or in `settings['test-governance']` if you build the config
yourself. Each rule also accepts the same object as a rule option, which overrides the shared
settings for that rule.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ticket` | `TicketSpec \| TicketSpec[]` | `{ preset: 'any' }` | Accepted ticket formats. An array accepts a ticket that matches any entry. |
| `placeholders` | `string[]` | see above | Tickets rejected as placeholders. `*` matches any characters. Case-insensitive; a leading `#` is ignored. Tickets numbered 0 are always rejected. |
| `lifecycleTags` | `boolean` | `false` | Turns on the `new` (`@new`) and `unstable` (`@unstable`) states. |
| `states` | `{ [state]: boolean \| { enabled?, marker?, ticket? } }` | | Turns built-in states (`skip`, `fixme`, `fail`, `slow`, `new`, `unstable`) on or off, renames their marker, or gives them their own ticket format. |
| `customStates` | `{ [name]: { when, marker, ticket? } }` | `{}` | Adds a state for a tag, e.g. `{ quarantine: { when: '@quarantine', marker: 'QUARANTINE' } }`. |
| `requireTicketForConditional` | `boolean` | `false` | Require a ticket for `test.skip(condition, ...)` too. |
| `allowBlankLine` | `boolean` | `false` | Let blank lines separate a marker from its test. |
| `allowNotes` | `boolean` | `false` | Allow free text after the tickets, e.g. `// SKIP: WEB-123 flaky on CI`. |
| `testFunctions` | `string[]` | `['test']` | Names treated as Playwright's `test`. See below. |
| `reportDynamicTitles` | `boolean` | `false` | When a tag state is on, report titles that aren't static text, since their tags can't be read. |

### Ticket presets

| Preset | Accepts | Options |
| --- | --- | --- |
| `any` | `PROJ-123`, `#123`, `owner/repo#123`, any http(s) URL | |
| `jira` | `WEB-123`, `https://<host>/browse/WEB-123`, board URLs with `selectedIssue=WEB-123` | `projects`, `host` |
| `github` | `#123`, `owner/repo#123`, `https://github.com/owner/repo/issues/123` (or `/pull/`) | `host` for GitHub Enterprise |
| `gitlab` | `#123`, `group/project#123`, `https://gitlab.com/group/project/-/issues/123` | `host` for self-managed |
| `linear` | `ENG-123`, `https://linear.app/<workspace>/issue/ENG-123/...` | `teams` |
| `azure-devops` | `AB#123`, `https://dev.azure.com/<org>/<project>/_workitems/edit/123` | `host` for Azure DevOps Server |
| `numeric` | `4821` | `minLength` (1), `maxLength` (20) |
| `pattern` | anything matching your regex, anchored at both ends | `pattern`, `flags` |

Presets combine, and each state can have its own format. For example, bugs in Jira and flaky-test
reports in GitHub:

```js
testGovernance.configure({
  ticket: { preset: 'jira', projects: ['WEB'] },
  lifecycleTags: true,
  states: { unstable: { ticket: { preset: 'github' } } },
});
```

The built-in presets are written to run in linear time. A `pattern` preset runs your regex as given,
so keep it free of nested quantifiers.

### Which functions count as `test`

- `test` imported from `@playwright/test`, including aliases such as `import { test as it }` and
  `const { test } = require('@playwright/test')`.
- Fixtures made with `.extend()` in the same file, such as `const test = base.extend({...})`.
- Any name in `testFunctions`, for fixtures imported from your own modules. The default `['test']`
  covers the common `import { test } from './fixtures'`.

### Syntax the rules understand

- `test.skip('title', fn)`, `test.fixme(...)`, `test.fail(...)`, and the same with a details object.
- `test.describe.skip(...)` and `test.describe.fixme(...)`, including `serial` and `parallel` variants.
  The state covers every test inside.
- `test.skip()`, `test.skip(true)`, `test.fixme()` inside a test or hook; `testInfo.skip()`,
  `test.info().skip()`.
- Tags in titles (string or template literal) and in `{ tag: '@new' }` / `{ tag: [...] }`, inherited
  from enclosing describes.

Not covered in this version: tests generated in loops with dynamic titles, fixtures imported from
other modules under a name not in `testFunctions`, and Playwright annotations as markers.


## Development

```sh
npm install
npm test               # rule tests under espree and @typescript-eslint/parser
npm run test:coverage  # fails below 100% coverage of src/rules and src/utils
npm run typecheck
npm run test:pack      # pack the tarball and lint tests/fixtures/sample-project with it
npm run docs           # regenerate the rules list and rule doc headers
```

## License

[MIT](LICENSE)
