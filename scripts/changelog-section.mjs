// Prints the CHANGELOG.md section for a version, for use as GitHub release notes. Fails when the
// section is missing or empty, so a release can't go out without a changelog entry.
// Usage: node scripts/changelog-section.mjs 0.1.1
import { readFileSync } from 'node:fs';
import path from 'node:path';

const version = process.argv[2]?.replace(/^v/, '');
if (!version) {
  console.error('Usage: node scripts/changelog-section.mjs <version>');
  process.exit(1);
}

const changelog = readFileSync(path.resolve(import.meta.dirname, '../CHANGELOG.md'), 'utf8');
const lines = changelog.split('\n');
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
const end = lines.findIndex((line, i) => i > start && (line.startsWith('## ') || /^\[[^\]]+\]: /.test(line)));
const body = start === -1 ? '' : lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();

if (!body) {
  console.error(`CHANGELOG.md has no entry for ${version}. Add a "## [${version}] - <date>" section.`);
  process.exit(1);
}
console.log(body);
