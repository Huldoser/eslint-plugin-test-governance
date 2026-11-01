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
 * Whether a failed run should be tried once more: only a coverage threshold may have failed, so no test
 * did. Any other failure, a failing test included, is reported as it is.
 *
 * The summary reads `ℹ fail 0` on a terminal and `# fail 0` in the TAP report a CI log gets, so both are
 * read.
 */
export function shouldRetry(output) {
  const failed = /^#?\s*(?:ℹ\s*)?fail (\d+)$/m.exec(output)?.[1];
  return /does not meet threshold/.test(output) && failed === '0';
}

function run() {
  // The TAP report of the whole suite is a few hundred kilobytes, so the buffer is far larger than the
  // 1 MiB default a longer run could exceed.
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    const message = `Could not run the suite: ${result.error.message}\n`;
    process.stderr.write(message);
    return { status: 1, output: message };
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // Writing through the log file keeps the output when the write to a pipe is still buffered at exit.
  writeFileSync(logPath, output, { flag: 'a' });
  return { status: result.status ?? 1, output };
}

function main() {
  writeFileSync(logPath, '');
  const first = run();
  // A pipe such as a CI log buffers this, so it is written and flushed by Node's normal exit below.
  process.stdout.write(first.output);
  if (first.status === 0) return 0;

  if (!shouldRetry(first.output)) {
    const why = 'The failure is not a coverage threshold with every test passing, so it is not retried.\n';
    appendFileSync(logPath, why);
    process.stdout.write(why);
    return first.status;
  }

  const note =
    'Every test passed and only a coverage threshold failed, which a dropped range in the coverage merge\n' +
    'also causes (TG-44). Running the suite once more; a real regression fails this run too.\n\n';
  appendFileSync(logPath, note);
  process.stdout.write(note);
  const second = run();
  process.stdout.write(second.output);
  return second.status;
}

// Only a direct run runs the suite: the tests import `shouldRetry` from this file.
const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename;
if (isDirectRun) {
  // `process.exit()` would cut off a large write still buffered for a pipe, so the code is set instead.
  process.exitCode = main();
}
