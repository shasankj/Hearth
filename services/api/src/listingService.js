import { call } from './grpcClient.js';

// Maps the validated REST query (camelCase, strings parsed) onto the gRPC SearchRequest.
export function toSearchRequest(q) {
  return {
    q: q.q ?? '', status: q.status ?? '', city: q.city ?? '', sort: q.sort ?? '',
    propertyTypes: q.types ?? [], features: q.features ?? [],
    ...ranges(q), bounds: toBounds(q), openHouseOnly: Boolean(q.openHouse),
    page: q.page ?? 1, pageSize: q.pageSize ?? 12,
  };
}

function ranges(q) {
  return {
    minPriceUsd: q.minPrice ?? 0, maxPriceUsd: q.maxPrice ?? 0, minBeds: q.beds ?? 0, minBaths: q.baths ?? 0,
    minSqft: q.minSqft ?? 0, maxSqft: q.maxSqft ?? 0, minYearBuilt: q.minYear ?? 0,
  };
}

// The map viewport is only applied when all four edges are present.
function toBounds({ north, south, east, west }) {
  return [north, south, east, west].every((v) => v !== undefined) ? { north, south, east, west } : null;
}

// ListingService is the BFF's only knowledge of the backend: easy to fake in tests.
export function makeListingService(client) {
  return {
    get: (id) => call(client, 'GetListing', { id }),
    getMany: async (ids) => (await call(client, 'GetListings', { ids })).listings,
    search: (query) => call(client, 'SearchListings', toSearchRequest(query)),
    similar: async (id, limit = 4) => (await call(client, 'SimilarListings', { id, limit })).listings,
    market: async (status = 'for_sale') => (await call(client, 'MarketStats', { status })).cities,
  };
}
