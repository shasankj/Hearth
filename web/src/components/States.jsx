export function SkeletonGrid({ count = 6 }) {
  return (
    <ul className="grid" aria-busy="true" aria-label="Loading homes">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card skeleton" aria-hidden="true"><div className="sk-cover" /><div className="sk-line" /><div className="sk-line short" /></li>
      ))}
    </ul>
  );
}

export function EmptyState({ title = 'No homes match yet', hint = 'Try a wider price range or fewer filters.', action, onAction }) {
  return (
    <div className="state" data-cy="empty">
      <div className="state-art" aria-hidden="true">⌂</div>
      <h2>{title}</h2>
      <p>{hint}</p>
      {onAction && <button type="button" className="btn" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="state-art bad" aria-hidden="true">!</div>
      <h2>We couldn't load that</h2>
      <p>{error.message}</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <p className="spinner" role="status">{label}…</p>;
}
