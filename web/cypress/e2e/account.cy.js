import { detail, listing, page } from '../support/e2e.js';

const USER = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };

describe('accounts and offers (network stubbed)', () => {
  beforeEach(() => cy.clearLocalStorage());

  it('protected pages redirect to sign in, then return you after signing in', () => {
    cy.stubSession(null);
    cy.intercept('POST', '/api/auth/login', { user: USER });
    cy.intercept('GET', '/api/me/activity', { offers: [], tours: [], inquiries: [] });
    cy.visit('/activity');
    cy.location('pathname').should('eq', '/login');
    cy.get('input[name=email]').type(USER.email);
    cy.get('input[name=password]').type('correct-horse-battery');
    cy.get('[data-cy=auth-submit]').click();
    cy.location('pathname').should('eq', '/activity');
    cy.contains('h1', 'My activity').should('exist');
  });

  it('shows the server error for wrong credentials', () => {
    cy.stubSession(null);
    cy.intercept('POST', '/api/auth/login', { statusCode: 401, body: { error: 'Wrong email or password' } });
    cy.visit('/login');
    cy.get('input[name=email]').type('x@example.com');
    cy.get('input[name=password]').type('whatever');
    cy.get('[data-cy=auth-submit]').click();
    cy.get('[data-cy=auth-error]').should('contain', 'Wrong email or password');
  });

  it('register shows field-level validation from the API', () => {
    cy.stubSession(null);
    cy.intercept('POST', '/api/auth/register', { statusCode: 400, body: { error: 'Invalid request', details: [{ field: 'password', message: 'Too small' }] } });
    cy.visit('/register');
    cy.get('input[name=name]').type('Ada Lovelace');
    cy.get('input[name=email]').type('ada@example.com');
    cy.get('input[name=password]').type('longenough1');
    cy.get('[data-cy=auth-submit]').click();
    cy.get('[data-cy=auth-error]').should('contain', 'password: Too small');
  });

  it('offer wizard: 3 steps, posts the right payload, then links to activity', () => {
    cy.stubSession(USER);
    cy.intercept('GET', '/api/listings/H-9', detail('H-9'));
    cy.intercept('GET', '/api/listings/H-9/similar', { listings: [] });
    cy.intercept('POST', '/api/offers', { statusCode: 201, body: { id: 'o1', workflowId: 'offer-o1' } }).as('offer');
    cy.visit('/homes/H-9');
    cy.get('[data-cy=make-offer]').click();
    cy.get('[data-cy=offer-amount]').clear().type('780000');
    cy.get('[data-cy=offer-next]').click();
    cy.contains('label', 'Appraisal').find('input').check();
    cy.get('[data-cy=offer-next]').click();
    cy.get('[role=dialog]').should('contain', '$780,000').and('contain', 'inspection, appraisal');
    cy.get('[data-cy=offer-submit]').click();
    cy.wait('@offer').its('request.body').should('deep.include', { listingId: 'H-9', amountUsd: 780000, financing: 'conventional' });
    cy.get('[data-cy=offer-done]').should('contain', 'Offer submitted');
  });

  it('activity page draws the workflow timeline and the approve button at "financing"', () => {
    cy.stubSession(USER);
    const offer = { id: 'o1', listingId: 'H-9', address: '9 Main St', city: 'Boston', amountUsd: 780000, askingUsd: 800000, step: 'awaiting_financing', workflowId: 'offer-o1' };
    cy.intercept('GET', '/api/me/activity', { offers: [offer], tours: [], inquiries: [] });
    cy.intercept('POST', '/api/offers/o1/approve-financing', { statusCode: 202, body: '' }).as('approve');
    cy.visit('/activity');
    cy.get('[data-cy=timeline]').should('have.attr', 'data-step', 'awaiting_financing');
    cy.get('[data-cy=approve]').click();
    cy.wait('@approve');
  });

  it('signed-in favorites are saved on the server', () => {
    cy.stubSession(USER);
    cy.intercept('GET', '/api/me/favorites', { ids: [] });
    cy.intercept('GET', '/api/listings?*', page([listing('H-1')]));
    cy.intercept('PUT', '/api/me/favorites/H-1', { statusCode: 204, body: '' }).as('save');
    cy.visit('/homes');
    cy.get('[data-cy=fav]').first().click();
    cy.wait('@save');
    cy.get('[data-cy=saved-count]').should('have.text', '1');
  });
});
