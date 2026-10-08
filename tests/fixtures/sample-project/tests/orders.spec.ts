import { expect, test } from '../fixtures';

test.describe('Order entry', () => {
  test('places a limit order at the chosen price @smoke', async ({ page }) => {
    // TODO: TRADE-490
    await page.goto('/orders');
    // FIXME: the price check is flaky on mobile
    await expect(page).toHaveTitle(/Orders/);
  });

  // Markers hold tickets only, so the note after TRADE-481 is reported.
  // SKIP: TRADE-481 broker sandbox is down
  test.skip('rejects a margin order above the buying power', async ({ page }) => {
    await page.goto('/orders');
  });

  // A skipped test with no marker is reported.
  test.skip('updates the price of an open order', async () => {});

  // FIXME: TODO
  test.fixme('shows the commission before an order is placed', async () => {});

  // SKIP: TRADE-500
  test.fixme('shows the unfilled quantity of a partly filled order', async () => {});

  // NEW: RISK-77
  test('closes all positions with one click @new', async ({ page }) => {
    await page.goto('/positions');
  });

  test('moves a trailing stop up with the price', { tag: ['@unstable', '@smoke'] }, async () => {});

  // UNSTABLE: OPS-9
  test('triggers a stop-loss when the price drops @unstable', async () => {});

  // NEW: RISK-80 promoted, marker left behind
  test('saves a watchlist', async () => {});

  test('exports the trade history as CSV @New', async () => {});

  test('shows dividend payments in the account history @unstabel', async () => {});

  test('draws the price chart', async ({ browserName }) => {
    test.skip(browserName === 'webkit', 'Chart layout differs on WebKit by design');
  });
});
