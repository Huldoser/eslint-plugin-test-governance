import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, compileOptions } from '../../src/utils/options.ts';
import { validate, type Schema } from '../../src/utils/validate.ts';

/** The problems `compileOptions` reports for these options, without the shared prefix. */
function problems(options: unknown): string[] {
  try {
    compileOptions(options as never);
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.message
      .split('\n')
      .slice(1)
      .map((line) => line.replace(/^ {2}- /, ''));
  }
  return [];
}

describe('options validation', () => {
  for (const [options, message] of [
    [{ lifecycleTag: true }, 'lifecycleTag is not a known option; did you mean "lifecycleTags"?'],
    [{ LIFECYCLETAGS: true }, 'LIFECYCLETAGS is not a known option; did you mean "lifecycleTags"?'],
    [{ lifecycleTags: 'yes' }, 'lifecycleTags must be a boolean (got "yes")'],
    [
      { ticket: { preset: 'jria' } },
      'ticket.preset must be one of "any", "jira", "github", "gitlab", "linear", "azure-devops", "numeric", "pattern" (got "jria")',
    ],
    [{ ticket: { preset: 'jira', projects: 'TRADE' } }, 'ticket.projects must be an array (got "TRADE")'],
    [{ ticket: [] }, 'ticket must have at least 1 item'],
    [{ ticket: 'jira' }, 'ticket must be an object or an array (got "jira")'],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'githb' }] },
      'ticket[1].preset must be one of "any", "jira", "github", "gitlab", "linear", "azure-devops", "numeric", "pattern" (got "githb")',
    ],
    [
      { ticket: { preset: 'jira', project: ['TRADE'] } },
      'ticket.project is not a known option; did you mean "projects"?',
    ],
    [{ ticket: {} }, 'ticket.preset is required'],
    [{ ticket: { preset: 'numeric', minLength: 0.5 } }, 'ticket.minLength must be an integer (got 0.5)'],
    [{ ticket: { preset: 'numeric', minLength: 0 } }, 'ticket.minLength must be at least 1 (got 0)'],
    [
      { states: { blocked: true } },
      'states.blocked is not a known option (expected one of: skip, fixme, fail, slow, todo, new, unstable)',
    ],
    [{ states: { skip: null } }, 'states.skip must be a boolean or an object (got null)'],
    [{ comments: true }, 'comments must be false (got true)'],
    [
      { comments: { keywords: ['todo'] } },
      'comments.keywords[0] must be an uppercase keyword such as NEEDS-DATA (letters, digits, "-" and "_") (got "todo")',
    ],
    [{ customStates: { x: { marker: 'X' } } }, 'customStates.x.when is required'],
    [{ testFunctions: [1] }, 'testFunctions[0] must be a string (got 1)'],
    [{ testFunctions: () => ['test'] }, 'testFunctions must be an array (got a function)'],
    [{ placeholders: 'x'.repeat(60) }, `placeholders must be an array (got "${'x'.repeat(36)}...)`],
    [
      { testFunctions: 'test, buyOrder, sellOrder, cancelOrder' },
      'testFunctions must be an array (got "test, buyOrder, sellOrder, cancelOrder")',
    ],
    [{ ticket: { preset: 'jira', host: ['jira.acme.io'] } }, 'ticket.host must be a string (got ["jira.acme.io"])'],
    [{ ticket: { preset: 'numeric', maxLength: 0 } }, 'ticket.maxLength must be at least 1 (got 0)'],
    [
      { ticket: { preset: 'pattern', pattern: ['TRADE', 'RISK'] } },
      'ticket.pattern must be a string (got ["TRADE","RISK"])',
    ],
    // A regex shows as written, not as JSON's `{}`.
    [{ ticket: { preset: 'pattern', pattern: /TRADE-\d+/i } }, 'ticket.pattern must be a string (got /TRADE-\\d+/i)'],
    [{ ticket: { preset: 'pattern', pattern: 'TRADE-\\d+', flags: true } }, 'ticket.flags must be a string (got true)'],
    [
      { ticket: { preset: 'numeric', manLength: 6 } },
      'ticket.manLength is not a known option; did you mean "minLength"?',
    ],
    [{ states: { slow: { enabled: 'yes' } } }, 'states.slow.enabled must be a boolean (got "yes")'],
    [{ states: { skip: { mark: 'SKIPPED' } } }, 'states.skip.mark is not a known option; did you mean "marker"?'],
    [
      { customStates: { blocked: { when: '@blocked', marker: 'BLOCKED', tickets: { preset: 'jira' } } } },
      'customStates.blocked.tickets is not a known option; did you mean "ticket"?',
    ],
    [
      { customStates: { blocked: { when: '@blocked @flaky', marker: 'BLOCKED' } } },
      'customStates.blocked.when must be a tag such as @needs-data (got "@blocked @flaky")',
    ],
    [
      { customStates: { blocked: { when: '@blocked', marker: '@BLOCKED' } } },
      'customStates.blocked.marker must be an uppercase keyword such as NEEDS-DATA (letters, digits, "-" and "_") (got "@BLOCKED")',
    ],
    [{ comments: 'off' }, 'comments must be false or an object (got "off")'],
    [{ comments: { keyword: ['HACK'] } }, 'comments.keyword is not a known option; did you mean "keywords"?'],
    [{ placeholders: [0] }, 'placeholders[0] must be a string (got 0)'],
    [{ lifecycleTags: () => true }, 'lifecycleTags must be a boolean (got a function)'],
    [{ requireTicketForConditional: 'always' }, 'requireTicketForConditional must be a boolean (got "always")'],
    [{ allowBlankLine: 1 }, 'allowBlankLine must be a boolean (got 1)'],
    [{ reportDynamicTitles: 'on' }, 'reportDynamicTitles must be a boolean (got "on")'],
  ]) {
    it(JSON.stringify(options), () => {
      assert.deepEqual(problems(options), [message]);
    });
  }

  it('reports every problem at once', () => {
    assert.deepEqual(problems({ xyzzy: 1, allowNotes: 'no' }), [
      'xyzzy is not a known option (expected one of: framework, testFunctions, ticket, placeholders, lifecycleTags, states, customStates, comments, requireTicketForConditional, allowBlankLine, allowNotes, reportDynamicTitles)',
      'allowNotes must be a boolean (got "no")',
    ]);
  });

  it('accepts valid options, including explicit undefined values', () => {
    assert.deepEqual(
      problems({
        ticket: [
          { preset: 'jira', projects: ['TRADE'] },
          { preset: 'numeric', minLength: 4 },
        ],
        lifecycleTags: undefined,
        states: { skip: false, fixme: { marker: 'BROKEN', ticket: { preset: 'github' } } },
        customStates: { blocked: { when: '@blocked', marker: 'BLOCKED' } },
        comments: false,
      }),
      [],
    );
    assert.deepEqual(problems({ comments: { keywords: ['FIXME', 'HACK'] } }), []);
  });

  it('accepts a value equal to the minimum', () => {
    assert.deepEqual(problems({ ticket: { preset: 'numeric', minLength: 1, maxLength: 1 } }), []);
  });
});

