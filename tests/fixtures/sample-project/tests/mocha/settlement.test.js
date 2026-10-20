describe('Settlement', function () {
  // SKIP: RISK-21
  xit('settles a trade at T+1', function () {});

  // A test with only a title is pending, so it needs a TODO marker.
  it('settles a trade on a market holiday');

  it('nets trades in the same symbol', function () {
    // A skip from inside the test needs a ticket too.
    this.skip();
  });

  it('settles in the clearing house currency', function () {
    // A skip under a condition doesn't.
    if (!process.env.CLEARING_URL) this.skip();
  });
});
