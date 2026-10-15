import { Client, Connection } from '@temporalio/client';

const TASK_QUEUE = 'offers';

// Starts/queries/signals the Go OfferWorkflow. Field names match the Go `offer.Input` struct (JSON).
export function makeWorkflows({ address }) {
  let client;
  const get = async () => (client ??= new Client({ connection: await Connection.connect({ address }) }));
  const handle = async (id) => (await get()).workflow.getHandle(id);
  return {
    start: (offer) => start(get, offer),
    step: (id) => step(handle, id),
    approve: async (id) => (await handle(id)).signal('financing-approved'),
  };
}

async function start(get, offer) {
  const workflowId = `offer-${offer.id}`;
  const args = [{ OfferID: offer.id, ListingID: offer.listingId, BuyerID: offer.userId, AmountUSD: offer.amountUsd }];
  await (await get()).workflow.start('OfferWorkflow', { taskQueue: TASK_QUEUE, workflowId, args });
  return workflowId;
}

// A missing/old workflow must not break the offers page: show "unknown" instead.
async function step(handle, id) {
  if (!id) return 'unknown';
  try {
    return await (await handle(id)).query('status');
  } catch {
    return 'unknown';
  }
}
