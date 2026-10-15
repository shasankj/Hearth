import { COOKIE } from '../auth/token.js';
import { unauthorized } from '../errors.js';

// Reads the httpOnly session cookie (JavaScript in the page cannot read it, which limits XSS damage).
export function authenticate(tokens) {
  return async (ctx, next) => {
    const token = ctx.cookies.get(COOKIE);
    ctx.state.user = token ? tokens.verify(token) : null;
    await next();
  };
}

export function requireUser(ctx) {
  if (!ctx.state.user) throw unauthorized();
  return ctx.state.user;
}
