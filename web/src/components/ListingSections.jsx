import { api } from '../api.js';
import { useFetch } from '../hooks/useFetch.js';
import { compact, money, number, openHouseLabel, pricePerSqft, titleCase } from '../lib/format.js';
import { FeatureChips } from './Badges.jsx';
import { ListingCard } from './ListingCard.jsx';
import { HistoryTable, PriceChart } from './PriceChart.jsx';
import { SkeletonGrid } from './States.jsx';

function Fact({ label, value }) {
  return <div className="fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

function MoreFacts({ l }) {
  const ppsf = pricePerSqft(l);
  return (
    <>
      {l.lotSqft > 0 && <Fact label="Lot" value={`${number(l.lotSqft)} sqft`} />}
      {ppsf && l.status !== 'for_rent' && <Fact label="Price / sqft" value={money(ppsf)} />}
      {l.hoaMonthly > 0 && <Fact label="HOA" value={`${money(l.hoaMonthly)}/mo`} />}
    </>
  );
}

export function Facts({ l }) {
  return (
    <dl className="facts-grid">
      <Fact label="Type" value={titleCase(l.propertyType)} />
      <Fact label="Year built" value={l.yearBuilt} />
      {l.sqft > 0 && <Fact label="Size" value={`${number(l.sqft)} sqft`} />}
      <MoreFacts l={l} />
      <Fact label="On market" value={`${l.daysOnMarket} days`} />
    </dl>
  );
}

export function OpenHouse({ l }) {
  if (!l.openHouseAt || new Date(l.openHouseAt) < new Date()) return null;
  return <p className="open-house" data-cy="open-house">📅 <b>Open house</b> {openHouseLabel(l.openHouseAt)}</p>;
}

export function Description({ l }) {
  return (
    <section aria-labelledby="about-h">
      <h2 id="about-h">About this home</h2>
      <p>{l.description}</p>
      {l.features.length > 0 && <FeatureChips features={l.features} />}
    </section>
  );
}

export function PriceHistory({ l }) {
  return (
    <section aria-labelledby="hist-h">
      <h2 id="hist-h">Price history</h2>
      <PriceChart history={l.priceHistory} />
      <HistoryTable history={l.priceHistory} />
    </section>
  );
}

function Compared({ l, stat }) {
  if (l.status === 'for_rent' || !stat) return null;
  const diff = Math.round(((l.priceUsd - stat.medianPriceUsd) / stat.medianPriceUsd) * 100);
  return <p className="compared">{Math.abs(diff)}% {diff < 0 ? 'below' : 'above'} the {l.city} median of {compact(stat.medianPriceUsd)}</p>;
}

export function Neighborhood({ l }) {
  const { data } = useFetch((s) => api.market(s), []);
  const stat = data?.cities.find((c) => c.city === l.city);
  return (
    <section aria-labelledby="hood-h">
      <h2 id="hood-h">{l.neighborhood}, {l.city}</h2>
      <Compared l={l} stat={stat} />
      {stat && <p className="hint">{stat.listings} similar-status homes in {l.city} · avg {money(Math.round(stat.avgPricePerSqft))}/sqft · avg {Math.round(stat.avgDaysOnMarket)} days on market</p>}
    </section>
  );
}

export function Similar({ id }) {
  const { data, loading } = useFetch((s) => api.similar(id, s), [id]);
  if (loading) return <SkeletonGrid count={3} />;
  if (!data?.listings.length) return null;
  return (
    <section aria-labelledby="sim-h">
      <h2 id="sim-h">Similar homes</h2>
      <ul className="grid three">{data.listings.slice(0, 3).map((l) => <ListingCard key={l.id} listing={l} />)}</ul>
    </section>
  );
}
