import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage.js';

const MAX = 12;

// Remembers the last homes you looked at (browser only, newest first, no duplicates).
export function useRecentlyViewed() {
  const [ids, setIds] = useLocalStorage('hearth:recent', []);
  const remember = useCallback((id) => setIds((cur) => [id, ...cur.filter((x) => x !== id)].slice(0, MAX)), [setIds]);
  return { ids, remember };
}
