import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ListingBadges } from '../components/Badges.jsx';
import { ContactPanel } from '../components/ContactPanel.jsx';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { Gallery } from '../components/Gallery.jsx';
import { LocationMap } from '../components/LocationMap.jsx';
import { Description, Facts, Neighborhood, OpenHouse, PriceHistory, Similar } from '../components/ListingSections.jsx';
import { MortgageCalc } from '../components/MortgageCalc.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed.js';
import { useTitle } from '../hooks/useTitle.js';
import { bathsLabel, number, priceLabel } from '../lib/format.js';
import { useToast } from '../state/ToastContext.jsx';
import NotFoundPage from './NotFoundPage.jsx';

function ShareButton({ l }) {
  const { notify } = useToast();
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) return navigator.share({ title: l.address, url }).catch(() => {});
    await navigator.clipboard?.writeText(url);
    notify('Link copied', 'success');
  };
  return <button type="button" className="icon" aria-label="Share this home" onClick={share}>⇪</button>;
}

function Title({ l }) {
  return (
    <header className="listing-head">
      <div>
        <p className="price big" data-cy="detail-price">{priceLabel(l)}</p>
        <p className="facts"><span><b>{l.beds}</b> bd</span><span><b>{bathsLabel(l.baths)}</b> ba</span><span><b>{number(l.sqft)}</b> sqft</span></p>
        <h1 className="addr-title">{l.address}, {l.neighborhood}, {l.city}, {l.state} {l.zip}</h1>
      </div>
      <div className="head-actions"><FavoriteButton id={l.id} /><ShareButton l={l} /></div>
    </header>
  );
}

function Crumbs({ l }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link> › <Link to={`/homes?city=${encodeURIComponent(l.city)}`}>{l.city}</Link> › <span>{l.neighborhood}</span>
    </nav>
  );
}

function Main({ l }) {
  return (
    <div className="listing-main">
      <Facts l={l} />
      <OpenHouse l={l} />
      <Description l={l} />
      <PriceHistory l={l} />
      <section aria-label="Location"><h2>Location</h2><LocationMap listing={l} /></section>
      <Neighborhood l={l} />
    </div>
  );
}

function Side({ l }) {
  return (
    <div className="listing-side">
      <ContactPanel listing={l} />
      {l.status !== 'for_rent' && l.propertyType !== 'land' && <MortgageCalc price={l.priceUsd} hoa={l.hoaMonthly} />}
    </div>
  );
}

function useTrackView(l) {
  const { remember } = useRecentlyViewed();
  useEffect(() => remember(l.id), [l.id, remember]);
  useTitle(`${l.address}, ${l.city}`);
}

function View({ l }) {
  useTrackView(l);
  return (
    <article className="listing-page">
      <Crumbs l={l} />
      <Gallery listing={l}><ListingBadges listing={l} /></Gallery>
      <Title l={l} />
      <div className="listing-cols"><Main l={l} /><Side l={l} /></div>
      <Similar id={l.id} />
    </article>
  );
}

export default function ListingPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch((s) => api.listing(id, s), [id]);
  if (loading && !data) return <Spinner label="Loading home" />;
  if (error?.status === 404) return <NotFoundPage />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return <View l={data} />;
}
