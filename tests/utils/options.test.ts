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

  it('turns on @new and @unstable with lifecycleTags', () => {
    assert.deepEqual(stateNames({ lifecycleTags: true }), ['skip', 'fixme', 'new', 'unstable']);
    assert.deepEqual(stateNames({ lifecycleTags: false }), ['skip', 'fixme']);
  });

  it('lets states override lifecycleTags and defaults', () => {
    assert.deepEqual(
      stateNames({ lifecycleTags: true, states: { unstable: false, fail: true, skip: { enabled: false } } }),
      ['fixme', 'fail', 'new'],
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
    [{ ticket: { preset: 'numeric', minLength: 5, maxLength: 3 } }, /minLength \(5\) is greater than maxLength \(3\)/],
    [{ ticket: { preset: 'pattern' } }, /"pattern" ticket preset needs a `pattern` regex string/],
    [{ customStates: { x: { when: '@x', marker: 'SKIP' } } }, /two states use the marker "SKIP"/],
    [{ lifecycleTags: true, customStates: { x: { when: '@new', marker: 'X' } } }, /two states use the tag "@new"/],
    [
      { ticket: { preset: 'jira', projects: ['trade'] } },
      /ticket\.projects\[0\] must be an uppercase key as it appears in tickets, such as WEB for WEB-123 \(got "trade"\)/,
    ],
    [{ ticket: { preset: 'linear', teams: ['Eng'] } }, /ticket\.teams\[0\] must be an uppercase key/],
    [
      { ticket: { preset: 'any', host: 'jira.acme.com' } },
      /ticket\.host is not an option of the "any" preset \(it applies to "jira", "github", "gitlab", "azure-devops"\)/,
    ],
    [
      { ticket: [{ preset: 'jira' }, { preset: 'numeric', projects: ['TRADE'] }] },
      /ticket\[1\]\.projects is not an option of the "numeric" preset \(it applies to "jira"\)/,
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
});

describe('framework', () => {
  for (const framework of ['jest', 'vitest'] as const) {
    it(`turns on skip and todo for ${framework}, and has no fixme or slow`, () => {
      assert.deepEqual(stateNames({ framework }), ['skip', 'todo']);
      assert.deepEqual(
        stateNames({ framework, lifecycleTags: true, states: { fixme: true, slow: true, fail: true } }),
        ['skip', 'fail', 'todo', 'new', 'unstable'],
      );
      assert.deepEqual([...compile({ framework }).testFunctions], ['test', 'it']);
      assert.equal(compile({ framework }).framework.name, framework);
    });
  }

  it('is required, since there is no default framework', () => {
    assert.throws(
      () => compileOptions({} as never),
      /framework is required: set it to "playwright", "jest" or "vitest", or use configs\.playwright, configs\.jest or configs\.vitest$/,
    );
  });

  it('has no todo state in Playwright', () => {
    assert.deepEqual(stateNames({ framework: 'playwright', states: { todo: true } }), ['skip', 'fixme']);
  });

  it('rejects an unknown framework', () => {
    assert.throws(
      () => compile({ framework: 'mocha' } as never),
      /framework must be one of "playwright", "jest", "vitest" \(got "mocha"\)/,
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
