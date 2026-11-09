# eslint-plugin-test-governance

[![npm](https://img.shields.io/npm/v/eslint-plugin-test-governance)](https://www.npmjs.com/package/eslint-plugin-test-governance)
[![CI](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml/badge.svg)](https://github.com/Huldoser/eslint-plugin-test-governance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/eslint-plugin-test-governance)](LICENSE)

Require tracking tickets for disabled tests and TODO/FIXME comments with ESLint. Supports Playwright,
Jest, Vitest, Mocha, Cypress, WebdriverIO, `node:test` and Jasmine. Custom tag policies and retry tracking
are optional.

<!-- example: valid -->

```js
// SKIP: TRADE-123
test.skip('cancels an open order', () => {});
```

Removing the skip leaves a stale marker, which the plugin reports too. Tickets can also come from
[Playwright annotations or Vitest metadata](docs/configuration.md#tickets-from-annotations).
Ticket formats are checked locally; the plugin does not verify that an issue exists or is open.

**Start here:** [Install](#install) · [First lint run](#usage) · [Choose a framework](#frameworks) ·
[Rules](#rules) · [Configuration](docs/configuration.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Upgrading](docs/upgrading.md)

> Early release (0.x): options may change before 1.0. Check the [upgrade guide](docs/upgrading.md)
> when updating an existing configuration.

## Install

Requires ESLint 9 or 10 with flat config. The plugin requires Node.js 22.12 or later; ESLint may
require a newer version:

| ESLint | Node.js requirement for this plugin and ESLint together |
| ------ | ------------------------------------------------------- |
| 9      | 22.12 or later                                          |
| 10     | 22.13 or later within Node 22, or Node 24 and later     |

See [ESLint's prerequisites](https://eslint.org/docs/latest/use/getting-started#prerequisites).
Use a project that already has a supported test runner. Install the linter and plugin:

```sh
npm install --save-dev eslint eslint-plugin-test-governance
```

For TypeScript tests, follow the [TypeScript setup](docs/configuration.md#typescript), which also
installs and configures a parser. The JavaScript quick start below needs no TypeScript parser.

## Usage

This example uses Playwright and JavaScript tests in `tests/`. Choose your runner in the
[framework table](#frameworks) and adjust `files` to match your test locations and extensions.
If you already have an ESLint config, add this object to its array rather than replacing the file.

1. Create `eslint.config.mjs` at the project root:

<!-- config: javascript -->

```js
// eslint.config.mjs
import testGovernance from 'eslint-plugin-test-governance';

export default [{ files: ['tests/**/*.js'], ...testGovernance.configs.playwright }];
```

2. In `tests/order.spec.js`, a skipped test without a ticket is reported:

<!-- example: invalid -->

```js
import { test } from '@playwright/test';

test.skip('cancels an open order', () => {});
```

3. Run ESLint from the project root:

```sh
npx eslint tests/order.spec.js
```

ESLint reports `test-governance/require-ticket` and exits with status 1. Add the marker directly above
the test, then run the same command again:

<!-- example: valid -->

```js
import { test } from '@playwright/test';

// SKIP: TRADE-123
test.skip('cancels an open order', () => {});
```

With this config and file, ESLint prints nothing and exits with status 0. Use a real ticket from your
tracker. The default accepts `PROJ-123`, `#123`, `owner/repo#123` or an http(s) URL; a
[ticket preset](docs/configuration.md#ticket-presets) narrows the accepted format.

### Frameworks

Each config sets the same rule defaults, adapted to the runner. There is no `recommended` or default config.
See [Framework syntax](docs/frameworks.md) for imports, supported calls and version-specific features.

| Runner                                      | Config                 |
| ------------------------------------------- | ---------------------- |
| Playwright                                  | `configs.playwright`   |
| Jest                                        | `configs.jest`         |
| Vitest                                      | `configs.vitest`       |
| Mocha                                       | `configs.mocha`        |
| Cypress                                     | `configs.cypress`      |
| WebdriverIO with Mocha                      | `configs.webdriverio`  |
| Node's built-in runner                      | `configs['node-test']` |
| Jasmine, including WebdriverIO with Jasmine | `configs.jasmine`      |

For mixed suites, give each framework its own `files` pattern. See
[multiple frameworks](docs/configuration.md#multiple-frameworks).

## Rules

All framework configs use the severities in [Defaults](#defaults).

<!-- begin auto-generated rules list -->

| Name                                                                                           | Description                                                          |
| :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- |
| [consistent-tag-names](docs/rules/consistent-tag-names.md)                                     | Disallow tag names that differ in case or look like typos            |
| [limit-retries](docs/rules/limit-retries.md)                                                   | Enforce a maximum retry count for tests                              |
| [marker-matches-state](docs/rules/marker-matches-state.md)                                     | Require the marker keyword to match the test's state                 |
| [no-orphaned-marker](docs/rules/no-orphaned-marker.md)                                         | Disallow marker comments that no longer match a test state           |
| [require-ticket](docs/rules/require-ticket.md)                                                 | Require a ticket for skipped, fixme, todo, retried and tagged tests  |
| [require-ticket-for-commented-out-tests](docs/rules/require-ticket-for-commented-out-tests.md) | Require a ticket marker on commented-out tests                       |
| [require-ticket-in-comments](docs/rules/require-ticket-in-comments.md)                         | Require FIXME and TODO comments in test files to start with a ticket |

<!-- end auto-generated rules list -->

## Defaults

| Setting                   | Default                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| States that need a ticket | `skip`, `fixme`; in the other frameworks `skip`, `todo`                                                                          |
| Tag ticket requirements   | none by default; configure your own with `customStates`                                                                          |
| Conditional skips         | no ticket or reason required; opt in with `requireTicketForConditional` or `requireReasonForConditional`                         |
| `fail`, `slow`, `retry`   | off; enable the states your framework supports with `states`                                                                     |
| Marker format             | uppercase keyword and colon, then comma-separated tickets: `// SKIP: TRADE-123, TRADE-124`                                       |
| Notes after the ticket    | not allowed; `allowNotes: true` allows them                                                                                      |
| `FIXME` / `TODO` comments | require tickets in test files; `comments: false` turns this check off                                                            |
| Placement                 | comment block directly above the test or skip call; a blank line breaks it                                                       |
| Placeholder tickets       | rejected: `TODO`, `TBD`, `XXX-*`, and any ticket numbered 0                                                                      |
| Describe blocks           | a marker on a skipped or tagged describe covers its tests                                                                        |
| Severity                  | `consistent-tag-names` and `require-ticket-for-commented-out-tests`: warn; every other rule except the opt-in retry limit: error |
| Retry limit               | `limit-retries`: off; enable the rule explicitly, then set `maxRetries` (default `2`)                                            |

Tags have no built-in meaning. Configure `customStates` for tags that need ticket markers, or
`knownTags` for spelling checks alone. Other tags remain allowed. See [custom tag policies](docs/configuration.md#tag-names).
Warnings allow a successful lint run unless your command uses `--max-warnings 0`.

## Options

Use [`configure()`](docs/configuration.md#change-the-shared-policy) to change shared settings, or
[override rule severity](docs/troubleshooting.md#adopt-in-an-existing-suite). Options belong to the
plugin's shared settings, not individual rules.

<a name="tag-names"></a>
<a name="ticket-presets"></a>
<a name="tickets-from-annotations"></a>
<a name="markers-in-eslint-disable-comments"></a>

- [Custom tags and spelling checks](docs/configuration.md#tag-names)
- [Ticket presets](docs/configuration.md#ticket-presets)
- [Tickets from annotations](docs/configuration.md#tickets-from-annotations)
- [Markers in ESLint directives](docs/configuration.md#markers-in-eslint-disable-comments)

<a name="which-functions-count-as-test"></a>
<a name="syntax-the-rules-understand"></a>

See [recognized test functions and syntax](docs/frameworks.md), including
[static analysis limits](docs/frameworks.md#static-analysis-limits).

## TypeScript

See [TypeScript setup and exported types](docs/configuration.md#typescript). TypeScript test files
need a parser; TypeScript config files also need an appropriate config loader.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, checks and documentation maintenance.
[CHANGELOG.md](CHANGELOG.md) lists releases; [SECURITY.md](SECURITY.md) explains private vulnerability reports.

## License

[MIT](LICENSE)
