import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileTicketSpec, DEFAULT_PLACEHOLDERS, type TicketSpec } from '../../src/utils/tickets.ts';

interface Table {
  spec: TicketSpec | TicketSpec[];
  accepts: string[];
  rejects: string[];
}

const tables: Record<string, Table> = {
  any: {
    spec: { preset: 'any' },
    accepts: [
      'TRADE-123',
      'AB_C-9',
      '#4821',
      'acme/trading-engine#4821',
      'group/sub/project#7',
      'https://example.com/x',
      'http://jira/browse/TRADE-1',
    ],
    rejects: ['trade-123', 'T-1', 'TRADE-', '4821', 'flaky', 'ftp://example.com/x', 'https://', 'acme#4821'],
  },
  jira: {
    spec: { preset: 'jira' },
    accepts: [
      'TRADE-123',
      'https://acme.atlassian.net/browse/TRADE-123',
      'https://acme.atlassian.net/browse/TRADE-123/',
      'https://acme.atlassian.net/jira/software/projects/TRADE/boards/1?selectedIssue=TRADE-123',
    ],
    rejects: [
      '#4821',
      'trade-123',
      'https://acme.atlassian.net/browse/trade-1',
      'https://acme.atlassian.net/boards/1',
      'https://acme.atlassian.net/x?selectedIssue=nope',
    ],
  },
  'jira with projects and host': {
    spec: { preset: 'jira', projects: ['TRADE', 'RISK'], host: 'jira.acme.io' },
    accepts: ['TRADE-1', 'RISK-22', 'https://JIRA.acme.io/browse/RISK-2'],
    rejects: ['OPS-1', 'https://other.io/browse/TRADE-1', 'https://jira.acme.io/browse/OPS-1'],
  },
  github: {
    spec: { preset: 'github' },
    accepts: [
      '#4821',
      'acme/trading-engine#4821',
      'acme/trading-engine.js#1',
      'https://github.com/acme/trading-engine/issues/4821',
      'https://github.com/acme/trading-engine/pull/7/',
    ],
    rejects: [
      'TRADE-1',
      'acme#1',
      'https://github.com/acme/trading-engine',
      'https://gitlab.com/acme/trading-engine/issues/1',
      'https://github.com/acme/trading-engine/issues/x',
    ],
  },
  'github enterprise': {
    spec: { preset: 'github', host: 'git.acme.io' },
    accepts: ['https://git.acme.io/acme/trading-engine/issues/1'],
    rejects: ['https://github.com/acme/trading-engine/issues/1'],
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
    accepts: [
      'ENG-123',
      'https://linear.app/acme/issue/ENG-123',
      'https://linear.app/acme/issue/ENG-123/fix-stop-loss',
    ],
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
      'https://dev.azure.com/acme/trading-engine/_workitems/edit/4821',
      'https://acme.visualstudio.com/trading-engine/_workitems/edit/4821/',
    ],
    rejects: [
      '#4821',
      'ab#1',
      'https://example.com/acme/trading-engine/_workitems/edit/4821',
      'https://dev.azure.com/acme/trading-engine/_boards',
    ],
  },
  'azure-devops on a server': {
    spec: { preset: 'azure-devops', host: 'tfs.acme.io' },
    accepts: ['https://tfs.acme.io/acme/trading-engine/_workitems/edit/1'],
    rejects: ['https://dev.azure.com/acme/trading-engine/_workitems/edit/1'],
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
    spec: [{ preset: 'jira', projects: ['TRADE'] }, { preset: 'github' }],
    accepts: ['TRADE-1', '#4821'],
    rejects: ['OPS-1', 'AB#1'],
  },
};

describe('pattern preset flags', () => {
  for (const flags of ['g', 'y', 'gi']) {
    it(`accepts the same ticket every time with the ${flags} flag`, () => {
      const matcher = compileTicketSpec([{ preset: 'pattern', pattern: '[A-Z]+-\\d+', flags }], []);
      assert.deepEqual(
        ['ABC-1', 'ABC-1', 'ABC-2', 'ABC-3'].map((ticket) => matcher.check(ticket)),
        ['ok', 'ok', 'ok', 'ok'],
      );
    });
  }
});

for (const [name, { spec, accepts, rejects }] of Object.entries(tables)) {
  describe(`${name} preset`, () => {
    const matcher = compileTicketSpec(Array.isArray(spec) ? spec : [spec], []);
    for (const ticket of accepts) {
      it(`accepts ${ticket}`, () => {
        assert.equal(matcher.check(ticket), 'ok');
      });
    }
    for (const ticket of rejects) {
      it(`rejects ${ticket}`, () => {
        assert.equal(matcher.check(ticket), 'format');
      });
    }
  });
}

