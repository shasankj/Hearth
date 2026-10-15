import { useMemo, useState } from 'react';
import { CompareTray } from '../components/Compare.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { MapPreview } from '../components/MapPreview.jsx';
import { MapView } from '../components/MapView.jsx';
import { ResultsList } from '../components/ResultsList.jsx';
import { SearchToolbar } from '../components/SearchToolbar.jsx';
import { useCompare } from '../hooks/useCompare.js';
import { useHotkey } from '../hooks/useHotkey.js';
import { useInfiniteListings } from '../hooks/useInfiniteListings.js';
import { useSearchFilters } from '../hooks/useSearchFilters.js';
import { useTitle } from '../hooks/useTitle.js';
import { toQuery } from '../lib/filters.js';

const boundsQuery = (b) => (b ? { north: b.north, south: b.south, east: b.east, west: b.west } : {});
const toPlain = (b) => ({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });

function MapPane({ results, filters, bounds, setBounds, hover }) {
  const [picked, setPicked] = useState(null);
  const listing = results.items.find((l) => l.id === picked);
  return (
    <section className="map-pane" aria-label="Map" hidden={filters.view === 'list'}>
      <MapView listings={results.items} activeId={picked ?? hover} onPick={setPicked} bounds={bounds}
        onSearchArea={(b) => setBounds(toPlain(b))} onClearArea={() => setBounds(null)} />
      {listing && <MapPreview listing={listing} onClose={() => setPicked(null)} />}
    </section>
  );
}

function Heading({ filters, total }) {
  const where = filters.city || filters.q || 'all cities';
  return <h1 className="results-title" data-cy="count">{total.toLocaleString()} homes <span>in {where}</span></h1>;
}

export default function SearchPage() {
  const { filters, update, reset } = useSearchFilters();
  const [bounds, setBounds] = useState(null);
  const [hover, setHover] = useState(null);
  const query = useMemo(() => ({ ...toQuery(filters), ...boundsQuery(bounds) }), [filters, bounds]);
  const results = useInfiniteListings(query);
  const compare = useCompare();
  const searchRef = useHotkey('/');
  useTitle(`${results.total} homes${filters.city ? ` in ${filters.city}` : ''}`);
  return (
    <div className={`search-page view-${filters.view}`}>
      <aside className="sidebar"><FilterPanel filters={filters} update={update} reset={reset} /></aside>
      <div className="results-area">
        <SearchToolbar filters={filters} update={update} reset={reset} searchRef={searchRef} />
        <Heading filters={filters} total={results.total} />
        <div className="split">
          <section className="list-pane" hidden={filters.view === 'map'}>
            <ResultsList results={results} compare={compare} onHover={setHover} onReset={() => { setBounds(null); reset(); }} />
          </section>
          <MapPane results={results} filters={filters} bounds={bounds} setBounds={setBounds} hover={hover} />
        </div>
      </div>
      <CompareTray items={compare.items} onRemove={compare.toggle} onClear={compare.clear} />
    </div>
  );
}
