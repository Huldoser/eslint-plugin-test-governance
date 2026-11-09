# Disallow state tags that contradict each other, differ in case or look like typos (`test-governance/no-conflicting-states`)

Enabled as **warn** in every [framework config](../../README.md#frameworks).

Supports automatic fixes with `--fix`.

<!-- end auto-generated rule header -->

Tags are matched exactly, so `@New` or `@quarantiend` silently puts a test in no state at all. This
rule reports:

- `@new` together with `@quarantined` on the same test, including tags inherited from a `describe`;
- `@new` on a test that is skipped or fixme'd, since a test that doesn't run can't be promoted;
- a state tag written in the wrong case, such as `@New` (autofixed to `@new`);
- a near-miss spelling of a state tag, such as `@quarantiend`;
- the same for the tags listed in `knownTags`, such as `@Smoke` or `@smok` next to `@smoke`.

The `@new` checks run when the `new` state is on (`lifecycleTags: true`). Case and typo checks cover
every tag state that is on, including custom states. A tag kept in a `const` in the same file is
reported where the test uses it, without an autofix, since other tests may share the constant. Vitest
tag names are written without the `@`, so `{ tags: ['New'] }` is reported, and fixed, as `'new'`.

Tags such as `@smoke` usually pick which tests a CI job runs, so a misspelled one quietly drops a test
from that job. List your team's tags in `knownTags`, written with the `@`, also for Vitest, to give them
the same checks. A listed tag is never reported as a typo of a state tag, so `knownTags: ['@quarantine']`
keeps a tag your team uses next to `@quarantined`. Tags of four letters or fewer after the `@`, such as
`@e2e` or `@fast`, get only the case check, since one letter off is often another word.

With `knownTags: ["@smoke","@regression"]`:

<!-- example: invalid settings={"knownTags":["@smoke","@regression"]} -->

```js
test('places a market order @smok', async () => {});
```

## Examples

Examples use Playwright unless noted. Settings shown with an example go in `configure()` alongside
`framework`. Incorrect examples illustrate this rule; other enabled rules may report them too.

Incorrect:

With `lifecycleTags: true`:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('places a limit order @new @quarantined', async () => {});
```

With `lifecycleTags: true`:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
// SKIP: TRADE-9
// NEW: TRADE-9
test.skip('places a limit order @new', async () => {});
```

With `lifecycleTags: true`:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('exports the trade history as CSV @New', async () => {});
```

With `lifecycleTags: true`:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('shows dividend payments in the account history @quarantiend', async () => {});
```

Correct:

With `lifecycleTags: true`:

<!-- example: valid settings={"lifecycleTags":true} -->

```js
// QUARANTINED: TRADE-10
test('places a limit order @quarantined', async () => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[configuration reference](../configuration.md#options). These change what it reports:

- `lifecycleTags`, or `states` for `new` and `quarantined`: the `@new` checks run when the `new` state
  is on, and `@new` together with `@quarantined` is reported when both are on. A tag renamed in
  `states`, such as `@flaky`, is checked in place of the default one.
- `customStates`: the tags of custom states get the same case and typo checks.
- `knownTags`: other tags that get the case and typo checks.
- `framework` and `testFunctions`: which functions count as the framework's `test`.
