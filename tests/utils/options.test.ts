import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileOptions, ConfigError, resolveOptions, type GovernanceOptions } from '../../src/utils/options.ts';

/** Compiles `options` for Playwright, unless they name another framework. */
const compile = (options: Partial<GovernanceOptions>) => compileOptions({ framework: 'playwright', ...options });
const stateNames = (options: Partial<GovernanceOptions>) => compile(options).states.map((s) => s.name);

describe('compileOptions', () => {
  it('defaults the retry ceiling to two and accepts zero to forbid retries', () => {
    assert.equal(compile({}).maxRetries, 2);
    assert.equal(compile({ maxRetries: 0 }).maxRetries, 0);
    assert.equal(compile({ maxRetries: 5 }).maxRetries, 5);
  });

  it('rejects retry ceilings that are not non-negative integers', () => {
    for (const maxRetries of [-1, 0.5, NaN, Infinity, '2', false, null]) {
      assert.throws(() => compile({ maxRetries } as never), /maxRetries must be/);
    }
  });

  it('turns on skip and fixme by default', () => {
    const resolved = compile({});
    assert.deepEqual(
      resolved.states.map((s) => [s.name, s.marker]),
      [
        ['skip', 'SKIP'],
        ['fixme', 'FIXME'],
      ],
    );
    assert.deepEqual([...resolved.testFunctions], ['test']);
    assert.equal(resolved.requireTicketForConditional, false);
    assert.equal(resolved.allowBlankLine, false);
    assert.equal(resolved.reportUnreadableTags, false);
  });

  it('resolves the annotation type', () => {
    assert.deepEqual(compile({}).annotations, { type: 'issue', only: false });
    assert.equal(compile({ annotations: false }).annotations, undefined);
    assert.deepEqual(compile({ annotations: { type: 'defect' } }).annotations, { type: 'defect', only: false });
    assert.deepEqual(compile({ annotations: { only: true } }).annotations, { type: 'issue', only: true });
  });

  it('allows shared annotation settings without only on frameworks without annotations', () => {
    for (const framework of ['jest', 'mocha', 'cypress', 'webdriverio', 'node-test', 'jasmine'] as const) {
      assert.doesNotThrow(() => compile({ framework, annotations: { type: 'issue' } }));
      assert.doesNotThrow(() => compile({ framework, annotations: { only: false } }));
    }
  });

  it('accepts formerly built-in lifecycle names as explicit custom states', () => {
    assert.deepEqual(
      stateNames({
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      ['skip', 'fixme', 'new', 'quarantined'],
    );
    assert.deepEqual(stateNames({}), ['skip', 'fixme']);
  });

  it('combines native state overrides with custom tags', () => {
    assert.deepEqual(
      stateNames({
        states: { fail: true, skip: { enabled: false } },
        customStates: { new: { when: '@new', marker: 'NEW' } },
      }),
      ['fixme', 'fail', 'new'],
    );
  });

  it('uses the tag and marker chosen for each custom state', () => {
    const resolved = compile({
      customStates: { new: { when: '@candidate', marker: 'NEW' }, quarantined: { when: '@flaky', marker: 'FLAKY' } },
    });
    assert.deepEqual(
      resolved.states.slice(-2).map(({ name, tag, marker }) => ({ name, tag, marker })),
      [
        { name: 'new', tag: '@candidate', marker: 'NEW' },
        { name: 'quarantined', tag: '@flaky', marker: 'FLAKY' },
      ],
    );
  });

  it('adds custom states after the built-ins', () => {
    const resolved = compile({ customStates: { blocked: { when: '@blocked', marker: 'BLOCKED' } } });
    const { name, tag, marker } = resolved.states.at(-1) ?? {};
    assert.deepEqual({ name, tag, marker }, { name: 'blocked', tag: '@blocked', marker: 'BLOCKED' });
  });

  it('accepts options that belong to the preset, and states set to true or false', () => {
    assert.doesNotThrow(() =>
      compile({
        ticket: [{ preset: 'jira', projects: ['TRADE'], host: 'acme.atlassian.net', minLength: undefined } as never],
        states: { fail: true, slow: { enabled: true } },
        customStates: { blocked: { when: '@blocked', marker: 'BLOCKED', ticket: { preset: 'numeric', maxLength: 6 } } },
      }),
    );
  });

  it('accepts a host written with a trailing dot', () => {
    assert.doesNotThrow(() =>
      compile({
        ticket: [
          { preset: 'redmine', host: 'redmine.acme.io.' },
          { preset: 'url', hosts: ['*.acme.io.'] },
        ],
      }),
    );
  });

  it('accepts the options of the presets for other trackers', () => {
    assert.doesNotThrow(() =>
      compile({
        ticket: [
          { preset: 'notion', prefixes: ['TASK'], host: 'docs.acme.io' },
          { preset: 'clickup', prefixes: ['DEV'] },
          { preset: 'redmine', host: 'redmine.acme.io' },
          { preset: 'monday', prefixes: ['TIX'] },
          { preset: 'youtrack', projects: ['KT', '4DM'], host: 'yt.acme.io' },
          { preset: 'url', hosts: ['www.wrike.com'] },
          { preset: 'trello' },
          { preset: 'asana' },
          { preset: 'basecamp' },
          { preset: 'shortcut' },
        ],
      }),
    );
  });

  it('treats a state set to undefined as not set', () => {
    assert.deepEqual(stateNames({ states: { skip: undefined } }), ['skip', 'fixme']);
  });

  it('compiles a custom ticket pattern', () => {
    const resolved = compile({ ticket: { preset: 'pattern', pattern: 'TRADE-\\d+', flags: 'i' } });
    assert.equal(resolved.commentTicket.check('trade-7'), 'ok');
  });

  it('checks no comment keywords with comments: false', () => {
    assert.deepEqual(compile({ comments: false }).commentKeywords, []);
  });

  it('names the error ConfigError', () => {
    assert.throws(
      () => compile({ lifecycleTags: 'yes' } as never),
      /^ConfigError: eslint-plugin-test-governance: invalid options:/,
    );
  });

  it('compiles per-state ticket formats', () => {
    const resolved = compile({
      ticket: { preset: 'jira' },
      states: { fixme: { ticket: { preset: 'github' } } },
      customStates: { blocked: { when: '@blocked', marker: 'BLOCKED', ticket: [{ preset: 'numeric' }] } },
    });
    const [skip, fixme, blocked] = resolved.states;
    assert.equal(skip.ticket.check('TRADE-1'), 'ok');
    assert.equal(fixme.ticket.check('TRADE-1'), 'format');
    assert.equal(fixme.ticket.check('#4821'), 'ok');
    assert.equal(blocked.ticket.check('4821'), 'ok');
  });

  for (const [options, message] of [
    [
      { customStates: { x: { when: 'blocked', marker: 'BLOCKED' } } },
      /customStates\.x\.when must be a tag such as @needs-data \(got "blocked"\)/,
    ],
    [
      { customStates: { x: { when: '@x', marker: 'blocked' } } },
      /customStates\.x\.marker must be an uppercase keyword/,
    ],
    [{ states: { skip: { marker: 'Skip' } } }, /states\.skip\.marker must be an uppercase keyword/],
    [{ customState: true }, /customState is not a known option; did you mean "customStates"\?/],
    [{ annotations: 'yes' }, /annotations/],
    [{ annotations: { type: 42 } }, /annotations\.type must be a string/],
    [{ annotations: { only: 'yes' } }, /annotations\.only must be a boolean/],
    [{ annotations: { typo: true } }, /annotations\.typo is not a known option/],
    [{ requireReasonForConditional: 'yes' }, /requireReasonForConditional must be a boolean/],
    [{ ticket: { preset: 'numeric', minLength: 5, maxLength: 3 } }, /minLength \(5\) is greater than maxLength \(3\)/],
    [{ ticket: { preset: 'pattern' } }, /"pattern" ticket preset needs a `pattern` regex string/],
    [{ customStates: { x: { when: '@x', marker: 'SKIP' } } }, /two states use the marker "SKIP"/],
    [
      {
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
          x: { when: '@new', marker: 'X' },
        },
      },
      /two states use the tag "@new"/,
    ],
    [
      { customStates: { new: { when: '@new', marker: 'NEW' }, quarantined: { when: '@new', marker: 'FLAKY' } } },
      /two states use the tag "@new"/,
    ],
    [
      { customStates: { flaky: { when: 'flaky', marker: 'FLAKY' } } },
      /customStates\.flaky\.when must be a tag such as @needs-data/,
    ],
    [{ knownTags: ['@smoke', 'regression'] }, /knownTags\[1\] must be a tag such as @needs-data \(got "regression"\)/],
    // Native runner states cannot be renamed to tags.
    [
      { states: { skip: { tag: '@skipped' } } },
      /states\.skip\.tag is not a known option \(expected one of: enabled, marker, ticket\)/,
    ],
    [
      { states: { unstable: true } },
      /states\.unstable was removed; configure a customStates entry with when and marker instead/,
    ],
    [
      { ticket: { preset: 'jira', projects: ['trade'] } },
      /ticket\.projects\[0\] must be an uppercase key as it appears in tickets, such as WEB for WEB-123 \(got "trade"\)/,
    ],
    [{ ticket: { preset: 'linear', teams: ['Eng'] } }, /ticket\.teams\[0\] must be an uppercase key/],
    [
      { ticket: { preset: 'jira', projects: ['TRADE', '4DM'] } },
      /ticket\.projects\[1\] must start with a letter and have at least two characters, as Jira keys do \(got "4DM"\)/,
    ],
    [
      { ticket: { preset: 'jira', projects: ['A'] } },
      /ticket\.projects\[0\] must start with a letter and have at least two characters, as Jira keys do \(got "A"\)/,
    ],
    [
      { ticket: { preset: 'plane', projects: ['WEB', '4DM'] } },
      /ticket\.projects\[1\] must start with a letter and have at least two characters, as Plane keys do \(got "4DM"\)/,
    ],
    [
      { ticket: { preset: 'plane', projects: ['A'] } },
      /ticket\.projects\[0\] must start with a letter and have at least two characters, as Plane keys do \(got "A"\)/,
    ],
    [{ ticket: { preset: 'youtrack', projects: ['123'] } }, /ticket\.projects\[0\] must be an uppercase key/],
    [
      { ticket: { preset: 'url', hosts: ['tracker.io:8080'] } },
      /ticket\.hosts\[0\] must be a host name such as tasks\.example\.com or \*\.example\.com/,
    ],
    [{ ticket: { preset: 'url', hosts: ['https://tracker.io'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'url', hosts: ['*'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'notion', prefixes: ['task'] } }, /ticket\.prefixes\[0\] must be an uppercase key/],
    [{ ticket: { preset: 'url' } }, /ticket\.hosts is required by the "url" preset/],
    [{ ticket: { preset: 'servicenow' } }, /ticket\.prefixes is required by the "servicenow" preset/],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'servicenow' }] },
      /ticket\[1\]\.prefixes is required by the "servicenow" preset/,
    ],
    [
      { states: { skip: { ticket: { preset: 'servicenow' } } } },
      /states\.skip\.ticket\.prefixes is required by the "servicenow" preset/,
    ],
    [{ ticket: [{ preset: 'jira' }, { preset: 'url' }] }, /ticket\[1\]\.hosts is required by the "url" preset/],
    // A state that is off still has its options checked, so the mistake shows before someone turns it on.
    [
      { states: { fail: { ticket: { preset: 'url' } } } },
      /states\.fail\.ticket\.hosts is required by the "url" preset/,
    ],
    [{ ticket: { preset: 'url', hosts: ['*.com'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'url', hosts: ['-acme.io'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'url', hosts: ['acme-.io'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'jira', projects: [] } }, /ticket\.projects must have at least 1 item/],
    [{ ticket: { preset: 'linear', teams: [] } }, /ticket\.teams must have at least 1 item/],
    [{ ticket: { preset: 'clickup', prefixes: [] } }, /ticket\.prefixes must have at least 1 item/],
    // Only Playwright and Vitest have annotations, so elsewhere `only` could never be met.
    [
      { framework: 'jest', annotations: { only: true } },
      /annotations\.only needs a framework with annotations, "playwright" or "vitest" \(got "jest"\)/,
    ],
    [
      { ticket: { preset: 'redmine', host: 'https://redmine.acme.io' } },
      /ticket\.host must be a host name such as tracker\.example\.com or \*\.example\.com, with no scheme, port or path \(got "https:\/\/redmine\.acme\.io"\)/,
    ],
    [{ ticket: { preset: 'notion', host: 'docs.acme.io/wiki' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'youtrack', host: '*.io' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'jira', host: 'https://jira.acme.io' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'github', host: 'git.acme.io:8080' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'gitlab', host: 'gitlab.acme.io/' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'azure-devops', host: 'tfs.acme.io/tfs' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'openproject', host: 'op.acme.io:8443' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'bugzilla', host: 'https://bugs.acme.io' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'phabricator', host: 'phab.acme.io/x' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'plane', host: 'plane.acme.io:8443' } }, /ticket\.host must be a host name/],
    [{ ticket: { preset: 'rally', host: 'rally.acme.io' } }, /ticket\.host is not an option of the "rally" preset/],
    [
      { ticket: { preset: 'clickup', prefixes: ['X'] } },
      /ticket\.prefixes\[0\] must be an uppercase key of two or more characters as it appears in tickets/,
    ],
    [
      { ticket: { preset: 'linear', teams: ['Q'] } },
      /ticket\.teams\[0\] must be an uppercase key of two or more characters/,
    ],
    [{ ticket: { preset: 'url', hosts: [] } }, /ticket\.hosts must have at least 1 item/],
    [{ ticket: { preset: 'trello', host: 'trello.acme.io' } }, /ticket\.host is not an option of the "trello" preset/],
    [
      { ticket: { preset: 'clickup', projects: ['DEV'] } },
      /ticket\.projects is not an option of the "clickup" preset \(it applies to "jira", "youtrack", "plane"\)/,
    ],
    [
      { ticket: { preset: 'any', host: 'jira.acme.com' } },
      /ticket\.host is not an option of the "any" preset \(it applies to "jira", "github", "gitlab", "azure-devops", "notion", "redmine", "youtrack", "openproject", "bugzilla", "phabricator", "plane"\)/,
    ],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'numeric', projects: ['TRADE'] }] },
      /ticket\[1\]\.projects is not an option of the "numeric" preset \(it applies to "jira", "youtrack", "plane"\)/,
    ],
    [
      { states: { fixme: { ticket: { preset: 'github', teams: ['ENG'] } } } },
      /states\.fixme\.ticket\.teams is not an option of the "github" preset \(it applies to "linear"\)/,
    ],
    [
      { customStates: { blocked: { when: '@blocked', marker: 'BLOCKED', ticket: { preset: 'any', flags: 'i' } } } },
      /customStates\.blocked\.ticket\.flags is not an option of the "any" preset \(it applies to "pattern"\)/,
    ],
    [
      { customStates: { fixme: { when: '@broken', marker: 'BROKEN' } } },
      /customStates\.fixme reuses the name of the built-in "fixme" state; give it another name, or use states\.fixme/,
    ],
  ]) {
    it(`rejects ${JSON.stringify(options)}`, () => {
      assert.throws(() => compile(options as never), ConfigError);
      assert.throws(() => compile(options as never), message);
    });
  }

  it('reports a misplaced option together with a malformed value', () => {
    assert.throws(
      () => compile({ ticket: { preset: 'trello', prefixes: ['X'] } as never }),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.match(error.message, /ticket\.prefixes\[0\] must be an uppercase key/);
        assert.match(error.message, /ticket\.prefixes is not an option of the "trello" preset/);
        return true;
      },
    );
  });

  for (const [options, problem] of [
    [
      { ticket: { preset: 'jira', projects: ['trade'] } },
      'ticket.projects[0] must be an uppercase key as it appears in tickets, such as WEB for WEB-123 (got "trade")',
    ],
    [
      { ticket: { preset: 'plane', projects: ['web'] } },
      'ticket.projects[0] must be an uppercase key as it appears in tickets, such as WEB for WEB-123 (got "web")',
    ],
    [
      { ticket: { preset: 'numeric', minLength: 25 } },
      'ticket.minLength (25) is greater than the default maxLength (20); set maxLength as well',
    ],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'numeric', minLength: 5, maxLength: 3 }] },
      'ticket[1].minLength (5) is greater than maxLength (3)',
    ],
    [
      { ticket: { preset: 'pattern', pattern: '(' } },
      'ticket.pattern is not a valid regex: Invalid regular expression: /(/: Unterminated group',
    ],
    [
      { ticket: { preset: 'pattern', pattern: 'TRADE-\\d+', flags: 'q' } },
      "ticket.pattern is not a valid regex: Invalid flags supplied to RegExp constructor 'q'",
    ],
    // A state the framework lacks, or one that is off, still has its ticket format checked.
    [
      { framework: 'jest', states: { fixme: { ticket: { preset: 'pattern', pattern: 'TRADE-\\d+)|(.*' } } } },
      "states.fixme.ticket.pattern is not a valid regex: Invalid regular expression: /TRADE-\\d+)|(.*/: Unmatched ')'",
    ],
    [
      { framework: 'jest', states: { fixme: { ticket: { preset: 'numeric', minLength: 21 } } } },
      'states.fixme.ticket.minLength (21) is greater than the default maxLength (20); set maxLength as well',
    ],
    [
      { states: { fail: { ticket: { preset: 'numeric', minLength: 9, maxLength: 4 } } } },
      'states.fail.ticket.minLength (9) is greater than maxLength (4)',
    ],
  ] as const) {
    it(`reports ${JSON.stringify(options)} once, in the list of invalid options`, () => {
      assert.throws(() => compile(options as never), new ConfigError(`invalid options:\n  - ${problem}`));
    });
  }

  it('checks the ticket format of a state the framework lacks or that is off', () => {
    assert.throws(
      () => compile({ framework: 'jest', states: { fixme: { ticket: { preset: 'pattern' } as never } } }),
      /"pattern" ticket preset needs a `pattern` regex string/,
    );
    assert.throws(
      () => compile({ states: { fail: { ticket: { preset: 'pattern' } as never } } }),
      /"pattern" ticket preset needs a `pattern` regex string/,
    );
  });

  it('leaves a malformed numeric or pattern option to the schema', () => {
    for (const [ticket, problem] of [
      [{ preset: 'numeric', minLength: '25' }, 'ticket.minLength must be an integer (got "25")'],
      [{ preset: 'numeric', minLength: 5, maxLength: '3' }, 'ticket.maxLength must be an integer (got "3")'],
      [{ preset: 'pattern', pattern: 5 }, 'ticket.pattern must be a string (got 5)'],
      [{ preset: 'pattern', pattern: 'x', flags: 5 }, 'ticket.flags must be a string (got 5)'],
    ] as const) {
      assert.throws(() => compile({ ticket: ticket as never }), new ConfigError(`invalid options:\n  - ${problem}`));
    }
  });

  it('does not read a ticket spec the schema already rejects as a preset', () => {
    for (const ticket of [
      { preset: 'bogus' },
      { preset: 'bogus', host: 'tracker.example.com' },
      { host: 'tracker.example.com' },
      'trello',
      null,
      [null],
      [[]],
      { preset: 5 },
      { preset: 'jira', projects: 'TRADE' },
      { preset: 'jira', projects: [123] },
      { preset: 'redmine', host: 123 },
    ]) {
      assert.throws(() => compile({ ticket: ticket as never }), ConfigError);
    }
  });

  it('does not report an unknown option as misplaced', () => {
    assert.throws(
      () => compile({ ticket: { preset: 'jira', project: ['TRADE'] } as never }),
      /ticket\.project is not a known option; did you mean "projects"\?/,
    );
  });

  it('checks options named like built-in object members', () => {
    assert.throws(() => compile({ toString: true } as never), /toString is not a known option/);
    assert.throws(() => compile({ states: { hasOwnProperty: true } } as never), /states\.hasOwnProperty is not/);
    assert.throws(
      () => compile({ customStates: { constructor: { when: 'not a tag', marker: 'lower case' } } }),
      /customStates\.constructor\.marker/,
    );
  });

  it('does not read malformed states as states', () => {
    assert.throws(() => compile({ states: { skip: null } as never }), ConfigError);
    assert.throws(() => compile({ customStates: { x: null } as never }), ConfigError);
  });

  it('reports settings that are not an object', () => {
    assert.throws(() => compileOptions(null as never), /invalid options/);
    assert.throws(() => compileOptions('jira' as never), /invalid options/);
  });
});

