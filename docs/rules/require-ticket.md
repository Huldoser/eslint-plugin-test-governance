# Require a ticket marker comment above skipped, fixme and tagged tests (`test-governance/require-ticket`)

📝 Require a ticket marker comment above skipped, fixme and tagged tests.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

A skipped test is coverage you no longer have. This rule makes every test in a tracked state point
at the ticket that explains it, so disabled tests show up in planning instead of disappearing.

A test is in a state when it is:

| State          | Put there by                                                                               | Marker                 | On by default              |
| -------------- | ------------------------------------------------------------------------------------------ | ---------------------- | -------------------------- |
| `skip`         | `test.skip('title', fn)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()` | `// SKIP:`             | yes                        |
| `fixme`        | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                               | `// FIXME:`            | yes                        |
| `new`          | the `@new` tag                                                                             | `// NEW:`              | with `lifecycleTags: true` |
| `unstable`     | the `@unstable` tag                                                                        | `// UNSTABLE:`         | with `lifecycleTags: true` |
| `fail`, `slow` | `test.fail(...)`, `test.slow()`                                                            | `// FAIL:`, `// SLOW:` | no                         |
| custom         | any tag you list in `customStates`                                                         | your keyword           | when configured            |

Tags are read from the title (`'checkout @new'`) and from `{ tag: '@new' }` or `{ tag: ['@new', '@smoke'] }`.
Tags on a `describe` apply to every test inside it.

## Marker format

```text
// SKIP: WEB-123
// SKIP: WEB-123, WEB-124
/* FIXME: https://github.com/acme/web/issues/4821 */
```

- The marker goes in the comment block directly above the test, describe or `test.skip()` call.
  Other comments, such as `eslint-disable-next-line`, may sit in the same block. A blank line ends
  the block unless `allowBlankLine` is set.
- The keyword is uppercase and followed by a colon. `// skip: WEB-1` is reported with a hint.
- After the colon come one or more tickets separated by commas, and nothing else. The ticket is the
  source of truth, so the reason for a skip belongs in the ticket, not in the comment.
  `// SKIP: WEB-123 flaky on CI` is reported, with a suggestion that removes the extra text. Teams
  that want short notes can set `allowNotes: true`.
- A marker on a skipped or tagged `describe` covers every test inside it.
- A `test.skip()` inside a test body can have its marker above the call or above the test.
- Ticket IDs in test titles (`'SDQA-52: logout'`) are never read as tickets.

How ticket lists are read:

| Marker                                                                          | Result                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `// SKIP: WEB-1, WEB-2` or `// SKIP: WEB-1,WEB-2`                               | two tickets                                               |
| `// SKIP:   WEB-1  ,  WEB-2  `                                                  | two tickets; extra spaces are fine                        |
| `// SKIP: https://acme.atlassian.net/browse/WEB-1?focusedCommentId=5#comment-5` | one ticket; query strings and fragments are part of a URL |
| `// SKIP: WEB-1 flaky on CI`, `// SKIP: WEB-1: flaky`                           | extra text `flaky on CI` / `: flaky`                      |
| `// SKIP: WEB-1.` or `// SKIP: WEB-1:`                                          | one ticket; a full stop or colon at the end is fine       |
| `// SKIP: WEB-1,`                                                               | extra text `,`                                            |
| `// SKIP: WEB-1 and WEB-2`                                                      | extra text `and WEB-2`; separate tickets with commas      |
| `// SKIP: WEB-1;WEB-2`, `// SKIP: WEB-1/WEB-2`                                  | invalid ticket, since only commas separate tickets        |
| `// SKIP: flaky on CI`                                                          | invalid ticket `flaky`: the first word must be a ticket   |

In a block comment, only the marker line is checked, so a JSDoc block can explain the skip on other
lines. Extra text is reported only once the tickets on that line are valid.

Conditional skips such as `test.skip(browserName === 'webkit', 'Not supported')` usually describe a
permanent platform limit, so they need no ticket unless you set `requireTicketForConditional: true`.
A runtime skip under an `if`, a `switch` case, a ternary or `&&` counts as conditional too, since
`if (!enabled) test.skip()` does the same as `test.skip(!enabled)`. So does a skip in a `catch` block,
such as `catch { test.skip(true, 'Mail server is down') }`, and a skip after an early exit such as
`if (ready) return;` or `if (!ok) throw error;` earlier in the same function.

If one test or describe has several markers for the same state, each must be valid: in
`// SKIP: WEB-1` followed by `// SKIP: nope`, the second line is reported.

## Examples

Incorrect:

<!-- example: invalid -->

```js
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: flaky on CI
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: TODO
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: WEB-481 payment sandbox is down
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('one-click reorder @new', async ({ page }) => {});
```

Correct:

<!-- example: valid -->

```js
// SKIP: WEB-481
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: valid -->

```js
// FIXME: WEB-12
test.describe.fixme('tax rules', () => {
  test('per region', async () => {});
  test('per product', async () => {});
});
```

<!-- example: valid -->

```js
test('opens the dashboard', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Layout differs on WebKit by design');
});
```

<!-- example: valid settings={"allowNotes":true} -->

```js
// SKIP: WEB-481 payment sandbox is down
test.skip('pays with PayPal', async ({ page }) => {});
```

<!-- example: valid settings={"lifecycleTags":true} -->

```js
// NEW: WEB-77
test('one-click reorder', { tag: '@new' }, async ({ page }) => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options), usually set once with `testGovernance.configure({...})`.
