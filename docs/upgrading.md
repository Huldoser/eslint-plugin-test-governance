# Upgrading

Run ESLint on your tests before and after updating. An upgrade may recognize syntax that an older
version missed, producing new reports. Check the [changelog](../CHANGELOG.md) for fixes and additions.

## Upgrading to 0.13

No configuration migration is required. The new `requireReasonForConditional` and `knownTags`
settings are opt-in. Existing defaults stay the same. See [configuration](configuration.md#options).

## Upgrading to 0.12

| Change                                                       | Who it affects                                                     | Action                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| TODO/FIXME descriptions in ESLint directives are now checked | Test files containing descriptions such as `-- TODO: migrate this` | Add the ticket, as in `-- TODO: TRADE-123`. If your policy allows free-form TODOs, configure `comments.keywords` accordingly. |
| Commented-out tests now need markers                         | Projects using the framework configs                               | Add a valid `SKIP:` marker to each commented-out test block, or delete obsolete test code.                                    |
| Annotation-only tickets and retry tracking are available     | Projects opting into these settings                                | No action unless enabling `annotations.only` or `states.retry`.                                                               |

The commented-out-test rule is a warning by default. An existing `--max-warnings 0` command makes
warnings fail CI too. Its markers belong to the commented-out block, so a skipped active test below
still needs its own marker. See [the rule](rules/require-ticket-for-commented-out-tests.md).

## Upgrading to 0.11

Every ticket preset that takes `host` now rejects schemes, ports and paths at configuration load time.
Previously, those malformed values could silently reject links. Use just the hostname:

Before: `ticket: { preset: 'jira', host: 'https://jira.example.com' }`.

After: `ticket: { preset: 'jira', host: 'jira.example.com' }`.

Playwright annotations and Vitest metadata can now satisfy ticket requirements. When an enabled
state needs a ticket, a supplied annotation of the configured type is validated as well, even if
a marker is present. Check those existing values if an upgrade introduces an annotation error.
See [annotation tickets and runner prerequisites](configuration.md#tickets-from-annotations).

## Upgrading from 0.7 through 0.10

These releases add frameworks and ticket presets without requiring a config rename. Keep your
framework and `files` patterns explicit. The [changelog](../CHANGELOG.md) records syntax fixes that
may expose previously missed cases.

## Upgrading to 0.6

0.6.0 renames the `unstable` state to `quarantined`. Only projects that turn it on, with
`lifecycleTags: true` or `states.unstable`, need to change anything.

| What changed                                                | Who it affects                                           | What to do                                              |
| ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| [`@unstable` is now `@quarantined`](#the-quarantined-state) | Projects with `lifecycleTags: true` or `states.unstable` | Rename the tags and markers, or keep them with `states` |

### The quarantined state

The state's tag is now `@quarantined` and its marker `// QUARANTINED:`.

Before:

```ts
// UNSTABLE: TRADE-311
test('streams level 2 quotes @unstable', async ({ page }) => {});
```

After:

```ts
// QUARANTINED: TRADE-311
test('streams level 2 quotes @quarantined', async ({ page }) => {});
```

In Vitest, `{ tags: ['unstable'] }` becomes `{ tags: ['quarantined'] }` too. To keep the tags and
markers you have instead, name them in `states`:

```js
testGovernance.configure({
  framework: 'playwright',
  lifecycleTags: true,
  states: { quarantined: { tag: '@unstable', marker: 'UNSTABLE' } },
});
```

A config that sets `states.unstable` fails when it loads, so rename it to `states.quarantined`:

```text
eslint-plugin-test-governance: invalid options:
  - states.unstable was renamed to "quarantined"
```

A config that only sets `lifecycleTags: true` still loads, and nothing reports the old tag: an
`@unstable` test no longer needs a ticket, and its `// UNSTABLE:` marker is an ordinary comment. Before
you upgrade, list them with `grep -rni unstable tests/` (or wherever your tests are), then rename them
or keep them as above.

## Upgrading to 0.5

0.5.0 changes how the plugin is configured, ahead of 1.0. Most projects change one or two lines. A
config that still uses an old name fails when ESLint loads it, with a message that says what to
change, so no check is turned off without a word.

| What changed                                                        | Who it affects                                                                   | What to do                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`configs.recommended` is removed](#the-recommended-config)         | Playwright projects that use it                                                  | Use `configs.playwright`                              |
| [`framework` is required](#the-framework-option)                    | `configure()` calls and hand-written `settings['test-governance']` without one   | Add `framework: 'playwright'`, `'jest'` or `'vitest'` |
| [`reportDynamicTitles` is renamed](#reportunreadabletags)           | Configs that set it                                                              | Call it `reportUnreadableTags`                        |
| [Vitest's `skipIf(true)` needs a ticket](#vitests-skipif-and-runif) | Vitest tests skipped with a literal `true` in `skipIf()` or `false` in `runIf()` | Add a `// SKIP:` marker, or remove the skip           |

Jest and Vitest projects set up with `configs.jest`, `configs.vitest` or `configure({ framework })` in
0.4.0 can skip the first two rows.

### The recommended config

`configs.recommended` checked every file as Playwright tests. It is gone, so use the config for your
framework. The rules and their severities are the same.

Before:

```js
export default [{ files: ['tests/**/*.spec.ts'], ...testGovernance.configs.recommended }];
```

After:

```js
export default [{ files: ['tests/**/*.spec.ts'], ...testGovernance.configs.playwright }];
```

With `defineConfig()`, change `extends` the same way: `extends: [testGovernance.configs.recommended]`
becomes `extends: [testGovernance.configs.playwright]`, and `extends: ['test-governance/recommended']`
becomes `extends: ['test-governance/playwright']`.

A config that still reads `configs.recommended` fails when it loads:

```text
eslint-plugin-test-governance: configs.recommended was removed in 0.5.0. Use the config for your framework: configs.playwright, configs.jest, configs.vitest, configs.mocha, configs.cypress, configs.webdriverio, configs['node-test'] or configs.jasmine. See https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/upgrading.md
```

### The framework option

Before 0.5.0, a config without a `framework` checked files as Playwright tests. Now `configure()`
needs one.

Before:

```js
testGovernance.configure({
  ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
  lifecycleTags: true,
});
```

After:

```js
testGovernance.configure({
  framework: 'playwright',
  ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
  lifecycleTags: true,
});
```

Without it, the config fails when it loads:

```text
eslint-plugin-test-governance: invalid options:
  - framework is required: set it to "playwright", "jest", "vitest", "mocha", "cypress", "webdriverio", "node-test" or "jasmine", or use configs.playwright, configs.jest, configs.vitest, configs.mocha, configs.cypress, configs.webdriverio, configs['node-test'] or configs.jasmine
```

If you write `settings['test-governance']` yourself instead of calling `configure()`, add `framework`
there too. That config fails on the first lint instead, with the same message after
`Error while loading rule 'test-governance/require-ticket':`.

To share options between frameworks, pass the same options to a `configure()` for each one, as in
[Frameworks](../README.md#frameworks).

### reportUnreadableTags

`reportDynamicTitles` is now called `reportUnreadableTags`, because it also reports tags and details
objects imported from another module, not only titles. It works the same way.

Before:

```js
testGovernance.configure({ framework: 'playwright', lifecycleTags: true, reportDynamicTitles: true });
```

After:

```js
testGovernance.configure({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true });
```

The old name fails when the config loads:

```text
eslint-plugin-test-governance: invalid options:
  - reportDynamicTitles was renamed to "reportUnreadableTags"
```

### Vitest's skipIf and runIf

A literal condition now decides whether the test is skipped, as it does for `{ skip: true }` and
Playwright's `test.skip(true)`:

- `test.skipIf(true)` and `test.runIf(false)` always skip, so they need a `// SKIP:` marker.
- `test.skipIf(false)` and `test.runIf(true)` never skip, so a `// SKIP:` marker above one is reported
  as left over.
- Any other condition, such as `test.skipIf(process.env.CI)`, is a conditional skip as before. It needs
  a ticket only with `requireTicketForConditional: true`.

The same goes for `describe.skipIf()` and `describe.runIf()`.

```ts
// SKIP: TRADE-1482
test.skipIf(true)('fills a stop order when the market opens', () => {});
```

### Checking the upgrade

Run ESLint on your tests as usual. Once the config loads, the upgrade is done. 0.5.0 also reads more
of your tests than 0.4.0, so a few new reports are expected: tags kept in a `const` in the same file,
Vitest tag names written without the `@`, and `context.skip()` in Vitest's `beforeEach`. The
[changelog](../CHANGELOG.md) lists them all.
