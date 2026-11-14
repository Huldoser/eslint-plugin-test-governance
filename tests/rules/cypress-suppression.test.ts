import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../src/index.ts';
import rule from '../../src/rules/require-ticket-for-error-suppression.ts';
import { runRule, withOptions } from '../helpers.ts';

const call = "Cypress.on('uncaught:exception', () => false);";
const policy = { framework: 'cypress' as const };

runRule('require-ticket-for-error-suppression', rule, {
  valid: withOptions(policy, [
    `// SUPPRESS: EXAMPLE-123\n${call}`,
    "Cypress.on('uncaught:exception', (error) => { if (error.known) return false; });",
    "Cypress.on('uncaught:exception', (error) => { expect(error.message).to.equal('expected'); return false; });",
    "Cypress.on('fail', () => false);",
    "cy.on('uncaught:exception', () => false);",
    "other.on('uncaught:exception', () => false);",
    "Cypress.once('uncaught:exception', () => false);",
    "Cypress.on('uncaught:exception', handler);",
    "Cypress.on('uncaught:exception', async () => false);",
    "Cypress.on('uncaught:exception', function* () { return false; });",
    "Cypress.on('uncaught:exception', () => true);",
    "Cypress.on('uncaught:exception', () => {});",
    "Cypress.on('uncaught:exception', () => { return; });",
    "Cypress.on('uncaught:exception', () => { throw new Error('expected'); });",
    'Cypress.on(event, () => false);',
    'Cypress.on();',
    "Cypress.on('uncaught:exception');",
    "const Cypress = custom; Cypress.on('uncaught:exception', () => false);",
    "function configure(Cypress) { Cypress.on('uncaught:exception', () => false); }",
    "Cypress = custom; Cypress.on('uncaught:exception', () => false);",
    { code: call, settings: { 'test-governance': { framework: 'mocha' } } },
    { code: `// SUPPRESS: EXAMPLE-123 reason\n${call}`, settings: { 'test-governance': { allowNotes: true } } },
    { code: `// SUPPRESS: EXAMPLE-123\n\n${call}`, settings: { 'test-governance': { allowBlankLine: true } } },
  ]),
  invalid: withOptions(policy, [
    ...[
      call,
      "Cypress.on('uncaught:exception', function () { return false; });",
      "Cypress['on']('uncaught:exception', () => { /* expected error */ return false; });",
      `if (condition) { ${call} }`,
      `describe('example', () => { ${call} });`,
    ].map((code) => ({ code, errors: [{ messageId: 'missingTicket' }] })),
    { code: `// SUPPRESS:\n${call}`, errors: [{ messageId: 'missingTicket' }] },
    { code: `// SUPPRESS: EXAMPLE-123 reason\n${call}`, errors: [{ messageId: 'extraText' }] },
    { code: `// SUPPRESS: TBD\n${call}`, errors: [{ messageId: 'placeholderTicket' }] },
    { code: `// SUPPRESS: wrong\n${call}`, errors: [{ messageId: 'invalidTicket' }] },
    { code: `// suppress: EXAMPLE-123\n${call}`, errors: [{ messageId: 'markerCase' }] },
  ]),
});

it('keeps suppression tracking opt-in and treats its marker as attached in support files', () => {
  const linter = new Linter();
  assert.deepEqual(linter.verify(call, plugin.configs.cypress), []);
  const config = [
    plugin.configure(policy),
    { rules: { 'test-governance/require-ticket-for-error-suppression': 'error' as const } },
  ];
  assert.deepEqual(linter.verify(`// SUPPRESS: EXAMPLE-123\n${call}`, config), []);
  assert.deepEqual(
    linter.verify(call, config).map((message) => message.messageId),
    ['missingTicket'],
  );
});

it('preserves suppress as an available custom-state name', () => {
  assert.doesNotThrow(() =>
    plugin.configure({ framework: 'cypress', customStates: { suppress: { when: '@suppression', marker: 'KNOWN' } } }),
  );
});
