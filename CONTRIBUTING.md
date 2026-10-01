# Contributing

Thanks for helping. Bug reports with a small code sample are the most useful contribution, so please
use the issue forms.

## Setup

Requires Node.js 22.12 or later.

```sh
git clone https://github.com/Huldoser/eslint-plugin-test-governance.git
cd eslint-plugin-test-governance
npm install
```

## Checks

Every pull request runs these in CI (tests on Node 22 and 24 with ESLint 9 and 10):

```sh
npm run lint           # ESLint, including type-aware rules and eslint-plugin-eslint-plugin
npm run format:check   # Prettier (run `npm run format` to fix)
npm run typecheck      # TypeScript, including the tests
npm run test:coverage  # all tests; fails below 100% coverage of src/rules and src/utils
npm run test:pack      # packs the plugin and lints tests/fixtures/sample-project with the tarball
npm run docs:check     # the README rules list and rule doc headers are up to date
```

Code is formatted with Prettier and linted with typescript-eslint's strict type-checked rules. Editors that
support EditorConfig, ESLint and Prettier pick up the settings automatically; VS Code suggests the extensions.
Prefer fixing a lint error over disabling the rule. When a line really needs an exception, use
`eslint-disable-next-line <rule> -- <reason>`.

Coverage must stay at 100% for statements, branches, functions and lines. If a branch can't be
reached, remove it rather than excluding it.

## Changing a rule

- Rule code is in `src/rules/`. The shared analysis (which calls are tests, which comments are
  markers) is in `src/utils/analyze.ts`, and ticket formats are in `src/utils/tickets.ts`.
- Rule tests use ESLint's `RuleTester` through `runRule()` in `tests/helpers.ts`, which runs every
  case under both espree and `@typescript-eslint/parser`. Add at least one valid and one invalid
  case, and assert the full message data and any suggestion output.
- Each rule has a page in `docs/rules/`. Examples marked `<!-- example: valid -->` or
  `<!-- example: invalid -->` run as tests, so keep them correct.
- The rules list in the README and the header of each rule page are generated. After changing rule
  metadata, run `npm run docs` and commit the result.
- If the change affects what the sample project reports, update the snapshot with
  `npx vitest run -u tests/sample-project.test.ts` and check the diff.

## Commits and pull requests

- Add a line under `[Unreleased]` in `CHANGELOG.md` for any change users will notice.
- Keep each commit to one logical change, with a short imperative subject line
  ("Reject tickets numbered zero"), and a body explaining why when it isn't obvious.
- Pull requests are squash-merged, so the PR title becomes the commit subject on `main`.
- Changes to `main` go through pull requests and need an approving review from the maintainer.

## Releasing

For the maintainer:

1. Open a pull request that bumps the version in `package.json` and `package-lock.json`
   (`npm version <x.y.z> --no-git-tag-version` does both) and renames the `[Unreleased]` section
   of `CHANGELOG.md` to `[x.y.z] - <date>`, and merge it. The plugin reads its `meta.version` from
   `package.json`.
2. Tag the merge commit and push the tag: `git tag v<x.y.z> && git push origin v<x.y.z>`.
3. The Release workflow checks that the tag matches the package version and that the changelog has
   an entry for it, runs the checks above, stages the version on npm with provenance and creates the
   GitHub release with that changelog entry as its notes.
4. Approve the staged version under Staged Packages on npmjs.com (2FA required). It becomes the
   `latest` version on npm.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE)
and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
