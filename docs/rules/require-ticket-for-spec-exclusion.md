# Require a ticket for excluded Playwright spec files (`test-governance/require-ticket-for-spec-exclusion`)

Disabled in every [framework config](../../README.md#frameworks); enable it explicitly.

Reports problems without fixes.

<!-- end auto-generated rule header -->

Playwright's `testIgnore` can remove a test file from a browser project while all its tests still look active.
Enable this rule on the configs whose exclusions your team reviews. Add an exact entry to
`allowedSpecExclusions` for permanent routing, such as a setup spec that runs in its own project.

<!-- config: spec-exclusions -->

```js
import testGovernance from 'eslint-plugin-test-governance';

const policy = testGovernance.configure({
  framework: 'playwright',
  allowedSpecExclusions: ['global-setup.spec.js'],
});
export default [
  {
    files: ['playwright.config.{js,mjs,cjs}'],
    plugins: policy.plugins,
    settings: policy.settings,
    rules: { 'test-governance/require-ticket-for-spec-exclusion': 'error' },
  },
];
```

For TypeScript configs, select their extensions and configure a [parser](../configuration.md#typescript).
The rule checks string literals at the root and in recognized projects. It accepts a named
`.spec` or `.test` file with a JavaScript or TypeScript extension and an optional leading `**/`.
Directory filters, wildcard filenames, regular expressions and dynamic entries are outside the rule.
Allowlist values match the entire written string, including any leading `**/`.

<!-- example: invalid -->

```js
export default { projects: [{ name: 'firefox', testIgnore: ['**/orders.spec.ts'] }] };
```

Each array entry needs its own marker immediately above it. For a single string, put the marker above
the property. The marker uses the shared ticket format, placeholder and note settings.

<!-- example: valid -->

```js
export default {
  projects: [
    {
      name: 'firefox',
      testIgnore: [
        // EXCLUDE: EXAMPLE-123
        '**/orders.spec.ts',
        'fixtures/**',
      ],
    },
  ],
};
```

## Options

Set these in [`configure()`](../configuration.md#options):

- `allowedSpecExclusions`: exact entries used for permanent routing, default `[]`.
- `ticket` and `placeholders`: which issue references are accepted.
- `allowBlankLine` and `allowNotes`: how markers can be written.