describe('validate', () => {
  it('describes a pattern without a hint by the pattern itself', () => {
    const schema: Schema = { type: 'string', pattern: '^a+$' };
    assert.deepEqual(validate('b', schema, 'name'), ['name must be a string matching /^a+$/ (got "b")']);
  });

  it('treats a schema without a type as matching anything', () => {
    assert.deepEqual(validate(Symbol('x'), {}), []);
  });

  it('shows values JSON cannot represent', () => {
    assert.deepEqual(validate(Symbol('s'), { type: 'string' }, 'name'), ['name must be a string (got Symbol(s))']);
  });

  it('allows unknown keys when the schema does not forbid them', () => {
    assert.deepEqual(validate({ extra: 1 }, { type: 'object', properties: {} }), []);
  });

  it('names the top level "options" and pluralises item counts', () => {
    assert.deepEqual(validate([1], { type: 'array', minItems: 2 }), ['options must have at least 2 items']);
  });

  it('accepts a value that matches a later anyOf branch of the same type', () => {
    const side: Schema = {
      anyOf: [
        { type: 'string', enum: ['buy'] },
        { type: 'string', enum: ['sell'] },
      ],
    };
    assert.deepEqual(validate('sell', side, 'side'), []);
  });

  it('applies pattern, minimum and properties only to values of their type', () => {
    assert.deepEqual(validate(4821, { pattern: '^[A-Z]+$' }), []);
    assert.deepEqual(validate('0', { minimum: 1 }), []);
    assert.deepEqual(validate('TRADE', { required: ['preset'], additionalProperties: false }), []);
  });
});
