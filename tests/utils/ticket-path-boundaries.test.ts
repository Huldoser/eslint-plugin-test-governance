import assert from 'node:assert/strict';
import { it } from 'node:test';
import { compileTicketSpec, type TicketSpec } from '../../src/utils/tickets.ts';

for (const { spec, ticket } of [
  { spec: { preset: 'trello' }, ticket: 'https://trello.com/unrelated/c/nqPiDKmw' },
  { spec: { preset: 'asana' }, ticket: 'https://app.asana.com/unrelated/0/1/4821' },
  { spec: { preset: 'asana' }, ticket: 'https://app.asana.com/0/1/4821/unrelated' },
  { spec: { preset: 'clickup' }, ticket: 'prefixCU-86abc123' },
  { spec: { preset: 'clickup' }, ticket: 'https://app.clickup.com/unrelated/t/86abc123' },
  { spec: { preset: 'clickup' }, ticket: 'https://app.clickup.com/t/86abc123/unrelated' },
  { spec: { preset: 'clickup' }, ticket: 'https://app.clickup.com/unrelated/123/v/list?p=86abc123' },
  { spec: { preset: 'monday' }, ticket: 'https://example.monday.com/unrelated/boards/1/pulses/4821' },
  { spec: { preset: 'monday' }, ticket: 'https://example.monday.com/boards/1/pulses/4821junk' },
  { spec: { preset: 'youtrack' }, ticket: 'KT-4821junk' },
  { spec: { preset: 'basecamp' }, ticket: 'https://3.basecamp.com/unrelated/1/buckets/2/todos/4821' },
  { spec: { preset: 'basecamp' }, ticket: 'https://3.basecamp.com/1/buckets/2/todos/4821junk' },
  { spec: { preset: 'shortcut' }, ticket: 'sc-4821junk' },
  { spec: { preset: 'shortcut' }, ticket: 'https://app.shortcut.com/unrelated/example/story/4821' },
  {
    spec: { preset: 'openproject', host: 'tracker.example.com' },
    ticket: 'https://tracker.example.com/projects/example/work_packages/4821junk',
  },
  {
    spec: { preset: 'openproject', host: 'tracker.example.com' },
    ticket: 'https://tracker.example.com/work_packages/4821junk',
  },
  {
    spec: { preset: 'bugzilla', host: 'tracker.example.com' },
    ticket: 'https://tracker.example.com/show_bug.cgi.backup?id=4821',
  },
  { spec: { preset: 'phabricator', host: 'tracker.example.com' }, ticket: 'https://tracker.example.com/T4821junk' },
  { spec: { preset: 'rally' }, ticket: 'XUS4821' },
] satisfies { spec: TicketSpec; ticket: string }[]) {
  it(`rejects ${ticket} as a ${spec.preset} ticket`, () => {
    assert.equal(compileTicketSpec([spec], []).check(ticket), 'format');
  });
}

it('accepts a multi-digit project-based OpenProject link', () => {
  const matcher = compileTicketSpec([{ preset: 'openproject', host: 'tracker.example.com' }], []);
  assert.equal(matcher.check('https://tracker.example.com/projects/example/work_packages/EXAMPLE-4821'), 'ok');
});

it('classifies a multi-digit all-zero Rally ID as a placeholder', () => {
  assert.equal(compileTicketSpec([{ preset: 'rally' }], []).check('TA0000'), 'placeholder');
});
