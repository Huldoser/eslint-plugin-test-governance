# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Opt-in `ticketsFromReasons` to accept ticket prefixes from Playwright and Node runtime skip
  reasons when no comment or annotation supplies the ticket.

- Opt-in `require-ticket-for-error-suppression` to track direct blanket Cypress uncaught-error
  handlers in specs and support files, without reserving a custom test-state name.

- Opt-in `comments.ticketedDisables` to require tracking tickets in descriptions when selected
  lint rules are disabled in test files, using the existing comment and state-marker checks.

## [0.14.1] - 2026-11-13

### Fixed

- Recognize imported Vitest tests with only a title as todos, including namespace imports and stable
  aliases, while leaving ambiguous global helpers unchanged.
- Track Node `getTestContext().skip()` and `.todo()` inside test and per-test hook bodies, including
  stable aliases and contexts retained across nested subtests.

## [0.14.0] - 2026-11-10

### Fixed

- Treat arguments passed to Mocha, Cypress and WebdriverIO `this.skip()` as ignored, so a false
  argument cannot hide an unconditional skip or explain a conditional one.
- Accept OpenProject short links under installation base paths and semantic work-package IDs,
  while rejecting their zero-number placeholders.
- Read ticket IDs from URLs matched by custom patterns, rejecting zero IDs without mistaking
  unrelated title suffixes or query values for placeholders.
- Recognize Vitest function titles without analyzing the name function as an executed body,
  and preserve options, runtime contexts and ticket-to-metadata suggestions.
- Find commented-out tests through namespace aliases and recognize CommonJS-only test files,
  while retaining protection against reassigned helpers and suite-hook aliases.

### Added

- Add the opt-in `limit-retries` rule for Playwright, Jest, Vitest, Mocha, Cypress and WebdriverIO.
  It checks readable native retry counts against the shared `maxRetries` setting (default `2`),
  independently of retry ticket requirements. Framework configs leave the rule off.
- Recognize chained Mocha retry setters such as `it('example', fn).retries(3)` for retry ticketing
  as well as retry limits.

### Removed

- **Breaking:** remove `lifecycleTags`, `states.new`, `states.quarantined` and their tag overrides.
  Use explicit `customStates` mappings for any tag that should require a ticket. Removed settings
  fail with migration instructions; native runner states keep their existing defaults.
- Remove the built-in checks for `@new` on a skipped test and for `@new` combined with `@quarantined`.
  Custom tags have no prescribed lifecycle or conflicts.

### Changed

