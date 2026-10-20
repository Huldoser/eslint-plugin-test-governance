describe('Checkout', { tags: '@smoke' }, () => {
  // NEW: TRADE-31
  it('places a market order', { tags: '@new' }, () => {
    cy.visit('/orders');
  });

  // A tag from @cypress/grep puts the test in a state like a tag in the title.
  it('places a stop order', { tags: ['@quarantined'] }, () => {
    cy.visit('/orders');
  });

  // Only some browsers run it, so it's a conditional skip and needs no ticket by default.
  it('places a limit order', { browser: '!webkit' }, () => {
    cy.visit('/orders');
  });
});
