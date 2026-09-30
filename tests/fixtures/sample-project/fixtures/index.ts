import { test as base } from '@playwright/test';

type Fixtures = { account: { user: string } };

export const test = base.extend<Fixtures>({
  account: async ({}, use) => {
    await use({ user: 'standard_user' });
  },
});

export { expect } from '@playwright/test';
