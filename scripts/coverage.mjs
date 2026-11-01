// Runs the test suite with the coverage thresholds, and retries once when the only failure is a
// coverage threshold. Node merges coverage from the processes that run the test files, and that merge
// sometimes drops a range: the same commit then reports 99.9% on one run and 100% on the next, with
// every test passing (TG-44). A retry is safe because a real regression fails both runs, and because a
// run with a failing test is never retried.
//
// The output of both runs goes to `coverage-run.log`, which CI uploads as an artifact when the step
// fails, so the next real loss can be read from the run itself.
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const logPath = path.join(root, 'coverage-run.log');
const args = [
  '--test',
  '--experimental-test-coverage',
  '--test-coverage-include=src/**',
  '--test-coverage-branches=100',
  '--test-coverage-functions=100',
  '--test-coverage-lines=100',
  'tests/**/*.test.ts',
];

/**
 * Whether a failed run should be tried once more: only a coverage threshold may have failed, so no
 * test did. Any other failure, a failing test included, is reported as it is.
 */
export function shouldRetry(output) {
  const failed = /^ℹ fail (\d+)$/m.exec(output)?.[1];
  return /does not meet threshold/.test(output) && failed === '0';
}

function run() {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  return { status: result.status ?? 1, output };
}

writeFileSync(logPath, '');
const first = run();
appendFileSync(logPath, first.output);

if (first.status === 0) process.exit(0);

if (!shouldRetry(first.output)) {
  appendFileSync(logPath, '\nThe failure is not a coverage threshold with every test passing, so it is not retried.\n');
  process.exit(first.status);
}

appendFileSync(
  logPath,
  '\nEvery test passed and only a coverage threshold failed, which a dropped range in the coverage merge\n' +
    'also causes (TG-44). Running the suite once more; a real regression fails this run too.\n',
);
process.stdout.write('\nEvery test passed and only a coverage threshold failed; running the suite once more.\n\n');
const second = run();
appendFileSync(logPath, second.output);
process.exit(second.status);
