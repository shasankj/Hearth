const full = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const short = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dayTime = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const money = (n) => full.format(n);
export const compact = (n) => short.format(n);
export const number = (n) => new Intl.NumberFormat('en-US').format(n);
export const shortDate = (iso) => day.format(new Date(iso));

// Rent listings store the MONTHLY rent in price_usd.
export const priceLabel = (l) => (l.status === 'for_rent' ? `${money(l.priceUsd)}/mo` : money(l.priceUsd));
export const pricePerSqft = (l) => (l.sqft > 0 ? Math.round(l.priceUsd / l.sqft) : null);
export const bathsLabel = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function listedAgo(days) {
  if (days <= 0) return 'Listed today';
  return days === 1 ? 'Listed yesterday' : `Listed ${days} days ago`;
}

// "Sun, Oct 18, 1:00 PM" for an ISO timestamp (empty string if none).
export const openHouseLabel = (iso) => (iso ? dayTime.format(new Date(iso)) : '');

export const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