describe('placeholders', () => {
  const matcher = compileTicketSpec([{ preset: 'any' }], DEFAULT_PLACEHOLDERS);
  for (const ticket of ['TODO', 'todo', 'TBD', 'XXX-1', 'xxx-999', '0', '#0', '123', '#123', '1234', '12345']) {
    it(`rejects ${ticket}`, () => {
      assert.equal(matcher.check(ticket), 'placeholder');
    });
  }
  for (const ticket of ['TRADE-123', '#4821', 'XXXX-1']) {
    it(`accepts ${ticket}`, () => {
      assert.equal(matcher.check(ticket), 'ok');
    });
  }

  for (const ticket of [
    'TRADE-0',
    'TRADE-000',
    '#00',
    'acme/trading-engine#0',
    'AB#0',
    'https://github.com/acme/trading-engine/issues/0',
    'https://x.io/browse/TRADE-0/',
    '000',
  ]) {
    it(`rejects ${ticket}, since no tracker issues number 0`, () => {
      assert.equal(
        compileTicketSpec([{ preset: 'any' }, { preset: 'azure-devops' }, { preset: 'numeric' }], []).check(ticket),
        'placeholder',
      );
    });
  }
  for (const ticket of ['TRADE-10', '#100', 'https://github.com/acme/trading-engine/issues/10', '1000']) {
    it(`still accepts ${ticket}`, () => {
      assert.equal(compileTicketSpec([{ preset: 'any' }, { preset: 'numeric' }], []).check(ticket), 'ok');
    });
  }

  it('uses a custom list with regex characters taken literally', () => {
    const custom = compileTicketSpec([{ preset: 'any' }], ['N/A', 'TRADE-0*', '(none)']);
    assert.equal(custom.check('N/A'), 'placeholder');
    assert.equal(custom.check('TRADE-007'), 'placeholder');
    assert.equal(custom.check('(none)'), 'placeholder');
    assert.equal(custom.check('TODO'), 'format');
    assert.equal(custom.check('TRADE-70'), 'ok');
  });
});

describe('messages', () => {
  const expectedOf = (spec: TicketSpec) => compileTicketSpec([spec], []);
  it('describes each preset', () => {
    assert.equal(expectedOf({ preset: 'jira' }).expected, 'a Jira key like PROJ-123, or a Jira URL');
    assert.equal(
      expectedOf({ preset: 'jira', projects: ['TRADE', 'RISK'] }).expected,
      'a Jira key like TRADE-123 in project TRADE, RISK, or a Jira URL',
    );
    assert.equal(
      expectedOf({ preset: 'gitlab' }).expected,
      'a GitLab issue like #4821 or group/project#4821, or an issue URL on gitlab.com',
    );
    assert.equal(expectedOf({ preset: 'linear' }).example, 'ENG-123');
    assert.equal(expectedOf({ preset: 'azure-devops' }).example, 'AB#4821');
    assert.equal(expectedOf({ preset: 'numeric' }).expected, 'a number with 1 to 20 digits');
    assert.equal(expectedOf({ preset: 'numeric', minLength: 5, maxLength: 5 }).expected, 'a 5-digit number');
    assert.equal(expectedOf({ preset: 'pattern', pattern: 'X\\d+' }).expected, 'a ticket matching /X\\d+/');
    assert.equal(
      compileTicketSpec([{ preset: 'jira' }, { preset: 'github' }], []).expected,
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
      assert.ok(sample.length >= min);
      assert.ok(sample.length <= max);
      assert.equal(
        compileTicketSpec([{ preset: 'numeric', minLength: min, maxLength: max }], DEFAULT_PLACEHOLDERS).check(sample),
        'ok',
      );
    }
  });

  it('rejects an invalid custom pattern', () => {
    assert.throws(() => compileTicketSpec([{ preset: 'pattern', pattern: '(' }], []), /invalid ticket pattern "\("/);
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

  for (const preset of presets) {
    it(`${preset.preset} stays linear on long input`, () => {
      const matcher = compileTicketSpec([preset], DEFAULT_PLACEHOLDERS);
      const start = performance.now();
      for (const input of inputs) matcher.check(input);
      assert.ok(performance.now() - start < 500);
    });
  }
});
