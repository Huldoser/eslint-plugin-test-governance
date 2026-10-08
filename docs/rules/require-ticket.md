# Require a ticket marker comment above skipped, fixme and tagged tests (`test-governance/require-ticket`)

📝 Require a ticket marker comment above skipped, fixme and tagged tests.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/Huldoser/eslint-plugin-test-governance#usage).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

A skipped test is coverage you no longer have. This rule makes every test in a tracked state point
at the ticket that explains it, so disabled tests show up in planning instead of disappearing.

A test is in a state when it is:

| State          | Put there by                                                                                                                          | Marker                 | On by default              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------- |
| `skip`         | `test.skip('title', fn)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()`, `test.step.skip`, `step.skip()` in a step | `// SKIP:`             | yes                        |
| `fixme`        | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                                                                          | `// FIXME:`            | yes                        |
| `todo`         | Jest's and Vitest's `test.todo`                                                                                                       | `// TODO:`             | yes, in Jest and Vitest    |
| `new`          | the `@new` tag                                                                                                                        | `// NEW:`              | with `lifecycleTags: true` |
| `unstable`     | the `@unstable` tag                                                                                                                   | `// UNSTABLE:`         | with `lifecycleTags: true` |
| `fail`, `slow` | `test.fail(...)`, `test.slow()`, `testInfo.fail()`, `testInfo.slow()`                                                                 | `// FAIL:`, `// SLOW:` | no                         |
| custom         | any tag you list in `customStates`                                                                                                    | your keyword           | when configured            |

