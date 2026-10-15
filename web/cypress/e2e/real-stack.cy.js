// These tests use NO stubs: Vite -> HAProxy -> Koa -> gRPC -> Go -> Postgres, plus Java and Temporal.
// Requires `docker compose up -d` (all services healthy) and the Vite dev server on :5173.
const unique = () => `qa+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

describe('real backend', () => {
  it('search returns seeded homes from Postgres and respects filters', () => {
    cy.visit('/homes?city=Boston');
    cy.get('[data-cy=listing]').should('have.length.at.least', 1);
    cy.get('[data-cy=listing]').each(($li) => expect($li.text()).to.contain('Boston'));
    cy.get('[data-cy=count]').invoke('text').should('match', /^\d+ homes/);
  });

  it('full-text search and a listing detail page with agent and price history', () => {
    cy.visit('/homes?q=seattle');
    cy.get('[data-cy=listing]').should('have.length.at.least', 1).first().click();
    cy.location('pathname').should('match', /^\/homes\/H-\d+$/);
    cy.get('[data-cy=detail-price]').should('exist');
    cy.get('svg[aria-label="Price history chart"]').should('exist');
    cy.contains('Similar homes').should('exist');
  });

  it('market page loads live aggregates', () => {
    cy.visit('/market');
    cy.contains('h1', 'Market insights');
    cy.get('table.market-table tbody tr').should('have.length.at.least', 5);
    cy.get('[data-cy=income]').clear().type('200000');
    cy.get('[data-cy=afford]').invoke('text').should('match', /\$\d/);
  });

  it('full journey: register, save a home (server), book a tour (409 on repeat), make an offer, approve financing and watch the workflow close', () => {
    const email = unique();
    const day = new Date(Date.now() + (500 + Math.floor(Math.random() * 3000)) * 86400000).toISOString().slice(0, 10);
    cy.visit('/register');
    cy.get('input[name=name]').type('QA Buyer');
    cy.get('input[name=email]').type(email);
    cy.get('input[name=password]').type('correct-horse-battery');
    cy.get('[data-cy=auth-submit]').click();
    cy.get('.avatar').should('exist');

    cy.visit('/homes?status=for_sale');
    cy.get('[data-cy=listing]').first().find('[data-cy=fav]').click();
    cy.get('[data-cy=saved-count]').should('have.text', '1');
    cy.reload();
    cy.get('[data-cy=saved-count]').should('have.text', '1'); // came back from the server, not localStorage

    cy.get('[data-cy=listing]').first().click();
    cy.get('input[name=date]').type(day);
    cy.contains('button', 'Request tour').click();
    cy.get('[data-cy=tour-result]').should('contain', "You're booked");
    cy.get('input[name=date]').clear().type(day);
    cy.contains('button', 'Request tour').click();
    cy.get('[data-cy=tour-result]').should('contain', 'already booked'); // real 409 from Java + Postgres UNIQUE

    cy.get('[data-cy=make-offer]').click();
    cy.get('[data-cy=offer-next]').click();
    cy.get('[data-cy=offer-next]').click();
    cy.get('[data-cy=offer-submit]').click();
    cy.get('[data-cy=offer-done]').should('exist');
    cy.contains('a', 'Track my offer').click();

    cy.get('[data-cy=timeline]', { timeout: 20000 }).should('have.attr', 'data-step', 'awaiting_financing');
    cy.get('[data-cy=approve]').click();
    cy.get('[data-cy=timeline]', { timeout: 30000 }).should('have.attr', 'data-step', 'closed');
    cy.get('[data-cy=tab-tours]').click();
    cy.get('[data-cy=tour]').should('have.length', 1);
  });
});
