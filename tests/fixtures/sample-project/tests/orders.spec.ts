import { expect, test } from '../fixtures';

test.describe('Order entry', () => {
  test('SDQA-10: places a limit order @smoke', async ({ page }) => {
    // TODO: TRADE-490
    await page.goto('/orders');
    // FIXME: the price check is flaky on mobile
    await expect(page).toHaveTitle(/Orders/);
  });

  // Markers hold tickets only, so the note after TRADE-481 is reported.
  // SKIP: TRADE-481 broker sandbox is down
  test.skip('SDQA-11: buys shares with margin', async ({ page }) => {
    await page.goto('/orders');
  });

  // The test-case ID in the title is not a ticket, so this is reported.
  test.skip('SDQA-12: amends an order price', async () => {});

  // FIXME: TODO
  test.fixme('SDQA-13: shows fees per exchange', async () => {});

  // SKIP: TRADE-500
  test.fixme('SDQA-14: fills a partial order', async () => {});

  // NEW: RISK-77
  test('SDQA-15: one-click sell all @new', async ({ page }) => {
    await page.goto('/positions');
  });

  test('SDQA-16: trailing stop order', { tag: ['@unstable', '@smoke'] }, async () => {});

  // UNSTABLE: OPS-9
  test('SDQA-17: bracket order @unstable', async () => {});

  // NEW: RISK-80 promoted, marker left behind
  test('SDQA-18: saved watchlists', async () => {});

  test('SDQA-19: trade history export @New', async () => {});

  test('SDQA-20: dividend payouts @unstabel', async () => {});

  test('SDQA-21: webkit-only chart layout', async ({ browserName }) => {
    test.skip(browserName === 'webkit', 'Chart layout differs on WebKit by design');
  });
});
