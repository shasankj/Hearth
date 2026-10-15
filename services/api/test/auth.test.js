import test from 'node:test';
import assert from 'node:assert/strict';
import { consume } from '../src/middleware/rateLimit.js';
import { USER, cookieOf, fakeDeps, signedIn, withApp } from './helpers.js';

test('register creates a session cookie that is httpOnly and SameSite=Lax', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const res = await api.post('/api/auth/register', USER);
    assert.equal(res.status, 201);
    const raw = res.headers.getSetCookie()[0];
    assert.match(raw, /httponly/i);
    assert.match(raw, /samesite=lax/i);
    assert.equal(res.body.user.email, USER.email);
    assert.equal('passwordHash' in res.body.user, false);
  });
});

test('/me returns the signed-in user, or null', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    assert.equal((await api.get('/api/auth/me')).body.user, null);
    const cookie = await signedIn(api);
    assert.equal((await api.get('/api/auth/me', cookie)).body.user.name, USER.name);
  });
});

test('login: right password works; wrong password and unknown email give the same 401', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    await signedIn(api);
    assert.equal((await api.post('/api/auth/login', { email: USER.email, password: USER.password })).status, 200);
    const wrong = await api.post('/api/auth/login', { email: USER.email, password: 'nope-nope-nope' });
    const unknown = await api.post('/api/auth/login', { email: 'ghost@example.com', password: 'nope-nope-nope' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });
});

test('duplicate email -> 409, weak password -> 400 with a field error', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    await signedIn(api);
    assert.equal((await api.post('/api/auth/register', USER)).status, 409);
    const weak = await api.post('/api/auth/register', { ...USER, email: 'b@example.com', password: 'short' });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.details[0].field, 'password');
  });
});

test('logout clears the cookie', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const cookie = await signedIn(api);
    const res = await api.post('/api/auth/logout', {}, cookie);
    assert.equal(res.status, 204);
    assert.match(res.headers.getSetCookie()[0], /hearth_session=;|expires=/i);
  });
});

test('a tampered token is treated as signed out', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    const cookie = await signedIn(api);
    const res = await api.get('/api/auth/me', cookie.slice(0, -3) + 'abc');
    assert.equal(res.body.user, null);
  });
});

test('rate limiter allows `max` hits per window, then blocks, then resets', () => {
  const hits = new Map();
  const opts = { windowMs: 1000, max: 2 };
  assert.equal(consume(hits, 'ip', 0, opts), true);
  assert.equal(consume(hits, 'ip', 10, opts), true);
  assert.equal(consume(hits, 'ip', 20, opts), false);
  assert.equal(consume(hits, 'ip', 2000, opts), true);
});

test('auth endpoints are rate limited (429 after 20 requests/minute)', async () => {
  await withApp(fakeDeps().deps, async (api) => {
    let last = 0;
    for (let i = 0; i < 25; i++) last = (await api.post('/api/auth/login', { email: 'x@example.com', password: 'whatever12' })).status;
    assert.equal(last, 429);
  });
});

test('cookieOf helper sanity', () => {
  assert.equal(cookieOf({ headers: { getSetCookie: () => ['a=b; Path=/'] } }), 'a=b');
});
