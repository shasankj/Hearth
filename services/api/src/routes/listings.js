import Router from '@koa/router';
import { batchQuery, parse, searchQuery } from '../validation.js';

const search = ({ listings }) => async (ctx) => {
  ctx.body = await listings.search(parse(searchQuery, ctx.query));
};

// Public batch lookup (saved / recently viewed homes for signed-out visitors). Registered BEFORE "/:id".
const batch = ({ listings }) => async (ctx) => {
  const ids = parse(batchQuery, ctx.query).ids;
  ctx.body = { listings: ids.length ? await listings.getMany(ids) : [] };
};

const detail = ({ listings }) => async (ctx) => {
  ctx.body = await listings.get(ctx.params.id);
};

const similar = ({ listings }) => async (ctx) => {
  ctx.body = { listings: await listings.similar(ctx.params.id) };
};

export function listingsRouter(deps) {
  const router = new Router({ prefix: '/api/listings' });
  router.get('/', search(deps));
  router.get('/batch', batch(deps));
  router.get('/:id', detail(deps));
  router.get('/:id/similar', similar(deps));
  return router;
}

export function marketRouter({ listings }) {
  const router = new Router({ prefix: '/api/market' });
  router.get('/', async (ctx) => {
    ctx.set('Cache-Control', 'public, max-age=60'); // aggregate stats change slowly: let browsers/CDN cache
    ctx.body = { cities: await listings.market(ctx.query.status) };
  });
  return router;
}
