import { tooMany } from '../errors.js';

// Fixed-window counter per client. Returns true while the client is under the limit.
export function consume(hits, key, now, { windowMs, max }) {
  const rec = hits.get(key);
  if (!rec || now - rec.start > windowMs) {
    hits.set(key, { start: now, n: 1 });
    return true;
  }
  return ++rec.n <= max;
}

// In-memory: fine for one instance. Behind several replicas use HAProxy stick tables or Redis.
export function rateLimit(options, clock = Date.now) {
  const hits = new Map();
  return async (ctx, next) => {
    if (!consume(hits, ctx.ip, clock(), options)) throw tooMany();
    await next();
  };
}
