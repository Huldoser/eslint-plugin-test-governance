import { describe, test } from 'node:test';

describe('Margin', () => {
  // SKIP: RISK-30
  test('calls margin on a gap down', { skip: 'needs the risk sandbox' }, () => {});

  // A reason for the skip is no ticket: this one still needs a marker.
  test('liquidates below maintenance', { skip: 'broker sandbox is down' }, () => {});

  test('nets margin across accounts', async (t) => {
    // A skip under a condition doesn't need a ticket.
    if (!process.env.RISK_URL) t.skip();
    await t.test('in the same currency', { todo: true }, () => {});
  });
});
