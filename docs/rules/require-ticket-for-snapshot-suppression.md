# Require a ticket for Playwright snapshot suppression (`test-governance/require-ticket-for-snapshot-suppression`)

Disabled in every [framework config](../../README.md#frameworks); enable it explicitly.

Reports problems without fixes.

<!-- end auto-generated rule header -->

Playwright's [`ignoreSnapshots`](https://playwright.dev/docs/api/class-testproject#test-project-ignore-snapshots)
skips screenshot and snapshot expectations. Teams that normally require those assertions can
track a browser-specific exception with a ticket at the property that disables them.

Enable the rule on your Playwright config files. For TypeScript configs, include your
[TypeScript parser](../configuration.md#typescript) in the matching ESLint config.

<!-- config: snapshot-suppression -->

```js
import testGovernance from 'eslint-plugin-test-governance';

export default [
  {
    files: ['playwright.config.{js,mjs,cjs}'],
    ...testGovernance.configs.playwright,
    rules: {
      ...testGovernance.configs.playwright.rules,
      'test-governance/require-ticket-for-snapshot-suppression': 'error',
    },
  },
];
```

## Examples

The following project disables snapshot assertions without a tracking ticket:

<!-- example: invalid -->

```js
export default {
  projects: [{ name: 'firefox', ignoreSnapshots: true }],
};
```

Place the marker immediately above the property:

<!-- example: valid -->

```js
export default {
  projects: [
    {
      name: 'firefox',
      // SUPPRESS: EXAMPLE-123
      ignoreSnapshots: true,
    },
  ],
};
```

The rule checks a literal `true` at the root or in a project, including properties from
readable local config objects. It ignores dynamic flag values and unrelated nested properties.
A marker on a shared property covers its uses. The rule checks the declaration even if a project
overrides an inherited default.

## Options

- `framework`: select Playwright.
- `ticket` and `placeholders`: validate the tickets after `SUPPRESS:`.
- `allowBlankLine` and `allowNotes`: apply the shared marker spacing and notes policy.
