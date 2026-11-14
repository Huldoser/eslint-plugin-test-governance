# Require a ticket for blanket Cypress error suppression (`test-governance/require-ticket-for-error-suppression`)

Disabled in every [framework config](../../README.md#frameworks); enable it explicitly.

Reports problems without fixes.

<!-- end auto-generated rule header -->

A global handler that always returns false for `uncaught:exception` can hide application errors
throughout a Cypress session. This rule requires a tracking ticket for that exception. It checks
specs and support files, including files with no test declarations.

## Enable the rule

```js
import testGovernance from 'eslint-plugin-test-governance';

const policy = testGovernance.configure({ framework: 'cypress' });

export default [
  {
    files: ['cypress/**/*.js'],
    ...policy,
    rules: { ...policy.rules, 'test-governance/require-ticket-for-error-suppression': 'error' },
  },
];
```

Incorrect:

<!-- example: invalid settings={"framework":"cypress"} -->

```js
Cypress.on('uncaught:exception', () => false);
```

Correct:

<!-- example: valid settings={"framework":"cypress"} -->

```js
// SUPPRESS: EXAMPLE-123
Cypress.on('uncaught:exception', () => false);
```

The uppercase `SUPPRESS:` comment belongs directly above the handler registration. It uses the
shared ticket format, rejects placeholders, and accepts comma-separated tickets. Free text after
the tickets requires `allowNotes: true`. If multiple SUPPRESS lines occur in the adjacent comment
block, the last one supplies the ticket.

## Detection boundaries

Only the global `Cypress.on` with a literal `uncaught:exception` event and a direct synchronous
callback that solely returns literal `false` is checked. A concise arrow or a function containing
one return statement qualifies. Conditional handlers, callbacks with assertions or other statements,
async/generator functions, `cy.on`, other events, aliases, and imported callbacks are outside this
rule. A shadowed or reassigned Cypress binding is left alone. Changes to Cypress properties through
other code are not resolved.

This checks the presence of tracking information, not whether the suppression is safe. It neither
analyzes listener cleanup nor verifies issue existence. The SUPPRESS comment is local to this rule;
it is not an inherited test-state marker, and `no-orphaned-marker` does not remove it later.

## Options

Options use the [shared configuration](../configuration.md#options):

- `framework`: must be `cypress`; other frameworks are left alone.
- `ticket`, `placeholders`: accepted ticket formats and rejected placeholders.
- `allowNotes`: permit text after the tickets, false by default.
- `allowBlankLine`: permit a blank line before the registration, false by default.

The rule has no options of its own. `comments: false` does not disable this separate rule.
