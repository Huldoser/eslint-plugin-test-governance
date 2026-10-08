import { describe, expect, test } from 'vitest';

describe('Order pricing', () => {
  // SKIP: TRADE-610
  test.skip('adds the exchange fee to a market order', () => {
    expect(0.25).toBeGreaterThan(0);
  });

  // `{ skip: true }` skips the test, so it needs a marker too.
  test('rounds the limit price to the tick size', { skip: true }, () => {});

  // skipIf skips only on some runs, so it needs no ticket.
  test.skipIf(process.env.CI)('streams live quotes', () => {});

  // A todo test needs a TODO marker.
  test.todo('applies a volume discount');

  test('rejects an order above the buying power', (context) => {
    // SKIP: TRADE-611
    context.skip();
  });
});
