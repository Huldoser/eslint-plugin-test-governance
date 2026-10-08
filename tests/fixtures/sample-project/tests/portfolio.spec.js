import { test } from '@playwright/test';

// SKIP: TRADE-300
test.describe.skip('Portfolio sorting', () => {
  test('sorts positions by profit', async () => {});
  test('sorts positions by symbol', async () => {});
});

test.describe('Portfolio data @needs-data', () => {
  test('lists open positions', async () => {});
});

// NEEDS-DATA: RISK-12
test('shows the dividend history @needs-data', async () => {});

test('opens a position', async ({ page }, testInfo) => {
  // skip: TRADE-301
  testInfo.skip();
  await page.goto('/portfolio');
});

test('rebalances the portfolio @new @unstable', async () => {});
