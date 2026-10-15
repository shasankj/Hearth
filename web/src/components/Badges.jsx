import { openHouseLabel, titleCase } from '../lib/format.js';

const STATUS_TEXT = { for_rent: 'For rent', pending: 'Pending', sold: 'Sold' };

export function dropPct(l) {
  if (!l.previousPriceUsd || l.previousPriceUsd <= l.priceUsd) return 0;
  return Math.round(((l.previousPriceUsd - l.priceUsd) / l.previousPriceUsd) * 100);
}

const hasOpenHouse = (l) => l.openHouseAt && new Date(l.openHouseAt) > new Date();

function Badge({ tone, children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

// Status, freshness, price drop and open house at a glance.
export function ListingBadges({ listing }) {
  const drop = dropPct(listing);
  const isNew = listing.status === 'for_sale' && listing.daysOnMarket <= 7;
  return (
    <div className="badges">
      {STATUS_TEXT[listing.status] && <Badge tone={listing.status}>{STATUS_TEXT[listing.status]}</Badge>}
      {isNew && <Badge tone="new">New</Badge>}
      {drop > 0 && <Badge tone="drop">↓ {drop}% price drop</Badge>}
      {hasOpenHouse(listing) && <Badge tone="open">Open house</Badge>}
    </div>
  );
}

export function FeatureChips({ features }) {
  return <ul className="feature-chips">{features.map((f) => <li key={f}>{titleCase(f)}</li>)}</ul>;
}

export const openHouseText = (l) => (hasOpenHouse(l) ? `Open house ${openHouseLabel(l.openHouseAt)}` : '');
