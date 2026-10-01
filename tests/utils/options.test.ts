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
    [{ customStates: { x: { when: 'blocked', marker: 'BLOCKED' } } }, /customStates.x.when must be a tag like "@x"/],
    [{ customStates: { x: { when: '@x', marker: 'blocked' } } }, /marker for state "x" must be uppercase/],
    [{ states: { skip: { marker: 'Skip' } } }, /marker for state "skip" must be uppercase/],
    [{ customStates: { x: { when: '@x', marker: 'SKIP' } } }, /two states use the marker "SKIP"/],
    [{ lifecycleTags: true, customStates: { x: { when: '@new', marker: 'X' } } }, /two states use the tag "@new"/],
  ])('rejects %j', (options, message) => {
    expect(() => compileOptions(options)).toThrow(ConfigError);
    expect(() => compileOptions(options)).toThrow(message);
  });
});

describe('resolveOptions', () => {
  it('merges rule options over shared settings and caches the result', () => {
    const settings = { 'test-governance': { lifecycleTags: true, allowBlankLine: true } };
    const merged = resolveOptions(settings, { allowBlankLine: false });
    expect(merged.allowBlankLine).toBe(false);
    expect(merged.states.map((s) => s.name)).toContain('new');
    expect(resolveOptions(settings, { allowBlankLine: false })).toBe(merged);
    expect(resolveOptions(settings, undefined)).not.toBe(merged);
    expect(resolveOptions(settings, undefined).allowBlankLine).toBe(true);
  });

  it('works without settings', () => {
    expect(resolveOptions(undefined, undefined).states).toHaveLength(2);
    expect(resolveOptions({}, undefined)).toBe(resolveOptions({ other: 1 }, undefined));
  });
});
