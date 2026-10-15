import { detail, listing, page } from '../support/e2e.js';

const L = [listing('H-1', { priceUsd: 850000, previousPriceUsd: 900000, beds: 3 }), listing('H-2', { priceUsd: 450000, beds: 1, city: 'Austin' }), listing('H-3', { priceUsd: 1250000, beds: 4, openHouseAt: '2999-01-01T17:00:00Z' })];

const stubSearch = (items = L) => cy.intercept('GET', '/api/listings?*', page(items)).as('search');

describe('home and search (network stubbed)', () => {
  beforeEach(() => { cy.clearLocalStorage(); cy.stubSession(); });

  it('home page: hero search navigates to results with the query in the URL', () => {
    stubSearch();
    cy.visit('/');
    cy.contains('h1', 'Find the home that feels like').should('be.visible');
    cy.get('input[type=search]').type('Boston{enter}');
    cy.location('pathname').should('eq', '/homes');
    cy.location('search').should('include', 'q=Boston');
  });

  it('shows cards with price, facts, badges (price drop, open house) and the result count', () => {
    stubSearch();
    cy.visit('/homes');
    cy.get('[data-cy=listing]').should('have.length', 3);
    cy.get('[data-cy=count]').should('contain', '3 homes');
    cy.contains('[data-cy=listing]', 'H-1 Main St').should('contain', '$850,000').and('contain', 'price drop');
    cy.contains('[data-cy=listing]', 'H-3 Main St').should('contain', 'Open house');
  });

  it('filters live in the URL and are sent to the API', () => {
    stubSearch();
    cy.intercept({ pathname: '/api/listings', query: { beds: '3' } }, page([L[0]])).as('threePlus'); // matches only once the filter is applied
    cy.visit('/homes');
    cy.get('[aria-label="Minimum bedrooms"]').contains('3+').click();
    cy.location('search').should('include', 'beds=3');
    cy.wait('@threePlus');
    cy.get('[data-cy=listing]').should('have.length', 1);
    cy.get('.sidebar').contains('label', 'Pool').find('input').check();
    cy.location('search').should('include', 'features=pool');
  });

  it('opening a link with filters restores them (shareable URLs)', () => {
    stubSearch();
    cy.visit('/homes?status=for_rent&beds=2&sort=price_asc');
    cy.wait('@search').its('request.url').should('include', 'status=for_rent').and('include', 'sort=price_asc');
    cy.get('[aria-label="Minimum bedrooms"] [aria-pressed=true]').should('contain', '2+');
    cy.get('.sort select').should('have.value', 'price_asc');
  });

  it('buy / rent / sold tabs switch the listing type', () => {
    stubSearch();
    cy.visit('/homes');
    cy.contains('[role=tab]', 'Rent').click();
    cy.location('search').should('include', 'status=for_rent');
    cy.contains('[role=tab]', 'Rent').should('have.attr', 'aria-selected', 'true');
  });

  it('list / map views toggle the panes', () => {
    stubSearch();
    cy.visit('/homes');
    cy.get('.map-pane').should('be.visible');
    cy.get('[data-cy=view-list]').click();
    cy.get('.map-pane').should('not.be.visible');
    cy.get('[data-cy=view-map]').click();
    cy.get('.list-pane').should('not.be.visible');
    cy.get('.leaflet-container').should('exist');
  });

  it('infinite scroll: reaching the end of the list requests page 2 exactly once and appends', () => {
    const first = Array.from({ length: 12 }, (_, i) => listing(`P-${i}`));
    const pages = [];
    cy.intercept('GET', '/api/listings?*', (req) => {
      pages.push(new URL(req.url).searchParams.get('page'));
      req.reply(page(req.url.includes('page=2') ? [listing('P-99')] : first, 13));
    });
    cy.visit('/homes');
    cy.get('[data-cy=listing]').should('have.length.at.least', 12);
    cy.get('.sentinel').scrollIntoView();
    cy.get('[data-cy=listing]').should('have.length', 13);
    cy.contains("You've seen all 13 homes").should('exist');
    cy.then(() => expect(pages.filter((p) => p === '2')).to.have.length(1)); // the race fixed in useInfiniteListings
  });

  it('error state offers Try again, empty state offers Clear filters', () => {
    cy.intercept('GET', '/api/listings?*', { statusCode: 503, body: {} }).as('fail');
    cy.visit('/homes');
    cy.get('[role=alert]').should('contain', '503');
    stubSearch([]);
    cy.contains('button', 'Try again').click();
    cy.get('[data-cy=empty]').should('contain', 'No homes match');
  });
});

