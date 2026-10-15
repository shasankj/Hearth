import { useCallback, useEffect, useReducer } from 'react';
import { api } from '../api.js';

export const PAGE_SIZE = 12;
const init = (key) => ({ key, items: [], total: 0, page: 1, loading: true, error: null, attempt: 0 });

function merge(items, more) {
  const seen = new Set(items.map((l) => l.id));
  return [...items, ...more.filter((l) => !seen.has(l.id))];
}

function reducer(s, a) {
  switch (a.type) {
    case 'reset': return init(a.key);
    case 'loading': return { ...s, loading: true, error: null };
    case 'loaded': return { ...s, loading: false, total: a.total, items: a.page === 1 ? a.items : merge(s.items, a.items) };
    case 'failed': return { ...s, loading: false, error: a.error };
    // Idempotent: the scroll sentinel and the button can both fire before the request marks itself as loading.
    case 'next': return s.loading || s.items.length >= s.total ? s : { ...s, page: s.page + 1, loading: true };
    case 'reload': return { ...init(s.key), attempt: s.attempt + 1 };
    default: return s;
  }
}

function fetchPage(s, dispatch) {
  const ctrl = new AbortController();
  dispatch({ type: 'loading' });
  api.searchListings({ ...JSON.parse(s.key), page: s.page, pageSize: PAGE_SIZE }, ctrl.signal)
    .then((res) => dispatch({ type: 'loaded', page: s.page, items: res.listings, total: res.total }))
    .catch((error) => error.name !== 'AbortError' && dispatch({ type: 'failed', error }));
  return () => ctrl.abort();
}

// Paged search with "load more": resets itself whenever the query changes.
export function useInfiniteListings(query) {
  const key = JSON.stringify(query);
  const [state, dispatch] = useReducer(reducer, key, init);
  if (state.key !== key) dispatch({ type: 'reset', key }); // adjust state during render when the input changes
  useEffect(() => fetchPage(state, dispatch), [state.key, state.page, state.attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasMore = state.items.length < state.total;
  const loadMore = useCallback(() => dispatch({ type: 'next' }), []);
  const reload = useCallback(() => dispatch({ type: 'reload' }), []);
  return { ...state, hasMore, loadMore, reload };
}
