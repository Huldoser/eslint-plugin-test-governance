import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileOptions, ConfigError, resolveOptions, type GovernanceOptions } from '../../src/utils/options.ts';

/** Compiles `options` for Playwright, unless they name another framework. */
const compile = (options: Partial<GovernanceOptions>) => compileOptions({ framework: 'playwright', ...options });
const stateNames = (options: Partial<GovernanceOptions>) => compile(options).states.map((s) => s.name);

describe('compileOptions', () => {
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
    assert.deepEqual(compile({}).annotations, { type: 'issue' });
    assert.equal(compile({ annotations: false }).annotations, undefined);
    assert.deepEqual(compile({ annotations: { type: 'defect' } }).annotations, { type: 'defect' });
  });

  it('turns on @new and @quarantined with lifecycleTags', () => {
    assert.deepEqual(stateNames({ lifecycleTags: true }), ['skip', 'fixme', 'new', 'quarantined']);
    assert.deepEqual(stateNames({ lifecycleTags: false }), ['skip', 'fixme']);
  });

  it('lets states override lifecycleTags and defaults', () => {
    assert.deepEqual(
      stateNames({ lifecycleTags: true, states: { quarantined: false, fail: true, skip: { enabled: false } } }),
      ['fixme', 'fail', 'new'],
    );
  });

  it('renames the tag and marker of a tag state, and only those it is given', () => {
    const resolved = compile({
      lifecycleTags: true,
      states: { new: { tag: '@candidate' }, quarantined: { tag: '@flaky', marker: 'FLAKY' } },
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
    [{ lifecycleTag: true }, /lifecycleTag is not a known option; did you mean "lifecycleTags"\?/],
    [{ annotations: 'yes' }, /annotations/],
    [{ ticket: { preset: 'numeric', minLength: 5, maxLength: 3 } }, /minLength \(5\) is greater than maxLength \(3\)/],
    [{ ticket: { preset: 'pattern' } }, /"pattern" ticket preset needs a `pattern` regex string/],
    [{ customStates: { x: { when: '@x', marker: 'SKIP' } } }, /two states use the marker "SKIP"/],
    [{ lifecycleTags: true, customStates: { x: { when: '@new', marker: 'X' } } }, /two states use the tag "@new"/],
    [
      { lifecycleTags: true, states: { quarantined: { tag: '@new', marker: 'FLAKY' } } },
      /two states use the tag "@new"/,
    ],
    [{ states: { quarantined: { tag: 'flaky' } } }, /states\.quarantined\.tag must be a tag such as @needs-data/],
    // Only a state that a tag puts a test in has a tag to rename.
    [
      { states: { skip: { tag: '@skipped' } } },
      /states\.skip\.tag is not a known option \(expected one of: enabled, marker, ticket\)/,
    ],
    [{ states: { unstable: true } }, /states\.unstable was renamed to "quarantined"/],
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
    [{ states: { new: { ticket: { preset: 'url' } } } }, /states\.new\.ticket\.hosts is required by the "url" preset/],
    [{ ticket: { preset: 'url', hosts: ['*.com'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'url', hosts: ['-acme.io'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'url', hosts: ['acme-.io'] } }, /ticket\.hosts\[0\] must be a host name/],
    [{ ticket: { preset: 'jira', projects: [] } }, /ticket\.projects must have at least 1 item/],
    [{ ticket: { preset: 'linear', teams: [] } }, /ticket\.teams must have at least 1 item/],
    [{ ticket: { preset: 'clickup', prefixes: [] } }, /ticket\.prefixes must have at least 1 item/],
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

  it('does not read a ticket spec the schema already rejects as a preset', () => {
    for (const ticket of [
      { preset: 'bogus' },
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
        stateNames({ framework, lifecycleTags: true, states: { fixme: true, slow: true, fail: true } }),
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
        stateNames({ framework, lifecycleTags: true, states: { fixme: true, slow: true, fail: true } }),
        ['skip', 'fail', 'todo', 'new', 'quarantined'],
      );
      assert.deepEqual([...compile({ framework }).testFunctions], ['test', 'it']);
      assert.equal(compile({ framework }).framework.name, framework);
    });
  }

  it('turns on skip and todo for jasmine, and reads only `it` by default', () => {
    assert.deepEqual(stateNames({ framework: 'jasmine' }), ['skip', 'todo']);
    assert.deepEqual(
      stateNames({ framework: 'jasmine', lifecycleTags: true, states: { fixme: true, slow: true, fail: true } }),
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
    const settings = { 'test-governance': { framework: 'playwright', lifecycleTags: true, allowBlankLine: true } };
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
