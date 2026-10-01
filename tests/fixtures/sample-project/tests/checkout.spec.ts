import { expect, test } from '../fixtures';

test.describe('Checkout', () => {
  test('SDQA-10: pays with a saved card @smoke', async ({ page }) => {
    // TODO: WEB-490
    await page.goto('/checkout');
    // FIXME: the title check is flaky on mobile
    await expect(page).toHaveTitle(/Checkout/);
  });

  // Markers hold tickets only, so the note after WEB-481 is reported.
  // SKIP: WEB-481 payment sandbox is down
  test.skip('SDQA-11: pays with PayPal', async ({ page }) => {
    await page.goto('/checkout');
  });

  // The test-case ID in the title is not a ticket, so this is reported.
  test.skip('SDQA-12: applies a coupon', async () => {});

  // FIXME: TODO
  test.fixme('SDQA-13: shows tax per region', async () => {});

  // SKIP: WEB-500
  test.fixme('SDQA-14: splits shipping', async () => {});

  // NEW: QA-77
  test('SDQA-15: one-click reorder @new', async ({ page }) => {
    await page.goto('/orders');
  });

  test('SDQA-16: gift wrap', { tag: ['@unstable', '@smoke'] }, async () => {});

  // UNSTABLE: OPS-9
  test('SDQA-17: express shipping @unstable', async () => {});

  // NEW: QA-80 promoted, marker left behind
  test('SDQA-18: saved addresses', async () => {});

  test('SDQA-19: invoice download @New', async () => {});

  test('SDQA-20: loyalty points @unstabel', async () => {});

  test('SDQA-21: webkit-only layout', async ({ browserName }) => {
    test.skip(browserName === 'webkit', 'Layout differs on WebKit by design');
  });
});
