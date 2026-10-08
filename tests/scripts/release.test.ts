import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

const SCRIPTS = path.resolve(import.meta.dirname, '../../scripts');
const REPO = 'https://github.com/Huldoser/eslint-plugin-test-governance';
const dirs: string[] = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway project laid out like this repo, so the scripts change its files instead of ours. */
function project(changelog: string, version = '0.3.1'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-test-'));
  dirs.push(dir);
  mkdirSync(path.join(dir, 'scripts'));
  for (const name of ['changelog-section.mjs', 'prepare-release.mjs']) {
    cpSync(path.join(SCRIPTS, name), path.join(dir, 'scripts', name));
  }
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path.join(dir, 'package.json'), json({ name: 'demo', version }));
  writeFileSync(
    path.join(dir, 'package-lock.json'),
    json({ name: 'demo', version, lockfileVersion: 3, requires: true, packages: { '': { name: 'demo', version } } }),
  );
  writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
  return dir;
}

function run(
  dir: string,
  script: string,
  ...args: string[]
): { status: number | null; stdout: string; stderr: string } {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], { cwd: dir, encoding: 'utf8' });
}

const read = (dir: string, file: string): string => readFileSync(path.join(dir, file), 'utf8');
const version = (dir: string, file: string): unknown => (JSON.parse(read(dir, file)) as { version: unknown }).version;

const CHANGELOG = `# Changelog

## [Unreleased]

### Fixed

- Stop-loss orders no longer fire twice.

## [0.3.1] - 2026-10-06

### Fixed

- Limit orders keep their price.

## [0.3.0] - 2026-10-05

- Adds trailing stops.

[Unreleased]: ${REPO}/compare/v0.3.1...HEAD
[0.3.1]: ${REPO}/compare/v0.3.0...v0.3.1
[0.3.0]: ${REPO}/releases/tag/v0.3.0
`;

describe('changelog-section.mjs', () => {
  it('prints the section of a version, up to the next section', () => {
    const dir = project(CHANGELOG);
    const result = run(dir, 'changelog-section.mjs', '0.3.1');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '### Fixed\n\n- Limit orders keep their price.\n');
  });

  it('accepts a tag name and stops the last section at the link list', () => {
    const dir = project(CHANGELOG);
    const result = run(dir, 'changelog-section.mjs', 'v0.3.0');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '- Adds trailing stops.\n');
  });

  it('fails when the version has no section, or an empty one', () => {
    const dir = project(CHANGELOG.replace('- Adds trailing stops.\n', ''));
    for (const [arg, message] of [
      ['0.4.0', 'CHANGELOG.md has no entry for 0.4.0. Add a "## [0.4.0] - <date>" section.\n'],
      ['0.3.0', 'CHANGELOG.md has no entry for 0.3.0. Add a "## [0.3.0] - <date>" section.\n'],
    ]) {
      const result = run(dir, 'changelog-section.mjs', arg);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, message);
    }
  });

  it('fails without a version', () => {
    const result = run(project(CHANGELOG), 'changelog-section.mjs');
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'Usage: node scripts/changelog-section.mjs <version>\n');
  });
});

describe('prepare-release.mjs', () => {
  it('moves the unreleased entries into a new section and bumps the version', () => {
    const dir = project(CHANGELOG);
    const result = run(dir, 'prepare-release.mjs', 'patch', '--date', '2026-10-08');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '0.3.2\n');
    assert.equal(version(dir, 'package.json'), '0.3.2');
    assert.equal(version(dir, 'package-lock.json'), '0.3.2');
    assert.equal(
      read(dir, 'CHANGELOG.md'),
      CHANGELOG.replace('## [Unreleased]\n', '## [Unreleased]\n\n## [0.3.2] - 2026-10-08\n').replace(
        `[Unreleased]: ${REPO}/compare/v0.3.1...HEAD\n`,
        `[Unreleased]: ${REPO}/compare/v0.3.2...HEAD\n[0.3.2]: ${REPO}/compare/v0.3.1...v0.3.2\n`,
      ),
    );
    // The new section is what the release workflow publishes as the release notes.
    assert.equal(
      run(dir, 'changelog-section.mjs', '0.3.2').stdout,
      '### Fixed\n\n- Stop-loss orders no longer fire twice.\n',
    );
  });

  for (const [bump, expected] of [
    ['minor', '0.4.0'],
    ['major', '1.0.0'],
    ['0.3.10', '0.3.10'],
  ]) {
    it(`bumps ${bump} to ${expected}`, () => {
      const dir = project(CHANGELOG);
      const result = run(dir, 'prepare-release.mjs', bump, '--date', '2026-10-08');
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `${expected}\n`);
      assert.equal(version(dir, 'package.json'), expected);
    });
  }

  it('adds the links when the changelog has none', () => {
    const dir = project('# Changelog\n\n## [Unreleased]\n\n- Shows live prices.\n', '1.0.0');
    const result = run(dir, 'prepare-release.mjs', 'minor', '--date', '2026-10-08');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      read(dir, 'CHANGELOG.md'),
      [
        '# Changelog',
        '',
        '## [Unreleased]',
        '',
        '## [1.1.0] - 2026-10-08',
        '',
        '- Shows live prices.',
        '',
        `[Unreleased]: ${REPO}/compare/v1.1.0...HEAD`,
        `[1.1.0]: ${REPO}/compare/v1.0.0...v1.1.0`,
      ].join('\n'),
    );
  });

  for (const [name, changelog, args, message] of [
    [
      'nothing is unreleased',
      CHANGELOG.replace('### Fixed\n\n- Stop-loss orders no longer fire twice.\n\n', ''),
      ['patch'],
      'CHANGELOG.md has nothing under [Unreleased], so there is nothing to release.',
    ],
    [
      'the changelog has no unreleased section',
      CHANGELOG.replace('## [Unreleased]\n\n', ''),
      ['patch'],
      'CHANGELOG.md has no "## [Unreleased]" section.',
    ],
    ['the version is not newer', CHANGELOG, ['0.3.1'], '0.3.1 is not newer than the current version 0.3.1.'],
    ['the version is older', CHANGELOG, ['0.2.9'], '0.2.9 is not newer than the current version 0.3.1.'],
    [
      'the date is not a date',
      CHANGELOG,
      ['patch', '--date', '8.10.2026'],
      '--date must be YYYY-MM-DD, got 8.10.2026.',
    ],
    [
      'the bump is unknown',
      CHANGELOG,
      ['hotfix'],
      'Usage: node scripts/prepare-release.mjs <patch|minor|major|x.y.z> [--date YYYY-MM-DD]',
    ],
  ] as const) {
    it(`fails and changes nothing when ${name}`, () => {
      const dir = project(changelog);
      const result = run(dir, 'prepare-release.mjs', ...args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, `${message}\n`);
      assert.equal(read(dir, 'CHANGELOG.md'), changelog);
      assert.equal(version(dir, 'package.json'), '0.3.1');
    });
  }

  it('fails when package.json has a version it can not bump', () => {
    const dir = project(CHANGELOG, '1.0.0-rc.1');
    const result = run(dir, 'prepare-release.mjs', 'patch');
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'package.json has version 1.0.0-rc.1, which is not x.y.z.\n');
  });
});
