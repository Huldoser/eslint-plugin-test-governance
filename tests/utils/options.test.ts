import { compileOptions, ConfigError, resolveOptions } from '../../src/utils/options.js';

const stateNames = (options: Parameters<typeof compileOptions>[0]) => compileOptions(options).states.map((s) => s.name);

describe('compileOptions', () => {
  it('turns on skip and fixme by default', () => {
    const resolved = compileOptions({});
    expect(resolved.states.map((s) => [s.name, s.marker])).toEqual([
      ['skip', 'SKIP'],
      ['fixme', 'FIXME'],
    ]);
    expect([...resolved.testFunctions]).toEqual(['test']);
    expect(resolved.requireTicketForConditional).toBe(false);
    expect(resolved.allowBlankLine).toBe(false);
    expect(resolved.reportDynamicTitles).toBe(false);
  });

  it('turns on @new and @unstable with lifecycleTags', () => {
    expect(stateNames({ lifecycleTags: true })).toEqual(['skip', 'fixme', 'new', 'unstable']);
    expect(stateNames({ lifecycleTags: false })).toEqual(['skip', 'fixme']);
  });

  it('lets states override lifecycleTags and defaults', () => {
    expect(
      stateNames({ lifecycleTags: true, states: { unstable: false, fail: true, skip: { enabled: false } } }),
    ).toEqual(['fixme', 'fail', 'new']);
  });

  it('adds custom states after the built-ins', () => {
    const resolved = compileOptions({ customStates: { blocked: { when: '@blocked', marker: 'BLOCKED' } } });
    expect(resolved.states.at(-1)).toMatchObject({ name: 'blocked', tag: '@blocked', marker: 'BLOCKED' });
  });

  it('compiles per-state ticket formats', () => {
    const resolved = compileOptions({
      ticket: { preset: 'jira' },
      states: { fixme: { ticket: { preset: 'github' } } },
      customStates: { blocked: { when: '@blocked', marker: 'BLOCKED', ticket: [{ preset: 'numeric' }] } },
    });
    const [skip, fixme, blocked] = resolved.states;
    expect(skip.ticket.check('WEB-1')).toBe('ok');
    expect(fixme.ticket.check('WEB-1')).toBe('format');
    expect(fixme.ticket.check('#4821')).toBe('ok');
    expect(blocked.ticket.check('4821')).toBe('ok');
  });

  it.each([
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
  ])('rejects %j', (options, message) => {
    expect(() => compileOptions(options as never)).toThrow(ConfigError);
    expect(() => compileOptions(options as never)).toThrow(message);
  });
});

describe('resolveOptions', () => {
  it('compiles shared settings once per settings object', () => {
    const settings = { 'test-governance': { lifecycleTags: true, allowBlankLine: true } };
    const resolved = resolveOptions(settings);
    expect(resolved.allowBlankLine).toBe(true);
    expect(resolved.states.map((s) => s.name)).toContain('new');
    expect(resolveOptions(settings)).toBe(resolved);
  });

  it('works without settings', () => {
    expect(resolveOptions(undefined).states).toHaveLength(2);
    expect(resolveOptions({})).toBe(resolveOptions({ other: 1 }));
  });
});
