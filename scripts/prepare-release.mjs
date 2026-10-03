// Prepares a release: bumps the version in package.json and package-lock.json, moves the
// [Unreleased] entries of CHANGELOG.md into a section for the new version, and updates the compare
// links at the bottom. Prints the new version. Fails when [Unreleased] is empty.
// Usage: node scripts/prepare-release.mjs <patch|minor|major|x.y.z> [--date YYYY-MM-DD]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [bump] = process.argv.slice(2);
const dateArg = process.argv.indexOf('--date');
const date = dateArg === -1 ? new Date().toISOString().slice(0, 10) : process.argv[dateArg + 1];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const current = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const parts = VERSION_RE.exec(current)?.slice(1).map(Number);
if (!parts) fail(`package.json has version ${current}, which is not x.y.z.`);
const [major, minor, patch] = parts;

let next;
if (bump === 'patch') next = `${major}.${minor}.${patch + 1}`;
else if (bump === 'minor') next = `${major}.${minor + 1}.0`;
else if (bump === 'major') next = `${major + 1}.0.0`;
else if (VERSION_RE.test(bump ?? '')) next = bump;
else fail('Usage: node scripts/prepare-release.mjs <patch|minor|major|x.y.z> [--date YYYY-MM-DD]');

const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
if (!newer(next, current)) fail(`${next} is not newer than the current version ${current}.`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) fail(`--date must be YYYY-MM-DD, got ${date}.`);

const changelogPath = path.join(root, 'CHANGELOG.md');
const lines = readFileSync(changelogPath, 'utf8').split('\n');
const start = lines.findIndex((line) => line.startsWith('## [Unreleased]'));
if (start === -1) fail('CHANGELOG.md has no "## [Unreleased]" section.');
const end = lines.findIndex((line, i) => i > start && (line.startsWith('## ') || /^\[[^\]]+\]: /.test(line)));
const body = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join('\n')
  .trim();
if (!body) fail('CHANGELOG.md has nothing under [Unreleased], so there is nothing to release.');

const repo = 'https://github.com/Huldoser/eslint-plugin-test-governance';
const section = ['## [Unreleased]', '', `## [${next}] - ${date}`, '', body, ''];
const updated = [...lines.slice(0, start), ...section, ...(end === -1 ? [] : lines.slice(end))];
const linkIndex = updated.findIndex((line) => line.startsWith('[Unreleased]: '));
const unreleasedLink = `[Unreleased]: ${repo}/compare/v${next}...HEAD`;
const versionLink = `[${next}]: ${repo}/compare/v${current}...v${next}`;
if (linkIndex === -1) updated.push(unreleasedLink, versionLink);
else updated.splice(linkIndex, 1, unreleasedLink, versionLink);
writeFileSync(changelogPath, updated.join('\n'));

execFileSync('npm', ['version', next, '--no-git-tag-version'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
console.log(next);