describe('saving and comparing (signed out)', () => {
  beforeEach(() => { cy.clearLocalStorage(); cy.stubSession(); cy.intercept('GET', '/api/listings?*', page(L)); });

  it('saved homes persist across reload and appear on /saved', () => {
    cy.intercept('GET', '/api/listings/batch*', page([L[0]]));
    cy.visit('/homes');
    cy.contains('[data-cy=listing]', 'H-1 Main St').find('[data-cy=fav]').click();
    cy.get('[data-cy=saved-count]').should('have.text', '1');
    cy.reload();
    cy.get('[data-cy=saved-count]').should('have.text', '1');
    cy.get('[data-cy=saved-link]').click();
    cy.get('[data-cy=listing]').should('have.length', 1).and('contain', 'H-1 Main St');
  });

  it('compares two homes side by side and highlights the best values', () => {
    cy.visit('/homes');
    cy.get('[data-cy=compare]').eq(0).check();
    cy.get('[data-cy=compare-open]').should('be.disabled');
    cy.get('[data-cy=compare]').eq(1).check();
    cy.get('[data-cy=compare-open]').click();
    cy.get('[role=dialog]').should('contain', 'Price per sqft').and('contain', '$450,000');
    cy.get('[role=dialog] td.best').should('have.length.at.least', 2);
    cy.get('body').type('{esc}');
    cy.get('[role=dialog]').should('not.exist');
  });
});

describe('listing page (stubbed)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.stubSession();
    cy.intercept('GET', '/api/listings/H-9', detail('H-9', { openHouseAt: '2999-01-01T17:00:00Z' }));
    cy.intercept('GET', '/api/listings/H-9/similar', { listings: [listing('H-8')] });
    cy.visit('/homes/H-9');
  });

  it('shows price, facts, open house, price history and similar homes', () => {
    cy.get('[data-cy=detail-price]').should('contain', '$800,000');
    cy.get('[data-cy=open-house]').should('contain', 'Open house');
    cy.get('svg[aria-label="Price history chart"] circle').should('have.length', 2);
    cy.contains('h2', 'Similar homes').should('exist');
    cy.contains('Maya Chen').should('exist');
  });

  it('gallery lightbox opens, navigates with arrow keys and closes with Esc', () => {
    cy.get('[data-cy=gallery-open]').click();
    cy.get('[role=dialog]').should('contain', 'Exterior');
    cy.get('body').type('{rightarrow}');
    cy.get('[role=dialog]').should('contain', 'Living room');
    cy.get('body').type('{esc}');
    cy.get('[role=dialog]').should('not.exist');
  });

  it('mortgage payment drops when the down payment slider moves up', () => {
    cy.get('[data-cy=monthly]').invoke('text').then((before) => {
      cy.contains('label', 'Down payment').parent().find('input').then(($i) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call($i[0], 50);
        $i[0].dispatchEvent(new Event('input', { bubbles: true }));
      });
      cy.get('[data-cy=monthly]').invoke('text').should((after) => expect(Number(after.replace(/\D/g, ''))).to.be.lessThan(Number(before.replace(/\D/g, ''))));
    });
  });

  it('tour booking shows a friendly message on 409 and a confirmation on 201', () => {
    cy.intercept('POST', '/api/tours', { statusCode: 409, body: { error: 'date already booked: 2030-01-02' } });
    cy.get('input[name=date]').type('2030-01-02');
    cy.contains('button', 'Request tour').click();
    cy.get('[data-cy=tour-result]').should('contain', 'already booked');
    cy.intercept('POST', '/api/tours', { statusCode: 201, body: { listingId: 'H-9', date: '2030-01-03' } });
    cy.get('input[name=date]').clear().type('2030-01-03');
    cy.contains('button', 'Request tour').click();
    cy.get('[data-cy=tour-result]').should('contain', "You're booked");
  });

  it('message the agent (works signed out)', () => {
    cy.intercept('POST', '/api/inquiries', { statusCode: 201, body: { id: 'q1' } }).as('inquiry');
    cy.get('[data-cy=tab-message]').click();
    cy.get('input[name=name]').type('Sam Buyer');
    cy.get('input[name=email]').type('sam@example.com');
    cy.contains('button', 'Send message').click();
    cy.wait('@inquiry').its('request.body').should('include', { listingId: 'H-9', email: 'sam@example.com' });
    cy.get('[data-cy=inquiry-result]').should('contain', 'will reply');
  });

  it('"Make an offer" sends a signed-out visitor to sign in', () => {
    cy.get('[data-cy=make-offer]').click();
    cy.location('pathname').should('eq', '/login');
  });
});

describe('not found', () => {
  it('unknown listing shows a friendly 404', () => {
    cy.stubSession();
    cy.intercept('GET', '/api/listings/nope', { statusCode: 404, body: { error: 'Not found' } });
    cy.visit('/homes/nope');
    cy.get('[data-cy=not-found]').should('contain', "couldn't find");
  });
});
