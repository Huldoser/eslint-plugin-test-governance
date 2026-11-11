# Configuration reference

[Getting started](../README.md#install) · [Framework syntax](frameworks.md) · [Troubleshooting](troubleshooting.md)

Use a framework config for its defaults, or `configure()` to change shared options. Every rule reads
`settings['test-governance']`; the rules have no individual options. This page describes configuration
fragments unless a block names a complete config file. Keep the imports from that file when combining examples.

## TypeScript

For TypeScript test files, install the parser as well as ESLint and this plugin:

```sh
npm install --save-dev eslint eslint-plugin-test-governance @typescript-eslint/parser typescript
```

You can use a JavaScript config file even when the tests are TypeScript. Add this configuration to your existing
ESLint config, or create `eslint.config.mjs` at the project root:

<!-- config: typescript -->

```js
// eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['tests/**/*.{js,ts}'],
    languageOptions: { parser: tsParser },
    ...testGovernance.configs.playwright,
  },
];
```

Run `npx eslint tests`. Change the framework and `files` pattern to match your project. Include `.tsx`,
`.mts` or `.cts` in the pattern if your tests use those extensions; ESLint needs an explicit matching
pattern for TypeScript files. This config adds governance rules; keep your existing TypeScript lint rules too.

### TypeScript config files

A TypeScript test file and a TypeScript ESLint config are separate choices. To write `eslint.config.ts`,
install `jiti` 2.2 or later as a dev dependency. See
[ESLint's TypeScript config instructions](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files)
for native loading alternatives and their flags. A JavaScript config needs no `jiti`.

### Exported types

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
  customStates: { review: { when: '@needs-review', marker: 'REVIEW' } },
  ticket: { preset: 'jira', projects: ['TRADE'] },
};

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  { files: ['tests/**/*.ts'], ...testGovernance.configure(options) },
];
```

## Config file forms

With ESLint's `defineConfig()` (ESLint 9.22 or later), put the config in `extends`:

```js
// eslint.config.mjs
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

