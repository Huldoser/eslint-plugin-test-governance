// Packs the plugin, installs the tarball into a copy of the sample project, lints it with the
// project's own eslint.config.js and compares the output with the snapshot the unit tests use.
// Usage: node scripts/pack-smoke.mjs [--eslint 9]
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatResults } from '../tests/fixtures/format.mjs';

const root = path.resolve(import.meta.dirname, '..');
const eslintArg = process.argv.indexOf('--eslint');
const eslintVersion = eslintArg === -1 ? '10' : process.argv[eslintArg + 1];
const work = mkdtempSync(path.join(tmpdir(), 'test-governance-pack-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

try {
  const [{ filename }] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  const project = path.join(work, 'sample-project');
  cpSync(path.join(root, 'tests/fixtures/sample-project'), project, { recursive: true });
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', path.join(work, filename), `eslint@${eslintVersion}`, '@typescript-eslint/parser'],
    project,
  );

  const { ESLint } = await import(pathToFileURL(path.join(project, 'node_modules/eslint/lib/api.js')).href);
  const eslint = new ESLint({ cwd: project });
  const actual = formatResults(await eslint.lintFiles(['tests']), project);
  const expected = readFileSync(path.join(root, 'tests/__snapshots__/sample-project.txt'), 'utf8');

  console.log(`Packed ${filename}, linted with ESLint ${ESLint.version}.`);
  if (actual !== expected) {
    console.error('Output differs from tests/__snapshots__/sample-project.txt:\n');
    console.error(actual);
    process.exitCode = 1;
  } else {
    console.log(`Output matches the snapshot (${actual.trim().split('\n').length} messages).`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
