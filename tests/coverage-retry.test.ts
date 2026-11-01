import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRetry } from '../scripts/coverage.mjs';

/** The tail of a Node coverage run with `failed` failing tests and `percent` branch coverage. */
const run = (percent: string, failed: number): string =>
  [
    'ℹ tests 2846',
    `ℹ fail ${failed}`,
    ...(percent === '100.00' ? [] : [`ℹ Error: ${percent}% branch coverage does not meet threshold of 100%.`]),
  ].join('\n');

describe('shouldRetry', () => {
  it('retries when every test passed and only the branch threshold failed', () => {
    assert.equal(shouldRetry(run('99.89', 0)), true);
  });

  it('does not retry when a test failed, even below the threshold', () => {
    assert.equal(shouldRetry(run('99.89', 2)), false);
  });

  it('does not retry a run that only failed a test', () => {
    assert.equal(shouldRetry('ℹ fail 1'), false);
  });

  it('does not retry a run that failed for another reason', () => {
    assert.equal(shouldRetry('Error: Cannot find module "tests/gone.test.ts"'), false);
  });

  it('does not retry a passing run', () => {
    assert.equal(shouldRetry(run('100.00', 0)), false);
  });
});