describe('framework', () => {
  for (const framework of ['mocha', 'cypress', 'webdriverio'] as const) {
    it(`turns on skip and todo for ${framework}, and has no fixme, fail or slow`, () => {
      assert.deepEqual(stateNames({ framework }), ['skip', 'todo']);
      assert.deepEqual(
        stateNames({
          framework,
          states: { fixme: true, slow: true, fail: true },
          customStates: {
            new: { when: '@new', marker: 'NEW' },
            quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
          },
        }),
        ['skip', 'todo', 'new', 'quarantined'],
      );
      assert.deepEqual([...compile({ framework }).testFunctions], ['it', 'specify', 'test']);
      assert.equal(compile({ framework }).framework.name, framework);
    });
  }

  for (const framework of ['jest', 'vitest', 'node-test'] as const) {
    it(`turns on skip and todo for ${framework}, and has no fixme or slow`, () => {
      assert.deepEqual(stateNames({ framework }), ['skip', 'todo']);
      assert.deepEqual(
        stateNames({
          framework,
          states: { fixme: true, slow: true, fail: true },
          customStates: {
            new: { when: '@new', marker: 'NEW' },
            quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
          },
        }),
        ['skip', 'fail', 'todo', 'new', 'quarantined'],
      );
      assert.deepEqual([...compile({ framework }).testFunctions], ['test', 'it']);
      assert.equal(compile({ framework }).framework.name, framework);
    });
  }

  it('turns on skip and todo for jasmine, and reads only `it` by default', () => {
    assert.deepEqual(stateNames({ framework: 'jasmine' }), ['skip', 'todo']);
    assert.deepEqual(
      stateNames({
        framework: 'jasmine',
        states: { fixme: true, slow: true, fail: true },
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      }),
      ['skip', 'todo', 'new', 'quarantined'],
    );
    assert.deepEqual([...compile({ framework: 'jasmine' }).testFunctions], ['it']);
  });

  it('is required, since there is no default framework', () => {
    assert.throws(
      () => compileOptions({} as never),
      /framework is required: set it to "playwright", "jest", "vitest", "mocha", "cypress", "webdriverio", "node-test" or "jasmine", or use configs\.playwright, configs\.jest, configs\.vitest, configs\.mocha, configs\.cypress, configs\.webdriverio, configs\['node-test'\] or configs\.jasmine$/,
    );
  });

  it('has no todo state in Playwright', () => {
    assert.deepEqual(stateNames({ framework: 'playwright', states: { todo: true } }), ['skip', 'fixme']);
  });

  it('rejects an unknown framework', () => {
    assert.throws(
      () => compile({ framework: 'ava' } as never),
      /framework must be one of "playwright", "jest", "vitest", "mocha", "cypress", "webdriverio", "node-test", "jasmine" \(got "ava"\)/,
    );
  });
});

describe('resolveOptions', () => {
  it('compiles shared settings once per settings object', () => {
    const settings = {
      'test-governance': {
        framework: 'playwright',
        allowBlankLine: true,
        customStates: {
          new: { when: '@new', marker: 'NEW' },
          quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
        },
      },
    };
    const resolved = resolveOptions(settings);
    assert.equal(resolved.allowBlankLine, true);
    assert.ok(resolved.states.map((s) => s.name).includes('new'));
    assert.equal(resolveOptions(settings), resolved);
  });

  it('fails without settings, since they name the framework', () => {
    for (const settings of [undefined, {}, { other: 1 }]) {
      assert.throws(() => resolveOptions(settings), /framework is required: .* or use configs\.playwright/);
    }
  });
});
