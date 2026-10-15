// Shared helpers for all specs.
export const listing = (id, over = {}) => ({
  id, status: 'for_sale', propertyType: 'condo', address: `${id} Main St`, city: 'Boston', state: 'MA', zip: '02116', neighborhood: 'Back Bay',
  lat: 42.35, lng: -71.08, priceUsd: 800000, beds: 2, baths: 2, sqft: 1100, lotSqft: 0, yearBuilt: 2005, hoaMonthly: 300,
  description: 'Light-filled home near the park.', features: ['garage', 'pool'], photos: [], listedAt: new Date().toISOString(),
  openHouseAt: '', previousPriceUsd: 0, daysOnMarket: 12, ...over,
});

export const detail = (id, over = {}) => ({
  ...listing(id, over),
  agent: { id: 'A-1', name: 'Maya Chen', brokerage: 'Hearth Realty', phone: '(555) 555-1000', email: 'maya@example.com', bio: '', rating: 4.8, sales: 120 },
  priceHistory: [{ date: '2026-01-01', priceUsd: 850000, event: 'listed' }, { date: '2026-02-01', priceUsd: 800000, event: 'price_change' }],
});

export const page = (listings, total = listings.length) => ({ listings, total, page: 1, pageSize: 12 });

// Map tiles come from the internet; stub them so tests are fast and offline-safe.
beforeEach(() => {
  cy.intercept('GET', 'https://tile.openstreetmap.org/**', { statusCode: 200, headers: { 'content-type': 'image/png' }, body: '' });
});

Cypress.Commands.add('stubSession', (user = null) => {
  cy.intercept('GET', '/api/auth/me', { user });
  cy.intercept('GET', '/api/market', { cities: [{ city: 'Boston', listings: 4, medianPriceUsd: 1000000, avgPriceUsd: 1100000, avgPricePerSqft: 800, avgDaysOnMarket: 20 }] });
});
