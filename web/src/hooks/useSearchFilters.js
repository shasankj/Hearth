import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULTS, parseFilters, serializeFilters } from '../lib/filters.js';

// Filters live in the URL: shareable links, working Back button, survives refresh.
export function useSearchFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const update = useCallback((patch) => setParams(serializeFilters({ ...filters, ...patch }), { replace: true }), [filters, setParams]);
  const reset = useCallback(() => update({ ...DEFAULTS, status: filters.status, view: filters.view, q: '' }), [update, filters.status, filters.view]);
  return { filters, update, reset };
}
