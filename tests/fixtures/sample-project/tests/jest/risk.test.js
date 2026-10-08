describe('Risk limits', () => {
  // SKIP: RISK-12
  xit('blocks an order above the position limit', () => {});

  // A skipped test with no marker is reported.
  it.skip('warns before a margin call', () => {});

  // TODO: RISK-13
  it.todo('blocks short sales on hard-to-borrow stocks');

  // SKIP: RISK-14
  it.todo('stops trading after the daily loss limit');
});
