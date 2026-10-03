import { compileTicketSpec, DEFAULT_PLACEHOLDERS, type TicketSpec } from '../../src/utils/tickets.js';

interface Table {
  spec: TicketSpec | TicketSpec[];
  accepts: string[];
  rejects: string[];
}

const tables: Record<string, Table> = {
  any: {
    spec: { preset: 'any' },
    accepts: [
      'WEB-123',
      'AB_C-9',
      '#4821',
      'acme/web#4821',
      'group/sub/project#7',
      'https://example.com/x',
      'http://jira/browse/WEB-1',
    ],
    rejects: ['web-123', 'W-1', 'WEB-', '4821', 'flaky', 'ftp://example.com/x', 'https://', 'acme#4821'],
  },
  jira: {
    spec: { preset: 'jira' },
    accepts: [
      'WEB-123',
      'https://acme.atlassian.net/browse/WEB-123',
      'https://acme.atlassian.net/browse/WEB-123/',
      'https://acme.atlassian.net/jira/software/projects/WEB/boards/1?selectedIssue=WEB-123',
    ],
    rejects: [
      '#4821',
      'web-123',
      'https://acme.atlassian.net/browse/web-1',
      'https://acme.atlassian.net/boards/1',
      'https://acme.atlassian.net/x?selectedIssue=nope',
    ],
  },
  'jira with projects and host': {
    spec: { preset: 'jira', projects: ['WEB', 'QA'], host: 'jira.acme.io' },
    accepts: ['WEB-1', 'QA-22', 'https://JIRA.acme.io/browse/QA-2'],
    rejects: ['OPS-1', 'https://other.io/browse/WEB-1', 'https://jira.acme.io/browse/OPS-1'],
  },
  github: {
    spec: { preset: 'github' },
    accepts: [
      '#4821',
      'acme/web#4821',
      'acme/web.js#1',
      'https://github.com/acme/web/issues/4821',
      'https://github.com/acme/web/pull/7/',
    ],
    rejects: [
      'WEB-1',
      'acme#1',
      'https://github.com/acme/web',
      'https://gitlab.com/acme/web/issues/1',
      'https://github.com/acme/web/issues/x',
    ],
  },
  'github enterprise': {
    spec: { preset: 'github', host: 'git.acme.io' },
    accepts: ['https://git.acme.io/acme/web/issues/1'],
    rejects: ['https://github.com/acme/web/issues/1'],
  },
  gitlab: {
    spec: { preset: 'gitlab' },
    accepts: [
      '#4821',
      'group/project#1',
      'group/sub/project#1',
      'https://gitlab.com/group/sub/project/-/issues/9',
      'https://gitlab.com/g/p/-/work_items/9',
    ],
    rejects: ['project#1', 'https://gitlab.com/g/p/issues/9', 'https://example.com/g/p/-/issues/9'],
  },
  linear: {
    spec: { preset: 'linear', teams: ['ENG'] },
    accepts: ['ENG-123', 'https://linear.app/acme/issue/ENG-123', 'https://linear.app/acme/issue/ENG-123/fix-checkout'],
    rejects: [
      'OPS-1',
      'https://linear.app/acme/issue/OPS-1',
      'https://linear.app/acme/project/x',
      'https://example.com/acme/issue/ENG-1',
    ],
  },
  'azure-devops': {
    spec: { preset: 'azure-devops' },
    accepts: [
      'AB#4821',
      'https://dev.azure.com/acme/web/_workitems/edit/4821',
      'https://acme.visualstudio.com/web/_workitems/edit/4821/',
    ],
    rejects: [
      '#4821',
      'ab#1',
      'https://example.com/acme/web/_workitems/edit/4821',
      'https://dev.azure.com/acme/web/_boards',
    ],
  },
  'azure-devops on a server': {
    spec: { preset: 'azure-devops', host: 'tfs.acme.io' },
    accepts: ['https://tfs.acme.io/acme/web/_workitems/edit/1'],
    rejects: ['https://dev.azure.com/acme/web/_workitems/edit/1'],
  },
  numeric: {
    spec: { preset: 'numeric', minLength: 4, maxLength: 6 },
    accepts: ['4821', '482173'],
    rejects: ['482', '4821735', '48a1', '#4821'],
  },
  pattern: {
    spec: { preset: 'pattern', pattern: 'BUG\\d+', flags: 'i' },
    accepts: ['BUG1', 'bug42'],
    rejects: ['BUG', 'xBUG1', 'BUG1x'],
  },
  'combined presets': {
    spec: [{ preset: 'jira', projects: ['WEB'] }, { preset: 'github' }],
    accepts: ['WEB-1', '#4821'],
    rejects: ['OPS-1', 'AB#1'],
  },
};

describe('pattern preset flags', () => {
  it.each(['g', 'y', 'gi'])('accepts the same ticket every time with the %s flag', (flags) => {
    const matcher = compileTicketSpec([{ preset: 'pattern', pattern: '[A-Z]+-\\d+', flags }], []);
    expect(['ABC-1', 'ABC-1', 'ABC-2', 'ABC-3'].map((ticket) => matcher.check(ticket))).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
  });
});

describe.each(Object.entries(tables))('%s preset', (_, { spec, accepts, rejects }) => {
  const matcher = compileTicketSpec(Array.isArray(spec) ? spec : [spec], []);
  it.each(accepts)('accepts %s', (ticket) => {
    expect(matcher.check(ticket)).toBe('ok');
  });
  it.each(rejects)('rejects %s', (ticket) => {
    expect(matcher.check(ticket)).toBe('format');
  });
});

