import { createApp } from './app.js';
import { makeTokens } from './auth/token.js';
import { makeInspectionClient } from './clients/inspection.js';
import { makeWorkflows } from './clients/workflows.js';
import { assertSafe, loadConfig } from './config.js';
import { makePool } from './db.js';
import { loadClient } from './grpcClient.js';
import { makeListingService } from './listingService.js';
import { makeFavoritesRepo } from './repos/favorites.js';
import { makeInquiriesRepo } from './repos/inquiries.js';
import { makeOffersRepo } from './repos/offers.js';
import { makeSearchesRepo } from './repos/searches.js';
import { makeToursRepo } from './repos/tours.js';
import { makeUsersRepo } from './repos/users.js';
import { makeAuthService } from './services/auth.js';
import { makeOfferService } from './services/offers.js';

function repos(pool) {
  return {
    favorites: makeFavoritesRepo(pool), searches: makeSearchesRepo(pool), inquiries: makeInquiriesRepo(pool),
    tours: makeToursRepo(pool), users: makeUsersRepo(pool), offers: makeOffersRepo(pool),
  };
}

// The composition root: the ONLY place that knows which concrete implementations are used.
function buildDeps(config) {
  const pool = makePool(config.databaseUrl);
  const { users, offers, ...rest } = repos(pool);
  const listings = makeListingService(loadClient(config.listingAddr));
  const workflows = makeWorkflows({ address: config.temporalAddress });
  return {
    config, pool, listings, ...rest, tokens: makeTokens(config.jwtSecret), log: console.log,
    auth: makeAuthService({ users, rounds: config.bcryptRounds }),
    inspection: makeInspectionClient({ baseUrl: config.inspectionUrl }),
    offerService: makeOfferService({ offers, listings, workflows }),
  };
}

const config = assertSafe(loadConfig());
const deps = buildDeps(config);
const server = createApp(deps).listen(config.port, () => console.log(`api listening on ${config.port}`));

// Graceful shutdown: stop accepting, let in-flight requests finish, close the pool (k8s sends SIGTERM).
process.on('SIGTERM', () => server.close(() => deps.pool.end().then(() => process.exit(0))));
