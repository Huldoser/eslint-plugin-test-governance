# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.9.0] - 2026-10-27

### Added

- Jasmine support. `configs.jasmine`, or `configure({ framework: 'jasmine' })`, checks tests run by
  Jasmine on its own, on Karma with karma-jasmine (as Angular's karma builder sets up) or by WebdriverIO's
  Jasmine framework: the globals `it`, `xit`, `fit`, `describe`, `xdescribe` and `fdescribe`, or the same
  names from `jasmine-core`. `xit` and `xdescribe` skip a test, and `it('title')` with no function is a
  todo. `pending()` and Jasmine 7's `notApplicable()` skip the running test in a test, `beforeEach` or
  `afterEach`; like `t.skip('reason')`, `pending('reason')` needs a ticket unless a condition guards it.
  `testFunctions` defaults to `['it']`, since Jasmine has no `test`.

## [0.8.1] - 2026-10-22

### Fixed

- In Playwright files, `const pw = require('@playwright/test')` and `import pw from '@playwright/test'`
  are `test` itself, so `pw.skip(...)`, `pw.describe.fixme(...)` and `pw.test.skip(...)` are checked.
  They were missed.
- In Mocha, Cypress and WebdriverIO files, `mocha.it.skip(...)` after `import mocha from 'mocha'` is
  checked, as it already was after `import * as mocha from 'mocha'` and `require('mocha')`.

## [0.8.0] - 2026-10-22

### Added

- `node:test` support. `configs['node-test']`, or `configure({ framework: 'node-test' })`, checks tests
  written with Node's built-in runner: `test`, `it`, `describe` and `suite` imported or required from
  `node:test`, their `skip`, `todo` and `expectFailure` members, which `node:test` also exports by name,
  and the same options. Node counts an option set to any value but `false` or `undefined`, so
  `{ skip: 'broker sandbox is down' }` always skips and needs a ticket, while `{ skip: isWindows }` is a
  conditional skip. `t.skip()` and `t.todo()` on a test's context, or `this.skip()` and `this.todo()` in a
  `function`, count in a test, `beforeEach` and `afterEach`, and subtests declared with `t.test()` are
  checked like tests. `expectFailure` is the `fail` state, which is off by default.

### Fixed

- A marker in the wrong case directly above a test in that state, as `// todo:` above `test.todo(...)`, is
  reported once, by `require-ticket`, which asks for uppercase. `require-ticket-in-comments` reported it too.

## [0.7.0] - 2026-10-20

### Added

- Mocha, Cypress and WebdriverIO support. `configs.mocha`, `configs.cypress` and `configs.webdriverio`,
  or `configure({ framework })`, check those frameworks' tests with the same rules and markers:
  `it.skip`, `describe.skip`, `context.skip`, `xit`, `xdescribe` and the other `x` forms, the TDD
  interface's `suite.skip` and `test.skip`, with globals or imports from `mocha`, and `this.skip()` in a
  test or hook written as a `function`. Under a condition, as in `if (!broker) this.skip()`, it is a
  conditional skip, so it needs no ticket by default. Cypress and WebdriverIO run their tests on Mocha,
  so their configs read the same calls; `webdriverio` is for WebdriverIO's Mocha framework.
- A Mocha test with only a title, `it('settles at T+1')`, which Mocha runs as pending, is in the `todo`
  state and needs a `// TODO:` marker, like Jest's `test.todo`. `it.skip('title')` with no body is a
  skip.
- In Cypress files, tags from @cypress/grep's `{ tags: '@smoke' }` count like tags in the title, and
  `{ browser: '!webkit' }`, which runs the test only in some browsers, is a conditional skip.

### Fixed

- A runtime skip after other code in a `try` block that has a `catch`, as in
  `try { await stat(target); test.skip(); } catch {}`, is a conditional skip: an error before it jumps to
  the `catch`, so the test runs. Before, it needed a ticket like an unconditional skip. A skip that starts
  the `try` block, or one in a `try` with only `finally`, still does. This covers Mocha's `this.skip()` too.

## [0.6.2] - 2026-10-14

### Fixed

- A test or describe whose function a condition picks, as in
  `(process.env.CI ? describe.skip : describe)('order book', fn)`, is now read as a conditional skip in
  Playwright, Jest and Vitest. Before, it wasn't seen at all: a `// SKIP:` marker above it was reported
  as orphaned, tags in its title didn't reach its tests, and `requireTicketForConditional` didn't
  require a ticket for it. In code without semicolons, a marker above the `;` that starts the line
  belongs to it.

## [0.6.1] - 2026-10-14

### Fixed

- In Playwright, `test.slow('title', body)` is no longer read as a slow test declared with a title.
  Playwright has no such form: `slow` only marks a running test, and a string before the description
  is its condition, so the call is checked like `test.slow(condition, description)`. Before, with the
  `slow` state on, it needed a `// SLOW:` marker even without `requireTicketForConditional`.

## [0.6.0] - 2026-10-14

This release renames the `unstable` state to `quarantined`.
[Upgrading to 0.6](https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/upgrading.md#upgrading-to-06)
shows what to change.

### Added

- `states` can rename the tag of the `new` and `quarantined` states, for teams that call them
  something else: `states: { quarantined: { tag: '@flaky', marker: 'FLAKY' } }` makes `@flaky` tests
  need a `// FLAKY:` marker. The rules check the new tag as they did the default one, and
  `@quarantined` no longer counts.

### Changed

- **Breaking:** the `unstable` state is renamed to `quarantined`. `lifecycleTags: true` now turns on
  `@quarantined`, with the `// QUARANTINED:` marker, instead of `@unstable` and `// UNSTABLE:`, so rename
  those in your tests, or keep them with
  `states: { quarantined: { tag: '@unstable', marker: 'UNSTABLE' } }`. A config that sets
  `states.unstable` fails with a message that names `states.quarantined`. A config that only sets
  `lifecycleTags: true` still loads, but no longer checks `@unstable` tests.

## [0.5.1] - 2026-10-13

### Fixed

- In Jest and Vitest, a test or describe whose title is a variable and whose body is defined
  elsewhere, as in `test.skip(title, placeOrder)`, is checked. Before, it was read as Playwright's
  runtime `test.skip(condition, description)` and left alone, though Jest and Vitest have no such call.
  In Playwright, a title kept in a `const` in the same file now counts as a title too.
- Vitest's `test.skip('title')` and `describe.skip('title')` with no body need a `// SKIP:` marker, since
  Vitest reports them as skipped. Before, only `.todo` was checked without a body.
- Vitest's `context.skip('note')` always skips, so it needs a `// SKIP:` marker. Before, the note was
  read as a condition and the skip as conditional.
- In Playwright, `describe` taken out of `test`, as in `const { describe } = test`, works like
  `test.describe`: `describe.skip(...)` needs a marker, and tags in its title apply to the tests inside.
  Before, it wasn't recognized.
- A function declared inside another function that happens to be called `test` is no longer taken for
  the framework's `test`, as a local variable already wasn't.

## [0.5.0] - 2026-10-08

This release changes how the plugin is configured, ahead of 1.0.
[Upgrading to 0.5](https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/upgrading.md#upgrading-to-05)
shows what to change, with a before and after for each one.

### Changed

- **Breaking:** `configure()` needs a `framework`, as in
  `configure({ framework: 'playwright', ticket: { preset: 'jira' } })`, and so does
  `settings['test-governance']` in a config you build yourself. Before, a config without one checked
  files as Playwright tests. Now `configure()` fails when the config file loads, and hand-written
  settings fail on the first lint, with a message that names the three frameworks. To share options
  between frameworks, pass the same options to a `configure()` for each one.
- **Breaking:** `reportDynamicTitles` is renamed to `reportUnreadableTags`, because it also reports
  tags and details objects imported from another module, not only titles. It works the same way, and
  a config that still uses the old name fails with a message that names the new one.
- Vitest's `skipIf(true)` and `runIf(false)` always skip, so they need a ticket, like `{ skip: true }`
  and Playwright's `test.skip(true)`. `skipIf(false)` and `runIf(true)` never skip, so a `// SKIP:`
  marker above one is reported as left over. Any other condition is still a conditional skip. Before,
  a literal condition was treated like any other.

### Removed

- **Breaking:** `configs.recommended` is gone. It checked every file as Playwright tests, so pick the
  config for your framework instead: `configs.playwright`, `configs.jest` or `configs.vitest`. For
  Playwright, replace `configs.recommended` with `configs.playwright`, and
  `extends: ['test-governance/recommended']` with `extends: ['test-governance/playwright']`. The
  rules and their severities are the same. A config that still reads `configs.recommended` fails when
  it loads, with a message that points to the upgrade guide, rather than spreading nothing and turning
  the rules off.

### Fixed

- Tags kept in a `const` or an enum in the same file count, as in `{ tag: TAGS.NEW }` after
  `const TAGS = { NEW: '@new' } as const`, with spreads, `as const` and `satisfies`, and so do titles
  and details objects kept in a constant. Before, a test tagged this way needed no ticket, and a
  correct `// NEW:` marker above it was reported as left over.
- Tags and details imported from another module can't be read, so a marker for a tag state above such
  a test is no longer reported as left over, and neither is a Vitest state marker such as `// SKIP:`
  above a test whose options object is imported. With `reportUnreadableTags: true`, the unreadable
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

[Unreleased]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Huldoser/eslint-plugin-test-governance/releases/tag/v0.1.0
