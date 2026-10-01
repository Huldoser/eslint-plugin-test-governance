# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-10-01

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

[Unreleased]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Huldoser/eslint-plugin-test-governance/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Huldoser/eslint-plugin-test-governance/releases/tag/v0.1.0
