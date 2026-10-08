import { test as base } from '@playwright/test';

type Fixtures = { account: { user: string } };

export const test = base.extend<Fixtures>({
  account: async ({}, use) => {
    await use({ user: 'paper_trader' });
  },
});

export { expect } from '@playwright/test';