describe('placeholders', () => {
  const matcher = compileTicketSpec([{ preset: 'any' }], DEFAULT_PLACEHOLDERS);
  it.each(['TODO', 'todo', 'TBD', 'XXX-1', 'xxx-999', '0', '#0', '123', '#123', '1234', '12345'])(
    'rejects %s',
    (ticket) => {
      expect(matcher.check(ticket)).toBe('placeholder');
    },
  );
  it.each(['WEB-123', '#4821', 'XXXX-1'])('accepts %s', (ticket) => {
    expect(matcher.check(ticket)).toBe('ok');
  });

  it.each([
    'WEB-0',
    'SDQA-000',
    '#00',
    'acme/web#0',
    'AB#0',
    'https://github.com/acme/web/issues/0',
    'https://x.io/browse/WEB-0/',
    '000',
  ])('rejects %s, since no tracker issues number 0', (ticket) => {
    expect(
      compileTicketSpec([{ preset: 'any' }, { preset: 'azure-devops' }, { preset: 'numeric' }], []).check(ticket),
    ).toBe('placeholder');
  });
  it.each(['WEB-10', '#100', 'https://github.com/acme/web/issues/10', '1000'])('still accepts %s', (ticket) => {
    expect(compileTicketSpec([{ preset: 'any' }, { preset: 'numeric' }], []).check(ticket)).toBe('ok');
  });

  it('uses a custom list with regex characters taken literally', () => {
    const custom = compileTicketSpec([{ preset: 'any' }], ['N/A', 'WEB-0*', '(none)']);
    expect(custom.check('N/A')).toBe('placeholder');
    expect(custom.check('WEB-007')).toBe('placeholder');
    expect(custom.check('(none)')).toBe('placeholder');
    expect(custom.check('TODO')).toBe('format');
    expect(custom.check('WEB-70')).toBe('ok');
  });
});

describe('messages', () => {
  const expectedOf = (spec: TicketSpec) => compileTicketSpec([spec], []);
  it('describes each preset', () => {
    expect(expectedOf({ preset: 'jira' }).expected).toBe('a Jira key like PROJ-123, or a Jira URL');
    expect(expectedOf({ preset: 'jira', projects: ['WEB', 'QA'] }).expected).toBe(
      'a Jira key like WEB-123 in project WEB, QA, or a Jira URL',
    );
    expect(expectedOf({ preset: 'gitlab' }).expected).toBe(
      'a GitLab issue like #4821 or group/project#4821, or an issue URL on gitlab.com',
    );
    expect(expectedOf({ preset: 'linear' }).example).toBe('ENG-123');
    expect(expectedOf({ preset: 'azure-devops' }).example).toBe('AB#4821');
    expect(expectedOf({ preset: 'numeric' }).expected).toBe('a number with 1 to 20 digits');
    expect(expectedOf({ preset: 'numeric', minLength: 5, maxLength: 5 }).expected).toBe('a 5-digit number');
    expect(expectedOf({ preset: 'pattern', pattern: 'X\\d+' }).expected).toBe('a ticket matching /X\\d+/');
    expect(compileTicketSpec([{ preset: 'jira' }, { preset: 'github' }], []).expected).toBe(
      'a Jira key like PROJ-123, or a Jira URL; or a GitHub issue like #4821 or owner/repo#4821, or an issue URL on github.com',
    );
  });

  it('gives a numeric example that fits the length limits and is not a placeholder', () => {
    const example = (minLength: number, maxLength: number) =>
      compileTicketSpec([{ preset: 'numeric', minLength, maxLength }], DEFAULT_PLACEHOLDERS).example;
    for (const [min, max] of [
      [1, 20],
      [5, 5],
      [2, 3],
      [8, 10],
    ]) {
      const sample = example(min, max);
      expect(sample.length).toBeGreaterThanOrEqual(min);
      expect(sample.length).toBeLessThanOrEqual(max);
      expect(
        compileTicketSpec([{ preset: 'numeric', minLength: min, maxLength: max }], DEFAULT_PLACEHOLDERS).check(sample),
      ).toBe('ok');
    }
  });

  it('rejects an invalid custom pattern', () => {
    expect(() => compileTicketSpec([{ preset: 'pattern', pattern: '(' }], [])).toThrow(/invalid ticket pattern "\("/);
  });
});

describe('backtracking', () => {
  const presets: TicketSpec[] = [
    { preset: 'any' },
    { preset: 'jira' },
    { preset: 'github' },
    { preset: 'gitlab' },
    { preset: 'linear' },
    { preset: 'azure-devops' },
    { preset: 'numeric' },
  ];
  const n = 50_000;
  const inputs = [
    'A'.repeat(n) + '!',
    'A'.repeat(n) + '-',
    '1'.repeat(n) + 'x',
    'a/'.repeat(n) + '#x',
    'a.'.repeat(n) + '/#',
    '#' + '1'.repeat(n) + 'x',
    'https://gitlab.com/' + '/-'.repeat(n) + '/issues/x',
    'https://dev.azure.com/' + '/_workitems/edit'.repeat(n / 20) + '/x',
    'https://linear.app/a/issue/' + 'A'.repeat(n) + '-',
    'https://x.io/browse/' + 'A'.repeat(n),
  ];

  it.each(presets.map((p) => [p.preset, p] as const))('%s stays linear on long input', (_, preset) => {
    const matcher = compileTicketSpec([preset], DEFAULT_PLACEHOLDERS);
    const start = performance.now();
    for (const input of inputs) matcher.check(input);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
