import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/security.js';
import { authRouter } from './routes/auth.js';
import { inquiriesRouter, offersRouter, toursRouter } from './routes/engage.js';
import { listingsRouter, marketRouter } from './routes/listings.js';
import { activityRouter, favoritesRouter, searchesRouter } from './routes/me.js';

function healthRouter() {
  const router = new Router();
  router.get('/healthz', (ctx) => { ctx.body = { ok: true }; }); // HAProxy / k8s probe target
  return router;
}

function routers(deps) {
  return [healthRouter(), authRouter(deps), listingsRouter(deps), marketRouter(deps), favoritesRouter(deps),
    searchesRouter(deps), activityRouter(deps), inquiriesRouter(deps), toursRouter(deps), offersRouter(deps)];
}

// Order matters (onion): id -> log -> headers -> error handling -> body parsing -> session -> routes.
function middleware(app, deps) {
  app.use(requestId).use(logger(deps.log)).use(securityHeaders).use(errorHandler);
  app.use(bodyParser({ enableTypes: ['json'], jsonLimit: '50kb' })); // JSON only => no cross-site <form> posts
  app.use(authenticate(deps.tokens));
}

// createApp takes ALL dependencies as arguments (dependency injection) so tests pass fakes: no DB, no network.
export function createApp(deps) {
  const app = new Koa();
  app.proxy = Boolean(deps.config?.trustProxy); // behind HAProxy: trust X-Forwarded-For/Proto
  middleware(app, deps);
  for (const router of routers(deps)) app.use(router.routes()).use(router.allowedMethods());
  return app;
}
