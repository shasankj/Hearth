export const DEFAULTS = {
  status: 'for_sale', q: '', city: '', types: [], minPrice: 0, maxPrice: 0, beds: 0, baths: 0,
  minSqft: 0, maxSqft: 0, minYear: 0, features: [], openHouse: false, sort: 'newest', view: 'split',
};

export const STATUS_TABS = [['for_sale', 'Buy'], ['for_rent', 'Rent'], ['sold', 'Sold']];
export const TYPES = [['house', 'House'], ['condo', 'Condo'], ['townhouse', 'Townhouse'], ['multi_family', 'Multi-family'], ['land', 'Land']];
export const FEATURES = ['pool', 'garage', 'waterfront', 'fireplace', 'hardwood floors', 'central AC', 'in-unit laundry', 'doorman', 'rooftop deck', 'pets allowed', 'EV charger', 'garden', 'city view', 'gym', 'smart home', 'finished basement'];
export const SORTS = [['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['beds_desc', 'Most bedrooms'], ['sqft_desc', 'Largest']];
export const SALE_PRICES = [100e3, 200e3, 300e3, 400e3, 500e3, 600e3, 750e3, 1e6, 1.5e6, 2e6, 3e6];
export const RENT_PRICES = [1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500];

const NUMBERS = ['minPrice', 'maxPrice', 'beds', 'baths', 'minSqft', 'maxSqft', 'minYear'];
const LISTS = ['types', 'features'];

// URL -> filters. The URL is the single source of truth, so links are shareable and Back works.
export function parseFilters(params) {
  const f = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const raw = params.get(key);
    if (raw === null) continue;
    f[key] = coerce(key, raw);
  }
  return f;
}

function coerce(key, raw) {
  if (NUMBERS.includes(key)) return Number(raw) || 0;
  if (LISTS.includes(key)) return raw.split(',').filter(Boolean);
  return key === 'openHouse' ? raw === '1' : raw;
}

// filters -> URL (defaults are omitted to keep links short).
export function serializeFilters(f) {
  const p = new URLSearchParams();
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const v = f[key];
    if (JSON.stringify(v) === JSON.stringify(def)) continue;
    p.set(key, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  }
  return p;
}

// filters -> REST query for /api/listings
export function toQuery(f) {
  return {
    status: f.status, q: f.q, city: f.city, types: f.types.join(','), features: f.features.join(','),
    minPrice: f.minPrice, maxPrice: f.maxPrice, beds: f.beds, baths: f.baths,
    minSqft: f.minSqft, maxSqft: f.maxSqft, minYear: f.minYear, openHouse: f.openHouse ? '1' : '', sort: f.sort,
  };
}

const COUNTED = ['city', 'minPrice', 'maxPrice', 'beds', 'baths', 'minSqft', 'maxSqft', 'minYear', 'openHouse'];

// How many filters are active (shown as a badge on the mobile Filters button).
export function activeCount(f) {
  const simple = COUNTED.filter((k) => JSON.stringify(f[k]) !== JSON.stringify(DEFAULTS[k])).length;
  return simple + f.types.length + f.features.length;
}

export const priceSteps = (status) => (status === 'for_rent' ? RENT_PRICES : SALE_PRICES);
