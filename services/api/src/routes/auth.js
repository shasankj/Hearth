import Router from '@koa/router';
import { COOKIE } from '../auth/token.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loginBody, parse, registerBody } from '../validation.js';

// Session = signed JWT in an httpOnly, SameSite=Lax cookie (not readable by page scripts, not sent cross-site).
function startSession(ctx, { tokens, config }, user) {
  const opts = { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: tokens.maxAgeMs };
  ctx.cookies.set(COOKIE, tokens.sign(user), opts);
}

const sessionUser = (u) => (u ? { id: u.sub, name: u.name, email: u.email } : null);

const register = (deps) => async (ctx) => {
  const user = await deps.auth.register(parse(registerBody, ctx.request.body));
  startSession(ctx, deps, user);
  ctx.status = 201;
  ctx.body = { user };
};

const login = (deps) => async (ctx) => {
  const user = await deps.auth.login(parse(loginBody, ctx.request.body));
  startSession(ctx, deps, user);
  ctx.body = { user };
};

const logout = (ctx) => {
  ctx.cookies.set(COOKIE, null);
  ctx.status = 204;
};

const me = (ctx) => {
  ctx.body = { user: sessionUser(ctx.state.user) };
};

export function authRouter(deps) {
  const router = new Router({ prefix: '/api/auth' });
  router.use(rateLimit({ windowMs: 60_000, max: 20 })); // brute-force guard on every auth route
  router.post('/register', register(deps));
  router.post('/login', login(deps));
  router.post('/logout', logout);
  router.get('/me', me);
  return router;
}
