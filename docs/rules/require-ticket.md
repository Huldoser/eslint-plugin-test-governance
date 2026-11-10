# Require a ticket for skipped, fixme, todo, retried and tagged tests (`test-governance/require-ticket`)

Enabled as **error** in every [framework config](../../README.md#frameworks).

Offers editor suggestions; these do not run with `--fix`.

<!-- end auto-generated rule header -->

A skipped test is coverage you no longer have. This rule makes every test in a tracked state point
at the ticket that explains it, so disabled tests show up in planning instead of disappearing.

A test is in a state when it is:

| State          | Put there by                                                                                                                          | Marker                 | On by default             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------- |
| `skip`         | `test.skip('title', fn)`, `test.describe.skip`, `test.skip()` in a body, `testInfo.skip()`, `test.step.skip`, `step.skip()` in a step | `// SKIP:`             | yes                       |
| `fixme`        | `test.fixme(...)`, `test.describe.fixme`, `testInfo.fixme()`                                                                          | `// FIXME:`            | yes                       |
| `todo`         | Jest's, Vitest's and `node:test`'s `test.todo`, and a Mocha or Jasmine test with only a title, `it('title')`                          | `// TODO:`             | yes, except in Playwright |
| `fail`, `slow` | `test.fail(...)`, `test.slow()`, `testInfo.fail()`, `testInfo.slow()`                                                                 | `// FAIL:`, `// SLOW:` | no                        |
| `retry`        | `describe.configure({ retries })`, `jest.retryTimes()`, Vitest's `{ retry }`, `this.retries()`, Cypress's `{ retries }`               | `// RETRY:`            | no                        |
| custom         | any tag you list in `customStates`                                                                                                    | your keyword           | when configured           |

In Jest and Vitest, `xit`, `xdescribe`, Vitest's `{ skip: true }`, `skipIf(true)`, `context.skip()` and
`context.skip('note')`, in a test or in `beforeEach`, skip a test too, and `test.failing` and `test.fails` put it in the `fail` state. Any retry count but `0` puts a test, describe or file in the `retry` state, including one known only when the tests run, such as `process.env.CI ? 2 : 0`; node:test and Jasmine have no retries. In Mocha, Cypress and WebdriverIO, `xit`, `xdescribe` and
`this.skip()` in a test or hook skip a test too, and Cypress's `{ browser: '!webkit' }` skips it in other
browsers, which counts as a conditional skip. In `node:test`, `{ skip: 'reason' }`, `t.skip()` and `this.skip()` skip a test, `{ todo: true }`,
`t.todo()` and `this.todo()` make it a todo, `t.test()` subtests count as tests, and `test.expectFailure` puts it in the `fail` state. In
Jasmine, `xit`, `xdescribe`, and `pending()` or `notApplicable()` in a test, `beforeEach` or `afterEach` skip a test. The
[framework reference](../frameworks.md) lists every form.

Tag examples on this page use this policy:

```js
testGovernance.configure({
  framework: 'playwright',
  customStates: {
    review: { when: '@needs-review', marker: 'REVIEW' },
    blocked: { when: '@blocked', marker: 'BLOCKED' },
  },
});
```

Tags are read from the title (`'places a limit order @needs-review'`) and from `{ tag: '@needs-review' }` or `{ tag: ['@needs-review', '@smoke'] }`,
also when they come from a `const` or an enum declared in the same file, as in `{ tag: TAGS.REVIEW }`.
Vitest 4.1+ and node:test (Node 26.2+) write tag names without the `@`, so `{ tags: ['needs-review'] }` is the `@needs-review` tag. Cypress tags from
@cypress/grep keep it: `{ tags: '@needs-review' }`. Tags on a
`describe` apply to every test inside it. Configure a tag and its marker with `customStates`;
no tag has a built-in meaning. See [Tag names](../configuration.md#tag-names).

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
such as `catch { test.skip(true, 'Market data feed is down') }`, a skip after other code in a `try`
block that has a `catch`, as in `try { await stat(target); test.skip(); } catch {}`, where an error
skips past it, and a skip after an early exit such as `if (ready) return;` or `if (!ok) throw error;`
earlier in the same function.

A test or describe whose function a condition picks is a conditional skip too, in every framework. Its
title and tags count as usual, and a marker goes above it, or in code without semicolons above the
`;` that starts the line.

<!-- example: valid -->

```js
(isMobile ? test.skip : test)('places an order', async ({ page }) => {});
```

With `framework: "jest"`, `requireTicketForConditional: true`:

<!-- example: invalid settings={"framework":"jest","requireTicketForConditional":true} -->

```js
(process.env.CI ? describe.skip : describe)('order book', () => {
  it('shows the best bid', () => {});
});
```

If one test or describe has several markers for the same state, each must be valid: in
`// SKIP: TRADE-1` followed by `// SKIP: nope`, the second line is reported.

## Reasons for conditional skips

With `requireReasonForConditional: true`, a conditional skip needs a reason but no ticket, so nobody has
to guess later why it doesn't run. Any of these counts:

- a comment above it or at the end of its line, above a statement around it, such as the `if`, or at the
  end of that statement's first line, as `if (isMobile) { // why`, or above the hook, step or test it is in.
  Commented-out code, a marker keyword alone such as `// SKIP:`, and an `eslint-disable` comment without a
  description after `--` say nothing, so they don't count. The description of an `eslint-disable` block
  comment that turns a rule off for a stretch of the file says why the rule is off, so it doesn't count either;
- for a test or describe whose function a constant picks, as `const posixTest = isWindows ? test.skip : test`,
  a comment above that declaration or at the end of its line, which says why once for every test that uses it;
- the reason its call takes, where the runner has one: Playwright's `test.skip(condition, 'why')` and
  `testInfo.skip(condition, 'why')`, Vitest's `context.skip(condition, 'why')` or `context.skip('why')`,
  node:test's `t.skip('why')` and Jasmine's `pending('why')`. A reason held in a name or built in a
  template is taken on trust;
- in node:test, text or a template in the option, as `{ skip: isWindows && 'No symlinks' }`, which Node
  reports;
- a ticket, from a marker or an annotation.

The same goes for the other states a condition can set, such as `test.fixme(condition)`. With
`requireTicketForConditional` as well, the ticket is required and the reason alone is not enough.

With `requireReasonForConditional: true`:

<!-- example: valid settings={"requireReasonForConditional":true} -->

```js
test('copies the order ID', async ({ browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit has no clipboard API in headless mode');
});

// Touch screens have no hover.
(isMobile ? test.skip : test)('shows the price on hover', async ({ page }) => {});
```

With `framework: "mocha"`, `requireReasonForConditional: true`:

<!-- example: invalid settings={"framework":"mocha","requireReasonForConditional":true} -->

```js
it('places an order', function () {
  if (isWeekend) this.skip();
});
```

## Titles and tags that can't be read

Tags can only be read from text: a string or a template literal such as `` `buys ${symbol} @needs-review` ``,
written in the call or kept in a `const` or an enum in the same file. A title built another way, such
as `'buys ' + symbol`, and a tag or details object imported from another module may hide a tag. With
`reportUnreadableTags: true`, the rule reports those whenever a custom tag state is configured, so no tagged test slips past.

With the custom tag policy above, `reportUnreadableTags: true`:

<!-- example: invalid settings={"reportUnreadableTags":true,"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
for (const symbol of ['AAPL', 'MSFT']) {
  test('buys ' + symbol, async ({ page }) => {});
}
```

With the custom tag policy above, `reportUnreadableTags: true`:

<!-- example: invalid settings={"reportUnreadableTags":true,"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
import { TAGS } from './tags';

test('closes all positions with one click', { tag: TAGS.REVIEW }, async ({ page }) => {});
```

With the custom tag policy above, `reportUnreadableTags: true`:

<!-- example: valid settings={"reportUnreadableTags":true,"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
for (const symbol of ['AAPL', 'MSFT']) {
  test(`buys ${symbol}`, async ({ page }) => {});
}
```

With the custom tag policy above, `reportUnreadableTags: true`:

<!-- example: valid settings={"reportUnreadableTags":true,"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
const TAGS = { REVIEW: '@needs-review', SMOKE: '@smoke' };

// REVIEW: TRADE-77
test('closes all positions with one click', { tag: [TAGS.REVIEW, TAGS.SMOKE] }, async ({ page }) => {});
```

## Examples

Examples use Playwright unless noted. Settings shown with an example go in `configure()` alongside
`framework`. Incorrect examples illustrate this rule; other enabled rules may report them too.

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

With the custom tag policy above:

<!-- example: invalid settings={"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
test('closes all positions with one click @needs-review', async ({ page }) => {});
```

With `framework: "jest"`:

<!-- example: invalid settings={"framework":"jest"} -->

```js
it.todo('caps position size at 2% of equity');
```

With `framework: "vitest"`:

<!-- example: invalid settings={"framework":"vitest"} -->

```js
test.skipIf(true)('fills a stop order when the market opens', () => {});
```

With `framework: "mocha"`:

<!-- example: invalid settings={"framework":"mocha"} -->

```js
it('settles a trade at T+1', function () {
  this.skip();
});
```

With `framework: "node-test"`:

<!-- example: invalid settings={"framework":"node-test"} -->

```js
import { test } from 'node:test';

test('liquidates below maintenance', { skip: 'broker sandbox is down' }, () => {});
```

With `framework: "jasmine"`:

<!-- example: invalid settings={"framework":"jasmine"} -->

```js
it('streams level 2 quotes', () => {
  pending('needs the market data feed');
});
```

With `framework: "cypress"`, with the custom tag policy above:

<!-- example: invalid settings={"framework":"cypress","customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
it('places a stop order', { tags: '@blocked' }, () => {});
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

With `allowNotes: true`:

<!-- example: valid settings={"allowNotes":true} -->

```js
// SKIP: TRADE-481 broker sandbox is down
test.skip('rejects a margin order above the buying power', async ({ page }) => {});
```

With the custom tag policy above:

<!-- example: valid settings={"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"},"blocked":{"when":"@blocked","marker":"BLOCKED"}}} -->

```js
// REVIEW: TRADE-77
test('closes all positions with one click', { tag: '@needs-review' }, async ({ page }) => {});
```

With `framework: "vitest"`:

<!-- example: valid settings={"framework":"vitest"} -->

```js
import { describe, test } from 'vitest';

describe('risk limits', () => {
  // TODO: TRADE-90
  test.todo('caps position size at 2% of equity');

  test.skipIf(process.env.CI)('streams live quotes', () => {});
});
```

With `framework: "mocha"`:

<!-- example: valid settings={"framework":"mocha"} -->

```js
describe('settlement', function () {
  // TODO: TRADE-91
  it('settles a trade on a market holiday');

  it('settles in the clearing house currency', function () {
    if (!process.env.CLEARING_URL) this.skip();
  });
});
```

With `framework: "node-test"`:

<!-- example: valid settings={"framework":"node-test"} -->

```js
import { test } from 'node:test';

// SKIP: TRADE-92
test('liquidates below maintenance', { skip: 'broker sandbox is down' }, () => {});

test('nets margin across accounts', (t) => {
  if (!process.env.RISK_URL) t.skip();
});
```

With `framework: "jasmine"`:

<!-- example: valid settings={"framework":"jasmine"} -->

```js
describe('order entry', () => {
  // SKIP: TRADE-93
  xit('routes an order to the dark pool', () => {});

  it('prints the trade confirmation', () => {
    if (isNode) pending('needs a browser');
  });
});
```

Mocha ignores a false argument to `this.skip()`, so this still needs a ticket:

<!-- example: invalid settings={"framework":"mocha"} -->

```js
it('fills an order', function () {
  this.skip(false);
});
```

Vitest accepts a function as the name. A separate body does not make the skipped test exempt:

<!-- example: invalid settings={"framework":"vitest"} -->

```js
test.skip(
  function fillsAnOrder() {},
  () => {},
);
```

OpenProject links may include an installation base path and a semantic work-package ID:

<!-- example: valid settings={"ticket":{"preset":"openproject","host":"tracker.example.com"}} -->

```js
// SKIP: https://tracker.example.com/openproject/wp/TRADE-512
test.skip('fills an order', () => {});
```

A matching custom pattern still rejects a URL whose ticket ID is zero:

<!-- example: invalid settings={"ticket":{"preset":"pattern","pattern":"\\S+"}} -->

```js
// SKIP: https://tracker.example.com/issues?id=0
test.skip('fills an order', () => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[configuration reference](../configuration.md#options), usually set once with `testGovernance.configure({...})`. These
change what it reports:

- `ticket` and `placeholders`: which tickets are accepted.
- `states` and `customStates`: which states need a marker, which tag puts a test in
  each, what the marker is called, and, for a state with its own `ticket`, which tickets it accepts.
- `requireTicketForConditional`: conditional skips need a ticket too.
- `requireReasonForConditional`: conditional skips need a reason, a comment or the call's own reason argument.
- `allowBlankLine`: blank lines may separate a marker from its test.
- `allowNotes`: text may follow the tickets.
- `annotations`: the ticket may also come from a Playwright annotation of the configured type or Vitest's `meta` key of that name. With `only: true`, a test or describe must take it from there, and a marker comment above one is reported with a suggestion that moves it.
- `reportUnreadableTags`: report titles and tags that can't be read (see [Titles and tags that can't be read](#titles-and-tags-that-cant-be-read)).
- `framework` and `testFunctions`: which functions count as the framework's `test`.
