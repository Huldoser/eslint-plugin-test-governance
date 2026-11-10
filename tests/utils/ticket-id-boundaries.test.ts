import assert from 'node:assert/strict';
import { it } from 'node:test';
import { compileTicketSpec, type TicketSpec } from '../../src/utils/tickets.ts';

for (const { preset, prefix } of [
  { preset: 'notion', prefix: 'https://www.notion.so/' },
  { preset: 'plane', prefix: 'https://app.plane.so/example/project/issues/' },
] as const) {
  it(`rejects the zero UUID while accepting a nonzero UUID with ${preset}`, () => {
    const matcher = compileTicketSpec([{ preset }], []);
    assert.equal(matcher.check(`${prefix}00000000-0000-0000-0000-000000000000`), 'placeholder');
    assert.equal(matcher.check(`${prefix}48217363-6a5b-4b1e-9f8a-0123456789ab`), 'ok');
  });
}

for (const generic of [
  { preset: 'any' },
  { preset: 'url', hosts: ['youtrack.jetbrains.com'] },
  { preset: 'pattern', pattern: '\\S+' },
] satisfies TicketSpec[]) {
  it(`keeps the tracker-specific zero ID decision ahead of ${generic.preset}, in either order`, () => {
    const specific: TicketSpec = { preset: 'youtrack' };
    for (const specs of [
      [specific, generic],
      [generic, specific],
    ]) {
      const matcher = compileTicketSpec(specs, []);
      assert.equal(matcher.check('https://youtrack.jetbrains.com/issue/4DM-0/fix-rounding'), 'placeholder');
      assert.equal(matcher.check('https://youtrack.jetbrains.com/issue/4DM-12/fix-rounding'), 'ok');
    }
  });
}

it('accepts Redmine note references with more than one digit', () => {
  const matcher = compileTicketSpec([{ preset: 'redmine' }], []);
  assert.equal(matcher.check('#4821-16'), 'ok');
  assert.equal(matcher.check('#4821#note-16'), 'ok');
});

it('accepts a tab path after a short OpenProject work package URL', () => {
  const matcher = compileTicketSpec([{ preset: 'openproject', host: 'tracker.example.com' }], []);
  assert.equal(matcher.check('https://tracker.example.com/work_packages/4821/activity'), 'ok');
});
