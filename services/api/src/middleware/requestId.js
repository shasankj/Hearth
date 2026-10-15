import { randomUUID } from 'node:crypto';

// Reuse an incoming id (from HAProxy / upstream) so one request is traceable across services.
export async function requestId(ctx, next) {
  ctx.state.id = ctx.get('x-request-id') || randomUUID();
  ctx.set('x-request-id', ctx.state.id);
  await next();
}
