# Require FIXME and TODO comments in test files to start with a ticket (`test-governance/require-ticket-in-comments`)

📝 Require FIXME and TODO comments in test files to start with a ticket.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

A `// TODO: clean this up` comment is a promise nobody tracks. This rule makes every `FIXME` and
`TODO` comment in a test file start with the ticket that tracks the work, so the ticket stays the
source of truth and nothing is forgotten in a comment.

```ts
// TODO: WEB-512                 ✓
// FIXME: WEB-77, WEB-78         ✓ several tickets, separated by commas
// TODO(WEB-512)                 ✓ the ticket can go in parentheses
// TODO(alice): refactor this    ✖ a name is not a ticket
// TODO: refactor this           ✖ no ticket
// FIXME: WEB-77 flaky locator   ✖ only tickets are allowed (allowNotes: true allows the note)
```

How comments are read:

- The keyword starts the comment (or a line of a block comment). `TODO` and `FIXME` in capitals
  count with or without a colon. Other casings, such as `todo:`, need the colon, so a sentence that
  happens to start with "Todo" is left alone.
- The tickets can also go in parentheses straight after the keyword, `TODO(WEB-512)`, a style many
  teams already use. Anything after the parentheses is a note, as it would be after `TODO: WEB-512`.
- The tickets follow the same rules as markers: the shared ticket format, placeholders such as `TBD`
  rejected, and no text after the tickets unless `allowNotes` is set.
- A `// FIXME:` marker directly above a `test.fixme(...)` is checked by
  [`require-ticket`](require-ticket.md) instead, so it is reported once.
- Only files that use Playwright (a Playwright import or a call to a test function) are checked.
  Application code is left alone, even if your config applies the plugin to it.

## Examples

Incorrect:

<!-- example: invalid -->

```js
test('checkout', async ({ page }) => {
  // FIXME: this locator breaks on mobile
  await page.click('#pay');
});
```

<!-- example: invalid -->

```js
// TODO: TBD
test('refund', async ({ page }) => {});
```

Correct:

<!-- example: valid -->

```js
test('checkout', async ({ page }) => {
  // FIXME: WEB-81
  await page.click('#pay');
});
```

<!-- example: valid settings={"comments":{"keywords":["FIXME"]}} -->

```js
// TODO: add a refund test once the API is stable
test('checkout', async ({ page }) => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options):

- `comments`: the keywords to check, `{ keywords: ['FIXME', 'TODO'] }` by default. Use
  `{ keywords: ['FIXME'] }` to allow free-form `TODO`s, add your own such as `HACK`, or set
  `comments: false` to turn the check off. Turning the rule off in your config works too.
- `ticket`, `placeholders` and `allowNotes` work as they do for markers.
