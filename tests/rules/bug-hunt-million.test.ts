import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

runRule('require-ticket (primitive snapshots preserve their source)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true }, [
    "const source = { reason: 'EXAMPLE-843' }; const copy = { reason: source.reason }; copy.reason = 'TBD'; test.skip(true, source.reason);",
    "const source = { reason: 'EXAMPLE-843' }; const copy = [source.reason]; copy[0] = 'TBD'; test.skip(true, source.reason);",
    "const source = { reason: 'EXAMPLE-843' }; const copy = { ...source }; copy.reason = 'TBD'; test.skip(true, source.reason);",
    "const source = { reason: 'EXAMPLE-843' }; const { ...copy } = source; copy.reason = 'TBD'; test.skip(true, source.reason);",
    "const source = { reason: 'EXAMPLE-843' }; const { ...copy } = source; const wrapper = { copy }; wrapper.copy.reason = 'TBD'; test.skip(true, source.reason);",
  ]),
  invalid: withOptions({ customStates: { hold: { when: '@hold', marker: 'HOLD' } }, reportUnreadableTags: true }, [
    {
      code: "const source = { tag: '@hold' }; const copy = { tag: source.tag }; copy.tag = '@open'; test('snapshot', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "const source = { tag: '@hold' }; const alias = ({ nested: source }).nested; alias.tag = '@open'; test('alias', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const source = { tag: '@hold' }; const alias = [source][0]; alias.tag = '@open'; test('alias', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const source = { nested: { tag: '@hold' } }; const { ...copy } = source; copy.nested.tag = '@open'; test('shared child', { tag: source.nested.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
  ]),
});

runRule('require-ticket (immutable global primitives through reason aliases)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true, ticket: { preset: 'pattern', pattern: 'EXAMPLE-(NaN|Infinity)' } }, [
    'const value = NaN; test.skip(true, `EXAMPLE-${value}`);',
    'const value = Infinity; test.skip(true, `EXAMPLE-${value}`);',
    'const first = Infinity; const value = first; test.skip(true, `EXAMPLE-${value}`);',
  ]),
  invalid: withOptions({ ticketsFromReasons: true, ticket: { preset: 'pattern', pattern: 'EXAMPLE-(NaN|Infinity)' } }, [
    {
      code: 'function configure(Infinity) { const value = Infinity; test.skip(true, `EXAMPLE-${value}`); }',
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

runRule('require-ticket (unknown annotation keys remain unreadable)', requireTicket, {
  valid: [],
  invalid: withOptions({ annotations: { only: true }, reportUnreadableTags: true }, [
    {
      code: "test.skip('opaque annotation', { annotation: { ...external } }, () => {});",
      errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
    },
    {
      code: "test.skip('overwritten annotation', { annotation: { type: 'other', ...external } }, () => {});",
      errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
    },
    {
      code: "test.skip('foreign annotation', { annotation: { type: 'other', description: external } }, () => {});",
      errors: [{ messageId: 'missingAnnotation' }],
    },
    {
      code: "test.skip('overridden spread', { annotation: { ...external, type: 'issue', description: ticket } }, () => {});",
      errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
    },
    ...withOptions({ framework: 'vitest' }, [
      {
        code: "test.skip('overridden metadata', { meta: { ...external, issue: ticket } }, () => {});",
        errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
      },
    ]),
  ]),
});
