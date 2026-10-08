# Disallow marker comments that no longer match a test state (`test-governance/no-orphaned-marker`)

📝 Disallow marker comments that no longer match a test state.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

When a test is promoted from `@new`, or a skipped test is fixed, its marker is often left behind.
A leftover marker makes searches for open tickets lie. This rule reports:

- a marker above a test, describe or skip call that is not in that marker's state, and
- a marker that is not directly above a test, describe or skip call at all, so it has no effect.

`FIXME:` and `TODO:` are also everyday work comments, so this rule leaves them to
[`require-ticket-in-comments`](require-ticket-in-comments.md), which requires a ticket in them anywhere
in a test file. A `// FIXME: refactor this` gets one clear error from that rule rather than a confusing
one from this.

A `FIXME:` or `TODO:` comment that starts with a valid ticket is treated by where it sits:

- Above a helper or any other code that isn't a test, it is a tracked work comment and is allowed.
- Above a test, describe or skip call that is not in the `fixme` state, a `FIXME:` comment reads as a
  leftover marker and is reported, since `// FIXME: TRADE-12` above a test usually means the test was
  fixed and the marker forgotten. Move a work comment into the test body, or onto the line of code it
  is about.
- Above a Jest or Vitest test that is not a todo, a `TODO:` comment is a tracked work comment about
  the test and is allowed. `TODO` is the everyday keyword for such comments, so there it is far more
  often a note than the forgotten marker of a `test.todo`.

Other markers that read as a sentence, such as `// SKIP: this one is flaky`, are left alone too: the rule
counts a comment as prose when its first word is not a valid ticket and more text follows.

A marker written in the wrong case, such as `// skip: TRADE-1`, is reported once the test is no longer
in that state, as long as a valid ticket follows the colon. Without one, as in `// skip: not on mobile`,
it reads as a sentence.

When a test's tags come from another module, as in `{ tag: TAGS.NEW }` with `TAGS` imported, the rule
can't tell which tags it has, so it leaves markers for tag states such as `// NEW:` alone on that test
and the tests inside it. The same goes for Vitest's state options, such as `// SKIP:`, when the options
object itself comes from another module. Tags kept in a `const` or an enum in the same file are read
and checked as usual.

Files without tests, such as application code, are not checked.

The rule offers a suggestion to delete the comment.

## Examples

Incorrect:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
// NEW: TRADE-80 promoted last sprint
test('saves a watchlist', async () => {});
```

<!-- example: invalid -->

```js
test('places a limit order', async ({ page }) => {
  // SKIP: TRADE-81
  await page.goto('/orders');
});
```

<!-- example: invalid -->

```js
// skip: TRADE-82
test('cancels an open order', async ({ page }) => {});
```

Correct:

<!-- example: valid settings={"lifecycleTags":true} -->

```js
test('saves a watchlist', async () => {});
```

<!-- example: valid -->

```js
test('places a limit order', async ({ page }) => {
  // FIXME: the price field sometimes loses focus on slow machines
  await page.goto('/orders');
});
```

<!-- example: valid -->

```js
// FIXME: TRADE-81
test.fixme('places a limit order', async ({ page }) => {
  await page.goto('/orders');
});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options). These change what it reports:

- `lifecycleTags`, `states` and `customStates`: which keywords are markers. `// NEW:` is a marker
  only while the `new` state is on, so with `lifecycleTags` off it is an ordinary comment.
- `ticket` and `placeholders`: whether a comment starts with a valid ticket, which separates a
  leftover marker from a sentence or a work comment.
- `allowBlankLine`: whether a marker separated from the code below it by a blank line still belongs
  to that code.
- `framework` and `testFunctions`: which functions count as the framework's `test`, and so which
  files are test files.
