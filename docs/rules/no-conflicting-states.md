# Disallow state tags that contradict each other, differ in case or look like typos (`test-governance/no-conflicting-states`)

📝 Disallow state tags that contradict each other, differ in case or look like typos.

⚠️ This rule _warns_ in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

Tags are matched exactly, so `@New` or `@unstabel` silently puts a test in no state at all. This
rule reports:

- `@new` together with `@unstable` on the same test, including tags inherited from a `describe`;
- `@new` on a test that is skipped or fixme'd, since a test that doesn't run can't be promoted;
- a state tag written in the wrong case, such as `@New` (autofixed to `@new`);
- a near-miss spelling of a state tag, such as `@unstabel`.

The `@new` checks run when the `new` state is on (`lifecycleTags: true`). Case and typo checks cover
every tag state that is on, including custom states.

## Examples

Incorrect:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('places a limit order @new @unstable', async () => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
// SKIP: TRADE-9
// NEW: TRADE-9
test.skip('places a limit order @new', async () => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('exports the trade history as CSV @New', async () => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('shows dividend payments in the account history @unstabel', async () => {});
```

Correct:

<!-- example: valid settings={"lifecycleTags":true} -->

```js
test('places a limit order @unstable', async () => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options). These change what it reports:

- `lifecycleTags`, or `states` for `new` and `unstable`: the `@new` checks run when the `new` state
  is on, and `@new` together with `@unstable` is reported when both are on.
- `customStates`: the tags of custom states get the same case and typo checks.
- `testFunctions`: which functions count as Playwright's `test`.
