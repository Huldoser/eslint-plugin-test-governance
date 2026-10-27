describe('Quotes', () => {
  // SKIP: TRADE-40
  xit('streams level 2 quotes', () => {});

  it('shows the closing auction', () => {
    pending('needs the market data feed');
  });

  it('marks a halted symbol', () => {
    // A skip under a condition doesn't need a ticket.
    if (!process.env.FEED_URL) pending();
  });

  it('shows the pre-market session');
});
