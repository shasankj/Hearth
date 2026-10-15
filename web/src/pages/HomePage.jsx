import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { SearchBar } from '../components/SearchBar.jsx';
import { SkeletonGrid } from '../components/States.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useTitle } from '../hooks/useTitle.js';
import { compact, number } from '../lib/format.js';

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero">
      <p className="eyebrow">Buy · Rent · Sell</p>
      <h1>Find the home that feels like <span className="ember">yours</span>.</h1>
      <p className="lede">Search real-time listings, compare homes, book tours and make offers, all in one place.</p>
      <SearchBar large onSubmit={(q) => navigate(`/homes?q=${encodeURIComponent(q)}`)} />
      <p className="hint">Try “Boston”, “Seattle condo”, or a neighborhood like “Ballard”.</p>
    </section>
  );
}

function CityTile({ stat }) {
  return (
    <Link className="city-tile" to={`/homes?city=${encodeURIComponent(stat.city)}`} data-cy="city-tile">
      <b>{stat.city}</b>
      <span>{stat.listings} homes · median {compact(stat.medianPriceUsd)}</span>
    </Link>
  );
}

function Cities() {
  const { data } = useFetch((s) => api.market(s), []);
  if (!data) return null;
  return (
    <section className="band" aria-labelledby="cities-h">
      <h2 id="cities-h">Explore cities</h2>
      <div className="city-grid">{data.cities.map((c) => <CityTile key={c.city} stat={c} />)}</div>
    </section>
  );
}

function Row({ title, query, to }) {
  const { data, loading } = useFetch((s) => api.searchListings({ ...query, pageSize: 4 }, s), [JSON.stringify(query)]);
  if (loading && !data) return <section className="band"><h2>{title}</h2><SkeletonGrid count={4} /></section>;
  if (!data?.listings.length) return null;
  return (
    <section className="band">
      <div className="band-head"><h2>{title}</h2><Link to={to}>See all →</Link></div>
      <ul className="grid">{data.listings.map((l) => <ListingCard key={l.id} listing={l} />)}</ul>
    </section>
  );
}

function Stats() {
  const { data } = useFetch((s) => api.market(s), []);
  const total = data?.cities.reduce((n, c) => n + c.listings, 0) ?? 0;
  return (
    <ul className="stats" aria-label="Marketplace at a glance">
      <li><b>{number(total)}</b> homes for sale</li>
      <li><b>{data?.cities.length ?? 0}</b> cities</li>
      <li><b>24/7</b> online tours & offers</li>
    </ul>
  );
}

export default function HomePage() {
  useTitle('');
  return (
    <>
      <Hero />
      <Stats />
      <Row title="Just listed" query={{ sort: 'newest' }} to="/homes?sort=newest" />
      <Row title="Open houses this week" query={{ openHouse: '1' }} to="/homes?openHouse=1" />
      <Cities />
      <Row title="Rentals" query={{ status: 'for_rent' }} to="/homes?status=for_rent" />
    </>
  );
}
