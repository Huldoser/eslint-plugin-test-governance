import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import testGovernance from '../src/index.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

/** Evaluates a complete documented config with the same plugin and parser the package tests use. */
function documentedConfig(file: string, name: string): Linter.Config[] {
  const match = new RegExp('<!-- config: ' + name + ' -->\\n+```js\\n([\\s\\S]*?)```').exec(read(file));
  assert.ok(match, `${file} has the complete ${name} config`);
  const module = { exports: [] as Linter.Config[] };
  runInNewContext(match[1].replace(/^import .+;\n/gm, '').replace('export default ', 'module.exports = '), {
    module,
    testGovernance,
    tsParser,
    require: (name: string): typeof testGovernance => {
      assert.equal(name, 'eslint-plugin-test-governance');
      return testGovernance;
    },
  });
  return module.exports;
}

describe('documented config files', () => {
  for (const { file, name, extension, severity } of [
    { file: 'README.md', name: 'javascript', extension: 'js', severity: 2 },
    { file: 'docs/configuration.md', name: 'typescript', extension: 'ts', severity: 2 },
    { file: 'docs/configuration.md', name: 'commonjs', extension: 'js', severity: 2 },
    { file: 'docs/configuration.md', name: 'policy', extension: 'js', severity: 2 },
    { file: 'docs/troubleshooting.md', name: 'gradual', extension: 'js', severity: 1 },
  ]) {
    it(`${name} reports a missing ticket, accepts the marker and excludes other files`, async () => {
      const eslint = new ESLint({
        cwd: root,
        overrideConfigFile: true,
        overrideConfig: documentedConfig(file, name),
      });
      const annotation = extension === 'ts' ? 'const title: string' : 'const title';
      const code = `import { test } from '@playwright/test';\n${annotation} = 'cancels an order';\ntest.skip(title, () => {});`;
      const filePath = `tests/order.spec.${extension}`;
      const [missing] = await eslint.lintText(code, { filePath });
      assert.equal(missing.messages.length, 1);
      assert.equal(missing.messages[0].ruleId, 'test-governance/require-ticket');
      assert.equal(missing.messages[0].messageId, 'missingMarker');
      assert.equal(missing.messages[0].severity, severity);

      const [tracked] = await eslint.lintText(code.replace('test.skip(', '// SKIP: TRADE-123\ntest.skip('), {
        filePath,
      });
      assert.deepEqual(tracked.messages, []);

      const [outside] = await eslint.lintText("test.skip('outside the suite', () => {});", { filePath: 'other.js' });
      assert.deepEqual(outside.messages, []);
    });
  }

  it('the README first-run samples produce the stated failing and passing results', async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('README.md', 'javascript'),
    });
    const samples = [...read('README.md').matchAll(/<!-- example: (valid|invalid) -->\n+```js\n([\s\S]*?)```/g)];
    assert.ok(samples.some((match) => match[1] === 'invalid'));
    assert.ok(samples.some((match) => match[1] === 'valid'));
    for (const [, kind, code] of samples) {
      const [result] = await eslint.lintText(code, { filePath: 'tests/order.spec.js' });
      if (kind === 'valid') assert.deepEqual(result.messages, []);
      else {
        assert.equal(result.errorCount, 1);
        assert.equal(result.messages[0].ruleId, 'test-governance/require-ticket');
      }
    }
  });
});
