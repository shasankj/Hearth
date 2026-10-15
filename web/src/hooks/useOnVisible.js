import { useEffect, useRef } from 'react';

// Calls `callback` when the returned ref's element scrolls into view (infinite scroll sentinel).
export function useOnVisible(callback, enabled = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled || !ref.current || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && callback(), { rootMargin: '400px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [callback, enabled]);
  return ref;
}
