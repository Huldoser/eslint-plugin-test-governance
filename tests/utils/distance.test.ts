import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { editDistance, typoThreshold } from '../../src/utils/distance.ts';

describe('editDistance', () => {
  const cases: [string, string, number][] = [
    ['', '', 0],
    ['unstable', 'unstable', 0],
    ['unstabel', 'unstable', 1],
    ['unstble', 'unstable', 1],
    ['unstablee', 'unstable', 1],
    ['quarantin', 'quarantine', 1],
    ['bid', '', 3],
    ['', 'bid', 3],
    ['bid', 'ask', 3],
  ];
  for (const [a, b, distance] of cases) {
    it(`${a} → ${b} is ${distance}`, () => {
      assert.equal(editDistance(a, b), distance);
    });
  }
});

describe('typoThreshold', () => {
  it('allows no typos for short tags and more for long ones', () => {
    assert.equal(typoThreshold(3), 0);
    assert.equal(typoThreshold(5), 1);
    assert.equal(typoThreshold(8), 2);
  });
});
