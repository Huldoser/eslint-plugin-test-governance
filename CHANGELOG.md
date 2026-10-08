# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Breaking:** `configure()` needs a `framework`, as in
  `configure({ framework: 'playwright', ticket: { preset: 'jira' } })`, and so does
  `settings['test-governance']` in a config you build yourself. Before, a config without one checked
  files as Playwright tests. Now `configure()` fails when the config file loads, and hand-written
  settings fail on the first lint, with a message that names the three frameworks. To share options
  between frameworks, pass the same options to a `configure()` for each one.

### Removed

- **Breaking:** `configs.recommended` is gone. It checked every file as Playwright tests, so pick the
  config for your framework instead: `configs.playwright`, `configs.jest` or `configs.vitest`. For
  Playwright, replace `configs.recommended` with `configs.playwright`, and
  `extends: ['test-governance/recommended']` with `extends: ['test-governance/playwright']`. The
  rules and their severities are the same.

### Fixed

- Tags kept in a `const` or an enum in the same file count, as in `{ tag: TAGS.NEW }` after
  `const TAGS = { NEW: '@new' } as const`, with spreads, `as const` and `satisfies`, and so do titles
  and details objects kept in a constant. Before, a test tagged this way needed no ticket, and a
  correct `// NEW:` marker above it was reported as left over.
- Tags and details imported from another module can't be read, so a marker for a tag state above such
  a test is no longer reported as left over, and neither is a Vitest state marker such as `// SKIP:`
  above a test whose options object is imported. With `reportDynamicTitles: true`, the unreadable
  tags are reported, like titles that aren't static text.
- Vitest tag names, which are written without the `@` (`{ tags: ['flaky'] }`), match the states:
  `'new'` is `@new`, and a custom state with `when: '@flaky'` matches `'flaky'`. Before, they never
  matched. `no-conflicting-states` shows and fixes them without the `@`.
- `context.skip()` in Vitest's `beforeEach`, global or imported, needs a ticket, like the one in
  `test.beforeEach`. Before, it wasn't checked.
- A marker in the wrong case with a ticket, such as `// skip: TRADE-1`, is reported by
  `no-orphaned-marker` once the test is no longer skipped, and by `marker-matches-state` above a test in
  another state. Before, it was only reported while the test was still in that state.

## [0.4.0] - 2026-10-08

### Added

- Jest and Vitest support. `configs.jest` and `configs.vitest`, or `configure({ framework })`, check
  those frameworks' tests with the same rules and markers: `test.skip`, `it.skip`, `describe.skip`,
  Jest's `xit`, `xtest` and `xdescribe`, Vitest's `{ skip: true }` and `context.skip()`, and their
  `.each` tables, with globals or imports from `@jest/globals` and `vitest`. Vitest's `skipIf()`,
  `runIf()` and `{ skip: condition }` are conditional skips, so they need no ticket by default.
  Point each config at its framework's files with `files`; Playwright files keep using
  `recommended` or `configs.playwright`.
- A `todo` state for Jest's and Vitest's `test.todo`, with the `// TODO:` marker, on by default. A
  `// TODO: TRADE-123` above a test that isn't a todo is left alone as a tracked work comment. Jest's
  `test.failing` and Vitest's `test.fails` use the `fail` state, which stays off by default.
- Skipped steps need a ticket, like skipped tests: `test.step.skip('title', fn)` and `step.skip()`
  on the `TestStepInfo` a step's body receives. The marker goes above the call, above the step or
  above a skipped test around it. A marker above a step that isn't skipped is reported as left over.
  Before, skipped steps were not checked.

### Changed

- `#123`, `#1234` and `#12345` are real tickets now, not placeholders, since young repositories
  have issues with small numbers. Add them to `placeholders` to keep rejecting them. `TODO`, `TBD`,
  `XXX-*` and tickets numbered 0 are still rejected.

### Fixed

- The type declarations load in TypeScript 5.0 to 5.5. Before, they included a string export name
  that only TypeScript 5.6 and later can parse, so older versions failed on the plugin's types even
  with `skipLibCheck`.
- Tests inside a node type that a custom parser gives no visitor keys for are now checked. ESLint
  reads such nodes' children from the node itself, and the rules now do the same. Before, everything
  inside such a node was skipped.
