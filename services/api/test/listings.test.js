import test from 'node:test';
import assert from 'node:assert/strict';
import { toSearchRequest } from '../src/listingService.js';
import { fakeDeps, grpcErr, withApp } from './helpers.js';

test('search query is validated and mapped onto the gRPC request', async () => {
  const { deps, calls } = fakeDeps();
  await withApp(deps, async (api) => {
    const res = await api.get('/api/listings?city=Boston&types=condo,house&minPrice=100&beds=2&features=pool,garage&sort=price_asc&page=2');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });
  const sent = calls.searches[0]; // what the route handed to the listing service (already validated/typed)
  assert.deepEqual(sent.types, ['condo', 'house']);
  assert.deepEqual(sent.features, ['pool', 'garage']);
  assert.deepEqual([sent.minPrice, sent.beds, sent.page], [100, 2, 2]);
});

test('validated query becomes the exact gRPC SearchRequest', () => {
  const req = toSearchRequest({ types: ['condo'], minPrice: 5, beds: 2, openHouse: 'true', sort: 'price_asc' });
  assert.deepEqual([req.propertyTypes, req.minPriceUsd, req.minBeds, req.openHouseOnly, req.sort], [['condo'], 5, 2, true, 'price_asc']);
  assert.deepEqual([req.page, req.pageSize, req.bounds], [1, 12, null]);
});

test('bad query values are rejected with field-level details (400)', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.get('/api/listings?sort=hacked&pageSize=9999');
    assert.equal(res.status, 400);
    assert.ok(res.body.details.some((d) => d.field === 'sort'));
    assert.ok(res.body.details.some((d) => d.field === 'pageSize'));
  });
});

test('map bounds are only sent when all four edges are present', () => {
  assert.equal(toSearchRequest({ north: 1, south: 0 }).bounds, null);
  assert.deepEqual(toSearchRequest({ north: 1, south: 0, east: 3, west: 2 }).bounds, { north: 1, south: 0, east: 3, west: 2 });
});

test('gRPC NOT_FOUND becomes a clean 404 with no internals', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.get('/api/listings/zzz');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
    assert.equal('details' in res.body, false); // upstream gRPC details are never forwarded
  });
});

test('gRPC DEADLINE_EXCEEDED maps to 504 and UNAVAILABLE to 503', async () => {
  const slow = fakeDeps({ listings: { search: async () => { throw grpcErr(4, 'slow'); }, get: async () => { throw grpcErr(14, 'down'); } } });
  await withApp(slow.deps, async (api) => {
    assert.equal((await api.get('/api/listings')).status, 504);
    assert.equal((await api.get('/api/listings/L1')).status, 503);
  });
});

test('unexpected errors return a generic 500 (nothing leaks)', async () => {
  const broken = fakeDeps({ listings: { get: async () => { throw new Error('password=hunter2 at db:5432'); } } });
  const quiet = console.error;
  console.error = () => {};
  await withApp(broken.deps, async (api) => {
    const res = await api.get('/api/listings/L1');
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(res.body).includes('hunter2'), false);
  });
  console.error = quiet;
});

test('security headers and request id are on every response', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.get('/healthz');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('x-request-id'));
  });
});

test('market stats are cacheable', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.get('/api/market');
    assert.match(res.headers.get('cache-control'), /max-age=60/);
    assert.equal(res.body.cities[0].city, 'Boston');
  });
});

test('batch lookup returns the requested homes and caps the id list', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.get('/api/listings/batch?ids=L1,L2');
    assert.deepEqual(res.body.listings.map((l) => l.id), ['L1', 'L2']);
    assert.equal((await api.get('/api/listings/batch')).body.listings.length, 0);
    const tooMany = Array.from({ length: 30 }, (_, i) => `H-${i}`).join(',');
    assert.equal((await api.get(`/api/listings/batch?ids=${tooMany}`)).status, 400);
  });
});
