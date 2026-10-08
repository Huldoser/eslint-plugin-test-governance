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

Every pull request runs these in CI (tests on Node 22 and 24 with ESLint 9 and 10, plus the oldest supported
versions, Node 22.12 with ESLint 9.0.0):

```sh
npm run lint           # ESLint, including type-aware rules and eslint-plugin-eslint-plugin
npm run format:check   # Prettier (run `npm run format` to fix)
npm run typecheck      # TypeScript, including the tests
npm run test:coverage  # all tests, including the docs checks; fails below 100% coverage of src
npm run test:pack      # packs the plugin and lints tests/fixtures/sample-project with the tarball
npm run docs:check     # the README rules list and rule doc headers are up to date
```

A pull request that changes `src/` also needs a `CHANGELOG.md` entry (see below).

Code is formatted with Prettier and linted with typescript-eslint's strict type-checked rules. Editors that
support EditorConfig, ESLint and Prettier pick up the settings automatically; VS Code suggests the extensions.
Prefer fixing a lint error over disabling the rule. When a line really needs an exception, use
`eslint-disable-next-line <rule> -- <reason>`.

Coverage must stay at 100% for lines, branches and functions. If a branch can't be
reached, remove it rather than excluding it.

## Changing a rule

- Rule code is in `src/rules/`. The shared analysis (which calls are tests, which comments are
  markers) is in `src/utils/analyze.ts`, and ticket formats are in `src/utils/tickets.ts`.
- Rule tests use ESLint's `RuleTester` through `runRule()` in `tests/helpers.ts`, which runs every
  case under both espree and `@typescript-eslint/parser`. Add at least one valid and one invalid
  case, and assert the full message data and any suggestion output.
- Each rule has a page in `docs/rules/`. Examples marked `<!-- example: valid -->` or
  `<!-- example: invalid -->` run as tests, so keep them correct. Code samples in the README marked
  the same way run with all the rules on.
- The rules list in the README and the header of each rule page are generated. After changing rule
  metadata, run `npm run docs` and commit the result.
- If the change affects what the sample project reports, update the snapshot with
  `UPDATE_SNAPSHOTS=1 node --test tests/sample-project.test.ts` and check the diff.

## Keeping the docs current

Docs change in the same pull request as the code. Most of what they say about the code is checked by
`tests/docs.test.ts` or `npm run docs:check`, so CI fails when they fall behind.

| When you change                                     | Update                                                                                                                               | Checked by                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| A rule's metadata (description, fixable, severity)  | run `npm run docs`; the Severity row of the README Defaults table                                                                    | `docs:check`, docs tests                                     |
| What a rule reports                                 | its page in `docs/rules/`, with an example for the new case                                                                          | the examples run                                             |
| The list of rules                                   | run `npm run docs`; the rule's page; the rule list in `.github/ISSUE_TEMPLATE/1-false-report.yml`                                    | `docs:check`, docs tests                                     |
| An option, its type or its default                  | the README Options and Defaults tables, its doc comment in `src/utils/options.ts`, and the Options list of each rule page it changes | docs tests                                                   |
| A ticket preset or the options it takes             | the README Ticket presets table                                                                                                      | docs tests                                                   |
| A framework, or syntax a framework's tests can use  | the README framework table and "Syntax the rules understand", rule page examples, `package.json` keywords and description            | partly: the table's columns and the keywords, not the syntax |
| Exported types                                      | the README TypeScript section                                                                                                        | docs tests                                                   |
| The supported Node.js, ESLint or TypeScript version | `package.json`, the README, this file and the CI matrix                                                                              | docs tests                                                   |
| A heading                                           | the links to it                                                                                                                      | docs tests                                                   |
| Anything users will notice                          | an entry under `[Unreleased]` in `CHANGELOG.md`                                                                                      | the Changelog check, for changes to `src/`                   |

What the README and rule pages say about behaviour, such as which syntax each framework supports,
can't be checked this way. Adding an example for it to a rule page makes it one that is.

## Commits and pull requests

- Add a line under `[Unreleased]` in `CHANGELOG.md` for any change users will notice. The Changelog
  check fails a pull request that changes `src/` without one. For a change users won't notice, such as
  a refactor, the maintainer adds the `no changelog` label instead.
- Keep each commit to one logical change, with a short imperative subject line
  ("Reject tickets numbered zero"), and a body explaining why when it isn't obvious.
- Pull requests are squash-merged, so the PR title becomes the commit subject on `main`.
- Changes to `main` go through pull requests and need an approving review from the maintainer.

## Releasing

For the maintainer:

1. Run the **Prepare release** workflow (Actions → Prepare release → Run workflow) with `patch`,
   `minor`, `major` or an exact version. It bumps `package.json` and `package-lock.json`, moves the
   `[Unreleased]` entries of `CHANGELOG.md` into a `[x.y.z] - <date>` section, opens a
   "Release x.y.z" pull request and starts CI on it. `node scripts/prepare-release.mjs patch` makes
   the same changes locally.
2. Review and merge that pull request.
3. The Release workflow sees the new version on `main` and checks that it matches the tag it will
   create, that the changelog has an entry for it and nothing left under `[Unreleased]`. It then
   runs the checks above, publishes the version to npm with provenance, where it becomes the
   `latest` version, tags the merge commit `vx.y.z` and creates the GitHub release with that
   changelog entry as its notes.

Pushing a `vx.y.z` tag on a commit of `main` by hand still publishes that commit the same way.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE)
and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