- Test files that ESLint parses as CommonJS, such as `.cjs` files, are now checked. Before, their
  top-level variables were taken for local helpers, so a `test` from `require('@playwright/test')`
  was ignored by every rule.
- The `jira` preset accepts issue URLs on Jira Server and Data Center sites that run under a path,
  such as `https://issues.example.com/jira/browse/TRADE-123`. Before, only `/browse/...` right
  after the host was accepted.
- A plain alias of a Playwright test, as in `const orderTest = base`, is now followed like
  `base.extend()` and `mergeTests()` are. Before, tests declared through it were not checked.
- A quoted key in a destructured `require()` is read like a plain one. Before,
  `const { 'test': test } = require('node:test')` still counted as Playwright's `test`, so its
  skipped tests were reported, and `const { 'test': t } = require('@playwright/test')` was not
  followed.
- Tests written through the whole Playwright module, as in `import * as pw from '@playwright/test'`
  or `const pw = require('@playwright/test')` followed by `pw.test.skip(...)`, are now checked,
  including `pw.test.extend()` and `pw.mergeTests()`. Before, they were ignored.
- The `no-conflicting-states` fix for a tag in the wrong case changes only that tag. Before, an
  escape earlier in the title could make it change another one: in `'@New\u002Dbeta @New'` it
  rewrote the start of `@New-beta` and left `@New` as it was. A tag after an escape in its title is
  still reported, without a fix.
- Block comments with lone CR line breaks, or with the Unicode line and paragraph separators
  (U+2028, U+2029), are read line by line. Before, only LF and CRLF ended a line, so a marker or a
  `TODO` after the first line of such a comment was missed.
- A marker with only punctuation after the colon, such as `// SKIP: .`, is reported as missing its
  ticket. Before, the message was `'' is not a valid ticket`.
- A regex passed where an option expects a string is shown as written in the error, as in
  `ticket.pattern must be a string (got /TRADE-\d+/)`. Before, it was shown as `{}`.

## [0.3.1] - 2026-10-06

### Fixed

- A `test` bound to another test runner without an import, as in `const test = require('node:test')`,
  `const test = require('ava')` or `const test = anyTest as TestFn<Context>`, is no longer mistaken
  for Playwright's `test`. Before, skipped tests in those files were reported as missing a ticket.
- `require-ticket-in-comments` reads a ticket in parentheses after a space, as in `// TODO (WEB-123)`.
  Before, such comments were reported as having no ticket at all.
- A test or describe whose body is not written inline, such as `test.skip('pays', payWithCard)` or
  `test('pays @new', withPage(async () => {}))`, is checked like any other. Before, it was ignored,
  so a skipped test written this way needed no ticket.

## [0.3.0] - 2026-10-06

### Added

- `require-ticket-in-comments` accepts the ticket in parentheses: `// TODO(WEB-123)`. A name in
  parentheses, as in `// TODO(alice): refactor`, is not a ticket and is reported. Before, comments
  written this way were never checked.
- Configuration mistakes that used to be accepted silently now fail with a clear message: lowercase
  Jira `projects` or Linear `teams` (`'web'` never matches a ticket like `WEB-1`), options that belong
  to another ticket preset (such as `host` on the `any` preset), and a custom state that reuses a
  built-in state's name (`customStates: { fixme: ... }`).

### Fixed

- A skip in a `catch` block (`catch { test.skip(true, 'Mail server is down') }`) or after an early
  exit such as `if (ready) return;` counts as conditional, like one under an `if`, so it no longer
  needs a ticket by default.
- A plain `// FIXME: some text` above `test.skip(...)` no longer gets a confusing `marker-matches-state`
  error claiming the test is also in the `fixme` state. `require-ticket-in-comments` and
  `require-ticket` report what is actually wrong. The `marker-matches-state` message for a test in
  two states now starts its second sentence with a capital letter.
- `@stable`, `@untestable` and other tags two or more letters longer or shorter than `@unstable`
  (or any other state tag) are no longer reported as typos of it.
- A broken marker next to a valid one for the same state, as in `// SKIP: WEB-1` followed by
  `// SKIP: nope`, is reported. Before, the valid marker hid it.
- A full stop or colon after the last ticket, as in `// SKIP: WEB-1.`, is no longer reported as
  extra text.

## [0.2.1] - 2026-10-03

### Added

