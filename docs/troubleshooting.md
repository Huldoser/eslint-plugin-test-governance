# Troubleshooting and adoption

[Getting started](../README.md#install) · [Configuration](configuration.md) · [Framework syntax](frameworks.md)

## Find the cause

| Symptom                                     | Check                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No governance reports                       | Run ESLint on a known skipped test without a marker. Make sure `files` matches its path and the chosen config names its runner. Use `npx eslint --print-config tests/order.spec.js` to inspect the effective config for that example path. |
| TypeScript file ignored or cannot be parsed | Install and configure a [TypeScript parser](configuration.md#typescript). Include the actual extension, such as `.ts`, `.tsx`, `.mts` or `.cts`, in `files`. A parser alone does not make ESLint select those files.                       |
| Custom fixture or alias not recognized      | Check [recognized functions](frameworks.md). Add imported fixture names to `testFunctions`; your list replaces its defaults, so keep the names you still need.                                                                             |
| Marker reported as missing or orphaned      | Put it in the comment block directly above its test, describe or skip call. A blank line breaks attachment unless `allowBlankLine: true`. Match the state: `SKIP` for skip, `FIXME` for fixme.                                             |
| Ticket rejected                             | Check the selected preset, placeholders and comma separation. Notes after a ticket require `allowNotes: true`. A preset's `host` is a hostname, without a scheme, port or path.                                                            |
| A tag has no effect                         | Tags require an explicit `customStates` mapping to a marker. Use `knownTags` for spelling checks alone. See [Tag names](configuration.md#tag-names). The linter does not change runner execution.                                          |
| Imported tags cannot be checked             | Keep readable tags or details in the file, or enable `reportUnreadableTags` to report the uncertainty when a tag state is on. It does not resolve imports.                                                                                 |
| Vitest rejects a tag that ESLint accepts    | Vitest's `tags` and `meta` need 4.1+. Register tags in your [Vitest configuration](https://vitest.dev/guide/test-tags#defining-tags). Governance `knownTags` only configures spelling checks.                                              |
| A warning fails CI                          | Check the command's `--max-warnings` threshold. The presets warn about tag case/spelling and commented-out tests; a zero-warning policy makes those fail too.                                                                              |
| Config rejects an old option                | Follow the [upgrade guide](upgrading.md). Options go in `configure()` or shared settings, not the rule's option array.                                                                                                                     |

Replace `tests/order.spec.js` in the diagnostic command with the path you are investigating. See
[ESLint's configuration debugger](https://eslint.org/docs/latest/use/configure/debug) for further checks.

## Understand fixes and suggestions

`npx eslint tests --fix` applies automatic fixes, such as changing a literal `@Needs-review` tag to `@needs-review`
when that tag is configured in `customStates` or `knownTags`. Near-miss tag spellings are reported for you to review.
A tag read through an object member is reported without an autofix. A string constant interpolated
into a title can be fixed at its definition, including when several titles share it. Review the diff
after `--fix`; see [tag fixes](rules/consistent-tag-names.md) for the distinction.

Other changes are editor suggestions that you choose individually: removing a leftover marker,
removing a note after a valid ticket, renaming a wrong-state marker, adding another state's marker,
or moving a ticket into an annotation. They do not run with `--fix`. See
[ESLint's rule suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

A missing ticket needs a real issue from your tracker; the plugin cannot create one. Missing-ticket
and lowercase-marker diagnostics do not offer suggestions. For a lowercase marker such as
`// skip: TRADE-123`, write `// SKIP: TRADE-123` yourself.

## Adopt in an existing suite

Start with one owned directory while the rest of the suite keeps its current policy. This complete
config enforces governance only in `tests/new/`; expand `files` after each directory is ready:

<!-- config: directory-rollout -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

export default [{ files: ['tests/new/**/*.js'], ...testGovernance.configs.playwright }];
```

Start with one test directory and inspect the reports. If you need a transition period, override a
rule's severity after spreading the config; the shared settings still apply. This complete config
keeps the other rules at their default severities:

<!-- config: gradual -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['tests/**/*.js'],
    ...testGovernance.configure({
      framework: 'playwright',
      ticket: { preset: 'jira', projects: ['TRADE'] },
    }),
    rules: {
      ...testGovernance.configs.playwright.rules,
      'test-governance/require-ticket': 'warn',
    },
  },
];
```

Change `files` and the framework to match the suite you are adopting. When its missing-ticket reports
are addressed, remove the severity override to restore errors. An existing `--max-warnings 0` policy
will still reject warnings; account for that before using this transition config.

Once the base policy works, enable optional states deliberately: custom tags that need tickets, `states: { retry: true }` for retries, and `requireReasonForConditional` or
`requireTicketForConditional` for conditional skips. See [shared options](configuration.md#options).

## Combine with a runner plugin

Keep the runner plugin's assertion, async and focused-test checks. If your policy allows ticketed
skips, replace its blanket skip ban only in the files governed here. For Playwright, the overlapping
rule is `playwright/no-skipped-test`; the [runner plugin's catalog](https://github.com/mskelton/eslint-plugin-playwright#rules)
lists its other checks. A ticket does not satisfy that plugin's blanket ban.

This complete config assumes `eslint.base.mjs` exports your existing flat-config array and registers
the Playwright plugin. The final object changes only the selected files, adds governance and turns
off that one overlapping rule. Existing focused-test and other correctness rules remain configured:

<!-- config: companion -->

```js
// eslint.config.mjs
import existingConfig from './eslint.base.mjs';
import testGovernance from 'eslint-plugin-test-governance';

const policy = testGovernance.configure({ framework: 'playwright' });

export default [
  ...existingConfig,
  {
    files: ['tests/**/*.js'],
    ...policy,
    rules: { ...policy.rules, 'playwright/no-skipped-test': 'off' },
  },
];
```

Use the actual namespace registered in your existing config if it differs from `playwright`.
This is a choice for suites that allow tracked skips; teams that prohibit every skip should keep
their blanket ban. Check the final rule selection with ESLint's `--print-config` for a real test path.

## Adopt without a separate baseline tool

ESLint's [bulk suppressions](https://eslint.org/docs/latest/use/suppressions) can retain existing
violations while enforcing errors on new code. They apply to error-severity rules, not warnings.
Prefer the directory rollout above when every accepted skip must already have a ticket: a suppressed
finding does not acquire tracking information. If your team chooses bulk suppressions, review the
suppression file and prune unused entries as debt is removed. The plugin has no separate baseline CLI.

## Run quarantined Playwright tests separately

A quarantined test still needs a runner lane. Give the test a tag so Playwright can select it,
and require a ticket for the tag with this ESLint config:

<!-- config: quarantine -->

```js
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['tests/**/*.spec.js'],
    ...testGovernance.configure({
      framework: 'playwright',
      customStates: { quarantined: { when: '@quarantined', marker: 'QUARANTINE' } },
    }),
  },
];
```

In `tests/upload.spec.js`, keep the quarantined test runnable:

<!-- quarantine: tests -->

```js
import { expect, test } from '@playwright/test';

test('resolves a relative upload URL', async () => {
  expect(new URL('upload', 'https://example.test/').pathname).toBe('/upload');
});

// QUARANTINE: EXAMPLE-123
test('preserves a trailing slash in the upload URL @quarantined', async () => {
  expect(new URL('/upload/', 'https://example.test/').pathname).toBe('/upload/');
});
```

Run ESLint over **both** lanes. Use complementary Playwright filters for the blocking
and quarantine jobs. These commands preview the selection without executing tests:

```sh
npx eslint tests
npx playwright test --list --grep-invert '(^|\s)@quarantined(\s|$)'
npx playwright test --list --grep '(^|\s)@quarantined(\s|$)'
```

The first Playwright list contains only the relative-URL test. The second contains only the
trailing-slash test. Remove `--list` in the two CI jobs to execute each lane, and retain the quarantine
job's results for the ticket owner. Remove the tag and marker together after fixing the test.
Playwright matches these filters against the full test name and tags, so reserve this tag for
quarantine. See [Playwright test tags](https://playwright.dev/docs/test-annotations#tag-tests).

## Connect retry policy to CI

Enable [retry ceilings](rules/limit-retries.md) in test files and, with `checkConfigRetries`, in runner
config files. `maxRetries` limits retries after the first attempt: two retries allow up to three
attempts. It cannot tell whether a run was flaky.
For Playwright teams that want flaky results to fail CI, the runner's
[`failOnFlakyTests`](https://playwright.dev/docs/api/class-testconfig#test-config-fail-on-flaky-tests)
option supplies that runtime policy. Make that choice separately from ticket requirements.

## Report a wrong or missed diagnostic

Use the repository's [issue forms](https://github.com/Huldoser/eslint-plugin-test-governance/issues/new/choose)
with the smallest test file, relevant config, expected and actual output, and plugin/ESLint/Node/parser
versions. Replace private ticket links and test data with examples. Report vulnerabilities through
the [private security route](https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/SECURITY.md),
not a public issue.
