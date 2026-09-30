import { editDistance, typoThreshold } from '../../src/utils/distance.js';

describe('editDistance', () => {
  it.each([
    ['', '', 0],
    ['unstable', 'unstable', 0],
    ['unstabel', 'unstable', 1],
    ['unstble', 'unstable', 1],
    ['unstablee', 'unstable', 1],
    ['quarantin', 'quarantine', 1],
    ['abc', '', 3],
    ['', 'abc', 3],
    ['new', 'old', 3],
  ])('%s → %s is %i', (a, b, distance) => {
    expect(editDistance(a, b)).toBe(distance);
  });
});

describe('typoThreshold', () => {
  it('allows no typos for short tags and more for long ones', () => {
    expect(typoThreshold(3)).toBe(0);
    expect(typoThreshold(5)).toBe(1);
    expect(typoThreshold(8)).toBe(2);
  });
});
