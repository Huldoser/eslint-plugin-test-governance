import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import testGovernance, { configs, configure, rules } from '../src/index.ts';
import { FRAMEWORK_NAMES } from '../src/utils/constants.ts';

const SKIPPED_VITEST_TEST = "import { test } from 'vitest';\ntest.skip('fills a limit order', () => {});";

describe('configs', () => {
  it('has a config for each framework and no other', () => {
    assert.deepEqual(Object.keys(configs).sort(), [...FRAMEWORK_NAMES].sort());
    const ruleNames = Object.keys(rules).map((name) => `test-governance/${name}`);
    for (const framework of FRAMEWORK_NAMES) {
      const config = configs[framework];
      assert.equal(config.name, `test-governance/${framework}`);
      // Every config turns on every rule, at the same severity.
      assert.deepEqual(Object.keys(config.rules).sort(), ruleNames.sort());
      assert.deepEqual(config.rules, configs.playwright.rules);
      assert.deepEqual(config.settings, { 'test-governance': { framework } });
      assert.equal(config.plugins['test-governance'], testGovernance);
    }
  });

  it('names a configure() config after its framework', () => {
    assert.equal(configure().name, 'test-governance/playwright');
    assert.equal(configure({ framework: 'jest' }).name, 'test-governance/jest');
  });

  it('keeps the shared options of an earlier config and sets the framework of a later one', () => {
    const linter = new Linter();
    const config = [
      { files: ['**/*.ts'], ...configure({ ticket: { preset: 'jira', projects: ['TRADE'] } }) },
      { files: ['unit/**'], ...configs.vitest },
    ];
    const [unit] = linter.verify(SKIPPED_VITEST_TEST, config, 'unit/pricing.test.ts');
    assert.match(unit.message, /e\.g\. `\/\/ SKIP: TRADE-123`/);
    // Outside the Vitest files, a test imported from Vitest is not checked.
    assert.deepEqual(linter.verify(SKIPPED_VITEST_TEST, config, 'e2e/pricing.spec.ts'), []);
  });

  it('lets the Playwright config win over a framework set for all files', () => {
    const linter = new Linter();
    const config = [configure({ framework: 'vitest' }), { files: ['e2e/**'], ...configs.playwright }];
    const code = "import { test } from '@playwright/test';\ntest.skip('fills a limit order', async () => {});";
    assert.equal(linter.verify(code, config, 'e2e/orders.spec.js').length, 1);
    assert.equal(linter.verify(code, config, 'unit/orders.test.js').length, 0);
  });
});
