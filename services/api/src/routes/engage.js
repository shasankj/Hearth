import Router from '@koa/router';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { inquiryBody, offerBody, parse, tourBody } from '../validation.js';
import { PG_FOREIGN_KEY_VIOLATION } from '../db.js';
import { notFound } from '../errors.js';

const missingListing = (err) => {
  throw err.code === PG_FOREIGN_KEY_VIOLATION ? notFound('Listing not found') : err;
};

// Anyone may contact an agent; if signed in, the inquiry is attached to their account.
export function inquiriesRouter({ inquiries }) {
  const router = new Router({ prefix: '/api/inquiries' });
  router.post('/', rateLimit({ windowMs: 60_000, max: 10 }), async (ctx) => {
    const body = parse(inquiryBody, ctx.request.body);
    ctx.status = 201;
    ctx.body = await inquiries.create(ctx.state.user?.sub ?? null, body).catch(missingListing);
  });
  return router;
}

// The BFF forwards to the Java inspection service; the UNIQUE(listing_id, date) constraint decides conflicts.
export function toursRouter({ inspection }) {
  const router = new Router({ prefix: '/api/tours' });
  router.post('/', async (ctx) => {
    const body = parse(tourBody, ctx.request.body);
    ctx.status = 201;
    ctx.body = await inspection.book({ ...body, userId: ctx.state.user?.sub });
  });
  return router;
}

const submitOffer = ({ offerService }) => async (ctx) => {
  const input = parse(offerBody, ctx.request.body);
  ctx.status = 201;
  ctx.body = await offerService.submit(requireUser(ctx), input);
};

const approveFinancing = ({ offerService }) => async (ctx) => {
  await offerService.approveFinancing(requireUser(ctx), ctx.params.id);
  ctx.status = 202;
};

export function offersRouter(deps) {
  const router = new Router({ prefix: '/api/offers' });
  router.post('/', submitOffer(deps));
  router.post('/:id/approve-financing', approveFinancing(deps));
  return router;
}
