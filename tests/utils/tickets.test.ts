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
    rejects: [
      'trade-123',
      'T-1',
      'TRADE-',
      '4821',
      'flaky',
      'ftp://example.com/x',
      'https://',
      'acme#4821',
      '#4821x',
      'git+https://github.com/acme/trading-engine/issues/1',
    ],
  },
  jira: {
    spec: { preset: 'jira' },
    accepts: [
      'TRADE-123',
      'https://acme.atlassian.net/browse/TRADE-123',
      'https://acme.atlassian.net/browse/TRADE-123/',
      'https://acme.atlassian.net/jira/software/projects/TRADE/boards/1?selectedIssue=TRADE-123',
      // Jira Server and Data Center under a path.
      'https://issues.example.com/jira/browse/TRADE-123',
      'https://tools.example.com/tracking/jira/browse/TRADE-123/',
    ],
    rejects: [
      '#4821',
      'trade-123',
      'https://acme.atlassian.net/browse/trade-1',
      'https://acme.atlassian.net/boards/1',
      'https://acme.atlassian.net/x?selectedIssue=nope',
      'https://acme.atlassian.net/browse/TRADE-123x',
      'https://acme.atlassian.net/browse/TRADE-123/comments',
      'https://acme.atlassian.net/xbrowse/TRADE-123',
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
      'https://github.com/acme/trading-engine/issues/4821x',
      'https://github.com/acme/trading-engine/blob/main/issues/1',
      'acme/trading-engine#4821x',
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
      'https://gitlab.com/group/project/-/merge_requests/4821',
    ],
    rejects: [
      'project#1',
      'https://gitlab.com/g/p/issues/9',
      'https://example.com/g/p/-/issues/9',
      'https://gitlab.com/g/p/-/issues/9x',
      'group/project#1x',
    ],
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
      'https://linear.app/x/acme/issue/ENG-1',
      'https://linear.app/acme/issue/ENG-123x',
    ],
  },
  'azure-devops': {
    spec: { preset: 'azure-devops' },
    accepts: [
      'AB#4821',
      // Azure Repos links #4821 in commit messages and pull request descriptions.
      '#4821',
      'https://dev.azure.com/acme/trading-engine/_workitems/edit/4821',
      'https://acme.visualstudio.com/trading-engine/_workitems/edit/4821/',
    ],
    rejects: [
      '#4821x',
      'ab#1',
      'https://example.com/acme/trading-engine/_workitems/edit/4821',
      'https://dev.azure.com/acme/trading-engine/_boards',
      'https://dev.azure.com/acme/trading-engine/_workitems/edit/4821x',
      'XAB#4821',
      'AB#4821x',
    ],
  },
  'azure-devops on a server': {
    spec: { preset: 'azure-devops', host: 'tfs.acme.io' },
    accepts: ['https://tfs.acme.io/acme/trading-engine/_workitems/edit/1'],
    rejects: ['https://dev.azure.com/acme/trading-engine/_workitems/edit/1'],
  },
  trello: {
    spec: { preset: 'trello' },
    accepts: [
      'https://trello.com/c/nqPiDKmw',
      'https://trello.com/c/nqPiDKmw/',
      'https://trello.com/c/nqPiDKmw/9-fix-stop-loss-rounding',
    ],
    rejects: [
      '#9',
      'nqPiDKmw',
      'https://trello.com/b/nqPiDKmw/trading',
      'https://trello.com/c/nqPiDKm',
      'https://trello.com/c/nqPiDKmw1',
      'https://trello.com/c/nqPiDKmw/9-slug/extra',
      'https://example.com/c/nqPiDKmw',
    ],
  },
  notion: {
    spec: { preset: 'notion' },
    accepts: [
      'TASK-123',
      'https://www.notion.so/TASK-123',
      'https://www.notion.so/Fix-stop-loss-rounding-1429989fe8ac4effbc8f57f56486db54',
      'https://notion.so/acme/1429989fe8ac4effbc8f57f56486db54',
      'https://www.notion.so/acme/Fix-1429989f-e8ac-4eff-bc8f-57f56486db54',
      'https://acme.notion.site/Fix-stop-loss-1429989fe8ac4effbc8f57f56486db54',
      'https://www.notion.so/acme/9a1f0c2b3d4e4f5a8b6c7d8e9f0a1b2c?v=0b1c2d3e4f5a4b6c8d7e9f0a1b2c3d4e&p=1429989fe8ac4effbc8f57f56486db54&pm=s',
      'https://www.notion.so/Fix-1429989fe8ac4effbc8f57f56486db54#0b1c2d3e4f5a4b6c8d7e9f0a1b2c3d4e',
    ],
    rejects: [
      'task-123',
      'https://www.notion.so/acme/9a1f0c2b3d4e4f5a8b6c7d8e9f0a1b2c?v=0b1c2d3e4f5a4b6c8d7e9f0a1b2c3d4e',
      'https://www.notion.so/acme/x?p=nope',
      'https://acme.notion.site/',
      'https://acme.notion.site/my-custom-slug',
      'https://www.notion.so/Fix-1429989fe8ac4effbc8f57f56486db5',
      'https://www.notion.so/Fix-1429989fe8ac4effbc8f57f56486db54x',
      'https://www.notion.so/1429989fe8ac4effbc8f57f56486db54/comments',
      'https://example.com/Fix-1429989fe8ac4effbc8f57f56486db54',
      'https://notion.site/Fix-1429989fe8ac4effbc8f57f56486db54',
    ],
  },
  'notion with prefixes and a custom domain': {
    spec: { preset: 'notion', prefixes: ['TASK'], host: 'docs.acme.io' },
    accepts: ['TASK-1', 'https://docs.acme.io/TASK-1', 'https://docs.acme.io/Fix-1429989fe8ac4effbc8f57f56486db54'],
    rejects: ['BUG-1', 'https://docs.acme.io/BUG-1', 'https://www.notion.so/Fix-1429989fe8ac4effbc8f57f56486db54'],
  },
  asana: {
    spec: { preset: 'asana' },
    accepts: [
      'https://app.asana.com/0/1202805690238892/1203106234191599',
      'https://app.asana.com/0/1202805690238892/1203106234191599/f',
      'https://app.asana.com/0/0/1203106234191599',
      'https://app.asana.com/1/1201234567890123/project/1202805690238892/task/1203106234191599',
      'https://app.asana.com/1/1201234567890123/task/1203106234191599?focus=true',
      'https://app.asana.com/1/1201234567890123/home/task/1203106234191599',
      'https://app.asana.com/1/1201234567890123/task/1203106234191599/comment/1203106234191600',
    ],
    rejects: [
      'https://app.asana.com/0/1202805690238892/list',
      'https://app.asana.com/0/1202805690238892/board',
      'https://app.asana.com/1/1201234567890123/project/1202805690238892',
      'https://app.asana.com/1/1201234567890123/project/1202805690238892/list/1202805690238893',
      'https://app.asana.com/1/1201234567890123/home',
      'https://app.asana.com/1/1201234567890123/inbox/1201234567890124/item/1203106234191599/story/1',
      'https://example.com/0/1202805690238892/1203106234191599',
      '#1203106234191599',
    ],
  },
  clickup: {
    spec: { preset: 'clickup' },
    accepts: [
      'CU-86abc123',
      '#86abc123',
      'DEV-123',
      'https://app.clickup.com/t/86abc123',
      'https://app.clickup.com/t/9015210959/DEV-123',
      'https://app.clickup.com/t/9015210959/86abc123/',
      'https://app.clickup.com/9015210959/v/li/901500000001?p=86abc123',
    ],
    rejects: [
      'CU-86ABC123',
      'cu-86abc123',
      'dev-123',
      '#86abc12_',
      'https://app.clickup.com/9015210959/v/li/901500000001',
      'https://app.clickup.com/9015210959/v/li/901500000001?p=86ABC',
      'https://app.clickup.com/t/9015210959/dev-123',
      'https://sharing.clickup.com/9015210959/t/h/86abc123/0123456789ABCDEF',
      'https://example.com/t/86abc123',
    ],
  },
  'clickup with prefixes': {
    spec: { preset: 'clickup', prefixes: ['DEV'] },
    accepts: ['DEV-1', 'CU-86abc123', 'https://app.clickup.com/t/9015210959/DEV-1'],
    rejects: ['OPS-1', 'https://app.clickup.com/t/9015210959/OPS-1'],
  },
  redmine: {
    spec: { preset: 'redmine' },
    accepts: ['#4821'],
    rejects: ['issue#4821', '4821', 'https://redmine.acme.io/issues/4821', 'https://github.com/acme/x/issues/4821'],
  },
  'redmine with host': {
    spec: { preset: 'redmine', host: 'redmine.acme.io' },
    accepts: [
      '#4821',
      'https://redmine.acme.io/issues/4821',
      'https://redmine.acme.io/issues/4821/',
      'https://redmine.acme.io/issues/4821#note-4',
      'https://redmine.acme.io/issues/4821.json',
      'https://redmine.acme.io/redmine/issues/4821.pdf',
    ],
    rejects: [
      'https://redmine.acme.io/issues/new',
      'https://redmine.acme.io/issues/gantt',
      'https://redmine.acme.io/projects/trading/issues',
      'https://redmine.acme.io/issues/4821/edit',
      'https://redmine.acme.io/issues/4821.html',
      'https://other.io/issues/4821',
    ],
  },
  monday: {
    spec: { preset: 'monday' },
    accepts: [
      'TIX-001',
      'https://acme.monday.com/boards/1234567890/pulses/1234567891',
      'https://acme.monday.com/boards/1234567890/pulses/1234567891/item_views/1',
    ],
    rejects: [
      '1234567891',
      'tix-001',
      'https://acme.monday.com/boards/1234567890',
      'https://acme.monday.com/boards/1234567890/views/2',
      'https://acme.monday.com/boards/1234567890/pulses/x',
      'https://monday.com.example.io/boards/1234567890/pulses/1234567891',
      'https://example.com/boards/1234567890/pulses/1234567891',
    ],
  },
  'monday with prefixes': {
    spec: { preset: 'monday', prefixes: ['TIX'] },
    accepts: ['TIX-12'],
    rejects: ['OPS-12'],
  },
  youtrack: {
    spec: { preset: 'youtrack' },
    accepts: [
      'KT-11468',
      '4DM-12',
      'PRJ_ROAD-7',
      'https://youtrack.jetbrains.com/issue/KT-11468',
      'https://youtrack.jetbrains.com/issue/KT-11468/Fix-stop-loss-rounding',
      'https://acme.youtrack.cloud/issue/TRADE-1/',
      'https://acme.myjetbrains.com/youtrack/issue/TRADE-1',
    ],
    rejects: [
      '123-4',
      'kt-1',
      'https://youtrack.jetbrains.com/issues/KT',
      'https://youtrack.jetbrains.com/issue/KT-1/slug/extra',
      'https://youtrack.jetbrains.com/issue/kt-1',
      'https://youtrack.example.com/issue/KT-1',
      'https://jetbrains.com/issue/KT-1',
    ],
  },
  'youtrack on a server with projects': {
    spec: { preset: 'youtrack', host: 'yt.acme.io', projects: ['TRADE', '4DM'] },
    accepts: ['TRADE-1', '4DM-2', 'https://yt.acme.io/youtrack/issue/TRADE-1'],
    rejects: ['KT-1', 'https://yt.acme.io/issue/KT-1', 'https://acme.youtrack.cloud/issue/TRADE-1'],
  },
  basecamp: {
    spec: { preset: 'basecamp' },
    accepts: [
      'https://3.basecamp.com/4821/buckets/4822/todos/4823',
      'https://3.basecamp.com/4821/buckets/4822/card_tables/cards/4823',
      'https://3.basecamp.com/4821/buckets/4822/card_tables/cards/4823#__recording_4824',
    ],
    rejects: [
      'https://3.basecamp.com/4821/buckets/4822/messages/4823',
      'https://3.basecamp.com/4821/buckets/4822/todolists/4823',
      'https://3.basecamp.com/4821/buckets/4822/documents/4823',
      'https://3.basecamp.com/4821/buckets/4822/card_tables/4823',
      'https://3.basecampapi.com/4821/buckets/4822/todos/4823.json',
      '#4823',
    ],
  },
  shortcut: {
    spec: { preset: 'shortcut' },
    accepts: [
      'sc-27971',
      'SC-27971',
      '[sc-27971]',
      'https://app.shortcut.com/acme/story/27971',
      'https://app.shortcut.com/acme/story/27971/fix-stop-loss-rounding',
      'https://app.clubhouse.io/acme/story/27971',
    ],
    rejects: [
      'sc-new-story',
      '[sc-new-story]',
      '[sc-27971',
      'sc27971',
      'ch27971',
      '[sc-0]',
      'https://app.shortcut.com/acme/epic/27971',
      'https://app.shortcut.com/acme/iteration/27971',
      'https://app.shortcut.com/acme/story/new',
      'https://example.com/acme/story/27971',
    ],
  },
  url: {
    spec: { preset: 'url', hosts: ['www.wrike.com', '*.acme.io'] },
    accepts: [
      'https://www.wrike.com/open.htm?id=4821',
      'https://WWW.Wrike.com/open.htm?id=4821',
      'https://tracker.acme.io/tasks/4821',
      'https://a.b.acme.io/x',
    ],
    rejects: [
      'https://wrike.com/open.htm?id=4821',
      'https://acme.io/tasks/4821',
      'https://evilacme.io/x',
      'https://example.com/x',
      'TRADE-1',
      '#4821',
    ],
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
  for (const ticket of ['TODO', 'todo', 'TBD', 'XXX-1', 'xxx-999', '0', '#0']) {
    it(`rejects ${ticket}`, () => {
      assert.equal(matcher.check(ticket), 'placeholder');
    });
  }
  // Small issue numbers are real issues in young repositories.
  for (const ticket of ['TRADE-123', '#4821', 'XXXX-1', '#123', '#1234', '#12345']) {
    it(`accepts ${ticket}`, () => {
      assert.equal(matcher.check(ticket), 'ok');
    });
  }

  it('ignores a leading # when matching a placeholder from the list', () => {
    const custom = compileTicketSpec([{ preset: 'any' }], ['123']);
    assert.equal(custom.check('#123'), 'placeholder');
    assert.equal(custom.check('#1234'), 'ok');
  });

  for (const ticket of [
    'TRADE-0',
    'TRADE-000',
    '#00',
    'acme/trading-engine#0',
    'AB#0',
    'https://github.com/acme/trading-engine/issues/0',
    'https://x.io/browse/TRADE-0/',
    '000',
    'TASK-000',
    'sc-0',
  ]) {
    it(`rejects ${ticket}, since no tracker issues number 0`, () => {
      assert.equal(
        compileTicketSpec(
          [{ preset: 'any' }, { preset: 'azure-devops' }, { preset: 'numeric' }, { preset: 'shortcut' }],
          [],
        ).check(ticket),
        'placeholder',
      );
    });
  }
  for (const ticket of ['TRADE-10', '#100', 'https://github.com/acme/trading-engine/issues/10', '1000', '004821']) {
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

  it('ignores a # only at the start of the ticket', () => {
    assert.equal(compileTicketSpec([{ preset: 'azure-devops' }], ['AB4821']).check('AB#4821'), 'ok');
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

  it('describes Linear and Azure DevOps tickets', () => {
    assert.equal(expectedOf({ preset: 'linear' }).expected, 'a Linear issue like ENG-123, or a Linear URL');
    assert.equal(
      expectedOf({ preset: 'linear', teams: ['TRADE', 'RISK'] }).expected,
      'a Linear issue like TRADE-123 in team TRADE, RISK, or a Linear URL',
    );
    assert.equal(
      expectedOf({ preset: 'azure-devops' }).expected,
      'an Azure Boards work item like AB#4821 or #4821, or a work item URL',
    );
  });

  it('describes the presets for other trackers', () => {
    assert.deepEqual(
      (
        [
          { preset: 'trello' },
          { preset: 'notion' },
          { preset: 'notion', prefixes: ['DOC', 'BUG'] },
          { preset: 'asana' },
          { preset: 'clickup' },
          { preset: 'clickup', prefixes: ['DEV'] },
          { preset: 'redmine' },
          { preset: 'redmine', host: 'redmine.acme.io' },
          { preset: 'monday', prefixes: ['TIX'] },
          { preset: 'youtrack', projects: ['KT'] },
          { preset: 'basecamp' },
          { preset: 'shortcut' },
          { preset: 'url', hosts: ['www.wrike.com', '*.acme.io'] },
        ] satisfies TicketSpec[]
      ).map((spec) => expectedOf(spec).expected),
      [
        'a Trello card link like https://trello.com/c/nqPiDKmw',
        'a Notion ID like TASK-123, or a Notion page link',
        'a Notion ID like DOC-123 in prefix DOC, BUG, or a Notion page link',
        'an Asana task link like https://app.asana.com/0/0/1204821736251904',
        'a ClickUp task like CU-86abc123 or DEV-123, or a ClickUp task link',
        'a ClickUp task like CU-86abc123 or DEV-123 in prefix DEV, or a ClickUp task link',
        'a Redmine issue like #4821 (set host to accept issue links)',
        'a Redmine issue like #4821, or an issue URL on redmine.acme.io',
        'a monday.com item link like https://acme.monday.com/boards/1234567890/pulses/1234567891, or a custom key like TIX-001 in prefix TIX',
        'a YouTrack issue like KT-123 in project KT, or a YouTrack issue link',
        'a Basecamp to-do or card link like https://3.basecamp.com/4821/buckets/4822/todos/4823',
        'a Shortcut story like sc-123, or a story link',
        'a link to www.wrike.com, *.acme.io',
      ],
    );
  });

  it('gives an example each new preset accepts', () => {
    const specs: TicketSpec[] = [
      { preset: 'trello' },
      { preset: 'notion' },
      { preset: 'asana' },
      { preset: 'clickup' },
      { preset: 'clickup', prefixes: ['DEV'] },
      { preset: 'redmine' },
      { preset: 'monday' },
      { preset: 'youtrack' },
      { preset: 'basecamp' },
      { preset: 'shortcut' },
      { preset: 'url', hosts: ['*.acme.io'] },
      { preset: 'azure-devops' },
    ];
    for (const spec of specs) {
      const matcher = compileTicketSpec([spec], DEFAULT_PLACEHOLDERS);
      assert.equal(matcher.check(matcher.example), 'ok', `${spec.preset}: ${matcher.example}`);
    }
    assert.equal(expectedOf({ preset: 'clickup', prefixes: ['DEV'] }).example, 'DEV-123');
    assert.equal(expectedOf({ preset: 'url', hosts: ['*.acme.io'] }).example, 'https://tasks.acme.io/4821');
  });

  it('rejects a url preset without hosts', () => {
    assert.throws(
      () => compileTicketSpec([{ preset: 'url' } as TicketSpec], []),
      /the "url" ticket preset needs `hosts`/,
    );
  });

  it('gives a sample ticket for each preset', () => {
    const specs: TicketSpec[] = [
      { preset: 'jira' },
      { preset: 'github' },
      { preset: 'gitlab' },
      { preset: 'pattern', pattern: 'TRADE-\\d+' },
    ];
    assert.deepEqual(
      specs.map((spec) => expectedOf(spec).example),
      ['PROJ-123', '#4821', '#4821', 'TICKET'],
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
    { preset: 'trello' },
    { preset: 'notion' },
    { preset: 'asana' },
    { preset: 'clickup' },
    { preset: 'redmine', host: 'x.io' },
    { preset: 'monday' },
    { preset: 'youtrack', host: 'x.io' },
    { preset: 'basecamp' },
    { preset: 'shortcut' },
    { preset: 'url', hosts: ['*.x.io'] },
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
    'https://x.io' + '/browse/A'.repeat(n / 10) + '-',
    'https://www.notion.so/' + 'a-'.repeat(n) + 'x',
    'https://www.notion.so/' + '0'.repeat(n) + 'x',
    'https://app.asana.com/1/1' + '/project/1'.repeat(n / 10) + '/x',
    'https://x.io' + '/issues/1'.repeat(n / 10) + 'x',
    'https://x.io' + '/issue/A-1'.repeat(n / 10) + '/x/',
    'https://app.clickup.com/t/' + '1'.repeat(n) + '/x/',
    '[sc-' + '1'.repeat(n),
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
