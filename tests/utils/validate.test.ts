import { ConfigError, compileOptions } from '../../src/utils/options.js';
import { validate, type Schema } from '../../src/utils/validate.js';

/** The problems `compileOptions` reports for these options, without the shared prefix. */
function problems(options: unknown): string[] {
  try {
    compileOptions(options as never);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as Error).message
      .split('\n')
      .slice(1)
      .map((line) => line.replace(/^ {2}- /, ''));
  }
  return [];
}

describe('options validation', () => {
  it.each([
    [{ lifecycleTag: true }, 'lifecycleTag is not a known option; did you mean "lifecycleTags"?'],
    [{ LIFECYCLETAGS: true }, 'LIFECYCLETAGS is not a known option; did you mean "lifecycleTags"?'],
    [{ lifecycleTags: 'yes' }, 'lifecycleTags must be a boolean (got "yes")'],
    [
      { ticket: { preset: 'jria' } },
      'ticket.preset must be one of "any", "jira", "github", "gitlab", "linear", "azure-devops", "numeric", "pattern" (got "jria")',
    ],
    [{ ticket: { preset: 'jira', projects: 'WEB' } }, 'ticket.projects must be an array (got "WEB")'],
    [{ ticket: [] }, 'ticket must have at least 1 item'],
    [{ ticket: 'jira' }, 'ticket must be an object or an array (got "jira")'],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'githb' }] },
      'ticket[1].preset must be one of "any", "jira", "github", "gitlab", "linear", "azure-devops", "numeric", "pattern" (got "githb")',
    ],
    [
      { ticket: { preset: 'jira', project: ['WEB'] } },
      'ticket.project is not a known option; did you mean "projects"?',
    ],
    [{ ticket: {} }, 'ticket.preset is required'],
    [{ ticket: { preset: 'numeric', minLength: 0.5 } }, 'ticket.minLength must be an integer (got 0.5)'],
    [{ ticket: { preset: 'numeric', minLength: 0 } }, 'ticket.minLength must be at least 1 (got 0)'],
    [
      { states: { blocked: true } },
      'states.blocked is not a known option (expected one of: skip, fixme, fail, slow, new, unstable)',
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
  ])('%j', (options, message) => {
    expect(problems(options)).toEqual([message]);
  });

  it('reports every problem at once', () => {
    expect(problems({ xyzzy: 1, allowNotes: 'no' })).toEqual([
      'xyzzy is not a known option (expected one of: testFunctions, ticket, placeholders, lifecycleTags, states, customStates, comments, requireTicketForConditional, allowBlankLine, allowNotes, reportDynamicTitles)',
      'allowNotes must be a boolean (got "no")',
    ]);
  });

  it('accepts valid options, including explicit undefined values', () => {
    expect(
      problems({
        ticket: [
          { preset: 'jira', projects: ['WEB'] },
          { preset: 'numeric', minLength: 4 },
        ],
        lifecycleTags: undefined,
        states: { skip: false, fixme: { marker: 'BROKEN', ticket: { preset: 'github' } } },
        customStates: { blocked: { when: '@blocked', marker: 'BLOCKED' } },
        comments: false,
      }),
    ).toEqual([]);
    expect(problems({ comments: { keywords: ['FIXME', 'HACK'] } })).toEqual([]);
  });
});

describe('validate', () => {
  it('describes a pattern without a hint by the pattern itself', () => {
    const schema: Schema = { type: 'string', pattern: '^a+$' };
    expect(validate('b', schema, 'name')).toEqual(['name must be a string matching /^a+$/ (got "b")']);
  });

  it('treats a schema without a type as matching anything', () => {
    expect(validate(Symbol('x'), {})).toEqual([]);
  });

  it('shows values JSON cannot represent', () => {
    expect(validate(Symbol('s'), { type: 'string' }, 'name')).toEqual(['name must be a string (got Symbol(s))']);
  });

  it('allows unknown keys when the schema does not forbid them', () => {
    expect(validate({ extra: 1 }, { type: 'object', properties: {} })).toEqual([]);
  });

  it('names the top level "options" and pluralises item counts', () => {
    expect(validate([1], { type: 'array', minItems: 2 })).toEqual(['options must have at least 2 items']);
  });
});
