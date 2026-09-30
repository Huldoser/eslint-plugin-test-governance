# Require the marker keyword to match the test's state (`test-governance/marker-matches-state`)

📝 Require the marker keyword to match the test's state.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

Reports a marker that is attached to the right test but names the wrong state, which usually
happens when `test.skip` is changed to `test.fixme` or a tag is swapped. It also reports a single
marker written for a test that is in two states, since each state is tracked separately.

The rule offers suggestions: rename the marker to the state the test is in, or add a second marker
that reuses the same ticket.

## Examples

Incorrect:

<!-- example: invalid -->
```js
// SKIP: WEB-500
test.fixme('splits shipping', async () => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->
```js
// SKIP: WEB-500
test.skip('splits shipping @unstable', async () => {});
```

Correct:

<!-- example: valid -->
```js
// FIXME: WEB-500
test.fixme('splits shipping', async () => {});
```

<!-- example: valid settings={"lifecycleTags":true} -->
```js
// SKIP: WEB-500
// UNSTABLE: WEB-500
test.skip('splits shipping @unstable', async () => {});
```

## Options

Uses the shared options described in the [README](../../README.md#options).

