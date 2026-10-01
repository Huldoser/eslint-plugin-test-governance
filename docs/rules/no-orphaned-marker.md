# Disallow marker comments that no longer match a test state (`test-governance/no-orphaned-marker`)

📝 Disallow marker comments that no longer match a test state.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

When a test is promoted from `@new`, or a skipped test is fixed, its marker is often left behind.
A leftover marker makes searches for open tickets lie. This rule reports:

- a marker above a test, describe or skip call that is not in that marker's state, and
- a marker that is not directly above a test, describe or skip call at all, so it has no effect.

A comment that starts with a marker keyword but reads as a sentence, such as
`// FIXME: this check is flaky on slow machines`, is an ordinary code comment and is not reported.
The rule counts a comment as prose when its first word is not a valid ticket and more text follows.

The rule offers a suggestion to delete the comment.

## Examples

Incorrect:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
// NEW: WEB-80 promoted last sprint
test('saved addresses', async () => {});
```

<!-- example: invalid -->

```js
test('checkout', async ({ page }) => {
  // FIXME: WEB-81
  await page.goto('/checkout');
});
```

Correct:

<!-- example: valid settings={"lifecycleTags":true} -->

```js
test('saved addresses', async () => {});
```

<!-- example: valid -->

```js
test('checkout', async ({ page }) => {
  // FIXME: the banner sometimes covers the button on slow machines
  await page.goto('/checkout');
});
```

<!-- example: valid -->

```js
// FIXME: WEB-81
test.fixme('checkout', async ({ page }) => {
  await page.goto('/checkout');
});
```

## Options

Uses the shared options described in the [README](../../README.md#options).
