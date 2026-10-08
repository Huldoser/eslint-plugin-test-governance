// Packs the plugin, installs the tarball into a copy of the sample project, lints it with the
// project's eslint.config.js and again with eslint.config.commonjs.cjs, and compares both outputs with
// the snapshot the unit tests use. It then type-checks a config that imports the plugin with
// TypeScript 5.0, the oldest version the type declarations support.
// Usage: node scripts/pack-smoke.mjs [--eslint 9]
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatResults } from '../tests/fixtures/format.mjs';

const root = path.resolve(import.meta.dirname, '..');
const eslintArg = process.argv.indexOf('--eslint');
const eslintVersion = eslintArg === -1 ? '10' : process.argv[eslintArg + 1];
const OLDEST_TYPESCRIPT = '5.0';
const work = mkdtempSync(path.join(tmpdir(), 'test-governance-pack-'));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

try {
  const [{ filename }] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  const project = path.join(work, 'sample-project');
  cpSync(path.join(root, 'tests/fixtures/sample-project'), project, { recursive: true });
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      path.join(work, filename),
      `eslint@${eslintVersion}`,
      '@typescript-eslint/parser',
      `typescript@${OLDEST_TYPESCRIPT}`,
    ],
    project,
  );

  const { ESLint } = await import(pathToFileURL(path.join(project, 'node_modules/eslint/lib/api.js')).href);
  const expected = readFileSync(path.join(root, 'tests/__snapshots__/sample-project.txt'), 'utf8');
  console.log(`Packed ${filename}, linting with ESLint ${ESLint.version}.`);

  // The ESM config, then the CommonJS one that loads the plugin with require().
  for (const configFile of ['eslint.config.js', 'eslint.config.commonjs.cjs']) {
    const eslint = new ESLint({ cwd: project, overrideConfigFile: configFile });
    const actual = formatResults(await eslint.lintFiles(['tests']), project);
    if (actual !== expected) {
      console.error(`${configFile}: output differs from tests/__snapshots__/sample-project.txt:\n`);
      console.error(actual);
      process.exitCode = 1;
    } else {
      console.log(`${configFile}: output matches the snapshot (${actual.trim().split('\n').length} messages).`);
    }
  }

  writeFileSync(
    path.join(project, 'eslint.config.check.ts'),
    [
      "import testGovernance, { configure, type GovernanceOptions } from 'eslint-plugin-test-governance';",
      '',
      "const options: GovernanceOptions = { lifecycleTags: true, ticket: { preset: 'jira', projects: ['TRADE'] } };",
      'export default [configure(options), testGovernance.configs.playwright];',
      '',
    ].join('\n'),
  );
  const tsc = path.join(project, 'node_modules/typescript/bin/tsc');
  const tscArgs = ['--noEmit', '--strict', '--module', 'nodenext', '--skipLibCheck', 'eslint.config.check.ts'];
  try {
    execFileSync(process.execPath, [tsc, ...tscArgs], { cwd: project, encoding: 'utf8' });
    console.log(`TypeScript ${OLDEST_TYPESCRIPT}: a config importing the plugin type-checks.`);
  } catch (error) {
    console.error(`TypeScript ${OLDEST_TYPESCRIPT} rejects the type declarations:\n${error.stdout}`);
    process.exitCode = 1;
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
