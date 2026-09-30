import { test } from '@playwright/test';

// SKIP: WEB-300
test.describe.skip('Inventory sorting', () => {
  test('sorts by price', async () => {});
  test('sorts by name', async () => {});
});

test.describe('Inventory data @needs-data', () => {
  test('shows stock levels', async () => {});
});

// NEEDS-DATA: QA-12
test('shows supplier names @needs-data', async () => {});

test('opens product details', async ({ page }, testInfo) => {
  // skip: WEB-301
  testInfo.skip();
  await page.goto('/inventory');
});

test('filters by category @new @unstable', async () => {});
