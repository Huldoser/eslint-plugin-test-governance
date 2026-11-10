import assert from 'node:assert/strict';
import { it } from 'node:test';
import { compileTicketSpec } from '../../src/utils/tickets.ts';

it('accepts ClickUp IDs that start with letters', () => {
  assert.equal(compileTicketSpec([{ preset: 'clickup' }], []).check('CU-abc123'), 'ok');
});

it('rejects padded zero IDs in fallback and pattern formats', () => {
  const any = compileTicketSpec([{ preset: 'any' }], []);
  assert.equal(any.check('000'), 'placeholder');
  assert.equal(any.check('https://tracker.example.com/issues/00'), 'placeholder');
  assert.equal(compileTicketSpec([{ preset: 'pattern', pattern: '.+' }], []).check('EXAMPLE-000'), 'placeholder');
});

it('requires the exact configured host without a wildcard', () => {
  const jira = compileTicketSpec([{ preset: 'jira', host: 'tracker.example.com' }], []);
  assert.equal(jira.check('https://xtracker.example.com/browse/EXAMPLE-1'), 'format');
});

it('keeps nonnumeric id queries out of zero-ID detection', () => {
  assert.equal(compileTicketSpec([{ preset: 'any' }], []).check('https://tracker.example.com/item?id=0/0'), 'ok');
});

it('reads slash-prefixed hash routes for zero IDs', () => {
  const matcher = compileTicketSpec([{ preset: 'any' }], []);
  assert.equal(matcher.check('https://tracker.example.com/item#section#/EXAMPLE-0/details'), 'ok');
  assert.equal(matcher.check('https://tracker.example.com/#/EXAMPLE-0/details'), 'placeholder');
});

it('lists all three configured hosts in diagnostics', () => {
  const matcher = compileTicketSpec(
    [{ preset: 'url', hosts: ['one.example.com', 'two.example.com', 'three.example.com'] }],
    [],
  );
  assert.equal(matcher.expected, 'a link to one.example.com, two.example.com or three.example.com');
});

it('describes the default monday.com key prefix', () => {
  assert.equal(
    compileTicketSpec([{ preset: 'monday' }], []).expected,
    'a monday.com item link like https://acme.monday.com/boards/1234567890/pulses/1234567891, or a custom key like TIX-001',
  );
});

it('keeps internal hashes literal in placeholder patterns', () => {
  assert.equal(compileTicketSpec([{ preset: 'azure-devops' }], ['AB#4821']).check('AB#4821'), 'placeholder');
});

it('keeps Phabricator task links at the host root', () => {
  const matcher = compileTicketSpec([{ preset: 'phabricator', host: 'tracker.example.com' }], []);
  assert.equal(matcher.check('https://tracker.example.com/unrelated/T4821'), 'format');
});

it('keeps extra path segments out of Notion page IDs', () => {
  const matcher = compileTicketSpec([{ preset: 'notion' }], []);
  assert.equal(matcher.check('https://www.notion.so/unrelated/example/1429989fe8ac4effbc8f57f56486db54'), 'format');
  assert.equal(matcher.check('https://www.notion.so/example/1429989fe8ac4effbc8f57f56486db54/comments'), 'format');
});
