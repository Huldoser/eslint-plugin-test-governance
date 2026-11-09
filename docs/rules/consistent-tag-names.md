# Disallow tag names that differ in case or look like typos (`test-governance/consistent-tag-names`)

Enabled as **warn** in every [framework config](../../README.md#frameworks).

Supports automatic fixes with `--fix`.

<!-- end auto-generated rule header -->

Tags match exactly. This rule checks the tags configured in `customStates` and `knownTags`:

- Wrong case, such as `@Smoke`, is reported and autofixed to `@smoke` when written as a literal.
- Near-miss spellings, such as `@regresion`, are reported for review, without an automatic fix.
- Exact configured tags are accepted. Other tags remain allowed; the lists are not an allowlist.

The rule does not require tickets or assign lifecycle stages. Use `customStates` to require tickets
for a tag; `knownTags` adds spelling checks alone. See [Tag names](../configuration.md#tag-names).

Tags of four letters or fewer after `@`, such as `@e2e` or `@fast`, get only the case check because
one letter off may be another word. A word two or more letters longer or shorter is not a near miss.
When a misspelling is near both a custom state and a known tag, the custom state takes precedence.

A tag read through a shared constant is reported where the test uses it without an autofix. A
constant interpolated into a title is reported once at its definition and can be autofixed when its
source range is known. Vitest and node:test tag names may be written without `@`; diagnostics and
fixes preserve that form.

## Examples

Examples use Playwright unless noted. Settings shown with an example go in `configure()` alongside
`framework`. Incorrect examples illustrate this rule; other enabled rules may report them too.

With `knownTags: ['@smoke', '@regression']`:

Incorrect:

<!-- example: invalid settings={"knownTags":["@smoke","@regression"]} -->

```js
test('places a market order @Smoke @regresion', async () => {});
```

Correct:

<!-- example: valid settings={"knownTags":["@smoke","@regression"]} -->

```js
test('places a market order @smoke @regression @team-owned', async () => {});
```

With `customStates: { review: { when: '@needs-review', marker: 'REVIEW' } }`:

Incorrect:

<!-- example: invalid settings={"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"}}} -->

```js
test('exports the trade history @Needs-review', async () => {});
```

Correct:

<!-- example: valid settings={"customStates":{"review":{"when":"@needs-review","marker":"REVIEW"}}} -->

```js
// REVIEW: TRADE-123
test('exports the trade history @needs-review', async () => {});
```

## Options

This rule has no options of its own. It reads the shared options described in the
[configuration reference](../configuration.md#options). These change what it reports:

- `customStates`: tags that also require ticket markers get case and spelling checks.
- `knownTags`: other tags that get case and spelling checks without requiring tickets.
- `framework` and `testFunctions`: which functions count as the framework's `test`.

For the old `no-conflicting-states` name and removed lifecycle checks, see the
[upgrade guide](../upgrading.md#next-release-custom-tag-states).
