import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ESLint, type Linter } from 'eslint';
import { configure } from '../src/index.ts';

// Catches a rule or the shared analysis that slows down on a large spec before users run into it. Only the
// plugin's rules are timed, not parsing, and each size takes its fastest run, so a busy machine adds little.

/** The most the rules may take on a 20,000-line spec. On a laptop they take about 300 ms. */
const LIMIT_MS = 3000;

const config = configure({ framework: 'playwright', lifecycleTags: true, states: { fail: true, slow: true } });
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config as Linter.Config, stats: true });

/** A describe block with valid and missing markers, tags, steps, runtime skips and a title in a constant. */
const block = (i: number): string => `
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
`;

function spec(lines: number): string {
  const blocks = Math.ceil(lines / (block(0).split('\n').length - 1));
  return `import { test, expect } from '@playwright/test';\n${Array.from({ length: blocks }, (_, i) => block(i)).join('')}`;
}

/** The fastest of `runs` lints of `code`, counting only the time spent in the plugin's rules. */
async function ruleTime(code: string, runs: number): Promise<number> {
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

it('lints a 20,000-line spec in time, and four times the code takes about four times as long', async () => {
  const small = spec(5000);
  const large = spec(20000);
  await ruleTime(small, 1); // warms up the JIT
  const smallMs = await ruleTime(small, 5);
  const largeMs = await ruleTime(large, 2);
  assert.ok(largeMs < LIMIT_MS, `took ${Math.round(largeMs)} ms, more than ${LIMIT_MS} ms`);
  // Linear growth gives about 4; an analysis that compares every test with every other one gives 16.
  assert.ok(largeMs / smallMs < 8, `took ${Math.round(largeMs)} ms, ${(largeMs / smallMs).toFixed(1)} times as long`);
});
