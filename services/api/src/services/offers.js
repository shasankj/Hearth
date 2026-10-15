import { HttpError, conflict, badRequest, notFound } from '../errors.js';

const MIN_FRACTION = 0.5; // sanity guard: offers under 50% of asking are almost certainly typos

function assertOpen(listing, input) {
  if (listing.status !== 'for_sale') throw conflict('This home is not accepting offers');
  if (input.amountUsd < listing.priceUsd * MIN_FRACTION) throw badRequest('That offer is far below the asking price. Check the amount.');
}

// Saga-style: row first, then the workflow; if starting the workflow fails, undo the row.
async function startOrRollback({ offers, workflows }, offer) {
  try {
    const workflowId = await workflows.start(offer);
    await offers.setWorkflow(offer.id, workflowId);
    return { ...offer, workflowId, step: 'submitted' };
  } catch (err) {
    await offers.remove(offer.id);
    throw new HttpError(503, 'Offers are temporarily unavailable. Please try again.');
  }
}

async function submit(deps, user, input) {
  assertOpen(await deps.listings.get(input.listingId), input);
  const id = await deps.offers.create({ ...input, userId: user.sub });
  return startOrRollback(deps, { ...input, id, userId: user.sub });
}

async function listMine({ offers, workflows }, user) {
  const rows = await offers.byUser(user.sub);
  return Promise.all(rows.map(async (o) => ({ ...o, step: await workflows.step(o.workflowId) })));
}

async function approveFinancing({ offers, workflows }, user, offerId) {
  const offer = await offers.byId(offerId, user.sub);
  if (!offer?.workflowId) throw notFound('Offer not found');
  await workflows.approve(offer.workflowId);
}

export function makeOfferService(deps) {
  return {
    submit: (user, input) => submit(deps, user, input),
    listMine: (user) => listMine(deps, user),
    approveFinancing: (user, id) => approveFinancing(deps, user, id),
  };
}
