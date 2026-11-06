# Require a ticket marker on commented-out tests (`test-governance/require-ticket-for-commented-out-tests`)

📝 Require a ticket marker on commented-out tests.

⚠️ This rule _warns_ in the following [configs](https://github.com/Huldoser/eslint-plugin-test-governance#usage): 🌲 `cypress`, 🌼 `jasmine`, 🃏 `jest`, ☕ `mocha`, 🟢 `node-test`, 🎭 `playwright`, ⚡ `vitest`, 🤖 `webdriverio`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

Commenting a test out skips it by hand, with nothing in the test report to say so. This rule asks a
commented-out test for the same `// SKIP: <ticket>` marker a skipped test needs, so it is tracked like one,
or deleted.

```ts
// SKIP: TRADE-512                                    ✓ the marker covers the block it is in
// test('rejects a margin order', async () => {});

// test('rejects a margin order', async () => {});    ✖ no marker
```

How comments are read:

- A commented-out test is a comment line that starts with a call of a test or describe function of the
  framework, such as `test(`, `test.describe(`, `it.skip(` or `xit(`, after any `*` of a block comment.
  A call that declares no test, such as `test.use({ ... })`, `test.describe.configure(...)` or an empty
  `test.slow()`, doesn't count.
- Comments on consecutive lines, with no code before them on their line, form one block. The block is
  reported once, at its first test line, and a `SKIP:` marker anywhere in it covers it. A blank line starts a
  new block.
- The marker takes the `skip` state's keyword and ticket format, renamed or narrowed under `states.skip`.
  With the `skip` state off, nothing is reported.
- A JSDoc comment, `/** ... */`, is documentation, so a test in its example is left alone.
- A block's comments belong to it: a `SKIP:` marker in it is not taken as the marker of the test below the
  block, which still needs its own.
- Only test files (a test framework import or a call to a test function) are checked.

The rule reads comment text rather than code, so a sentence that starts like a call, `// test(...)
covers this`, is reported too. That is why the configs set it to warn.

## Examples

Incorrect:

<!-- example: invalid -->

```js
// test('cancels an open order', async ({ page }) => {
//   await page.click('#cancel');
// });
test('places a limit order', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: TBD
// test('cancels an open order', async ({ page }) => {});
test('places a limit order', async ({ page }) => {});
```

Correct:

<!-- example: valid -->

```js
// SKIP: TRADE-512
// test('cancels an open order', async ({ page }) => {
//   await page.click('#cancel');
// });
test('places a limit order', async ({ page }) => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options):

- `states`: the `skip` state's marker and ticket format, such as `{ skip: { marker: 'PARKED' } }`.
  `{ skip: false }` turns the check off, and so does turning the rule off in your config.
- `ticket`, `placeholders` and `allowNotes` work as they do for markers.
- `framework` and `testFunctions`: which calls count as tests and describes, and so which comment lines
  are commented-out tests and which files are test files.
