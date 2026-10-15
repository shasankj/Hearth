import { memo } from 'react';
import { Link } from 'react-router-dom';
import { bathsLabel, listedAgo, number, priceLabel } from '../lib/format.js';
import { ListingBadges, dropPct, openHouseText } from './Badges.jsx';
import { FavoriteButton } from './FavoriteButton.jsx';
import { Photo } from './Scenes.jsx';

function Facts({ l }) {
  return (
    <p className="facts">
      {l.beds > 0 && <span><b>{l.beds}</b> bd</span>}
      {l.baths > 0 && <span><b>{bathsLabel(l.baths)}</b> ba</span>}
      {l.sqft > 0 && <span><b>{number(l.sqft)}</b> sqft</span>}
      {l.propertyType === 'land' && <span>Lot</span>}
    </p>
  );
}

function PriceLine({ l }) {
  const drop = dropPct(l) > 0;
  return (
    <p className="price-line">
      <span className="price">{priceLabel(l)}</span>
      {drop && <s className="was">{priceLabel({ ...l, priceUsd: l.previousPriceUsd })}</s>}
    </p>
  );
}

function CompareToggle({ on, onChange }) {
  return (
    <label className={on ? 'compare on' : 'compare'}>
      <input type="checkbox" data-cy="compare" checked={on} onChange={onChange} /> Compare
    </label>
  );
}

// memo: skip re-rendering a card unless its own props change (callbacks are stable via useCallback).
export const ListingCard = memo(function ListingCard({ listing: l, comparing, onCompare, onHover }) {
  return (
    <li data-cy="listing" className="card" onMouseEnter={() => onHover?.(l.id)} onMouseLeave={() => onHover?.(null)}>
      <Link to={`/homes/${l.id}`} className="card-link" aria-label={`${l.address}, ${l.city}`}>
        <div className="media"><Photo listing={l} kind="exterior" /><ListingBadges listing={l} /></div>
        <div className="body">
          <PriceLine l={l} />
          <Facts l={l} />
          <p className="addr">{l.address}, {l.neighborhood}, {l.city}</p>
          <p className="meta">{openHouseText(l) || listedAgo(l.daysOnMarket)}</p>
        </div>
      </Link>
      <FavoriteButton id={l.id} />
      {onCompare && <CompareToggle on={comparing} onChange={() => onCompare(l)} />}
    </li>
  );
});