The array/spread form in the [quick start](../README.md#usage) also works on ESLint 9.0-9.21.
With `defineConfig()`, once the plugin is registered under `plugins`,
`extends: ['test-governance/playwright']` works too.

### CommonJS

The package is ESM, but Node's `require()` returns the plugin itself. In `eslint.config.cjs`:

<!-- config: commonjs -->

```js
// eslint.config.cjs
const testGovernance = require('eslint-plugin-test-governance');

module.exports = [{ files: ['tests/**/*.js'], ...testGovernance.configs.playwright }];
```

### Change the shared policy

To change the defaults, use `configure()`. It takes the framework and your options, and returns that
framework's config with the options stored in `settings['test-governance']`, which all the rules read:

<!-- config: policy -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['tests/**/*.js'],
    ...testGovernance.configure({
      framework: 'playwright',
      // Only accept Jira keys from these projects (or Jira URLs).
      ticket: { preset: 'jira', projects: ['TRADE', 'RISK'] },
      // Require tickets for the tags your team chooses.
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
  - customState is not a known option; did you mean "customStates"?
  - ticket.preset must be one of "any", "jira", "github", … (got "jria")
```

## Multiple frameworks

A project with tests in more than one framework gives each framework its own config, pointed at its
files. To share options between them, pass the same options to each `configure()`:

```js
import tsParser from '@typescript-eslint/parser';
import testGovernance from 'eslint-plugin-test-governance';

const options = { ticket: { preset: 'jira', projects: ['TRADE'] } };

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  // The e2e specs run on Playwright, the unit tests on Vitest.
  { files: ['e2e/**/*.spec.ts'], ...testGovernance.configure({ framework: 'playwright', ...options }) },
  { files: ['src/**/*.test.ts'], ...testGovernance.configure({ framework: 'vitest', ...options }) },
];
```

This matters most for Jasmine next to Jest or Mocha, whose `it`, `xit` and `describe` look the same:
only the `files` of each config tell them apart.

Each framework's config, such as `configs.playwright`, sets only the framework, so one listed after a
`configure()` for the same files keeps that config's options and changes only the framework. They all
set the same rule defaults. See [Framework syntax](frameworks.md) for the calls each config recognizes.

## Options

[Defaults](../README.md#defaults) · [Tag names](#tag-names) · [Ticket presets](#ticket-presets) ·
[Annotation tickets](#tickets-from-annotations) · [ESLint directive markers](#markers-in-eslint-disable-comments)

All options go in `configure({...})`, or in `settings['test-governance']` if you build the config
yourself. `framework` is required, and every other option has a default. The rules have no options
of their own: they all read these shared settings, so they always agree on ticket formats, states
and markers. To turn a rule off, set it to `'off'` as usual.

| Option                        | Type                                                     | Default                           | Description                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framework`                   | `FrameworkName`                                          | required                          | The test framework of the files the config applies to. Each framework's config, such as `configs.playwright`, sets it, and `configure()` needs it. See [Frameworks](frameworks.md).          |
| `ticket`                      | `TicketSpec \| TicketSpec[]`                             | `{ preset: 'any' }`               | Accepted ticket formats. An array accepts a ticket that matches any entry. See [Ticket presets](#ticket-presets).                                                                            |
| `placeholders`                | `string[]`                                               | [defaults](../README.md#defaults) | See [placeholders details](#placeholders).                                                                                                                                                   |
| `states`                      | `{ [state]: boolean \| { enabled?, marker?, ticket? } }` | `skip`, `fixme` and `todo` on     | See [states details](#states).                                                                                                                                                               |
| `customStates`                | `{ [name]: { when, marker, ticket? } }`                  | `{}`                              | Adds a state for a tag, e.g. `{ 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } }`. `when` is a tag and `marker` an uppercase keyword; neither can be shared with another state. |
| `knownTags`                   | `string[]`                                               | `[]`                              | See [knownTags details](#knowntags).                                                                                                                                                         |
| `maxRetries`                  | `number`                                                 | `2`                               | Maximum retry count for the opt-in [limit-retries](rules/limit-retries.md) rule. A non-negative integer; `0` forbids retries.                                                                |
| `requireTicketForConditional` | `boolean`                                                | `false`                           | See [requireTicketForConditional details](#requireticketforconditional).                                                                                                                     |
| `requireReasonForConditional` | `boolean`                                                | `false`                           | See [requireReasonForConditional details](#requirereasonforconditional).                                                                                                                     |
| `allowBlankLine`              | `boolean`                                                | `false`                           | Let blank lines separate a marker from its test.                                                                                                                                             |
| `allowNotes`                  | `boolean`                                                | `false`                           | Allow free text after the tickets, e.g. `// SKIP: TRADE-123 flaky on CI`. Applies to markers and to `FIXME` / `TODO` comments.                                                               |
| `comments`                    | `false \| { keywords?: string[] }`                       | `{ keywords: ['FIXME', 'TODO'] }` | Comment keywords that must start with a ticket anywhere in a test file, e.g. `// TODO: TRADE-123`. Your keywords replace the default ones. `false` allows free-form comments.                |
| `annotations`                 | `false \| { type?: string, only?: boolean }`             | `{ type: 'issue' }`               | See [annotations details](#annotations).                                                                                                                                                     |
| `testFunctions`               | `string[]`                                               | `['test']`                        | See [testFunctions details](#testfunctions).                                                                                                                                                 |
| `reportUnreadableTags`        | `boolean`                                                | `false`                           | See [reportUnreadableTags details](#reportunreadabletags).                                                                                                                                   |

### placeholders

Tickets rejected as placeholders. `*` matches any characters. Case-insensitive, and a leading `#` on the ticket or the placeholder is ignored. Your list replaces the default one, so repeat the defaults you want to keep.

Tickets numbered 0 are always rejected.

### states

Turns built-in states (`skip`, `fixme`, `fail`, `slow`, `todo`, `retry`) on or off, renames their marker, or gives them their own ticket format. These states follow native runner behavior.

`fail`, `slow` and `retry` are off by default. Configure tag policies separately with `customStates`; see [Tag names](#tag-names).

`fixme` and `slow` exist only in Playwright, `todo` in every framework but Playwright, `fail` in Playwright, Jest, Vitest and node:test, and `retry` in every framework but node:test and Jasmine, so turning one on elsewhere has no effect.

### knownTags

Your team's other tags, such as `['@smoke', '@regression']`, written with the `@`. `consistent-tag-names` reports them in the wrong case or misspelled, as it does state tags, and never reports a listed tag as a typo of a state tag.

### maxRetries

The maximum retry count checked by [limit-retries](rules/limit-retries.md), default `2`. Set it to
a non-negative integer; `0` forbids retries. The rule is off in every preset and must be enabled
explicitly. This setting does not enable retry ticketing or change the runner's retry count.

### requireTicketForConditional

Require a ticket for conditional skips too: `test.skip(condition, ...)`, `if (...) test.skip()`, `(condition ? test.skip : test)(...)`, a skip in a `catch` block, after other code in a `try` block with a `catch`, or after an early `return` or `throw`.

### requireReasonForConditional

Require a reason, but no ticket, for conditional skips: a comment above the skip or at the end of its line, above the `if` around it or above its hook, step or test, or the reason the call takes, as `test.skip(condition, 'why')`. See [require-ticket](rules/require-ticket.md#reasons-for-conditional-skips).

### annotations

Accept the ticket from a test annotation as well: Playwright's `annotation` of the given type or Vitest's `meta` key of that name. One valid annotation covers every state the test is in, and a describe's covers its tests. `only: true` makes it the only place for a test's or describe's ticket. See [Tickets from annotations](#tickets-from-annotations).

### testFunctions

Names treated as the framework's `test`. Jest, Vitest and node:test default to `['test', 'it']`, Mocha, Cypress and WebdriverIO to `['it', 'specify', 'test']`, and Jasmine to `['it']`. Your list replaces the default one, so include those names if you still need them. See [recognized functions](frameworks.md).

### reportUnreadableTags

When a tag state is on, report titles that aren't static text, and tags or details that can't be read in the file, such as ones imported from another module, since their tags can't be checked.

## Tag names

Tags are unrestricted by default. Use `customStates` when a tag should require a ticket, and
`knownTags` when it should get spelling and case checks without a ticket requirement:

```js
testGovernance.configure({
  framework: 'playwright',
  customStates: {
    review: { when: '@needs-review', marker: 'REVIEW' },
    blocked: { when: '@blocked', marker: 'BLOCKED', ticket: { preset: 'github' } },
  },
  knownTags: ['@smoke', '@regression'],
});
```

The keys `review` and `blocked` name your custom states; `when` is the exact tag, including `@`.
Each tag and marker must be unique among configured states. Native names such as `skip` are reserved.
Custom states have no `enabled` property: omit an entry to stop tracking it.

With `customStates: { review: { when: '@needs-review', marker: 'REVIEW' } }`:

<!-- example: valid settings={"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"}}} -->

```ts
// REVIEW: TRADE-311
test('streams level 2 quotes @needs-review', async ({ page }) => {});
```

`consistent-tag-names` reports `@Needs-review` and near-miss spellings such as `@needs-reveiw`.
An exact tag in `knownTags` is never a typo. Other unlisted tags stay allowed; `knownTags` is not an
allowlist. Tags can coexist, including on skipped tests, provided each tracked state has its ticket.
The plugin does not assign promotion stages or change runner execution.

Migrating from `lifecycleTags` or `states.new` / `states.quarantined`? See the
[upgrade guide](upgrading.md#upgrading-to-014-custom-tag-states).

## Ticket presets

| Preset         | Accepts                                                                                                                                                                       | Options                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `any`          | `PROJ-123`, `#123`, `owner/repo#123`, any http(s) URL                                                                                                                         |                                                                                                                                    |
| `jira`         | `TRADE-123`, `https://<host>/browse/TRADE-123` (also under a path, as in `/jira/browse/TRADE-123`), board URLs with `selectedIssue=TRADE-123`                                 | `projects`; `host` (any host by default)                                                                                           |
| `github`       | `#123`, `owner/repo#123`, `https://github.com/owner/repo/issues/123` (or `/pull/`)                                                                                            | `host` for GitHub Enterprise (`github.com` by default)                                                                             |
| `gitlab`       | `#123`, `group/project#123`, `https://gitlab.com/group/project/-/issues/123`                                                                                                  | `host` for self-managed (`gitlab.com` by default)                                                                                  |
| `linear`       | `RISK-123`, `https://linear.app/<workspace>/issue/RISK-123/...`                                                                                                               | `teams`                                                                                                                            |
| `azure-devops` | `AB#123`, `#123`, `https://dev.azure.com/<org>/<project>/_workitems/edit/123`                                                                                                 | `host` for Azure DevOps Server (`dev.azure.com` and `*.visualstudio.com` by default)                                               |
| `trello`       | card links, `https://trello.com/c/nqPiDKmw` with or without the `/9-title` after it                                                                                           |                                                                                                                                    |
| `notion`       | Unique IDs such as `TASK-123`, `https://www.notion.so/TASK-123`, page links that end in the page ID (also `https://app.notion.com/p/...`), database links with `?p=<page ID>` | `prefixes`; `host` for a custom domain (`notion.so`, `www.notion.so`, `app.notion.com` and `*.notion.site` by default)             |
| `asana`        | task links, `https://app.asana.com/0/<project>/<task>` and the newer `https://app.asana.com/1/<workspace>/.../task/<task>`                                                    |                                                                                                                                    |
| `clickup`      | `CU-86abc123`, `#86abc123` (not `#123`), custom IDs like `DEV-123`, `https://app.clickup.com/t/86abc123` or `/t/<workspace>/DEV-123`, view links `?p=<task>`                  | `prefixes` for custom IDs                                                                                                          |
| `redmine`      | `#123`, `#123-4` and `#123#note-4` (a note), `##123`; with `host`, `https://<host>/issues/123` (also under a path)                                                            | `host`, needed for links                                                                                                           |
| `monday`       | item links, `https://<account>.monday.com/boards/<board>/pulses/<item>`, and custom keys such as `TIX-001`                                                                    | `prefixes` for custom keys                                                                                                         |
| `youtrack`     | `KT-123`, `https://<host>/issue/KT-123/...` or `/projects/KT/issues/KT-123` (also under a path, as in `/youtrack/issue/KT-123`)                                               | `projects`; `host` for Server or a custom domain (`youtrack.jetbrains.com`, `*.youtrack.cloud` and `*.myjetbrains.com` by default) |
| `basecamp`     | to-do and card links, `https://3.basecamp.com/<account>/buckets/<project>/todos/<id>` or `/card_tables/cards/<id>`                                                            |                                                                                                                                    |
| `shortcut`     | `sc-123`, `[sc-123]`, `https://app.shortcut.com/<workspace>/story/123/...`                                                                                                    |                                                                                                                                    |
| `openproject`  | `#4821`, `AGILE-1`; with `host`, `/projects/<identifier>/work_packages/AGILE-1`, `/work_packages/4821` or `/wp/AGILE-1`, also under an installation base path                 | `host`, needed for links                                                                                                           |
| `bugzilla`     | bug numbers `4821`; with `host`, `https://<host>/show_bug.cgi?id=4821`, also under a path as in `/bugzilla/show_bug.cgi`                                                      | `host`, needed for links                                                                                                           |
| `phabricator`  | task monograms `T4821`; with `host`, `https://<host>/T4821`. Phorge, Phabricator's maintained fork, shares the format                                                         | `host`, needed for links                                                                                                           |
| `rally`        | formatted IDs `US4821`, `DE4821`, `TA4821`, `TC4821`, never zero-padded (so MITRE ATT&CK's `TA0006` isn't one)                                                                |                                                                                                                                    |
| `servicenow`   | record numbers `STRY0010001` for the prefixes you list, any digit count                                                                                                       | `prefixes`, required: record-number prefixes such as `STRY`                                                                        |
| `plane`        | `WEB-142`; `https://app.plane.so/<workspace>/<project>/issues/WEB-142` (or a UUID), and the same on a `host` for self-hosted                                                  | `projects`; `host` for self-hosted (`app.plane.so` by default)                                                                     |
| `url`          | links to the hosts you list, and nothing else                                                                                                                                 | `hosts`, required: host names such as `tasks.example.com`, with no scheme, port or path; `*.example.com` matches its subdomains    |
| `numeric`      | `4821`                                                                                                                                                                        | `minLength` (1), `maxLength` (20)                                                                                                  |
| `pattern`      | anything matching your regex, anchored at both ends                                                                                                                           | `pattern`, `flags`                                                                                                                 |

`projects` (Jira, YouTrack, Plane), `teams` (Linear) and `prefixes` (Notion, ClickUp, monday.com,
ServiceNow) are keys as they appear in tickets, in uppercase: `TRADE` for `TRADE-123`, `STRY` for
`STRY0010001`. YouTrack project IDs may also start with a digit, as `4DM`. Without them, any key passes;
ServiceNow's list is required. `host` is a host name such as `jira.example.com`, or `*.example.com` for
every subdomain, as in `{ preset: 'jira', host: '*.atlassian.net' }`. Every preset that takes `host`
requires a plain host name: a value with a scheme, port or path never matched a link, so it is an error.
Each preset
takes only its own options, so `host` on the `any` preset fails with a clear message instead of being
ignored. A `pattern` always matches the whole ticket, so the `g` and `y` flags make no difference and are
ignored.

When a `pattern` matches an HTTP(S) URL, placeholder checks read ticket IDs from its path, query and
route. A URL with `?id=0` is rejected; a valid ticket followed by an unrelated title suffix such as
`/EXAMPLE-1/retry-count-0` is accepted.

A preset rejects links that aren't one ticket in its tracker, such as a Trello board, an Asana project or
a Notion database view. Redmine runs on your own server, and `/issues/123` is also GitHub's path, so its
links pass only once `host` is set. The same holds for OpenProject, Bugzilla and Phabricator, which also
run on their own servers.

For a tracker without a preset, use `url` with its host, for example
`{ preset: 'url', hosts: ['www.wrike.com'] }` for Wrike links such as
`https://www.wrike.com/open.htm?id=4821`; a link with `?id=0`, or a path that ends in `/0`, is a
placeholder. It works the same for Microsoft Planner (`tasks.office.com`), Airtable (`airtable.com`),
Smartsheet (`app.smartsheet.com`) and trackers of your own. For another
tracker's keys, such as `WEB-12`, `any` or `pattern` works. Gitea, Forgejo and Codeberg use GitHub's link layout,
so the `github` preset with their `host` covers them. For other URL layouts, use `url` or `pattern`.

Pass an array to `ticket` to accept several presets, such as `[{ preset: 'jira' }, { preset: 'github' }]`.
Each state can also have its own format. For example, bugs in Jira and flaky-test
reports in GitHub:

```js
testGovernance.configure({
  framework: 'playwright',
  ticket: { preset: 'jira', projects: ['TRADE'] },
  customStates: {
    flaky: { when: '@flaky', marker: 'FLAKY', ticket: { preset: 'github' } },
  },
});
```

The built-in presets are written to run in linear time. A `pattern` preset runs your regex as given,
so keep it free of nested quantifiers.

## Tickets from annotations

Playwright annotations (1.42+) and Vitest `meta` (4.1+) make tickets available to reporters.
The reporter determines how they are displayed; Playwright's HTML reporter displays annotations.
See [Playwright annotations](https://playwright.dev/docs/test-annotations#annotate-tests) and
[Vitest metadata](https://vitest.dev/api/test.html#meta).
`annotations` accepts the ticket from these options as well as comments:

```js
test.skip(
  'rejects a margin order above the buying power',
  {
    annotation: { type: 'issue', description: 'TRADE-123' },
  },
  async () => {},
);
```

```js
// Vitest: the ticket is the `issue` key of `meta`.
test.skip('rejects a margin order above the buying power', { meta: { issue: 'TRADE-123' } }, () => {});
```

The `type` names Playwright's annotation type and Vitest's `meta` key; `'issue'` by default, matched
exactly. The value must be the ticket and nothing else, as in a marker. One valid annotation covers every
state the test is in, and a describe's annotation covers its tests. An annotation of another type is
left alone, and an annotation whose ticket isn't static text is reported with `reportUnreadableTags`.
`annotations: false` turns it off. A marker comment still works everywhere, and when both are written,
both must be valid. This plugin reads annotation tickets only for Playwright and Vitest; use comments with the other configs.

With `annotations: { only: true }`, a test or describe in Playwright or Vitest must carry its ticket in the
annotation, and a marker comment above it is reported, with a suggestion that moves its tickets into
`annotation` or `meta`. A runtime skip such as `test.skip()` in a body, and a step, can't carry an
annotation, so their comments still count. `only` with another framework is a configuration error.

## Markers in `eslint-disable` comments

If you also run a rule that bans skipped tests, such as `jest/no-disabled-tests`, the comment that turns it off
can hold the marker in its description, after `--`:

```js
// eslint-disable-next-line jest/no-disabled-tests -- SKIP: TRADE-123
test.skip('rejects a margin order above the buying power', () => {});
```

The description is read as a marker comment, with the same tickets and notes rules. It works in an
`eslint-disable-next-line` above the test, an `eslint-disable-line` on the line the test starts on, and an
`eslint-disable` block comment, whose marker covers every test up to the `eslint-enable` of one of its rules, or of
every rule. A suggestion that removes or adds a marker keeps the directive working.
