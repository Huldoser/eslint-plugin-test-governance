# Require FIXME and TODO comments in test files to start with a ticket (`test-governance/require-ticket-in-comments`)

Enabled as **error** in every [framework config](../../README.md#frameworks).

Offers editor suggestions; these do not run with `--fix`.

<!-- end auto-generated rule header -->

This rule requires `FIXME` and `TODO` comments in test files to start with a tracking ticket.
Keep the work's details in the ticket, or enable `allowNotes` for short notes in comments.

| Comment                            | Result                                            |
| ---------------------------------- | ------------------------------------------------- |
| `// TODO: TRADE-512`               | Valid ticket                                      |
| `// FIXME: TRADE-77, TRADE-78`     | Valid comma-separated tickets                     |
| `// TODO(TRADE-512)`               | Valid ticket in parentheses                       |
| `// TODO(EXAMPLE): refactor this`  | Invalid: the value in parentheses is not a ticket |
| `// TODO: refactor this`           | Invalid: no ticket                                |
| `// FIXME: TRADE-77 flaky locator` | Invalid unless `allowNotes: true`                 |

How comments are read:

- The keyword starts the comment (or a line of a block comment). `TODO` and `FIXME` in capitals
  count with or without a colon. Other casings, such as `todo:`, need the colon, so a sentence that
  happens to start with "Todo" is left alone.
- The tickets can also go in parentheses after the keyword, `TODO(TRADE-512)` or `TODO (TRADE-512)`, a
  style many teams already use. Anything after the parentheses is a note, as it would be after `TODO: TRADE-512`.
- The tickets follow the same rules as markers: the shared ticket format, placeholders such as `TBD`
  rejected, and no text after the tickets unless `allowNotes` is set.
- A `// FIXME:` marker directly above a `test.fixme(...)`, or a `// TODO:` marker above a todo test,
  such as Jest's `test.todo(...)` or Mocha's `it('title')`, is checked by [`require-ticket`](require-ticket.md) instead, so it is
  reported once. That includes one in the wrong case, `// fixme:` or `// Todo:`, which `require-ticket` asks to write in
  uppercase.
- In an ESLint directive, only the description after `--` is read, as a comment of its own:
  `// eslint-disable-next-line no-console -- TODO: TRADE-512` is checked, the directive itself never is.
- Only test files (a test framework import or a call to a test function) are checked.
  Application code is left alone, even if your config applies the plugin to it.

## Examples

Examples use Playwright unless noted. Settings shown with an example go in `configure()` alongside
`framework`. Incorrect examples illustrate this rule; other enabled rules may report them too.

Incorrect:

<!-- example: invalid -->

```js
test('places a limit order', async ({ page }) => {
  // FIXME: this locator breaks on mobile
  await page.click('#buy');
});
```

<!-- example: invalid -->

```js
// TODO: TBD
test('cancels an open order', async ({ page }) => {});
```

Correct:

<!-- example: valid -->

```js
test('places a limit order', async ({ page }) => {
  // FIXME: TRADE-81
  await page.click('#buy');
});
```

With `comments: {"keywords": ["FIXME"]}`:

<!-- example: valid settings={"comments":{"keywords":["FIXME"]}} -->

```js
// TODO: add a test for cancelled orders once the API is stable
test('places a limit order', async ({ page }) => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[configuration reference](../configuration.md#options):

- `comments`: the keywords to check, `{ keywords: ['FIXME', 'TODO'] }` by default. Your list
  replaces the default one: `{ keywords: ['FIXME'] }` allows free-form `TODO`s, and
  `{ keywords: ['FIXME', 'TODO', 'HACK'] }` checks `HACK` too. `comments: false` turns the check
  off, and so does turning the rule off in your config.
- `ticket`, `placeholders` and `allowNotes` work as they do for markers.
- `framework` and `testFunctions`: which functions count as the framework's `test`, and so which
  files are test files.
