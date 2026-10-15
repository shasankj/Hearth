import Router from '@koa/router';
import { notFound } from '../errors.js';
import { PG_FOREIGN_KEY_VIOLATION } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { parse, savedSearchBody } from '../validation.js';

const userId = (ctx) => requireUser(ctx).sub;

function unknownListing(err) {
  throw err.code === PG_FOREIGN_KEY_VIOLATION ? notFound('Listing not found') : err;
}

const favoriteIds = ({ favorites }) => async (ctx) => {
  ctx.body = { ids: await favorites.ids(userId(ctx)) };
};

const favoriteListings = ({ favorites, listings }) => async (ctx) => {
  const ids = await favorites.ids(userId(ctx));
  ctx.body = { listings: ids.length ? await listings.getMany(ids) : [] };
};

const addFavorite = ({ favorites }) => async (ctx) => {
  await favorites.add(userId(ctx), ctx.params.listingId).catch(unknownListing);
  ctx.status = 204;
};

const removeFavorite = ({ favorites }) => async (ctx) => {
  await favorites.remove(userId(ctx), ctx.params.listingId);
  ctx.status = 204;
};

export function favoritesRouter(deps) {
  const router = new Router({ prefix: '/api/me/favorites' });
  router.get('/', favoriteIds(deps));
  router.get('/listings', favoriteListings(deps));
  router.put('/:listingId', addFavorite(deps));
  router.delete('/:listingId', removeFavorite(deps));
  return router;
}

const listSearches = ({ searches }) => async (ctx) => {
  ctx.body = { searches: await searches.list(userId(ctx)) };
};

const createSearch = ({ searches }) => async (ctx) => {
  ctx.status = 201;
  ctx.body = await searches.create(userId(ctx), parse(savedSearchBody, ctx.request.body));
};

const toggleAlerts = ({ searches }) => async (ctx) => {
  const ok = await searches.setAlerts(userId(ctx), ctx.params.id, Boolean(ctx.request.body?.alerts));
  if (!ok) throw notFound('Saved search not found');
  ctx.status = 204;
};

const deleteSearch = ({ searches }) => async (ctx) => {
  if (!(await searches.remove(userId(ctx), ctx.params.id))) throw notFound('Saved search not found');
  ctx.status = 204;
};

export function searchesRouter(deps) {
  const router = new Router({ prefix: '/api/me/saved-searches' });
  router.get('/', listSearches(deps));
  router.post('/', createSearch(deps));
  router.patch('/:id', toggleAlerts(deps));
  router.delete('/:id', deleteSearch(deps));
  return router;
}

// Everything the "My activity" page needs, in one round trip.
const activity = ({ tours, inquiries, offerService }) => async (ctx) => {
  const user = requireUser(ctx);
  const [t, i, o] = await Promise.all([tours.byUser(user.sub), inquiries.byUser(user.sub), offerService.listMine(user)]);
  ctx.body = { tours: t, inquiries: i, offers: o };
};

export function activityRouter(deps) {
  const router = new Router({ prefix: '/api/me/activity' });
  router.get('/', activity(deps));
  return router;
}
