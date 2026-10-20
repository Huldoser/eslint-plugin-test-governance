import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ESLint, type Linter } from 'eslint';
import { configure, type GovernanceOptions } from '../src/index.ts';

// Catches a rule or the shared analysis that slows down on a large spec before users run into it. Only the
// plugin's rules are timed, not parsing, and each size takes its fastest run, so a busy machine adds little.

/** The most the rules may take on a 20,000-line spec. On a laptop they take about 300 ms. */
const LIMIT_MS = 3000;

/** A large spec in one framework: a describe block repeated, and the imports above it. */
interface Spec {
  options: GovernanceOptions;
  header: string;
  block: (i: number) => string;
}

const specs: Record<string, Spec> = {
  Playwright: {
    options: { framework: 'playwright', lifecycleTags: true, states: { fail: true, slow: true } },
    header: "import { test, expect } from '@playwright/test';\n",
    // Valid and missing markers, tags, steps, runtime skips and a title in a constant.
    block: (i) => `
const TITLE_${i} = 'settles order ${i}';
test.describe('orders ${i}', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orders/${i}');
  });

  // SKIP: TRADE-${i}
  test.skip('cancels order ${i}', async ({ page }) => {
    // TODO: TRADE-${i}
    await expect(page.getByRole('row')).toHaveCount(${i});
  });

  test('fills order ${i} @new', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'mobile') testInfo.skip();
    await test.step('submits the order', async () => {
      test.slow();
    });
  });

  test.fixme(TITLE_${i}, async () => {});
  // FIXME: the broker sandbox drops the fill
  test('lists order ${i}', { tag: ['@quarantined', '@regression'] }, async () => {});
});
`,
  },
  Mocha: {
    options: { framework: 'mocha', lifecycleTags: true },
    header: "import assert from 'node:assert/strict';\n",
    // `this.skip()` in hooks, tests and nested functions, pending tests, tags and other context calls.
    block: (i) => `
const TITLE_${i} = 'settles order ${i}';
describe('orders ${i}', { tags: '@smoke' }, function () {
  beforeEach(function () {
    if (!process.env.BROKER_URL) this.skip();
  });

  // SKIP: TRADE-${i}
  it.skip('cancels order ${i}', function () {
    // TODO: TRADE-${i}
    assert.equal(rows(), ${i});
  });

  it('fills order ${i} @new', function () {
    this.slow(500);
    orders.forEach(function () {
      this.skip();
    });
  });

  it(TITLE_${i});
  // FIXME: the broker sandbox drops the fill
  context('lists order ${i} @quarantined', () => {
    xit('shows the fill', () => this.skip());
  });
});
`,
  },
};

function spec({ header, block }: Spec, lines: number): string {
  const blocks = Math.ceil(lines / (block(0).split('\n').length - 1));
  return `${header}${Array.from({ length: blocks }, (_, i) => block(i)).join('')}`;
}

/** The fastest of `runs` lints of `code`, counting only the time spent in the plugin's rules. */
async function ruleTime(options: GovernanceOptions, code: string, runs: number): Promise<number> {
  const config = configure(options);
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config as Linter.Config, stats: true });
  let fastest = Infinity;
  for (let run = 0; run < runs; run++) {
    const [result] = await eslint.lintText(code, { filePath: 'orders.spec.js' });
    const rules = Object.values(result.stats?.times.passes[0]?.rules ?? {});
    assert.equal(rules.length, Object.keys(config.rules).length);
    fastest = Math.min(
      fastest,
      rules.reduce((sum, rule) => sum + rule.total, 0),
    );
  }
  return fastest;
}

for (const [name, framework] of Object.entries(specs)) {
  it(`lints a 20,000-line ${name} spec in time, and four times the code takes about four times as long`, async () => {
    const small = spec(framework, 5000);
    const large = spec(framework, 20000);
    await ruleTime(framework.options, small, 1); // warms up the JIT
    const smallMs = await ruleTime(framework.options, small, 5);
    const largeMs = await ruleTime(framework.options, large, 2);
    assert.ok(largeMs < LIMIT_MS, `took ${Math.round(largeMs)} ms, more than ${LIMIT_MS} ms`);
    // Linear growth gives about 4; an analysis that compares every test with every other one gives 16.
    assert.ok(largeMs / smallMs < 8, `took ${Math.round(largeMs)} ms, ${(largeMs / smallMs).toFixed(1)} times as long`);
  });
}