In Jest and Vitest, `xit`, `xdescribe`, Vitest's `{ skip: true }` and `context.skip()` skip a test
too, and `test.failing` and `test.fails` put it in the `fail` state. The
[README](../../README.md#jest-and-vitest) lists every form.

Tags are read from the title (`'places a limit order @new'`) and from `{ tag: '@new' }` or `{ tag: ['@new', '@smoke'] }`.
Tags on a `describe` apply to every test inside it.

## Marker format

```text
// SKIP: TRADE-123
// SKIP: TRADE-123, TRADE-124
/* FIXME: https://github.com/acme/trading-engine/issues/4821 */
```

- The marker goes in the comment block directly above the test, describe or `test.skip()` call.
  Other comments, such as `eslint-disable-next-line`, may sit in the same block. A blank line ends
  the block unless `allowBlankLine` is set.
- The keyword is uppercase and followed by a colon. `// skip: TRADE-1` is reported with a hint.
- After the colon come one or more tickets separated by commas, and nothing else. The ticket is the
  source of truth, so the reason for a skip belongs in the ticket, not in the comment.
  `// SKIP: TRADE-123 flaky on CI` is reported, with a suggestion that removes the extra text. Teams
  that want short notes can set `allowNotes: true`.
- A marker on a skipped or tagged `describe` covers every test inside it.
- A `test.skip()` inside a test body can have its marker above the call or above the test.
- A skipped step, `test.step.skip(...)` or `step.skip()` in its body, can have its marker above the
  call, above the step or above a skipped test around it. A `test.skip()` inside a step skips the
  whole test, so its marker goes above the call or above the test.
- Ticket IDs in test titles (`'TRADE-52: closes all positions'`) are never read as tickets.

How ticket lists are read:

| Marker                                                                            | Result                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `// SKIP: TRADE-1, TRADE-2` or `// SKIP: TRADE-1,TRADE-2`                         | two tickets                                               |
| `// SKIP:   TRADE-1  ,  TRADE-2  `                                                | two tickets; extra spaces are fine                        |
| `// SKIP: https://acme.atlassian.net/browse/TRADE-1?focusedCommentId=5#comment-5` | one ticket; query strings and fragments are part of a URL |
| `// SKIP: TRADE-1 flaky on CI`, `// SKIP: TRADE-1: flaky`                         | extra text `flaky on CI` / `: flaky`                      |
| `// SKIP: TRADE-1.` or `// SKIP: TRADE-1:`                                        | one ticket; a full stop or colon at the end is fine       |
| `// SKIP: TRADE-1,`                                                               | extra text `,`                                            |
| `// SKIP: TRADE-1 and TRADE-2`                                                    | extra text `and TRADE-2`; separate tickets with commas    |
| `// SKIP: TRADE-1;TRADE-2`, `// SKIP: TRADE-1/TRADE-2`                            | invalid ticket, since only commas separate tickets        |
| `// SKIP: flaky on CI`                                                            | invalid ticket `flaky`: the first word must be a ticket   |

In a block comment, only the marker line is checked, so a JSDoc block can explain the skip on other
lines. Extra text is reported only once the tickets on that line are valid.

Conditional skips such as `test.skip(browserName === 'webkit', 'Not supported')` usually describe a
permanent platform limit, so they need no ticket unless you set `requireTicketForConditional: true`.
A runtime skip under an `if`, a `switch` case, a ternary or `&&` counts as conditional too, since
`if (!enabled) test.skip()` does the same as `test.skip(!enabled)`. So does a skip in a `catch` block,
such as `catch { test.skip(true, 'Market data feed is down') }`, and a skip after an early exit such as
`if (ready) return;` or `if (!ok) throw error;` earlier in the same function.

If one test or describe has several markers for the same state, each must be valid: in
`// SKIP: TRADE-1` followed by `// SKIP: nope`, the second line is reported.

## Dynamic titles

Tags can only be read from a title that is text: a string or a template literal such as
`` `buys ${symbol} @new` ``. A title built another way, such as `'buys ' + symbol` or a variable, may
hide a tag. With `reportDynamicTitles: true`, the rule reports those titles whenever a tag state
(`@new`, `@unstable` or a custom state) is on, so no tagged test slips past.

<!-- example: invalid settings={"lifecycleTags":true,"reportDynamicTitles":true} -->

```js
for (const symbol of ['AAPL', 'MSFT']) {
  test('buys ' + symbol, async ({ page }) => {});
}
```

<!-- example: valid settings={"lifecycleTags":true,"reportDynamicTitles":true} -->

```js
for (const symbol of ['AAPL', 'MSFT']) {
  test(`buys ${symbol}`, async ({ page }) => {});
}
```

## Examples

Incorrect:

<!-- example: invalid -->

```js
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: flaky on CI
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: TODO
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: invalid -->

```js
// SKIP: TRADE-481 broker sandbox is down
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
test('closes all positions with one click @new', async ({ page }) => {});
```

<!-- example: invalid settings={"framework":"jest"} -->

```js
it.todo('caps position size at 2% of equity');
```

Correct:

<!-- example: valid -->

```js
// SKIP: TRADE-481
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: valid -->

```js
// FIXME: TRADE-12
test.describe.fixme('risk limits', () => {
  test('stops trading at the daily loss limit', async () => {});
  test('caps position size at 2% of equity', async () => {});
});
```

<!-- example: valid -->

```js
test('draws the price chart', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Layout differs on WebKit by design');
});
```

<!-- example: valid settings={"allowNotes":true} -->

```js
// SKIP: TRADE-481 broker sandbox is down
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

<!-- example: valid settings={"lifecycleTags":true} -->

```js
// NEW: TRADE-77
test('closes all positions with one click', { tag: '@new' }, async ({ page }) => {});
```

<!-- example: valid settings={"framework":"vitest"} -->

```js
import { describe, test } from 'vitest';

describe('risk limits', () => {
  // TODO: TRADE-90
  test.todo('caps position size at 2% of equity');

  test.skipIf(process.env.CI)('streams live quotes', () => {});
});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[README](../../README.md#options), usually set once with `testGovernance.configure({...})`. These
change what it reports:

- `ticket` and `placeholders`: which tickets are accepted.
- `lifecycleTags`, `states` and `customStates`: which states need a marker, what the marker is
  called, and, for a state with its own `ticket`, which tickets it accepts.
- `requireTicketForConditional`: conditional skips need a ticket too.
- `allowBlankLine`: blank lines may separate a marker from its test.
- `allowNotes`: text may follow the tickets.
- `reportDynamicTitles`: report titles whose tags can't be read (see [Dynamic titles](#dynamic-titles)).
- `framework` and `testFunctions`: which functions count as the framework's `test`.
