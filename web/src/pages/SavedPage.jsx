import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed.js';
import { useTitle } from '../hooks/useTitle.js';
import { compact, titleCase } from '../lib/format.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useFavorites } from '../state/FavoritesContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

function Homes({ ids, empty }) {
  const key = ids.join(',');
  const { data, loading, error, reload } = useFetch((s) => (ids.length ? api.byIds(ids, s) : Promise.resolve({ listings: [] })), [key]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonGrid count={3} />;
  if (!data.listings.length) return <EmptyState title={empty.title} hint={empty.hint} />;
  const order = new Map(ids.map((id, i) => [id, i]));
  return <ul className="grid">{[...data.listings].sort((a, b) => order.get(a.id) - order.get(b.id)).map((l) => <ListingCard key={l.id} listing={l} />)}</ul>;
}

// A saved search stores the API query; the same keys are valid URL params, so "View results" is just a link.
const toUrl = (query) => new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== 0)).toString();

function summary(q) {
  const parts = [titleCase(q.status ?? 'for_sale'), q.city, q.q && `“${q.q}”`, q.beds && `${q.beds}+ bd`, q.maxPrice && `up to ${compact(q.maxPrice)}`, q.types];
  return parts.filter(Boolean).join(' · ');
}

function useRowActions(s, onChange) {
  const { notify } = useToast();
  const toggle = async (e) => { await api.setSearchAlerts(s.id, e.target.checked); onChange(); };
  const remove = async () => { await api.deleteSearch(s.id); notify('Search deleted'); onChange(); };
  return { toggle, remove };
}

function SearchRow({ s, onChange }) {
  const { toggle, remove } = useRowActions(s, onChange);
  return (
    <li className="search-row" data-cy="saved-search">
      <div><b>{s.name}</b><small>{summary(s.query)}</small></div>
      <label className="check"><input type="checkbox" checked={s.alerts} onChange={toggle} /> Email alerts</label>
      <Link className="btn small" to={`/homes?${toUrl(s.query)}`}>View results</Link>
      <button type="button" className="link" onClick={remove}>Delete</button>
    </li>
  );
}

function Searches() {
  const { user } = useAuth();
  const { data, loading, reload } = useFetch((s) => (user ? api.savedSearches(s) : Promise.resolve({ searches: [] })), [user?.id]);
  if (!user) return <EmptyState title="Sign in to save searches" hint="Saved searches can email you when new homes match." action="Sign in" onAction={() => { window.location.href = '/login'; }} />;
  if (loading && !data) return <SkeletonGrid count={2} />;
  if (!data.searches.length) return <EmptyState title="No saved searches" hint="Run a search and press “Save search”." />;
  return <ul className="search-list">{data.searches.map((s) => <SearchRow key={s.id} s={s} onChange={reload} />)}</ul>;
}

const TABS = [['homes', 'Saved homes'], ['searches', 'Saved searches'], ['recent', 'Recently viewed']];

export default function SavedPage() {
  const [tab, setTab] = useState('homes');
  const { ids } = useFavorites();
  const { ids: recent } = useRecentlyViewed();
  useTitle('Saved');
  return (
    <section className="page">
      <h1>Your saved</h1>
      <div className="tabs" role="tablist">{TABS.map(([v, t]) => <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'tab on' : 'tab'} onClick={() => setTab(v)}>{t}</button>)}</div>
      {tab === 'homes' && <Homes ids={ids} empty={{ title: 'No saved homes yet', hint: 'Tap the heart on any home to keep it here.' }} />}
      {tab === 'searches' && <Searches />}
      {tab === 'recent' && <Homes ids={recent} empty={{ title: 'Nothing viewed yet', hint: 'Homes you open will show up here.' }} />}
    </section>
  );
}
