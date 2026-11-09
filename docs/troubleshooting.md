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
| `@new` or `@quarantined` has no effect      | These states are off by default. Set `lifecycleTags: true` or enable them with `states`. A renamed tag replaces the old one. The linter does not change runner execution.                                                                  |
| Imported tags cannot be checked             | Keep readable tags or details in the file, or enable `reportUnreadableTags` to report the uncertainty when a tag state is on. It does not resolve imports.                                                                                 |
| Vitest rejects a tag that ESLint accepts    | Vitest's `tags` and `meta` need 4.1+. Register tags in your [Vitest configuration](https://vitest.dev/guide/test-tags#defining-tags). Governance `knownTags` only configures spelling checks.                                              |
| A warning fails CI                          | Check the command's `--max-warnings` threshold. The presets use warnings for tag conflicts and commented-out tests, but a zero-warning policy makes those fail too.                                                                        |
| Config rejects an old option                | Follow the [upgrade guide](upgrading.md). Options go in `configure()` or shared settings, not the rule's option array.                                                                                                                     |

Replace `tests/order.spec.js` in the diagnostic command with the path you are investigating. See
[ESLint's configuration debugger](https://eslint.org/docs/latest/use/configure/debug) for further checks.

## Understand fixes and suggestions

`npx eslint tests --fix` applies automatic fixes, such as changing a literal `@New` tag to `@new`
when the `new` state is on. Near-miss tag spellings are reported for you to review. Shared constants
are not autofixed, because other tests may use them.

Other changes are editor suggestions that you choose individually: removing a leftover marker,
removing a note after a valid ticket, renaming a wrong-state marker, adding another state's marker,
or moving a ticket into an annotation. They do not run with `--fix`. See
[ESLint's rule suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

A missing ticket needs a real issue from your tracker; the plugin cannot create one. Missing-ticket
and lowercase-marker diagnostics do not offer suggestions. For a lowercase marker such as
`// skip: TRADE-123`, write `// SKIP: TRADE-123` yourself.

## Adopt in an existing suite

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

Once the base policy works, enable optional states deliberately: lifecycle tags for your promotion
workflow, `states: { retry: true }` for retries, and `requireReasonForConditional` or
`requireTicketForConditional` for conditional skips. See [shared options](configuration.md#options).

## Report a wrong or missed diagnostic

Use the repository's [issue forms](https://github.com/Huldoser/eslint-plugin-test-governance/issues/new/choose)
with the smallest test file, relevant config, expected and actual output, and plugin/ESLint/Node/parser
versions. Replace private ticket links and test data with examples. Report vulnerabilities through
the [private security route](../SECURITY.md), not a public issue.
