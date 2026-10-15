import { useOnVisible } from '../hooks/useOnVisible.js';
import { ListingCard } from './ListingCard.jsx';
import { EmptyState, ErrorState, SkeletonGrid } from './States.jsx';

function Cards({ items, compare, onHover }) {
  const picked = new Set(compare.items.map((l) => l.id));
  return (
    <ul className="grid">
      {items.map((l) => <ListingCard key={l.id} listing={l} comparing={picked.has(l.id)} onCompare={compare.toggle} onHover={onHover} />)}
    </ul>
  );
}

function Footer({ results, sentinel }) {
  return (
    <div ref={sentinel} className="sentinel">
      {results.hasMore
        ? <button type="button" className="btn ghost" data-cy="load-more" disabled={results.loading} onClick={results.loadMore}>{results.loading ? 'Loading…' : 'Load more homes'}</button>
        : <p className="end">You've seen all {results.total} homes.</p>}
    </div>
  );
}

// Every state a real screen has: error, first load, empty, data (+ infinite scroll).
export function ResultsList({ results, compare, onHover, onReset }) {
  const sentinel = useOnVisible(results.loadMore, results.hasMore && !results.loading);
  if (results.error) return <ErrorState error={results.error} onRetry={results.reload} />;
  if (results.loading && results.items.length === 0) return <SkeletonGrid />;
  if (results.items.length === 0) return <EmptyState action="Clear filters" onAction={onReset} />;
  return (
    <>
      <Cards items={results.items} compare={compare} onHover={onHover} />
      <Footer results={results} sentinel={sentinel} />
    </>
  );
}
