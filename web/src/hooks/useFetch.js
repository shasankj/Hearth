import { useCallback, useEffect, useState } from 'react';

const LOADING = { data: null, loading: true, error: null };

// Starts the request and returns its cleanup, so a newer request cancels an older one (no stale results).
function run(fetcher, setState) {
  const ctrl = new AbortController();
  setState((s) => ({ ...s, loading: true, error: null }));
  fetcher(ctrl.signal)
    .then((data) => setState({ data, loading: false, error: null }))
    .catch((error) => error.name !== 'AbortError' && setState({ data: null, loading: false, error }));
  return () => ctrl.abort();
}

// Generic "load one resource" hook: { data, loading, error, reload }. Re-runs when `deps` change.
export function useFetch(fetcher, deps) {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => run(fetcher, setState), [...deps, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
