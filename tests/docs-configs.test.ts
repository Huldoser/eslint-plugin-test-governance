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
function documentedConfig(file: string, name: string, names: Record<string, unknown> = {}): Linter.Config[] {
  const match = new RegExp('<!-- config: ' + name + ' -->\\n+```js\\n([\\s\\S]*?)```').exec(read(file));
  assert.ok(match, `${file} has the complete ${name} config`);
  const module = { exports: [] as Linter.Config[] };
  runInNewContext(match[1].replace(/^import .+;\n/gm, '').replace('export default ', 'module.exports = '), {
    module,
    testGovernance,
    tsParser,
    ...names,
    require: (name: string): typeof testGovernance => {
      assert.equal(name, 'eslint-plugin-test-governance');
      return testGovernance;
    },
  });
  return module.exports;
}

describe('documented config files', () => {
  it('the tag examples show which shared values --fix changes and which it leaves alone', async () => {
    const text = read('docs/rules/consistent-tag-names.md');
    const sample = (name: string): string => {
      const match = new RegExp(`<!-- fix: ${name} -->[\\s\\S]*?\`\`\`js\\n([\\s\\S]*?)\`\`\``).exec(text);
      assert.ok(match, name);
      return match[1];
    };
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [testGovernance.configure({ framework: 'playwright', knownTags: ['@smoke'] })],
      fix: true,
    });
    const [shared] = await eslint.lintText(sample('shared-title-before'));
    assert.equal(shared.output, sample('shared-title-after'));
    assert.deepEqual(shared.messages, []);
    const [member] = await eslint.lintText(sample('object-member'));
    assert.equal(member.output, undefined);
    assert.deepEqual(
      member.messages.map(({ messageId }) => messageId),
      ['tagCase'],
    );
  });

  it('the suppression recipe requires a ticket in support files without test declarations', async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('docs/rules/require-ticket-for-error-suppression.md', 'error-suppression'),
    });
    const code = "Cypress.on('uncaught:exception', () => false);";
    for (const filePath of ['cypress/support/e2e.js', 'cypress/e2e/order.cy.js']) {
      const [missing] = await eslint.lintText(code, { filePath });
      assert.equal(missing.errorCount, 1);
      assert.equal(missing.messages[0].ruleId, 'test-governance/require-ticket-for-error-suppression');
      const [tracked] = await eslint.lintText(`// SUPPRESS: EXAMPLE-123\n${code}`, { filePath });
      assert.deepEqual(tracked.messages, []);
    }
    const [outside] = await eslint.lintText(code, { filePath: 'application.js' });
    assert.deepEqual(outside.messages, []);
  });

  it('the config retry recipe checks selected runner files and leaves application exports alone', async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('docs/rules/limit-retries.md', 'config-retry-limit'),
    });
    for (const filePath of ['playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs']) {
      const code = filePath.endsWith('.cjs') ? 'module.exports = { retries: 2 };' : 'export default { retries: 2 };';
      const [excessive] = await eslint.lintText(code, { filePath });
      assert.equal(excessive.messages.length, 1);
      assert.equal(excessive.messages[0].messageId, 'excessiveRetries');
      const [allowed] = await eslint.lintText(code.replace('2', '1'), { filePath });
      assert.deepEqual(allowed.messages, []);
    }
    const [outside] = await eslint.lintText('export default { retries: 9 };', { filePath: 'application.js' });
    assert.deepEqual(outside.messages, []);
  });

  it('directory rollout checks the new suite without adding policy to the legacy suite', async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('docs/troubleshooting.md', 'directory-rollout'),
    });
    const code = "test.skip('cancels an order', () => {});";
    const [fresh] = await eslint.lintText(code, { filePath: 'tests/new/order.spec.js' });
    assert.deepEqual(
      fresh.messages.map(({ ruleId }) => ruleId),
      ['test-governance/require-ticket'],
    );
    const [legacy] = await eslint.lintText(code, { filePath: 'tests/legacy/order.spec.js' });
    assert.deepEqual(legacy.messages, []);
  });

  it('companion composition replaces only the skip ban and retains existing correctness rules', async () => {
    // The base represents the user's config; upstream runner implementations are not installed by this test.
    const existingConfig = [{ rules: { 'playwright/no-skipped-test': 'error', 'no-debugger': 'error' } }];
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('docs/troubleshooting.md', 'companion', { existingConfig }),
    });
    const filePath = 'tests/order.spec.js';
    const [tracked] = await eslint.lintText("// SKIP: TRADE-123\ntest.skip('cancels an order', () => {});", {
      filePath,
    });
    assert.deepEqual(tracked.messages, []);
    const [untracked] = await eslint.lintText("test.skip('cancels an order', () => {}); debugger;", { filePath });
    assert.deepEqual(untracked.messages.map(({ ruleId }) => ruleId).sort(), [
      'no-debugger',
      'test-governance/require-ticket',
    ]);
    const config = (await eslint.calculateConfigForFile(filePath)) as Linter.Config;
    assert.deepEqual(config.rules?.['playwright/no-skipped-test'], [0]);
  });

  it('the retry-limit config reports excessive counts independently of retry tickets', async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: documentedConfig('docs/rules/limit-retries.md', 'retry-limit'),
    });
    for (const [count, expected] of [
      [0, 0],
      [1, 0],
      [2, 1],
    ] as const) {
      const [result] = await eslint.lintText(`test.describe.configure({ retries: ${count} });`, {
        filePath: 'tests/retries.spec.js',
      });
      assert.equal(result.messages.length, expected);
      if (expected) {
        assert.equal(result.messages[0].ruleId, 'test-governance/limit-retries');
        assert.equal(result.messages[0].messageId, 'excessiveRetries');
        assert.equal(result.messages[0].severity, 2);
      }
    }
  });

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
