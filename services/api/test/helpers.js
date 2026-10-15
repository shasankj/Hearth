import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { makeTokens } from '../src/auth/token.js';
import { makeAuthService } from '../src/services/auth.js';
import { makeOfferService } from '../src/services/offers.js';

// ---- in-memory fakes: same interfaces as the real repos/clients, no database, no network ----
export const grpcErr = (code, message) => Object.assign(new Error(message), { code });
export const L1 = { id: 'L1', status: 'for_sale', city: 'Boston', priceUsd: 800000, beds: 3 };

function memoryUsers() {
  const byEmail = new Map();
  return {
    create: async ({ email, name, passwordHash }) => {
      if (byEmail.has(email)) throw Object.assign(new Error('dup'), { code: '23505' });
      const user = { id: randomUUID(), email, name, passwordHash };
      byEmail.set(email, user);
      return { id: user.id, email, name };
    },
    byEmail: async (email) => byEmail.get(email) ?? null,
  };
}

function memoryFavorites() {
  const sets = new Map();
  const of = (u) => sets.get(u) ?? sets.set(u, new Set()).get(u);
  return {
    ids: async (u) => [...of(u)],
    add: async (u, l) => of(u).add(l),
    remove: async (u, l) => of(u).delete(l),
  };
}

function memorySearches() {
  const rows = [];
  return {
    list: async (u) => rows.filter((r) => r.userId === u),
    create: async (u, b) => { const r = { id: randomUUID(), userId: u, ...b }; rows.push(r); return r; },
    remove: async (u, id) => { const i = rows.findIndex((r) => r.id === id && r.userId === u); if (i >= 0) rows.splice(i, 1); return i >= 0; },
    setAlerts: async (u, id, alerts) => { const r = rows.find((x) => x.id === id && x.userId === u); if (r) r.alerts = alerts; return Boolean(r); },
  };
}

function memoryOffers() {
  const rows = new Map();
  return {
    create: async (b) => { const id = randomUUID(); rows.set(id, { id, ...b, workflowId: null }); return id; },
    setWorkflow: async (id, workflowId) => { rows.get(id).workflowId = workflowId; },
    remove: async (id) => rows.delete(id),
    byUser: async (u) => [...rows.values()].filter((o) => o.userId === u),
    byId: async (id, u) => { const o = rows.get(id); return o && o.userId === u ? o : null; },
    all: () => [...rows.values()],
  };
}

export function fakeDeps(overrides = {}) {
  const calls = { searches: [], booked: [], started: [], approved: [] };
  const offers = memoryOffers();
  const listings = overrides.listings ?? {
    get: async (id) => { if (id !== 'L1') throw grpcErr(5, 'nope'); return L1; },
    getMany: async (ids) => ids.map((id) => ({ ...L1, id })),
    search: async (q) => { calls.searches.push(q); return { listings: [L1], total: 1, page: 1, pageSize: 12 }; },
    similar: async () => [L1],
    market: async () => [{ city: 'Boston', listings: 1 }],
  };
  const workflows = {
    start: async (o) => { calls.started.push(o); return `offer-${o.id}`; },
    approve: async (id) => { calls.approved.push(id); },
    step: async () => 'awaiting_financing',
  };
  const deps = {
    config: { cookieSecure: false, trustProxy: false, bcryptRounds: 4 },
    listings, tokens: makeTokens('test-secret'), log: () => {},
    auth: makeAuthService({ users: memoryUsers(), rounds: 4 }),
    favorites: memoryFavorites(), searches: memorySearches(),
    inquiries: { create: async (u, b) => ({ id: 'q1', listingId: b.listingId, userId: u }), byUser: async () => [] },
    tours: { byUser: async () => [] },
    inspection: { book: async (b) => { calls.booked.push(b); return { listingId: b.listingId, date: b.date }; } },
    offerService: makeOfferService({ offers, listings, workflows }), ...overrides, listings,
  };
  return { deps, calls, offers, workflows };
}

// ---- tiny HTTP test client on an ephemeral port ----
export async function withApp(deps, fn) {
  const server = createApp(deps).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = makeClient(base);
  try { await fn(api); } finally { server.close(); }
}

// Most replies are JSON; a few (202 Accepted) are plain text.
function parseBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function makeClient(base) {
  const call = async (method, path, body, cookie) => {
    const headers = { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) };
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: parseBody(text) };
  };
  return {
    get: (p, c) => call('GET', p, undefined, c), post: (p, b, c) => call('POST', p, b, c),
    put: (p, b, c) => call('PUT', p, b, c), del: (p, c) => call('DELETE', p, undefined, c),
    patch: (p, b, c) => call('PATCH', p, b, c),
  };
}

export const cookieOf = (res) => res.headers.getSetCookie()[0].split(';')[0];
export const USER = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-battery' };

export async function signedIn(api, user = USER) {
  const res = await api.post('/api/auth/register', user);
  return cookieOf(res);
}
