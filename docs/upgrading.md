# Upgrading

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
eslint-plugin-test-governance: configs.recommended was removed in 0.5.0. Use the config for your framework: configs.playwright, configs.jest or configs.vitest. See https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/upgrading.md
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
  - framework is required: set it to "playwright", "jest" or "vitest", or use configs.playwright, configs.jest or configs.vitest
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