- **Breaking:** rename `no-conflicting-states` to `consistent-tag-names`. It retains case fixes and
  spelling checks for `customStates` and `knownTags`; the old rule name fails with migration guidance.
  See the [upgrade guide](docs/upgrading.md#upgrading-to-014-custom-tag-states).

- Reorganize documentation around a complete first lint run, with separate configuration, framework
  and troubleshooting references. Clarify supported version combinations, optional states, example
  settings and recent upgrade actions; retain existing README section links.

## [0.13.3] - 2026-11-09

### Fixed

- Vitest conditional factories can clear an earlier skip in a modifier chain. Runtime context methods
  retain their state through TypeScript wrappers on the receiver or method.
- Mutation detection follows wrapped references and aliases, and recognizes writes through the global
  `Object` and `Reflect` mutation methods without treating shadowed helpers as those built-ins.
- Retry counts are read through local constants and object members, with effective properties after
  spreads and overrides. Unread spreads remain possible retries unless every relevant count is known.
- Commented-out tests no longer hide a broken marker or a disallowed note behind another valid marker.
- Negative numeric and bigint template interpolations, `void`, and unshadowed `undefined`, `NaN` and
  `Infinity` retain their rendered text when checking tag boundaries.
- Mutable constant objects and arrays no longer supply stale tag or annotation values after detected
  property writes, deletion, array mutation or writes through a local alias.
- Runtime context methods keep their original test owner inside nested subtests. Vitest skip notes
  supplied through constants remain unconditional skips.
- Test callees retain their meaning through TypeScript assertions and type instantiations, sequence
  expressions and defaulted local destructuring. Repeated conditional factories use the final condition.
- Nested conditional returns and throws, and conditional loop breaks and continues, guard later runtime
  skips. Jest retry calls are recognized through CommonJS object bindings and method aliases, including
  bound arguments.
- Primitive template interpolations retain their rendered text when checking tag boundaries. Object
  prototype setters do not count as own tag or metadata properties, and suggestions use computed keys
  for metadata named `__proto__`.
- Test functions are read through aliases of whole modules, local destructuring, bound functions and
  nested conditional selections. Reassigning an alias to a helper no longer leaves it treated as a test.
- Runtime test contexts and their methods keep their meaning through chains of aliases, `bind()` and
  default parameter values. Arguments supplied by `bind()` retain their condition and reason, and a
  bound title no longer gives a diagnostic whose end is before its start.
- A runtime skip in a conditional loop, or after a conditional early exit inside a nested block, is
  read as conditional. A TypeScript assertion around a literal boolean keeps that boolean's meaning.
- With the retry state on, Jest's retry calls are read through renamed and namespace imports, and a
  Mocha describe chosen by a condition still supplies its suite context for `this.retries()`.
- Chains of constants retain their tags, details and annotation tickets. An unread computed property
  no longer leaves an earlier member of a tag object treated as certain.
- Tags from literal and nested template interpolations are checked using the rendered text's boundaries,
  so joining text around an `@` doesn't invent a state tag. Plain Vitest tags written as templates count
  like quoted strings. Cyclic constant and template definitions remain unread instead of recursing.
- `annotations.only` checks every supplied issue ticket, including an invalid one next to a valid one.
- The commented-out-test rule recognizes renamed test imports.
- Removing an orphaned marker removes its complete line with CR or Unicode line endings too.
- A suggestion to add another state's marker no longer copies a ticket that state's format rejects.
- Suggestions that move a ticket into annotations escape line breaks in the annotation type or key,
  keeping the suggested JavaScript valid.

## [0.13.2] - 2026-11-08

### Fixed

- Local aliases such as `const check = it; check.skip(...)`, and aliases of conditional test functions,
  are checked like the functions they keep.
- A helper's parameter or block variable named like a test context no longer makes its `skip()` or
  `test()` calls count as runtime skips or subtests.
- Runtime calls with a literal `false` condition, such as Playwright's `test.skip(false)`, need neither
  a ticket nor a reason.
- Details, options and annotations use the last value of a property, including values from object
  spreads. An unread spread or computed key no longer leaves an earlier value treated as certain.
- A tag read beyond an array's bounds no longer crashes linting. An index after a spread, or a string
  such as `'01'` that isn't an array index, is left unread instead of using the wrong tag.
- Circular object spreads no longer overflow the stack during analysis.
- Playwright annotation arrays read tickets from spreads of arrays declared in the same file, and
  report unread spreads with `reportUnreadableTags`.
- A ticket marker in a block comment no longer hides unrelated `TODO` or `FIXME` work comments on
  other lines of that block.
- The `pattern` preset matches the whole ticket even with the multiline flag, and no longer accepts
  trailing line breaks outside the pattern.
- Moving a ticket into an annotation preserves comments inside an empty details object.
- node:test's `todo` state no longer makes `no-conflicting-states` call a new test skipped: Node still
  runs its body.

## [0.13.1] - 2026-11-06

### Fixed

- The `rally` preset no longer takes a prefix with no number, such as `US` or `TC`, as a ticket, so
  `// SKIP: TC` and, with `allowNotes`, a note that starts with "US" or "DE" need a real ticket.
- A second `configure()` for some of the same files, such as `{ preset: 'github' }` for a legacy folder after
  `{ preset: 'jira', projects: ['TRADE'] }` for all files, replaces the earlier ticket format. ESLint merged the
  two key by key, so linting failed with "ticket.projects is not an option of the github preset".
- The `github` preset reads Gitea's, Forgejo's and Codeberg's pull request links, `/<owner>/<repo>/pulls/12`.
- A `pattern` with an unmatched `)`, such as `TRADE-\d+)|(.*`, is a configuration error. It used to close the
  group that anchors the pattern, so every ticket passed.
- `plane` checks its `projects` as `jira` does: a key must start with a letter and have two or more characters,
  since no other key can match.
- An option named like a built-in object member, such as `customStates: { constructor: ... }`, is checked like
  any other.
- A marker in an `eslint-disable` comment, as in `/* eslint-disable jest/no-disabled-tests -- SKIP: TRADE-1 */`,
  covers every test up to the `eslint-enable`, also when the comment sits directly above a describe or a test that
  isn't skipped. `no-orphaned-marker` called it left over there, and its suggestion removed the marker the
  skipped tests below relied on. Such a marker is now reported only when none of the tests it covers is in its
  state, and `require-ticket-in-comments` no longer reports its note a second time.
- `require-ticket-for-commented-out-tests` counts only a call that declares a test, describe or step. Everyday
  lines such as `// test.slow();`, `// test.use({ ... })` and `// test.describe.configure({ ... })` were reported,
  and in a comment block above a skipped test they took that test's marker, so `require-ticket` reported it too,
  even with the commented-out rule off.
- A test function kept in a constant is read when a condition picks it, as
  `const itUnlessWindows = isWindows ? it.skip : it`, when a call builds it, as `describe.runIf(hasDocker)`,
  `it.skipIf(true)` or `it.skip.each(table)`, and when the constant is declared inside a describe. A marker above
  such a test was reported as not directly above a test.
- With `requireReasonForConditional`, the description of an `eslint-disable` comment that covers a stretch of the
  file no longer counts as the reason for every conditional skip in it. A reason written as a template literal
  counts in Vitest's `context.skip(...)` and in node:test's `skip` option, and so does a comment at the end of a
  one-line `test.skipIf(isMobile)(...)` or after an `if`'s opening line, as `if (isMobile) { // why`.
- Suggestions edit only the marker's own line: removing a leftover marker from a block comment that says more,
  such as a doc comment, another marker or an ESLint directive's description, keeps the rest of the comment, and
  renaming a marker no longer renames the same word in prose above it.
- With `annotations: { only: true }`, there is no suggestion to move a ticket into the details when it would break
  the call: a Vitest test with a timeout or options after its function, or details with a computed key such as
  `['annotation']`.
- The suggestion to add a marker uses the file's own line breaks, so it no longer leaves a bare line feed in a
  file with CRLF line endings.
- Playwright's `test.describe.configure({ retries })` is read, with `states: { retry: true }`, when the options
  sit in a constant or a spread, and when `describe` comes from `const { describe } = test`.
- A marker above `test.describe('orders', () => test.skip(...))`, whose arrow body is the test, belongs to the test
  as well, so `no-orphaned-marker` no longer calls it left over on the describe.
- node:test's `t.skip(message)` and `t.todo(message)` and Jasmine's `pending(message)` take no condition, so they
  need a ticket whatever the message is, also one held in a name or built in a template. A message in a name was
  read as a condition.
- A tag constant used in several titles, as `` `buys ${TAG}` ``, is reported once, where it is written.
- The example in the `missingReason` message is written on one line, also when the call is split over lines.
- With `requireReasonForConditional`, a comment above the declaration of a constant that picks a test function,
  as `const posixTest = isWindows ? test.skip : test`, or at the end of its line, is the reason for every test
  that uses it.
- A link whose `id` query is zero, such as `https://www.wrike.com/open.htm?id=0`, is a placeholder, as any ticket
  numbered 0 is. Other zero queries, such as `?page=0`, are left alone.
- A placeholder written with a leading `#`, such as `#TBD`, also matches `TBD`: a leading `#` is ignored on both
  the ticket and the placeholder.
- A link whose scheme isn't in lowercase, such as `HTTPS://...`, is read as a link.
- Linear, Trello, Shortcut and YouTrack links that end in a slash after the title, as
  `.../ENG-1/fix-rounding/`, are accepted.
- A lowercase Jira or Plane project in `projects` is reported once instead of twice.
- `numeric` with a `minLength` above its `maxLength`, and a `pattern` or `flags` that isn't a valid regex, are
  reported in the list of invalid options. Without `maxLength`, the message names its default of 20.
- The ticket format of a state that is off, or that the framework doesn't have, such as `states.fixme.ticket`
  with Jest, is checked too, so a mistake in it shows up at once.

## [0.13.0] - 2026-11-05

### Added

- `requireReasonForConditional`, off by default: a conditional skip, such as `test.skip(isMobile)` or
  `if (isWeekend) this.skip()`, needs a reason but no ticket. A comment above it or at the end of its line, above
  the `if` around it, or above its hook, step or test counts, and so does the reason the call takes where the runner
  has one, as Playwright's `test.skip(condition, 'why')`, Vitest's `context.skip(condition, 'why')`, node:test's
  `t.skip('why')` and `{ skip: isWindows && 'why' }`, and Jasmine's `pending('why')`. `require-ticket` reports the
  skips that give none.
- `knownTags`, such as `['@smoke', '@regression']`: `no-conflicting-states` gives these tags the case and typo
  checks state tags get, so `@Smoke` is fixed to `@smoke` and `@smok` is reported. A listed tag is never reported as
  a typo of a state tag.

## [0.12.1] - 2026-11-04

### Fixed

- `node:test`'s `tags` option, added in Node 26.2, is read like Vitest's: `{ tags: ['new'] }` puts a test or
  describe in the `@new` state, also when the options come first, as in `test({ tags: ['new'] }, fn)`. The README
  now also says that `fail` exists in `node:test`, where `test.expectFailure` and `{ expectFailure }` already put a
  test in it.

## [0.12.0] - 2026-11-04

### Added

- `annotations: { only: true }` for Playwright and Vitest: a test or describe must carry its ticket in the
  annotation, which reaches the test report, and a marker comment above one is reported with a suggestion that moves
  its tickets into `annotation` or `meta`. Runtime skips and steps, which can't carry an annotation, keep their
  comments. With any other framework, `only` is a configuration error.
- A new rule, `require-ticket-for-commented-out-tests`, set to warn in every config: a test commented out by hand,
  such as `// test('places an order', ...)`, needs the `// SKIP: <ticket>` marker a skipped test needs, anywhere in
  its block of comments. It reads comment text, so the configs warn rather than fail. A marker in such a block
  belongs to it, not to the test below the block.
- A `retry` state, off by default: with `states: { retry: true }`, retries need a `// RETRY: <ticket>` marker, as a
  skip needs `// SKIP:`. It reads Playwright's `test.describe.configure({ retries })`, Jest's `jest.retryTimes()`,
  Vitest's `{ retry }`, Mocha's `this.retries()` in a describe, test or hook written as a `function`, and Cypress's
  `{ retries }`. Any count but `0` counts, including one known only when the tests run, such as
  `process.env.CI ? 2 : 0`, since retries on CI are where flaky tests hide. node:test and Jasmine have no retries.
- A marker can be the description of an ESLint directive, as in
  `// eslint-disable-next-line jest/no-disabled-tests -- SKIP: TRADE-123`, so a skip that also turns off a rule
  banning skipped tests needs one comment, not two. It works in `eslint-disable-next-line` above the test,
  `eslint-disable-line` on its first line, and an `eslint-disable` block comment, which covers the tests up to the
  `eslint-enable` of one of its rules or of every rule. Removing such a marker keeps the directive, and a marker
  added next to it goes above it.

### Changed

- `require-ticket-in-comments` now reads the description of an ESLint directive, the text after `--`, as it
  reads any comment, so `// eslint-disable-next-line rule -- TODO: migrate this` in a test file needs a ticket:
  `-- TODO: TRADE-123`. Directives weren't read before, so a test file with such descriptions can get new reports on
  upgrade. Add the tickets, or set `comments: false` to turn the check off.

### Fixed

- The `clickup` preset no longer takes digits alone as a task in `#4821` or `https://app.clickup.com/t/9015210959`:
  the first is an issue number in GitHub, GitLab or Redmine, and the second is a workspace link. Write an
  all-digit task ID as `CU-4821` or `/t/<workspace>/4821`.

## [0.11.1] - 2026-11-03

### Fixed

- A skip declared through `Function.prototype.call`, `apply` or `bind`, such as
  `test.skip.call(null, 'places an order', fn)` or `test.skip.bind(null)('places an order', fn)`, is
  checked like the plain call, so it needs its ticket.

## [0.11.0] - 2026-11-01

### Added

- Ticket presets for six more trackers: `openproject` (classic `#4821` work package IDs, per-project IDs
  such as `AGILE-1`, and work package links once `host` is set), `bugzilla` (bug numbers, and
  `show_bug.cgi?id=4821` links once `host` is set), `phabricator` (task monograms such as `T4821`, and
  `/T4821` links once `host` is set; Phorge shares the format), `rally` (formatted IDs `US4821`, `DE4821`,
  `TA4821`, `TC4821`), `servicenow` (record numbers such as `STRY0010001` for the `prefixes` you list) and
  `plane` (work-item IDs such as `WEB-142`, and work-item links on `app.plane.so` or a `host`). The
  `rally` preset rejects zero-padded IDs, which is how MITRE ATT&CK writes its technique IDs (`TA0006`).
- Tickets from test annotations: with `annotations` (default `{ type: 'issue' }`), a valid ticket in
  Playwright's `annotation` of that type or Vitest's `meta` key of that name satisfies the ticket
  requirement, on tests and describes; an invalid one is reported, and `annotations: false` turns it
  off. Comments stay the form that works everywhere; Jest, Mocha, Jasmine, node:test and Cypress have
  no annotations.

### Changed

- A `host` value with a scheme, port or path, such as `https://jira.example.com` or `tracker.io:8080`, is
  now a configuration error on every preset that takes `host`, not only on `notion`, `redmine` and
  `youtrack`. Such a value never matched a URL hostname, so it already rejected every link silently.

## [0.10.1] - 2026-10-31

### Fixed

- Options that belong to another preset, such as `prefixes` on `trello`, are reported even when a value next
  to them is malformed, so one run shows both the misplaced option and the bad value.
- A placeholder with several `*` characters, such as `*a*a*a*a*b`, matches in one pass instead of
  backtracking on a long ticket.
- A details object written as a literal with a spread or a computed key, `{ ...base, tag: '@new' }` or
  `{ ['tag']: '@new' }`, keeps its tags and options; a key or spread that can't be read, such as an object
  imported from another file, is reported with `reportUnreadableTags` instead of being ignored.
- A tag read from an array element, `TAGS[1]`, or from a constant inside a template, `` `${TAG}` ``, is
  checked like the constant itself.
- A runtime skip method kept in a local variable, `const { skip } = t`, `const s = testInfo.skip` or
  `const p = pending`, is checked like the method called on the context, in every framework.
- `node:test`'s `test.describe` and `test.it` are read after `import { test } from 'node:test'`, as they were
  after `require()` or a default import. A state member kept in a variable, `const s = it.skip` or
  `const { skip } = it`, is checked like `it.skip(...)` in every framework. The same holds for a skip called
  on a required module used inline, `require('node:test').test.skip(...)`.

## [0.10.0] - 2026-10-30

### Added

- Ticket presets for more trackers: `trello`, `notion`, `asana`, `clickup`, `redmine`, `monday`,
  `youtrack`, `basecamp` and `shortcut`. Each accepts its tracker's ticket keys and links to one ticket,
  and rejects links to boards, projects, views and other sites. `prefixes` limits the keys Notion,
  ClickUp and monday.com accept, and `projects` the YouTrack projects; `host` sets a custom domain for
  Notion, a server for YouTrack, and the server whose links Redmine accepts.
- A `url` preset for any other tracker: it accepts links to the `hosts` you list, and `*.example.com`
  matches subdomains.
- The `azure-devops` preset accepts `#123`, which Azure Repos links to work item 123 in commit messages
  and pull requests.

### Fixed

- A link whose title ends in `-0`, as in `https://linear.app/acme/issue/ENG-1/upgrade-to-node-0`, was
  reported as a placeholder ticket. Only the ticket's own ID makes it a placeholder now, which also
  catches links where a title, suffix or query follows a zero ID, as in
  `https://linear.app/acme/issue/ENG-0/fix-rounding`.
- `host` takes `*.example.com` to match every subdomain, as in `{ preset: 'jira', host: '*.atlassian.net' }`.
  Before, such a host matched no link.
- `projects: []` (Jira) and `teams: []` (Linear) are config errors. An empty list rejected every key, and
  the messages read "in project ,".
- Links whose host ends in a dot, as in `https://dev.azure.com./acme/web/_workitems/edit/1`, are read like
  the same link without it.

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

[Unreleased]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.14.1...HEAD
[0.14.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.13.3...v0.14.0
[0.13.3]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.13.2...v0.13.3
[0.13.2]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.13.1...v0.13.2
[0.13.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.9.0...v0.10.0
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
