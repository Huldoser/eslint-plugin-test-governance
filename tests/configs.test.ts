import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import testGovernance, { configs, configure } from '../src/index.ts';

const SKIPPED_VITEST_TEST = "import { test } from 'vitest';\ntest.skip('fills a limit order', () => {});";

describe('configs', () => {
  it('has a config for each framework, with the same rules as recommended', () => {
    assert.deepEqual(Object.keys(configs).sort(), ['jest', 'playwright', 'recommended', 'vitest']);
    for (const framework of ['playwright', 'jest', 'vitest'] as const) {
      const config = configs[framework];
      assert.equal(config.name, `test-governance/${framework}`);
      assert.deepEqual(config.rules, configs.recommended.rules);
      assert.deepEqual(config.settings, { 'test-governance': { framework } });
      assert.equal(config.plugins['test-governance'], testGovernance);
    }
    assert.equal(configs.recommended.settings, undefined);
  });

  it('names a configure() config after its framework', () => {
    assert.equal(configure().name, 'test-governance/recommended');
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
