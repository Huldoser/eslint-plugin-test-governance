# Require the marker keyword to match the test's state (`test-governance/marker-matches-state`)

Enabled as **error** in every [framework config](../../README.md#frameworks).

Offers editor suggestions; these do not run with `--fix`.

<!-- end auto-generated rule header -->

Reports a marker that is attached to the right test but names the wrong state, which usually
happens when `test.skip` is changed to `test.fixme` or a tag is swapped. It also reports a single
marker written for a test that is in two states, since each state is tracked separately.

The rule offers suggestions: rename the marker to the state the test is in, or add a second marker
that reuses the same ticket.

## Examples

Examples use Playwright unless noted. Settings shown with an example go in `configure()` alongside
`framework`. Incorrect examples illustrate this rule; other enabled rules may report them too.

Incorrect:

<!-- example: invalid -->

```js
// SKIP: TRADE-500
test.fixme('shows the unfilled quantity of a partly filled order', async () => {});
```

With `lifecycleTags: true`:

<!-- example: invalid settings={"lifecycleTags":true} -->

```js
// SKIP: TRADE-500
test.skip('shows the unfilled quantity of a partly filled order @quarantined', async () => {});
```

Correct:

<!-- example: valid -->

```js
// FIXME: TRADE-500
test.fixme('shows the unfilled quantity of a partly filled order', async () => {});
```

With `lifecycleTags: true`:

<!-- example: valid settings={"lifecycleTags":true} -->

```js
// SKIP: TRADE-500
// QUARANTINED: TRADE-500
test.skip('shows the unfilled quantity of a partly filled order @quarantined', async () => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[configuration reference](../configuration.md#options). These change what it reports:

- `lifecycleTags`, `states` and `customStates`: which states are on, and the marker keyword each
  one expects.
- `requireTicketForConditional`: conditional skips such as `test.skip(browserName === 'webkit')`
  need a marker only when this is set, so only then is a wrong marker above one reported.
- `allowBlankLine`: whether a marker separated from its test by a blank line still belongs to it.
- `framework` and `testFunctions`: which functions count as the framework's `test`.