- A `funding` link in `package.json`, so `npm fund` points to
  [GitHub Sponsors](https://github.com/sponsors/Huldoser).

### Fixed

- A `pattern` ticket preset with the `g` or `y` flag no longer rejects every other valid ticket. Those
  flags are now ignored, since a ticket is always matched whole.
- A marker directly above a test that is the body of an arrow function, such as
  `rows.forEach((row) =>` followed by `// SKIP: WEB-1` and `test.skip(...)`, is found. It was
  reported both as missing and as a stray marker.

## [0.2.0] - 2026-10-01

0.1.1 was published with these changes by mistake and is deprecated. Use 0.2.0, or stay on 0.1.0
until you're ready for the changes below.

### Added

- New rule `require-ticket-in-comments`, on as an error in `recommended`: `FIXME` and `TODO` comments
  in test files must start with a ticket, such as `// TODO: WEB-123`. The `comments` option sets
  the keywords (`{ keywords: ['FIXME'] }` allows free-form `TODO`s) and `comments: false` turns the
  check off.
- `configure()` and `settings['test-governance']` are validated. A typo such as `lifecycleTag` or an
  unknown ticket preset fails with a clear message and a "did you mean" hint instead of being
  ignored or crashing with a `TypeError`.
- Tests from Playwright's component-testing packages (`@playwright/experimental-ct-*`) and fixtures
  combined with `mergeTests()` are recognised.

### Changed

- **Breaking:** rules no longer take options of their own. All options live in
  `settings['test-governance']` (set by `configure()`), so every rule reads the same settings and
  they can't disagree. Move any rule options into `configure({...})`.
- A missing marker is reported on the test's head, `test.skip('title'`, instead of underlining the
  whole test body in editors.
- `test` imported from another test runner (`vitest`, `@jest/globals`, `node:test`, `bun:test`,
  `mocha`, `ava`, `tap`, `uvu`), or a local variable called `test` inside a function, is no longer
  treated as Playwright's `test`.
- `no-orphaned-marker` leaves `FIXME` and `TODO` comments to `require-ticket-in-comments`, and none
  of the comment checks run in files that don't use Playwright, such as application code.

## [0.1.1] - 2026-10-01

Deprecated: this version was published with the changes listed under 0.2.0 by mistake.

### Added

- Releases are published from a version tag by GitHub Actions, with npm provenance and a GitHub
  release whose notes come from this changelog.

### Changed

- Node.js 22.12 or later is required, the first 22.x release that can `require()` an ES module
  ([#6](https://github.com/Huldoser/eslint-plugin-test-governance/pull/6)).
- A runtime skip under an `if`, a `switch` case, a ternary or `&&`/`||`/`??`, such as
  `if (!enabled) test.skip()`, counts as a conditional skip and needs no ticket by default
  ([#7](https://github.com/Huldoser/eslint-plugin-test-governance/pull/7)).
- The plugin reads `meta.version` from `package.json`.

### Fixed

- `require('eslint-plugin-test-governance')` returns the plugin itself, so a CommonJS config that
  registers the plugin and extends its config no longer fails with "Cannot redefine plugin"
  ([#6](https://github.com/Huldoser/eslint-plugin-test-governance/pull/6)).
- `no-orphaned-marker` no longer reports ordinary comments such as
  `// FIXME: this check is flaky on slow machines`
  ([#7](https://github.com/Huldoser/eslint-plugin-test-governance/pull/7)).

## [0.1.0] - 2026-09-30

First release.

### Added

- Rules `require-ticket`, `marker-matches-state`, `no-orphaned-marker` and `no-conflicting-states`.
- `configs.recommended`, and `configure()` for shared options that all four rules read.
- States `skip` and `fixme` on by default; `fail` and `slow` on request; `@new` and `@unstable`
  with `lifecycleTags: true`; any other tag with `customStates`.
- Ticket presets `any`, `jira`, `github`, `gitlab`, `linear`, `azure-devops`, `numeric` and
  `pattern`, which can be combined and set per state. Placeholder tickets are rejected.
- Support for ESLint 9 and 10 flat config, JavaScript and TypeScript test files, `.extend()`
  fixtures, describe blocks, runtime skips and tags in titles or the `tag` option.

[Unreleased]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Huldoser/eslint-plugin-test-governance/releases/tag/v0.1.0
