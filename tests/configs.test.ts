import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
      // Every config sets every rule to the same default severity.
      assert.deepEqual(Object.keys(config.rules).sort(), ruleNames.sort());
      assert.deepEqual(config.rules, configs.playwright.rules);
      assert.deepEqual(config.settings, { 'test-governance': { framework } });
      assert.equal(config.plugins['test-governance'], testGovernance);
    }
  });

  it('fails with a pointer to the guide when a config still reads the removed recommended config', () => {
    const removed =
      /configs\.recommended was removed in 0\.5\.0\. Use the config for your framework: .*docs\/upgrading\.md/;
    // `...configs.recommended` would otherwise spread nothing and leave the rules off.
    assert.throws(
      () => ({ files: ['tests/**/*.spec.ts'], ...(configs as Record<string, object>).recommended }),
      removed,
    );
    assert.ok(!Object.keys(configs).includes('recommended'));
  });

  it('names the package, its version and the rule prefix in the plugin meta', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, string>;
    assert.deepEqual(testGovernance.meta, { name: pkg.name, version: pkg.version, namespace: 'test-governance' });
  });

  it('names a configure() config after its framework', () => {
    assert.equal(configure({ framework: 'playwright' }).name, 'test-governance/playwright');
    assert.equal(configure({ framework: 'jest' }).name, 'test-governance/jest');
  });

  it('preserves explicit undefined and boolean native state overrides', () => {
    const states = { skip: undefined, fixme: false, slow: true };
    const config = configure({ framework: 'playwright', states });
    assert.deepEqual(config.settings?.['test-governance'], { framework: 'playwright', states });
  });

  it('needs a framework in configure() when the config file loads', () => {
    assert.throws(
      () =>
        configure({
          customStates: {
            new: { when: '@new', marker: 'NEW' },
            quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
          },
        } as never),
      /framework is required/,
    );
  });

  it('fails on the first lint when a config built by hand names no framework', () => {
    const config = { plugins: { 'test-governance': testGovernance }, rules: configs.playwright.rules };
    assert.throws(() => new Linter().verify(SKIPPED_VITEST_TEST, config, 'orders.spec.js'), /framework is required/);
  });

  it('keeps the shared options of an earlier config and sets the framework of a later one', () => {
    const linter = new Linter();
    const config = [
      {
        files: ['**/*.ts'],
        ...configure({ framework: 'playwright', ticket: { preset: 'jira', projects: ['TRADE'] } }),
      },
      { files: ['unit/**'], ...configs.vitest },
    ];
    const [unit] = linter.verify(SKIPPED_VITEST_TEST, config, 'unit/pricing.test.ts');
    assert.match(unit.message, /e\.g\. `\/\/ SKIP: TRADE-123`/);
    // Outside the Vitest files, a test imported from Vitest is not checked.
    assert.deepEqual(linter.verify(SKIPPED_VITEST_TEST, config, 'e2e/pricing.spec.ts'), []);
  });

  it('replaces the ticket formats of an earlier configure() for the same files', () => {
    const linter = new Linter();
    const code =
      "import { test } from '@playwright/test';\n// SKIP: #12\ntest.skip('fills a limit order', async () => {});";
    const config = [
      configure({
        framework: 'playwright',
        ticket: { preset: 'jira', projects: ['TRADE'] },
        states: { skip: { ticket: { preset: 'jira', projects: ['TRADE'], host: 'jira.acme.io' } } },
        customStates: { flaky: { when: '@flaky', marker: 'FLAKY', ticket: { preset: 'jira', projects: ['TRADE'] } } },
      }),
      {
        files: ['legacy/**'],
        ...configure({
          framework: 'playwright',
          ticket: { preset: 'github' },
          states: { skip: { ticket: { preset: 'github' } } },
          customStates: { flaky: { when: '@flaky', marker: 'FLAKY', ticket: { preset: 'github' } } },
        }),
      },
    ];
    // Earlier Jira project constraints must not reach the later GitHub ticket formats.
    assert.deepEqual(linter.verify(code, config, 'legacy/orders.spec.js'), []);
    assert.equal(linter.verify(code, config, 'e2e/orders.spec.js').length, 1);
  });

  it('lets the Playwright config win over a framework set for all files', () => {
    const linter = new Linter();
    const config = [configure({ framework: 'vitest' }), { files: ['e2e/**'], ...configs.playwright }];
    const code = "import { test } from '@playwright/test';\ntest.skip('fills a limit order', async () => {});";
    assert.equal(linter.verify(code, config, 'e2e/orders.spec.js').length, 1);
    assert.equal(linter.verify(code, config, 'unit/orders.test.js').length, 0);
  });
});

describe('custom tag policy', () => {
  it('rejects the old rule name with migration guidance', () => {
    assert.throws(
      () =>
        new Linter().verify("test('orders', () => {});", {
          plugins: { 'test-governance': testGovernance },
          rules: { 'test-governance/no-conflicting-states': 'warn' },
          settings: { 'test-governance': { framework: 'playwright' } },
        }),
      /no-conflicting-states was renamed to consistent-tag-names.*conflict checks were removed.*upgrading/,
    );
    assert.ok(!Object.keys(rules).includes('no-conflicting-states'));
    assert.ok(Object.keys(rules).includes('consistent-tag-names'));
  });

  it('allows unlisted tags and spelling-only known tags without ticket markers', () => {
    const config = configure({ framework: 'playwright', knownTags: ['@smoke'] });
    const linter = new Linter();
    assert.deepEqual(linter.verify("test('orders @smoke @new @quarantined @team-owned', () => {});", config), []);
    const [typo] = linter.verify("test('orders @Smoke', () => {});", config);
    assert.equal(typo.ruleId, 'test-governance/consistent-tag-names');
    assert.equal(typo.messageId, 'tagCase');
  });

  it('lets custom tags coexist with each other and a native skip while enforcing their tickets', () => {
    const config = configure({
      framework: 'playwright',
      ticket: { preset: 'github' },
      customStates: {
        new: { when: '@new', marker: 'NEW' },
        quarantined: { when: '@quarantined', marker: 'QUARANTINED' },
      },
    });
    const linter = new Linter();
    const code = "test.skip('orders @new @quarantined', () => {});";
    const missing = linter.verify(code, config);
    assert.equal(missing.length, 3);
    assert.ok(missing.every((m) => m.ruleId === 'test-governance/require-ticket'));
    assert.deepEqual(linter.verify('// SKIP: #123\n// NEW: #123\n// QUARANTINED: #123\n' + code, config), []);
  });
});
