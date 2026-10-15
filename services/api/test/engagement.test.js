import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/errors.js';
import { makeInspectionClient } from '../src/clients/inspection.js';
import { fakeDeps, signedIn, withApp } from './helpers.js';

test('favorites need a session (401) then add / list / remove', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    assert.equal((await api.get('/api/me/favorites')).status, 401);
    const cookie = await signedIn(api);
    assert.equal((await api.put('/api/me/favorites/L1', {}, cookie)).status, 204);
    assert.deepEqual((await api.get('/api/me/favorites', cookie)).body.ids, ['L1']);
    assert.equal((await api.get('/api/me/favorites/listings', cookie)).body.listings[0].id, 'L1');
    await api.del('/api/me/favorites/L1', cookie);
    assert.deepEqual((await api.get('/api/me/favorites', cookie)).body.ids, []);
  });
});

test('saved searches: create, list, toggle alerts, delete, and 404 for unknown', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const cookie = await signedIn(api);
    const made = await api.post('/api/me/saved-searches', { name: 'Boston condos', query: { city: 'Boston' } }, cookie);
    assert.equal(made.status, 201);
    assert.equal((await api.patch(`/api/me/saved-searches/${made.body.id}`, { alerts: false }, cookie)).status, 204);
    assert.equal((await api.get('/api/me/saved-searches', cookie)).body.searches[0].alerts, false);
    assert.equal((await api.del(`/api/me/saved-searches/${made.body.id}`, cookie)).status, 204);
    assert.equal((await api.del('/api/me/saved-searches/nope', cookie)).status, 404);
  });
});

test('inquiry works signed out, validates input', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const ok = await api.post('/api/inquiries', { listingId: 'L1', name: 'Sam', email: 'sam@example.com', message: 'Is it still available?' });
    assert.equal(ok.status, 201);
    const bad = await api.post('/api/inquiries', { listingId: 'L1', name: 'S', email: 'not-an-email', message: 'hi' });
    assert.equal(bad.status, 400);
  });
});

test('tour booking is forwarded with the user id; a 409 from the Java service reaches the client', async () => {
  const { deps, calls } = fakeDeps();
  await withApp(deps, async (api) => {
    const cookie = await signedIn(api);
    const ok = await api.post('/api/tours', { listingId: 'L1', date: '2031-01-02' }, cookie);
    assert.equal(ok.status, 201);
    assert.ok(calls.booked[0].userId);
  });
  const conflict = fakeDeps({ inspection: { book: async () => { throw new HttpError(409, 'date already booked: 2031-01-02'); } } });
  await withApp(conflict.deps, async (api) => {
    const res = await api.post('/api/tours', { listingId: 'L1', date: '2031-01-02' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already booked/);
  });
});

test('tour date must look like YYYY-MM-DD', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    assert.equal((await api.post('/api/tours', { listingId: 'L1', date: 'tomorrow' })).status, 400);
  });
});

test('inspection client turns network failure into 503 and timeout into 504', async () => {
  const refused = makeInspectionClient({ baseUrl: 'http://x', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(refused.book({ listingId: 'L1', date: 'd' }), (e) => e.status === 503);
  const slow = makeInspectionClient({ baseUrl: 'http://x', fetchImpl: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } });
  await assert.rejects(slow.book({ listingId: 'L1', date: 'd' }), (e) => e.status === 504);
});

const OFFER = { listingId: 'L1', amountUsd: 790000, financing: 'conventional', contingencies: ['inspection'] };

test('offers need sign-in; a valid offer starts the Temporal workflow', async () => {
  const { deps, calls } = fakeDeps();
  await withApp(deps, async (api) => {
    assert.equal((await api.post('/api/offers', OFFER)).status, 401);
    const cookie = await signedIn(api);
    const res = await api.post('/api/offers', OFFER, cookie);
    assert.equal(res.status, 201);
    assert.match(res.body.workflowId, /^offer-/);
    assert.equal(calls.started[0].amountUsd, 790000);
  });
});

test('offer guards: absurdly low amount (400), non-sale listing (409), bad financing (400)', async () => {
  const { deps } = fakeDeps({ listings: { get: async () => ({ id: 'L1', status: 'sold', priceUsd: 800000 }) } });
  await withApp(deps, async (api) => {
    const cookie = await signedIn(api);
    assert.equal((await api.post('/api/offers', OFFER, cookie)).status, 409);
    assert.equal((await api.post('/api/offers', { ...OFFER, financing: 'bitcoin' }, cookie)).status, 400);
  });
  await withApp(fakeDeps().deps, async (api) => {
    const cookie = await signedIn(api);
    assert.equal((await api.post('/api/offers', { ...OFFER, amountUsd: 1000 }, cookie)).status, 400);
  });
});

test('if the workflow cannot start, the offer row is rolled back (saga) and the user sees 503', async () => {
  const fake = fakeDeps();
  fake.workflows.start = async () => { throw new Error('temporal down'); };
  await withApp(fake.deps, async (api) => {
    const cookie = await signedIn(api);
    assert.equal((await api.post('/api/offers', OFFER, cookie)).status, 503);
    assert.equal(fake.offers.all().length, 0);
  });
});

test('approving financing signals the workflow; other users cannot touch your offer', async () => {
  const { deps, calls } = fakeDeps();
  await withApp(deps, async (api) => {
    const mine = await signedIn(api);
    const offer = await api.post('/api/offers', OFFER, mine);
    assert.equal((await api.post(`/api/offers/${offer.body.id}/approve-financing`, {}, mine)).status, 202);
    assert.equal(calls.approved.length, 1);
    const other = await signedIn(api, { name: 'Eve Mallory', email: 'eve@example.com', password: 'another-long-pass' });
    assert.equal((await api.post(`/api/offers/${offer.body.id}/approve-financing`, {}, other)).status, 404);
  });
});

test('activity bundles tours, inquiries and offers (with live workflow step)', async () => {
  const { deps } = fakeDeps();
  await withApp(deps, async (api) => {
    const cookie = await signedIn(api);
    await api.post('/api/offers', OFFER, cookie);
    const res = await api.get('/api/me/activity', cookie);
    assert.equal(res.body.offers[0].step, 'awaiting_financing');
    assert.deepEqual(res.body.tours, []);
  });
});
